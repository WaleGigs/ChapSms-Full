const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    txRef: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 100,
    },

    currency: {
      type: String,
      enum: ["NGN"],
      default: "NGN",
    },

    paymentMethod: {
      type: String,
      enum: ["card", "bank"],
      default: "bank",
    },

    /*
     * The mode is saved when payment is initialized.
     * This prevents a pending test payment from being credited as live money
     * after an environment-variable change.
     */
    environment: {
      type: String,
      enum: ["test", "live"],
      required: true,
      default: "test",
      index: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "successful",
        "failed",
      ],
      default: "pending",
      index: true,
    },

    credited: {
      type: Boolean,
      default: false,
      index: true,
    },

    flutterwaveId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    /*
     * Flutterwave Pay-With-Bank-Transfer details.
     * These are public temporary payment instructions returned by Flutterwave,
     * not secret API credentials.
     */
    bankTransfer: {
      transferReference: {
        type: String,
        default: "",
        trim: true,
      },
      accountNumber: {
        type: String,
        default: "",
        trim: true,
      },
      bankName: {
        type: String,
        default: "",
        trim: true,
      },
      transferNote: {
        type: String,
        default: "",
        trim: true,
      },
      transferAmount: {
        type: Number,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

paymentSchema.index({
  user: 1,
  createdAt: -1,
});

paymentSchema.index({
  status: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.Payment ||
  mongoose.model(
    "Payment",
    paymentSchema,
  );
