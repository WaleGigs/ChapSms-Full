const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  provider: { type: String, required: true, enum: ['smsbower','benotp','loggsplug','samehasocialhub'], index: true },
  balance: { type: Number, required: true },
  currency: { type: String, required: true, enum: ['NGN','USD'] },
  date: { type: String, required: true, index: true },
  recordedAt: { type: Date, default: Date.now },
}, { timestamps: true });
schema.index({ provider: 1, date: 1 }, { unique: true });
module.exports = mongoose.models.ProviderBalanceSnapshot || mongoose.model('ProviderBalanceSnapshot', schema);