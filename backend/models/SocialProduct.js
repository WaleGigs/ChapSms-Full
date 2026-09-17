const mongoose = require("mongoose");

const providerAlternativeSchema =
  new mongoose.Schema(
    {
      provider: {
        type: String,
        enum: ["sameeha", "loggsplug"],
        required: true,
      },

      providerProductId: {
        type: String,
        required: true,
        trim: true,
      },

      providerCurrency: {
        type: String,
        default: "NGN",
        trim: true,
        uppercase: true,
      },

      providerUnitPrice: {
        type: Number,
        required: true,
        min: 0,
      },

      providerCostNgn: {
        type: Number,
        required: true,
        min: 0,
      },

      stock: {
        type: Number,
        default: 0,
        min: 0,
      },

      inStock: {
        type: Boolean,
        default: false,
      },
    },
    {
      _id: false,
    }
  );

const socialProductSchema =
  new mongoose.Schema(
    {
      /*
       * provider = product synchronized from Sameeha / Loggsplug
       * house    = inventory uploaded directly by the ChapSms admin
       */
      sourceType: {
        type: String,
        enum: ["provider", "house"],
        default: "provider",
        index: true,
      },

      /*
       * Provider products use:
       * category-slug::product-slug
       *
       * House stock uses a unique house::* key.
       */
      catalogKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
      },

      name: {
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

      /*
       * Current preferred source.
       * NEVER expose this to customers.
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

      providerCurrency: {
        type: String,
        default: "NGN",
        uppercase: true,
        trim: true,
      },

      providerUnitPrice: {
        type: Number,
        required: true,
        min: 0,
      },

      providerCostNgn: {
        type: Number,
        required: true,
        min: 0,
      },

      /*
       * Price shown to ChapSms customer.
       *
       * Provider products are recalculated from the active
       * provider candidate. House products keep the admin's
       * manually configured selling price.
       */
      sellingPrice: {
        type: Number,
        required: true,
        min: 0,
      },

      stock: {
        type: Number,
        default: 0,
        min: 0,
      },

      inStock: {
        type: Boolean,
        default: false,
        index: true,
      },

      /*
       * Provider alternatives for one normalized catalog product.
       * House stock does not use this array.
       */
      alternatives: {
        type: [providerAlternativeSchema],
        default: [],
      },

      /*
       * For provider products this means the product still exists
       * in the upstream catalog.
       *
       * For house stock this is the admin show/hide switch.
       *
       * Provider-specific visibility is stored separately in
       * SocialCatalogRule so hiding Loggsplug TextNow does not hide
       * the Sameeha TextNow alternative.
       */
      isActive: {
        type: Boolean,
        default: true,
        index: true,
      },

      lastSyncedAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

socialProductSchema.index({
  category: 1,
  name: 1,
});

socialProductSchema.index({
  sourceType: 1,
  isActive: 1,
  category: 1,
});

function hidePrivateFields(
  _doc,
  ret
) {
  delete ret.provider;
  delete ret.providerProductId;
  delete ret.providerCurrency;
  delete ret.providerUnitPrice;
  delete ret.providerCostNgn;
  delete ret.alternatives;
  delete ret.catalogKey;
  delete ret.sourceType;

  return ret;
}

socialProductSchema.set(
  "toJSON",
  {
    transform: hidePrivateFields,
  }
);

socialProductSchema.set(
  "toObject",
  {
    transform: hidePrivateFields,
  }
);

module.exports =
  mongoose.models.SocialProduct ||
  mongoose.model(
    "SocialProduct",
    socialProductSchema
  );