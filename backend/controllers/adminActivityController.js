// Admin User Activity: one newest-first timeline of everything users do.
const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Order = require('../models/Order');
const SocialOrder = require('../models/SocialOrder');
const PurchaseAttempt = require('../models/PurchaseAttempt');

/*
 * Categories:
 *   deposit  — wallet deposits (any status), including admin credits
 *   purchase — number orders still live or delivered; social orders not failed
 *   refund   — number orders cancelled/expired/refunded; social orders failed/refunded
 *   failed   — purchase attempts that never became an order
 *   withdraw — wallet withdrawals, including admin debits
 */
const CATEGORIES = ['deposit', 'purchase', 'refund', 'failed', 'withdraw'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isObjectId = (s) => typeof s === 'string' && /^[0-9a-f]{24}$/i.test(s);

const NUMBER_REFUND = { $or: [
  { refunded: true },
  { financialStatus: 'refunded' },
  { status: { $in: ['expired', 'cancelled'] } },
] };
const SOCIAL_REFUND = { $or: [
  { refunded: true },
  { status: { $in: ['failed', 'refunded'] } },
] };
const exprOf = (match) => ({ $or: match.$or.map((clause) => {
  const [field, cond] = Object.entries(clause)[0];
  return cond.$in ? { $in: [`$${field}`, cond.$in] } : { $eq: [`$${field}`, cond] };
}) });

/** Newest `windowSize` rows of one stream plus its total, as { entries, total }. */
async function stream(model, pipeline, windowSize) {
  const [result] = await model.aggregate([
    ...pipeline,
    { $sort: { at: -1, id: -1 } },
    { $facet: { entries: [{ $limit: windowSize }], counts: [{ $count: 'total' }] } },
  ]).allowDiskUse(true);
  return { entries: result?.entries || [], total: result?.counts?.[0]?.total || 0 };
}

function walletStream(userMatch, types, windowSize) {
  return stream(Wallet, [
    { $match: userMatch },
    { $unwind: '$transactions' },
    { $match: { 'transactions.type': { $in: types } } },
    { $project: {
      _id: 0,
      id: { $concat: ['wallet:', { $toString: '$transactions._id' }] },
      category: '$transactions.type',
      kind: { $literal: 'payment' },
      userId: { $toString: '$user' },
      at: { $ifNull: ['$transactions.createdAt', '$createdAt'] },
      status: '$transactions.status',
      amount: '$transactions.amount',
      label: '$transactions.description',
      ref: '$transactions.reference',
      provider: '$transactions.paymentGateway',
      environment: '$transactions.environment',
    } },
  ], windowSize);
}

function numberOrderStream(userMatch, cats, windowSize) {
  const match = cats.includes('purchase') && cats.includes('refund') ? {}
    : cats.includes('refund') ? NUMBER_REFUND : { $nor: [NUMBER_REFUND] };
  return stream(Order, [
    { $match: { ...userMatch, ...match } },
    { $project: {
      _id: 0,
      id: { $concat: ['order:', { $toString: '$_id' }] },
      category: { $cond: [exprOf(NUMBER_REFUND), 'refund', 'purchase'] },
      kind: { $literal: 'number' },
      userId: { $toString: '$user' },
      at: '$createdAt',
      status: '$status',
      amount: '$sellingPrice',
      label: { $ifNull: [{ $cond: [{ $eq: ['$serviceName', ''] }, null, '$serviceName'] }, '$service'] },
      ref: '$phoneNumber',
      server: '$server',
      country: { $ifNull: [{ $cond: [{ $eq: ['$countryName', ''] }, null, '$countryName'] }, '$country'] },
      environment: '$paymentEnvironment',
    } },
  ], windowSize);
}

function socialOrderStream(userMatch, cats, windowSize) {
  const match = cats.includes('purchase') && cats.includes('refund') ? {}
    : cats.includes('refund') ? SOCIAL_REFUND : { $nor: [SOCIAL_REFUND] };
  return stream(SocialOrder, [
    { $match: { ...userMatch, ...match } },
    { $project: {
      _id: 0,
      id: { $concat: ['social:', { $toString: '$_id' }] },
      orderId: '$_id',
      category: { $cond: [exprOf(SOCIAL_REFUND), 'refund', 'purchase'] },
      kind: { $literal: 'social' },
      userId: { $toString: '$user' },
      at: '$createdAt',
      status: '$status',
      amount: '$sellingPrice',
      quantity: '$quantity',
      label: '$productName',
      provider: '$provider',
      failureReason: '$failureReason',
    } },
  ], windowSize);
}

function attemptStream(userMatch, windowSize) {
  // Attempts linked to an order are already shown on that order's refund row.
  return stream(PurchaseAttempt, [
    { $match: { ...userMatch, orderId: null } },
    { $project: {
      _id: 0,
      id: { $concat: ['attempt:', { $toString: '$_id' }] },
      category: { $literal: 'failed' },
      kind: '$kind',
      userId: { $toString: '$user' },
      at: '$createdAt',
      status: { $literal: 'failed' },
      amount: '$amount',
      label: { $ifNull: ['$label', '$service'] },
      provider: '$provider',
      server: '$server',
      country: '$country',
      reason: '$reason',
      message: '$message',
    } },
  ], windowSize);
}

/** Why each failed social order failed, from its recorded attempt. */
async function attachSocialReasons(rows) {
  const socialRefunds = rows.filter((r) => r.kind === 'social' && r.category === 'refund');
  if (!socialRefunds.length) return;
  const attempts = await PurchaseAttempt.find({ orderId: { $in: socialRefunds.map((r) => r.orderId) } })
    .sort({ createdAt: 1 }).select('orderId reason message').lean();
  const byOrder = new Map();
  attempts.forEach((a) => { if (!byOrder.has(String(a.orderId))) byOrder.set(String(a.orderId), a); });
  socialRefunds.forEach((r) => {
    const a = byOrder.get(String(r.orderId));
    r.reason = a?.reason || null;
    r.message = a?.message || r.failureReason || null;
  });
}

/*
 * What each completed deposit was first spent on: the user's first order that
 * wasn't refunded, placed after the deposit and before their next deposit.
 * Sets firstPurchase (object or null) and nextDepositAt on the row.
 */
async function attachFirstPurchases(rows) {
  const deposits = rows.filter((r) => r.category === 'deposit' && r.status === 'completed');
  if (!deposits.length) return;
  const userIds = [...new Set(deposits.map((r) => r.userId))];
  const all = await Wallet.aggregate([
    { $match: { user: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $unwind: '$transactions' },
    { $match: { 'transactions.type': 'deposit', 'transactions.status': 'completed' } },
    { $project: { _id: 0, userId: { $toString: '$user' }, at: '$transactions.createdAt' } },
    { $sort: { at: 1 } },
  ]);
  await Promise.all(deposits.map(async (r) => {
    const at = new Date(r.at);
    const next = all.find((d) => d.userId === r.userId && new Date(d.at) > at);
    const window = { $gte: at, ...(next ? { $lt: new Date(next.at) } : {}) };
    const [order, social] = await Promise.all([
      Order.findOne({ user: r.userId, createdAt: window, $nor: [NUMBER_REFUND] })
        .sort({ createdAt: 1 }).select('serviceName service sellingPrice createdAt').lean(),
      SocialOrder.findOne({ user: r.userId, createdAt: window, $nor: [SOCIAL_REFUND] })
        .sort({ createdAt: 1 }).select('productName sellingPrice createdAt').lean(),
    ]);
    const first = [
      order && { kind: 'number', label: order.serviceName || order.service, amount: order.sellingPrice, boughtAt: order.createdAt },
      social && { kind: 'social', label: social.productName, amount: social.sellingPrice, boughtAt: social.createdAt },
    ].filter(Boolean).sort((a, b) => new Date(a.boughtAt) - new Date(b.boughtAt))[0];
    r.firstPurchase = first || null;
    r.nextDepositAt = next ? next.at : null;
  }));
}

exports.getActivity = async (req, res) => {
  try {
    const page = Math.max(1, Math.min(1000, parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 30));
    const category = String(req.query.type || req.query.category || 'all').toLowerCase();
    if (category !== 'all' && !CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid activity filter' });
    }
    const cats = category === 'all' ? CATEGORIES : [category];

    let userIds;
    if (isObjectId(req.query.userId)) {
      userIds = [new mongoose.Types.ObjectId(req.query.userId)];
    } else {
      const search = String(req.query.search || '').trim().slice(0, 100);
      if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        const users = await User.find({
          $or: [{ email: pattern }, { username: pattern }, { firstName: pattern }, { lastName: pattern }],
        }).select('_id').lean();
        userIds = users.map((u) => u._id);
        if (!userIds.length) {
          return res.json({ success: true, activities: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        }
      }
    }
    const userMatch = userIds ? { user: { $in: userIds } } : {};
    const windowSize = page * limit;
    const walletTypes = cats.filter((c) => c === 'deposit' || c === 'withdraw');
    const orderCats = cats.filter((c) => c === 'purchase' || c === 'refund');

    // Separate streams merged here, not $unionWith, which some MongoDB
    // deployments reject.
    const empty = Promise.resolve({ entries: [], total: 0 });
    const streams = await Promise.all([
      walletTypes.length ? walletStream(userMatch, walletTypes, windowSize) : empty,
      orderCats.length ? numberOrderStream(userMatch, orderCats, windowSize) : empty,
      orderCats.length ? socialOrderStream(userMatch, orderCats, windowSize) : empty,
      cats.includes('failed') ? attemptStream(userMatch, windowSize) : empty,
    ]);

    const rows = streams.flatMap((s) => s.entries)
      .sort((a, b) => (new Date(b.at || 0) - new Date(a.at || 0)) || String(b.id).localeCompare(String(a.id)))
      .slice((page - 1) * limit, page * limit);
    const total = streams.reduce((sum, s) => sum + s.total, 0);

    const pageUserIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
    const [users] = await Promise.all([
      User.find({ _id: { $in: pageUserIds } }).select('firstName lastName username email').lean(),
      attachSocialReasons(rows),
      attachFirstPurchases(rows),
    ]);
    const byId = new Map(users.map((u) => [String(u._id), u]));

    const activities = rows.map(({ orderId, failureReason, ...row }) => { // eslint-disable-line no-unused-vars
      const u = byId.get(row.userId);
      return {
        ...row,
        amount: row.amount != null ? Number(row.amount) : null,
        user: u ? {
          name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || '',
          email: u.email || '',
        } : null,
      };
    });

    return res.json({
      success: true,
      activities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Admin activity error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load user activity' });
  }
};
