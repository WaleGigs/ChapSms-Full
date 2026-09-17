const mongoose =
  require("mongoose");

const neuraPayAccountSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      providerChannel: {
        type: String,
        enum: [
          "Paga",
          "PalmPay",
        ],
        required: true,
        index: true,
      },

      requestReference: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },

      bankName: {
        type: String,
        required: true,
        trim: true,
      },

      accountNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },

      accountName: {
        type: String,
        required: true,
        trim: true,
      },

      customerName: {
        type: String,
        required: true,
        trim: true,
      },

      customerEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true,
      },

      status: {
        type: String,
        default: "active",
        trim: true,
        lowercase: true,
        index: true,
      },

      providerCreatedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

neuraPayAccountSchema.index({
  user: 1,
  providerChannel: 1,
  status: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models
    .NeuraPayAccount ||
  mongoose.model(
    "NeuraPayAccount",
    neuraPayAccountSchema
  );