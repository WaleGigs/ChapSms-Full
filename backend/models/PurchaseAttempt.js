const mongoose = require('mongoose');

/*
 * A buy that failed before or without producing a delivered order: provider
 * out of funds, no stock, insufficient balance, upstream error. Written by
 * utils/purchaseAttempts.js and read by the admin User Activity page.
 */
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, required: true, enum: ['number', 'social'] },
  reason: { type: String, required: true },   // machine code, e.g. insufficient_balance
  message: { type: String, default: '' },     // what the user was told
  httpStatus: { type: Number, default: null },
  provider: { type: String, default: null },
  server: { type: String, default: null },
  country: { type: String, default: null },
  service: { type: String, default: null },
  label: { type: String, default: null },     // service name or product name
  amount: { type: Number, default: null },    // price they'd have paid, when known
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialOrder', default: null },
  detail: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, versionKey: false });

schema.index({ createdAt: -1 });
schema.index({ user: 1, createdAt: -1 });
schema.index({ orderId: 1 }, { partialFilterExpression: { orderId: { $type: 'objectId' } } });

module.exports = mongoose.models.PurchaseAttempt || mongoose.model('PurchaseAttempt', schema);
