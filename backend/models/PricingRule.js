const mongoose = require("mongoose");

const pricingRuleSchema = new mongoose.Schema(
  {
    server: {
      type: String,
      enum: ["server1", "server2"],
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    country: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

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
      index: true,
    },

    pricingStyle: {
      type: String,
      enum: ["cheapest_buffer", "fixed_operator"],
      default: "fixed_operator",
      required: true,
      index: true,
    },

    maxPriceBufferPercent: {
      type: Number,
      default: 50,
      min: 0,
      max: 500,
    },

    pricingMode: {
      type: String,
      enum: ["fixed", "percentage", "cost_plus"],
      default: "fixed",
      required: true,
    },

    fixedSellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    markupPercent: {
      type: Number,
      default: 0,
      min: 0,
    },

    fixedMarkup: {
      type: Number,
      default: 0,
      min: 0,
    },

    minimumSellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

pricingRuleSchema.index(
  {
    server: 1,
    country: 1,
    service: 1,
    operator: 1,
  },
  {
    unique: true,
    name: "unique_server_country_service_operator",
  }
);

module.exports = mongoose.model("PricingRule", pricingRuleSchema);
