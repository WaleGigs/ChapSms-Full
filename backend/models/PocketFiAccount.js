const mongoose = require("mongoose");

const pocketFiAccountSchema = new mongoose.Schema(
  {
    // One permanent account per customer.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    bank: { type: String, default: "", trim: true, lowercase: true },
    bankName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, unique: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    status: { type: String, default: "active", trim: true, lowercase: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

module.exports =
  mongoose.models.PocketFiAccount || mongoose.model("PocketFiAccount", pocketFiAccountSchema);
