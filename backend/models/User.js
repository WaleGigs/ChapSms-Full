const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      trim: true,
    },

    googlePicture: {
      type: String,
      default: null,
      trim: true,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    /*
     * New local accounts use username.
     * This remains optional at schema level so older accounts
     * that still contain firstName/lastName continue working.
     */
    username: {
      type: String,
      default: null,
      trim: true,
    },

    /*
     * Kept for existing users and future Google profile data.
     * They are no longer required for local registration.
     */
    firstName: {
      type: String,
      default: null,
      trim: true,
    },

    lastName: {
      type: String,
      default: null,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required() {
        return this.authProvider === "local";
      },
      select: false,
    },

    wallet: {
      type: Number,
      default: 0,
      min: 0,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },

    suspended: {
      type: Boolean,
      default: false,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationCodeHash: {
      type: String,
      default: null,
      select: false,
    },

    verificationExpires: {
      type: Date,
      default: null,
      select: false,
    },

    verificationLastSentAt: {
      type: Date,
      default: null,
      select: false,
    },

    verificationResendAvailableAt: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetCodeHash: {
      type: String,
      default: null,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },

    apiKey: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      select: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/*
 * Case-insensitive unique usernames.
 * Existing documents without username are ignored by the sparse index.
 */
userSchema.index(
  { username: 1 },
  {
    unique: true,
    sparse: true,
    collation: {
      locale: "en",
      strength: 2,
    },
  }
);

module.exports =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );
