const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Order = require('../models/Order');

const TYPES = new Set(['all', 'deposit', 'purchase', 'refund', 'failed', 'withdraw']);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getActivity = async (req, res) => {
  try {
    const page = Math.max(1, Math.min(100000, parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
    const type = String(req.query.type || 'all').toLowerCase();
    if (!TYPES.has(type)) return res.status(400).json({ success: false, message: 'Invalid activity filter' });
    const search = String(req.query.search || '').trim().slice(0, 100);
    let userIds;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      const users = await User.find({ $or: [
        { email: pattern }, { username: pattern }, { firstName: pattern }, { lastName: pattern }
      ] }).select('_id').lean();
      userIds = users.map((u) => u._id);
      if (!userIds.length) return res.json({ success: true, activities: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }
    const walletMatch = userIds ? { user: { $in: userIds } } : {};
    const orderMatch = userIds ? { user: { $in: userIds } } : {};
    const transactionMatch = type === 'all' ? {} : type === 'failed'
      ? { 'transactions.status': 'failed' }
      : { 'transactions.type': type };
    // Order entries represent SMS purchases. Linked wallet purchase entries are omitted to prevent duplicates.
    const includeOrders = ['all', 'purchase', 'failed'].includes(type);
    const includeWallet = true;
    const walletPipeline = [
      { $match: walletMatch },
      { $unwind: '$transactions' },
      { $match: { ...transactionMatch, $nor: [{ 'transactions.type': 'purchase', 'transactions.orderId': { $ne: null } }] } },
      { $lookup: { from: User.collection.name, localField: 'user', foreignField: '_id', as: 'account' } },
      { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 0, id: { $concat: ['wallet:', { $toString: '$transactions._id' }] },
        userId: { $toString: '$user' },
        name: { $trim: { input: { $concat: [{ $ifNull: ['$account.firstName', ''] }, ' ', { $ifNull: ['$account.lastName', ''] }] } } },
        email: { $ifNull: ['$account.email', ''] },
        type: '$transactions.type', status: '$transactions.status', amount: '$transactions.amount',
        description: '$transactions.description', reference: '$transactions.reference',
        gateway: '$transactions.paymentGateway', environment: '$transactions.environment',
        service: '$transactions.serviceName', country: '$transactions.countryName',
        createdAt: '$transactions.createdAt'
      } }
    ];
    const orderPipeline = [
      { $match: orderMatch },
      { $match: { refunded: { $ne: true }, financialStatus: { $ne: 'refunded' } } },
      ...(type === 'failed' ? [{ $match: { status: { $in: ['expired', 'cancelled'] } } }] : []),
      { $lookup: { from: User.collection.name, localField: 'user', foreignField: '_id', as: 'account' } },
      { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 0, id: { $concat: ['order:', { $toString: '$_id' }] },
        userId: { $toString: '$user' },
        name: { $ifNull: ['$customerName', ''] },
        accountName: { $trim: { input: { $concat: [{ $ifNull: ['$account.firstName', ''] }, ' ', { $ifNull: ['$account.lastName', ''] }] } } },
        email: { $ifNull: ['$customerEmail', ''] }, accountEmail: { $ifNull: ['$account.email', ''] },
        type: { $cond: [{ $or: ['$refunded', { $eq: ['$financialStatus', 'refunded'] }] }, 'refund', 'purchase'] },
        status: { $cond: [{ $or: ['$refunded', { $eq: ['$financialStatus', 'refunded'] }] }, 'refunded', '$status'] },
        amount: '$sellingPrice', description: { $literal: 'SMS number order' },
        reference: '$walletReservationReference', environment: '$paymentEnvironment',
        service: { $ifNull: ['$serviceName', '$service'] },
        country: { $ifNull: ['$countryName', '$country'] },
        createdAt: '$createdAt'
      } }
    ];
    // Combine both streams inside MongoDB so pagination and sorting are global.
    const base = includeWallet ? walletPipeline : [];
    if (includeOrders) {
      base.push({ $unionWith: { coll: Order.collection.name, pipeline: orderPipeline } });
    }
    // 'purchase' filter should not include refunded order entries, and 'failed' should only show failed records.
    if (type === 'purchase') base.push({ $match: { type: 'purchase' } });
    if (type === 'failed') base.push({ $match: { $or: [{ status: 'failed' }, { status: { $in: ['expired', 'cancelled'] } }] } });
    const result = await Wallet.aggregate([
      ...base,
      { $sort: { createdAt: -1, id: -1 } },
      { $facet: {
        entries: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        counts: [{ $count: 'total' }]
      } }
    ]).allowDiskUse(true);
    const data = result[0] || {};
    const activities = (data.entries || []).map((item) => ({
      ...item,
      name: item.name || item.accountName || 'Customer',
      email: item.email || item.accountEmail || '',
      accountName: undefined,
      accountEmail: undefined
    }));
    const total = data.counts?.[0]?.total || 0;
    return res.json({ success: true, activities, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Admin activity error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load user activity' });
  }
};