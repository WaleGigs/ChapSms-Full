const mongoose = require("mongoose");

const houseStockItemSchema =
  new mongoose.Schema(
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SocialProduct",
        required: true,
        index: true,
      },

      /*
       * The actual account/log/key delivered to the customer.
       * Never expose this from admin catalog/list endpoints.
       */
      details: {
        type: String,
        required: true,
        trim: true,
        select: true,
      },

      /*
       * Prevents the exact same credential from being uploaded twice
       * for the same house product.
       */
      contentHash: {
        type: String,
        required: true,
        trim: true,
      },

      status: {
        type: String,
        enum: [
          "available",
          "reserved",
          "sold",
        ],
        default: "available",
        index: true,
      },

      reservationReference: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      reservedAt: {
        type: Date,
        default: null,
      },

      reservedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      soldAt: {
        type: Date,
        default: null,
        index: true,
      },

      soldTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
      },

      socialOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SocialOrder",
        default: null,
        index: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

houseStockItemSchema.index(
  {
    product: 1,
    contentHash: 1,
  },
  {
    unique: true,
  }
);

houseStockItemSchema.index({
  product: 1,
  status: 1,
  createdAt: 1,
});

module.exports =
  mongoose.models.HouseStockItem ||
  mongoose.model(
    "HouseStockItem",
    houseStockItemSchema
  );