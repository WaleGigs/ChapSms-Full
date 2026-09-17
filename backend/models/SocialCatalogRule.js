const mongoose = require("mongoose");

/*
 * Stores ONLY admin visibility overrides for provider catalogs.
 *
 * Examples:
 *   category:loggsplug:textnow
 *   product:loggsplug:123
 *
 * This model is deliberately separate from SocialProduct so a provider
 * catalog refresh can never wipe an admin's hide/show decisions.
 */
const socialCatalogRuleSchema =
  new mongoose.Schema(
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
        enum: ["category", "product"],
        required: true,
        index: true,
      },

      provider: {
        type: String,
        enum: ["sameeha", "loggsplug"],
        required: true,
        index: true,
      },

      category: {
        type: String,
        default: "",
        trim: true,
      },

      categoryKey: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      providerProductId: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      hidden: {
        type: Boolean,
        default: true,
        index: true,
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

socialCatalogRuleSchema.index({
  provider: 1,
  scope: 1,
  categoryKey: 1,
  providerProductId: 1,
});

module.exports =
  mongoose.models.SocialCatalogRule ||
  mongoose.model(
    "SocialCatalogRule",
    socialCatalogRuleSchema
  );