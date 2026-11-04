const mongoose = require("mongoose");

const pocketFiTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "PocketFiAccount", required: true, index: true },
    reference: { type: String, required: true, unique: true, trim: true, uppercase: true },
    amount: { type: Number, required: true, min: 0 },
    fee: { type: Number, default: 0, min: 0 },
    settlementAmount: { type: Number, default: 0, min: 0 },
    creditedAmount: { type: Number, default: 0, min: 0 },
    virtualAccount: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "", trim: true },
    credited: { type: Boolean, default: false, index: true },
    creditedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

pocketFiTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports =
  mongoose.models.PocketFiTransaction ||
  mongoose.model("PocketFiTransaction", pocketFiTransactionSchema);
