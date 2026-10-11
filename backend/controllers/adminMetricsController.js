/**
 * ChapSms admin metrics — signup-cohort reporting.
 * Each row represents users who REGISTERED on that Lagos calendar date.
 * "To date" means from their signup date through the time this report runs.
 */
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Order = require('../models/Order');

const DAY_MS = 86400000;
const LAGOS_OFFSET_MS = 3600000;
const toDate = (value) => value ? new Date(value) : null;
const dayKey = (value) => new Date(new Date(value).getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
const dayStart = (value = new Date()) => {
  const local = new Date(value.getTime() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - LAGOS_OFFSET_MS);
};
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const idOf = (value) => String(value || '');
const isLive = (tx) => tx.environment !== 'test' && tx.balanceField !== 'testBalance';
const isCompletedDeposit = (tx) => tx?.type === 'deposit' && tx?.status === 'completed' && isLive(tx);
const isEarnedOrder = (order) => !order.refunded && order.financialStatus !== 'refunded' &&
  (order.financialStatus === 'earned' || order.status === 'received');
const percent = (part, whole) => whole > 0 ? Number((100 * part / whole).toFixed(1)) : 0;

exports.getDailyMetrics = async (req, res) => {
  try {
    const days = Number(req.query.days ?? req.query.range ?? 7);
    if (![7, 14, 30].includes(days)) {
      return res.status(400).json({ success: false, message: 'days must be 7, 14, or 30' });
    }

    const now = new Date();
    const today = dayStart(now);
    const start = new Date(today.getTime() - (days - 1) * DAY_MS);
    const configuredStart = process.env.ADMIN_DASHBOARD_START_AT ? new Date(process.env.ADMIN_DASHBOARD_START_AT) : null;
    const floor = configuredStart && !Number.isNaN(configuredStart.getTime()) ? configuredStart : null;
    const since = floor && floor > start ? floor : start;
    const dates = Array.from({ length: days }, (_, i) => dayKey(new Date(start.getTime() + i * DAY_MS)));
    const byDate = new Map(dates.map((date) => [date, {
      date, signups: 0, toppedUp: 0, toppedUpPercent: 0,
      firstDayDeposit: 0, deposited: 0, depositedToDate: 0,
      usersBalance: 0, boughtSameDay: 0, boughtToDate: 0,
      boughtToDatePercent: 0, purchases: 0,
      profitSameDay: 0, profitToDate: 0,
    }]));

    // Only users who signed up in the requested window belong to these cohorts.
    const users = await User.find({ createdAt: { $gte: since, $lte: now } })
      .select('_id createdAt').lean();
    const cohortByUser = new Map();
    for (const user of users) {
      const cohort = dayKey(user.createdAt);
      if (!byDate.has(cohort)) continue;
      cohortByUser.set(idOf(user._id), { date: cohort, joinedAt: new Date(user.createdAt) });
      byDate.get(cohort).signups += 1;
    }

    const userIds = users.map((u) => u._id);
    const [wallets, orders] = userIds.length ? await Promise.all([
      Wallet.find({ user: { $in: userIds } })
        .select('user balance transactions').lean(),
      Order.find({ user: { $in: userIds }, createdAt: { $lte: now } })
        .select('user createdAt status financialStatus refunded sellingPrice price providerCostNgn profit').lean(),
    ]) : [[], []];

    const fundedOnSignupDay = new Map();
    const fundedToDate = new Map();
    const boughtOnSignupDay = new Map();
    const boughtToDate = new Map();
    const addToSet = (map, key, userId) => {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(userId);
    };

    for (const wallet of wallets) {
      const userId = idOf(wallet.user);
      const cohort = cohortByUser.get(userId);
      if (!cohort) continue;
      const row = byDate.get(cohort.date);
      // This is the group's CURRENT live balance, not a historical snapshot.
      row.usersBalance += numeric(wallet.balance);

      for (const tx of wallet.transactions || []) {
        if (!isCompletedDeposit(tx) || !tx.createdAt) continue;
        const created = toDate(tx.createdAt);
        if (Number.isNaN(created.getTime()) || created < cohort.joinedAt || created > now) continue;
        const value = numeric(tx.amount);
        row.depositedToDate += value;
        addToSet(fundedToDate, cohort.date, userId);
        if (dayKey(created) === cohort.date) {
          row.firstDayDeposit += value;
          row.deposited += value;
          addToSet(fundedOnSignupDay, cohort.date, userId);
        }
      }
    }

    for (const order of orders) {
      if (!isEarnedOrder(order) || !order.createdAt) continue;
      const userId = idOf(order.user);
      const cohort = cohortByUser.get(userId);
      if (!cohort) continue;
      const created = toDate(order.createdAt);
      if (Number.isNaN(created.getTime()) || created < cohort.joinedAt || created > now) continue;
      const row = byDate.get(cohort.date);
      const profit = Number.isFinite(Number(order.profit)) && order.profit != null
        ? Number(order.profit)
        : numeric(order.sellingPrice ?? order.price) - numeric(order.providerCostNgn);
      row.purchases += 1;
      row.profitToDate += profit;
      addToSet(boughtToDate, cohort.date, userId);
      if (dayKey(created) === cohort.date) {
        row.profitSameDay += profit;
        addToSet(boughtOnSignupDay, cohort.date, userId);
      }
    }

    const daily = dates.map((date) => {
      const row = byDate.get(date);
      row.toppedUp = fundedOnSignupDay.get(date)?.size || 0;
      row.toppedUpPercent = percent(row.toppedUp, row.signups);
      // Count only customers who funded AND purchased on their signup day.
      const sameDayBuyers = boughtOnSignupDay.get(date) || new Set();
      const sameDayFunders = fundedOnSignupDay.get(date) || new Set();
      row.boughtSameDay = [...sameDayBuyers].filter((userId) => sameDayFunders.has(userId)).length;
      row.boughtSameDayPercent = percent(row.boughtSameDay, row.toppedUp);
      row.boughtToDate = boughtToDate.get(date)?.size || 0;
      row.boughtToDatePercent = percent(row.boughtToDate, row.signups);
      // 'deposited' is same-day funding; 'depositedToDate' is all subsequent funding.
      return row;
    });

    const sum = (field) => daily.reduce((total, row) => total + row[field], 0);
    const totals = {
      signups: sum('signups'), toppedUp: sum('toppedUp'),
      firstDayDeposit: sum('firstDayDeposit'), deposited: sum('deposited'),
      depositedToDate: sum('depositedToDate'), usersBalance: sum('usersBalance'),
      boughtSameDay: sum('boughtSameDay'), boughtToDate: sum('boughtToDate'),
      purchases: sum('purchases'), profitSameDay: sum('profitSameDay'),
      profitToDate: sum('profitToDate'),
    };
    totals.toppedUpPercent = percent(totals.toppedUp, totals.signups);
    totals.boughtSameDayPercent = percent(totals.boughtSameDay, totals.toppedUp);
    totals.boughtToDatePercent = percent(totals.boughtToDate, totals.signups);

    return res.json({
      success: true, days, timezone: 'Africa/Lagos', currency: 'NGN',
      scope: 'signup-cohorts',
      period: { start: dates[0], end: dates[dates.length - 1] },
      daily, dailyMetrics: daily, totals,
      definitions: {
        cohort: 'Each row includes only customers who registered on that date.',
        toppedUp: 'Cohort customers with a completed live deposit on signup day.',
        toppedUpPercent: 'Topped-up signup-day customers divided by that day’s signups.',
        firstDayDeposit: 'Completed live deposits by the cohort on signup day.',
        deposited: 'Completed live deposits by the cohort on signup day.',
        depositedToDate: 'All completed live deposits by the same signup cohort through report time.',
        usersBalance: 'Sum of current live wallet balances belonging to the signup cohort; not historical end-of-day balances.',
        boughtSameDay: 'Distinct signup-day cohort customers who BOTH completed a live wallet top-up AND made an earned, non-refunded SMS purchase on their signup day.',
        boughtSameDayPercent: 'Same-day buyers who topped up divided by signup-day customers who topped up, multiplied by 100.',
        boughtToDate: 'Distinct cohort customers with an earned SMS order through report time.',
        boughtToDatePercent: 'Bought-to-date customers divided by that day’s signups.',
        purchases: 'Count of earned, non-refunded SMS number orders by the cohort from registration through report time. Each repeat order counts separately.',
        profitSameDay: 'Profit from earned, non-refunded cohort orders created on signup day.',
        profitToDate: 'Profit from earned, non-refunded cohort orders created through report time.',
      },
    });
  } catch (error) {
    console.error('Admin signup-cohort metrics error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load daily metrics' });
  }
};
