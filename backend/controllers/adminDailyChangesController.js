const Order = require('../models/Order');
const SocialOrder = require('../models/SocialOrder');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const ProviderBalanceSnapshot = require('../models/ProviderBalanceSnapshot');
const { createResponseCache } = require('../utils/responseCache');

const DAY = 86400000;
const LAGOS_OFFSET = 3600000; // Africa/Lagos is UTC+1 all year (no DST)
const PROVIDERS = ['smsbower', 'benotp', 'loggsplug', 'samehasocialhub'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const lagosToday = () => new Date(Date.now() + LAGOS_OFFSET).toISOString().slice(0, 10);
const shiftDay = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
// Lagos midnight that starts `ymd`, as a UTC instant.
const dayStart = (ymd) => new Date(Date.parse(`${ymd}T00:00:00Z`) - LAGOS_OFFSET);
const dateKey = (date) => new Date(new Date(date).getTime() + LAGOS_OFFSET).toISOString().slice(0, 10);
const money = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round = (value) => Number(money(value).toFixed(2));

function earnedNumber(order) {
  return !order.refunded && order.financialStatus !== 'refunded' &&
    (order.financialStatus === 'earned' || order.status === 'received');
}
function spentNumber(order) {
  return !order.refunded && order.financialStatus !== 'refunded' &&
    !['expired', 'cancelled'].includes(order.status);
}
function earnedSocial(order) {
  return order.status === 'completed' && order.refunded !== true;
}
function spentSocial(order) {
  return order.refunded !== true && !['failed', 'refunded'].includes(order.status);
}
function addEarned(target, order) {
  const revenue = money(order.sellingPrice ?? order.price);
  const cost = money(order.providerCostNgn);
  target.revenue += revenue;
  target.cost += cost;
  target.profit += order.profit == null ? revenue - cost : money(order.profit);
}

// Live wallet movements that count toward users' balance.
const LIVE = {
  environment: { $ne: 'test' },
  balanceField: { $ne: 'testBalance' },
};
const LIVE_COMPLETED = { ...LIVE, status: 'completed' };
// A purchase debits the wallet when it's reserved. A failed one stays marked
// "failed" and is given back by a separate refund row, so every purchase
// counts here, whatever its status.
const BALANCE_MOVEMENT = { ...LIVE, $or: [
  { type: 'purchase' },
  { type: { $in: ['deposit', 'refund', 'withdraw'] }, status: 'completed' },
] };

// Reports are cached briefly; the dashboard's refresh button sends fresh=1.
const cachedReport = createResponseCache(60000);

/*
 * GET /api/admin/daily-changes?date=YYYY-MM-DD&days=14
 *
 * The dashboard's metrics for one Lagos day plus the `days` before it (for
 * the change vs the previous day and the trend table). Oldest first; the last
 * row is `date`. Every day is present, with zeros on a quiet day.
 */
exports.getDailyChanges = async (req, res) => {
  try {
    const today = lagosToday();
    let date = String(req.query.date || today);
    if (!YMD.test(date) || Number.isNaN(Date.parse(date))) {
      return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
    }
    if (date > today) date = today;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 90);

    const report = await cachedReport(`${date}:${days}`, () => buildDailyChanges(date, days, today), {
      fresh: req.query.fresh === '1',
    });
    return res.json(report);
  } catch (error) {
    console.error('Admin daily changes error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load daily changes' });
  }
};

async function buildDailyChanges(date, days, today) {
  const from = shiftDay(date, -days);
  const start = dayStart(from);
  const end = dayStart(shiftDay(date, 1));
  const rows = Array.from({ length: days + 1 }, (_, index) => ({
    date: shiftDay(from, index),
    numbers: { orders: 0, received: 0, revenue: 0, cost: 0, profit: 0 },
    socials: { orders: 0, completed: 0, revenue: 0, cost: 0, profit: 0 },
    newUsers: 0,
    usersTotal: 0,
    balance: { deposits: 0, totalDeposits: 0, spent: 0, net: 0, closing: null },
    providers: Object.fromEntries(PROVIDERS.map((provider) => [provider, null])),
  }));
  const byDay = new Map(rows.map((row) => [row.date, row]));

  const [numberOrders, socialOrders, newUsers, usersBefore, balanceTotals, movements, depositsBefore, snapshots] = await Promise.all([
    Order.find({ createdAt: { $gte: start, $lt: end } })
      .select('createdAt refunded financialStatus status otpReceivedAt sellingPrice price providerCostNgn profit').lean(),
    SocialOrder.find({ createdAt: { $gte: start, $lt: end } })
      .select('createdAt refunded status sellingPrice providerCostNgn profit').lean(),
    User.find({ createdAt: { $gte: start, $lt: end } }).select('createdAt').lean(),
    User.countDocuments({ createdAt: { $lt: start } }),
    Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]),
    // Every movement from the window's start up to now: the window's days
    // need them, and so does walking the live balance back to each closing.
    Wallet.aggregate([
      { $match: { 'transactions.createdAt': { $gte: start } } },
      { $unwind: '$transactions' },
      { $replaceRoot: { newRoot: '$transactions' } },
      { $match: { ...BALANCE_MOVEMENT, createdAt: { $gte: start } } },
      { $group: {
        _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+01:00' } }, type: '$type' },
        total: { $sum: '$amount' },
      } },
    ]),
    Wallet.aggregate([
      { $unwind: '$transactions' },
      { $replaceRoot: { newRoot: '$transactions' } },
      { $match: { ...LIVE_COMPLETED, type: 'deposit', createdAt: { $lt: start } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // A month further back so the first day's balance has a previous snapshot.
    ProviderBalanceSnapshot.find({ date: { $gte: shiftDay(from, -31), $lte: date } })
      .select('provider date balance currency').sort({ date: 1 }).lean(),
  ]);

  for (const user of newUsers) {
    const row = byDay.get(dateKey(user.createdAt));
    if (row) row.newUsers += 1;
  }

  for (const order of numberOrders) {
    const row = byDay.get(dateKey(order.createdAt));
    if (!row) continue;
    row.numbers.orders += 1;
    if (order.status === 'received' || order.otpReceivedAt) row.numbers.received += 1;
    if (earnedNumber(order)) addEarned(row.numbers, order);
    if (spentNumber(order)) row.balance.spent += money(order.sellingPrice ?? order.price);
  }

  for (const order of socialOrders) {
    const row = byDay.get(dateKey(order.createdAt));
    if (!row) continue;
    row.socials.orders += 1;
    if (earnedSocial(order)) {
      row.socials.completed += 1;
      addEarned(row.socials, order);
    }
    if (spentSocial(order)) row.balance.spent += money(order.sellingPrice);
  }

  // net = what users' balances moved by that day: deposits and refunds in,
  // purchases and withdrawals out.
  const netByDay = new Map();
  for (const { _id: { date: key, type }, total } of movements) {
    const value = money(total);
    netByDay.set(key, (netByDay.get(key) || 0) + { deposit: 1, refund: 1, purchase: -1, withdraw: -1 }[type] * value);
    const row = byDay.get(key);
    if (row && type === 'deposit') row.balance.deposits += value;
  }

  // Running totals at the end of each day.
  let usersTotal = usersBefore;
  let totalDeposits = money(depositsBefore[0]?.total);
  for (const row of rows) {
    usersTotal += row.newUsers;
    totalDeposits += row.balance.deposits;
    row.usersTotal = usersTotal;
    row.balance.totalDeposits = totalDeposits;
    row.balance.net = netByDay.get(row.date) || 0;
  }

  // Closing balance per day. There's no balance history, so walk back from the
  // live wallet total: closing(D) = live − net of every day after D.
  let closing = money(balanceTotals[0]?.total);
  for (let key = today; key > date; key = shiftDay(key, -1)) closing -= netByDay.get(key) || 0;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    rows[index].balance.closing = closing;
    closing -= rows[index].balance.net;
  }

  // Provider balances from the snapshots saved when the admin dashboard is
  // opened; change is against that provider's previous snapshot. A day with
  // no snapshot shows the latest earlier one, dated by `asOf`, with no change.
  const byProvider = {};
  for (const snapshot of snapshots) (byProvider[snapshot.provider] ||= []).push(snapshot);
  for (const [provider, list] of Object.entries(byProvider)) {
    let index = -1;
    for (const row of rows) {
      while (index + 1 < list.length && list[index + 1].date <= row.date) index += 1;
      const snapshot = list[index];
      if (!snapshot) continue;
      const before = list[index - 1];
      const sameDay = snapshot.date === row.date;
      row.providers[provider] = {
        balance: round(snapshot.balance),
        currency: snapshot.currency,
        asOf: snapshot.date,
        change: sameDay && before && before.currency === snapshot.currency ? round(snapshot.balance - before.balance) : null,
        since: sameDay && before ? before.date : null,
      };
    }
  }

  for (const row of rows) {
    for (const group of [row.numbers, row.socials]) {
      for (const field of ['revenue', 'cost', 'profit']) group[field] = round(group[field]);
    }
    for (const field of Object.keys(row.balance)) row.balance[field] = round(row.balance[field]);
  }

  return { success: true, date, today, days, timezone: 'Africa/Lagos', currency: 'NGN', rows };
}
