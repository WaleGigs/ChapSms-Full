const mongoose = require("mongoose");

const socialPricingRuleSchema = new mongoose.Schema(
  {
    ruleKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    scope: {
      type: String,
      enum: ["global", "product"],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["sameeha", "loggsplug"],
      required: true,
      index: true,
    },
    providerProductId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    productName: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    pricingEnabled: {
      type: Boolean,
      default: false,
    },
    pricingMode: {
      type: String,
      enum: ["markup", "fixed"],
      default: "markup",
    },
    markupPercent: {
      type: Number,
      default: 0,
      min: 0,
    },
    fixedSellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumSellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    logoUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

socialPricingRuleSchema.index({
  provider: 1,
  scope: 1,
  providerProductId: 1,
});

module.exports =
  mongoose.models.SocialPricingRule ||
  mongoose.model("SocialPricingRule", socialPricingRuleSchema);