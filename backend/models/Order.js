const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    customerEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    customerName: {
      type: String,
      default: "",
      trim: true,
    },

    country: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    /* Friendly country label shown to customers/admins. */
    countryName: {
      type: String,
      default: "",
      trim: true,
    },

    service: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    /* Friendly service label shown to customers/admins. */
    serviceName: {
      type: String,
      default: "",
      trim: true,
    },

    operator: {
      type: String,
      default: "any",
      trim: true,
      lowercase: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    otpCode: {
      type: String,
      default: "",
      trim: true,
    },

    sms: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "waiting",
        "cancelling",
        "received",
        "expired",
        "cancelled",
      ],
      default: "waiting",
      index: true,
    },

    /*
     * Legacy customer-facing amount.
     * Keep this equal to sellingPrice.
     */
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    /* Provider price in the provider's original currency. */
    providerPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    providerCurrency: {
      type: String,
      default: "USD",
      trim: true,
      uppercase: true,
    },

    /* Provider cost converted to naira at purchase time. */
    providerCostNgn: {
      type: Number,
      required: true,
      min: 0,
    },

    /* sellingPrice - providerCostNgn */
    profit: {
      type: Number,
      required: true,
      default: 0,
    },

    financialStatus: {
      type: String,
      enum: ["charged", "earned", "refunded"],
      default: "charged",
      index: true,
    },

    pricingRule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PricingRule",
      default: null,
    },

    pricingSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    /* Private purchase/refund context. Removed by sanitizeOrder before API output. */
    paymentEnvironment: {
      type: String,
      enum: ["test", "live"],
      default: "live",
      index: true,
    },

    walletBalanceField: {
      type: String,
      enum: ["balance", "testBalance"],
      default: "balance",
    },

    walletReservationReference: {
      type: String,
      default: "",
      trim: true,
    },

    server: {
      type: String,
      enum: ["server1", "server2"],
      required: true,
      index: true,
    },

    /* Internal provider identity. Never expose to customers. */
    provider: {
      type: String,
      enum: ["smsbower", "benotp"],
      required: true,
      select: true,
    },

    providerOrderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    providerStartedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    /*
     * Rollout safety: only orders explicitly created by the new lifecycle
     * code are eligible for automatic provider-timeout refunds. This avoids
     * double-crediting historical orders that may already have been manually
     * compensated before this fix was deployed.
     */
    autoRefundEligible: {
      type: Boolean,
      default: false,
      index: true,
    },

    refunded: {
      type: Boolean,
      default: false,
      index: true,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    otpReceivedAt: {
      type: Date,
      default: null,
    },

    providerStatus: {
      type: String,
      default: "STATUS_WAIT_CODE",
    },

    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    providerLastCheckedAt: {
      type: Date,
      default: null,
    },

    providerCancelledAt: {
      type: Date,
      default: null,
    },

    providerFinishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ server: 1, createdAt: -1 });
orderSchema.index({
  server: 1,
  country: 1,
  service: 1,
  operator: 1,
  createdAt: -1,
});
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ refunded: 1, createdAt: -1 });
orderSchema.index({ autoRefundEligible: 1, status: 1, expiresAt: 1 });

function hidePrivateProviderFields(_doc, ret) {
  delete ret.provider;
  delete ret.providerResponse;
  return ret;
}

orderSchema.set("toJSON", {
  transform: hidePrivateProviderFields,
});

orderSchema.set("toObject", {
  transform: hidePrivateProviderFields,
});

module.exports = mongoose.model("Order", orderSchema);