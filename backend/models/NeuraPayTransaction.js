const mongoose =
  require("mongoose");

const senderSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        default: "",
        trim: true,
      },

      accountNumber: {
        type: String,
        default: "",
        trim: true,
      },

      bank: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      _id: false,
      versionKey: false,
    }
  );

const neuraPayTransactionSchema =
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

      account: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "NeuraPayAccount",
        required: true,
        index: true,
      },

      reference: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        index: true,
      },

      providerReference: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      amount: {
        type: Number,
        required: true,
        min: 0,
      },

      fees: {
        type: Number,
        default: 0,
        min: 0,
      },

      netAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      creditedAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      type: {
        type: String,
        default:
          "inbound_transfer",
        trim: true,
        index: true,
      },

      status: {
        type: String,
        default: "successful",
        trim: true,
        lowercase: true,
        index: true,
      },

      virtualAccount: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      bankName: {
        type: String,
        default: "",
        trim: true,
      },

      sender: {
        type: senderSchema,
        default: () => ({}),
      },

      description: {
        type: String,
        default: "",
        trim: true,
      },

      eventName: {
        type: String,
        default:
          "payment.successful",
        trim: true,
      },

      credited: {
        type: Boolean,
        default: false,
        index: true,
      },

      creditedAt: {
        type: Date,
        default: null,
      },

      providerCreatedAt: {
        type: Date,
        default: null,
      },

      /*
       * TikTok Events API delivery state.
       * This lets duplicate NeuraPay webhooks/manual verification safely
       * retry an event that previously failed without creating duplicate
       * TikTok conversions.
       */
      tiktokEventId: {
        type: String,
        default: "",
        trim: true,
        index: true,
      },

      tiktokEventSent: {
        type: Boolean,
        default: false,
        index: true,
      },

      tiktokEventSentAt: {
        type: Date,
        default: null,
      },

      tiktokEventAttempts: {
        type: Number,
        default: 0,
        min: 0,
      },

      tiktokEventLastError: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

neuraPayTransactionSchema.index({
  user: 1,
  createdAt: -1,
});

neuraPayTransactionSchema.index({
  credited: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models
    .NeuraPayTransaction ||
  mongoose.model(
    "NeuraPayTransaction",
    neuraPayTransactionSchema
  );
