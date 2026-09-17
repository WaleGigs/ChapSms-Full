const mongoose = require("mongoose");

const socialOrderSchema =
  new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SocialProduct",
        required: true,
        index: true,
      },

      productName: {
        type: String,
        required: true,
        trim: true,
      },

      category: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
      },

      unitSellingPrice: {
        type: Number,
        required: true,
        min: 0,
      },

      sellingPrice: {
        type: Number,
        required: true,
        min: 0,
      },

      /*
       * Private cost information.
       */
      providerUnitPrice: {
        type: Number,
        default: 0,
        min: 0,
      },

      providerCharge: {
        type: Number,
        default: 0,
        min: 0,
      },

      providerCostNgn: {
        type: Number,
        default: 0,
        min: 0,
      },

      profit: {
        type: Number,
        default: 0,
      },

      /*
       * NEVER expose source identity to customers.
       * "house" means stock uploaded directly by ChapSms admin.
       */
      provider: {
        type: String,
        enum: [
          "sameeha",
          "loggsplug",
          "house",
        ],
        required: true,
      },

      providerProductId: {
        type: String,
        required: true,
        trim: true,
      },

      providerOrderId: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      deliveredItems: {
        type: [String],
        default: [],
      },

      status: {
        type: String,
        enum: [
          "processing",
          "completed",
          "failed",
          "refunded",
          "review_required",
        ],
        default: "processing",
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

      walletReservationReference: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      paymentEnvironment: {
        type: String,
        enum: ["live"],
        default: "live",
      },

      walletBalanceField: {
        type: String,
        enum: ["balance"],
        default: "balance",
      },

      failureReason: {
        type: String,
        default: "",
      },

      providerResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },

      completedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

socialOrderSchema.index({
  user: 1,
  createdAt: -1,
});

socialOrderSchema.index({
  status: 1,
  createdAt: -1,
});

socialOrderSchema.index({
  provider: 1,
  createdAt: -1,
});

function hidePrivateFields(
  _doc,
  ret
) {
  delete ret.provider;
  delete ret.providerProductId;
  delete ret.providerResponse;
  delete ret.providerUnitPrice;
  delete ret.providerCharge;
  delete ret.providerCostNgn;
  delete ret.profit;
  delete ret.walletBalanceField;
  delete ret.walletReservationReference;

  return ret;
}

socialOrderSchema.set(
  "toJSON",
  {
    transform: hidePrivateFields,
  }
);

socialOrderSchema.set(
  "toObject",
  {
    transform: hidePrivateFields,
  }
);

module.exports =
  mongoose.models.SocialOrder ||
  mongoose.model(
    "SocialOrder",
    socialOrderSchema
  );