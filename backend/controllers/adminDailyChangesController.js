const Order = require('../models/Order');
const SocialOrder = require('../models/SocialOrder');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

const DAY = 86400000;
const LAGOS_OFFSET = 3600000;
const PROVIDERS = ['smsbower', 'benotp', 'loggsplug', 'samehasocialhub'];

function dayStart(date) {
  const lagos = new Date(date.getTime() + LAGOS_OFFSET);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - LAGOS_OFFSET);
}
function dateKey(date) {
  return new Date(new Date(date).getTime() + LAGOS_OFFSET).toISOString().slice(0, 10);
}
function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function blank() {
  return { revenue: 0, profit: 0, cost: 0, orders: 0 };
}
function addOrder(target, order) {
  const revenue = money(order.sellingPrice ?? order.price);
  const cost = money(order.providerCostNgn);
  const profit = order.profit == null ? revenue - cost : money(order.profit);
  target.revenue += revenue;
  target.cost += cost;
  target.profit += profit;
  target.orders += 1;
}
function addTotals(target, source) {
  for (const field of ['revenue', 'profit', 'cost', 'orders']) target[field] += source[field];
}
function earnedNumber(order) {
  return !order.refunded && order.financialStatus !== 'refunded' &&
    (order.financialStatus === 'earned' || order.status === 'received');
}
function earnedSocial(order) {
  return order.status === 'completed' && order.refunded !== true;
}

exports.getDailyChanges = async (req, res) => {
  try {
    const days = Number(req.query.days ?? 7);
    if (![7, 14, 30].includes(days)) {
      return res.status(400).json({ success: false, message: 'days must be 7, 14, or 30' });
    }

    const now = new Date();
    const today = dayStart(now);
    const start = new Date(today.getTime() - (days - 1) * DAY);
    const end = new Date(today.getTime() + DAY);
    const rows = Array.from({ length: days }, (_, index) => ({
      date: dateKey(new Date(start.getTime() + index * DAY)),
      overall: blank(),
      numbers: { ...blank(), receivedOtp: 0 },
      accounts: blank(),
      platform: { users: 0, usersBalanceChange: 0, usersBalance: null },
      providers: Object.fromEntries(PROVIDERS.map((provider) => [provider, null])),
    }));
    const byDay = new Map(rows.map((row) => [row.date, row]));

    const [numberOrders, socialOrders, users, wallets] = await Promise.all([
      Order.find({ createdAt: { $gte: start, $lt: end } })
        .select('createdAt refunded financialStatus status otpReceivedAt sellingPrice price providerCostNgn profit').lean(),
      SocialOrder.find({ createdAt: { $gte: start, $lt: end } })
        .select('createdAt completedAt refunded status sellingPrice providerCostNgn profit').lean(),
      User.find({ createdAt: { $gte: start, $lt: end } }).select('createdAt').lean(),
      Wallet.find({}).select('balance transactions').lean(),
    ]);

    for (const user of users) {
      if (!user.createdAt) continue;
      const row = byDay.get(dateKey(user.createdAt));
      if (row) row.platform.users += 1;
    }

    for (const order of numberOrders) {
      if (!order.createdAt) continue;
      const row = byDay.get(dateKey(order.createdAt));
      if (!row) continue;
      if (order.status === 'received' || order.otpReceivedAt) row.numbers.receivedOtp += 1;
      if (!earnedNumber(order)) continue;
      addOrder(row.numbers, order);
      addOrder(row.overall, order);
    }

    for (const order of socialOrders) {
      if (!order.createdAt || !earnedSocial(order)) continue;
      const row = byDay.get(dateKey(order.createdAt));
      if (!row) continue;
      addOrder(row.accounts, order);
      addOrder(row.overall, order);
    }

    let currentBalance = 0;
    const dailyDeltas = new Map();
    const dailyDeposits = new Map();
    for (const wallet of wallets) {
      currentBalance += money(wallet.balance);
      for (const transaction of wallet.transactions || []) {
        if (!transaction.createdAt || transaction.status !== 'completed') continue;
        if (transaction.environment === 'test' || transaction.balanceField === 'testBalance') continue;
        const key = dateKey(transaction.createdAt);
        const value = money(transaction.amount);
        const direction = { deposit: 1, refund: 1, purchase: -1, withdraw: -1 }[transaction.type];
        if (direction) {
          dailyDeltas.set(key, (dailyDeltas.get(key) || 0) + direction * value);
        }
        if (transaction.type === 'deposit') {
          dailyDeposits.set(key, (dailyDeposits.get(key) || 0) + value);
        }
      }
    }

    // Closing balances use net wallet movements. Deposit cards use deposits only.
    let closingBalance = currentBalance;
    for (const row of [...rows].reverse()) {
      const netChange = dailyDeltas.get(row.date) || 0;
      row.platform.usersBalance = closingBalance;
      row.platform.usersBalanceChange = dailyDeposits.get(row.date) || 0;
      closingBalance -= netChange;
    }

    const daily = rows.reverse();
    const totals = {
      numbers: { ...blank(), receivedOtp: 0 },
      overall: blank(),
      accounts: blank(),
      platform: { users: 0, usersBalanceChange: 0, usersBalance: currentBalance },
      providers: Object.fromEntries(PROVIDERS.map((provider) => [provider, null])),
    };
    for (const row of daily) {
      addTotals(totals.numbers, row.numbers);
      totals.numbers.receivedOtp += row.numbers.receivedOtp;
      addTotals(totals.accounts, row.accounts);
      addTotals(totals.overall, row.overall);
      totals.platform.users += row.platform.users;
      totals.platform.usersBalanceChange += row.platform.usersBalanceChange;
    }

    return res.json({
      success: true,
      days,
      today: dateKey(today),
      timezone: 'Africa/Lagos',
      currency: 'NGN',
      daily,
      totals,
      availability: {
        overall: 'Combined completed, non-refunded Numbers and Accounts & VPNs purchases',
        accounts: 'Connected to SocialOrder: completed and non-refunded orders, grouped by creation date',
        providers: 'Historical provider balance changes require persisted balance snapshots',
        usersBalance: 'Historical live wallet balances estimated from current balances and completed live wallet transactions',
        usersBalanceChange: 'Total completed live wallet deposits on each date; excludes refunds, purchases and withdrawals',
      },
    });
  } catch (error) {
    console.error('Admin daily changes error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load daily changes' });
  }
};