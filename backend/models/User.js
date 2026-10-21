const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, default: null, unique: true, sparse: true, trim: true },
    googlePicture: { type: String, default: null, trim: true },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    username: { type: String, default: null, trim: true },
    firstName: { type: String, default: null, trim: true },
    lastName: { type: String, default: null, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: {
      type: String,
      required() { return this.authProvider === "local"; },
      select: false,
    },
    wallet: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    suspended: { type: Boolean, default: false, index: true },
    isVerified: { type: Boolean, default: false },
    verificationCodeHash: { type: String, default: null, select: false },
    verificationExpires: { type: Date, default: null, select: false },
    verificationLastSentAt: { type: Date, default: null, select: false },
    verificationResendAvailableAt: { type: Date, default: null, select: false },
    passwordResetCodeHash: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
    apiKey: { type: String, default: null, unique: true, sparse: true, select: false },
    lastLogin: { type: Date, default: null },
    registrationSource: {
      type: String,
      enum: ["snapchat", "tiktok", "instagram", "facebook", "organic", "direct", "other"],
      default: "direct",
      index: true,
    },
    registrationMedium: { type: String, default: "", trim: true, maxlength: 100 },
    registrationCampaign: { type: String, default: "", trim: true, maxlength: 200 },
    snapClickId: { type: String, default: "", trim: true, select: false, maxlength: 512 },
    tiktokClickId: { type: String, default: "", trim: true, select: false, maxlength: 512 },
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ createdAt: -1 });

userSchema.index(
  { username: 1 },
  { unique: true, sparse: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
