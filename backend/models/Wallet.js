const mongoose =
  require("mongoose");

const TRANSACTION_TYPES = [
  "deposit",
  "purchase",
  "refund",
  "withdraw",
];

const TRANSACTION_STATUSES = [
  "pending",
  "completed",
  "failed",
];

const TRANSACTION_ENVIRONMENTS = [
  "test",
  "live",
];

const BALANCE_FIELDS = [
  "testBalance",
  "balance",
];

const PAYMENT_GATEWAYS = [
  /*
   * Keep Flutterwave for historical wallet records that may already
   * exist. New funding created by this integration uses "neurapay".
   */
  "flutterwave",
  "neurapay",
];

const transactionSchema =
  new mongoose.Schema(
    {
      type: {
        type: String,
        enum:
          TRANSACTION_TYPES,
        required: true,
      },

      amount: {
        type: Number,
        required: true,
        min: 0,
      },

      environment: {
        type: String,
        enum:
          TRANSACTION_ENVIRONMENTS,
        required: true,
        default: "live",
      },

      balanceField: {
        type: String,
        enum: BALANCE_FIELDS,
        required: true,
        default: "balance",
      },

      description: {
        type: String,
        default: "",
        trim: true,
      },

      status: {
        type: String,
        enum:
          TRANSACTION_STATUSES,
        default: "pending",
      },

      reference: {
        type: String,
        trim: true,
        uppercase: true,
      },

      transactionId: {
        type: String,
        trim: true,
      },

      paymentGateway: {
        type: String,
        enum:
          PAYMENT_GATEWAYS,
        default: null,
      },

      currency: {
        type: String,
        enum: ["NGN"],
        default: "NGN",
      },

      paymentMethod: {
        type: String,
        default: "",
        trim: true,
      },

      orderId: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "Order",
        default: null,
      },

      server: {
        type: String,
        enum: [
          "server1",
          "server2",
        ],
        default: null,
      },

      serviceName: {
        type: String,
        default: "",
        trim: true,
      },

      countryName: {
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

const walletSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
        unique: true,
        required: true,
        index: true,
      },

      /*
       * Real-money balance.
       *
       * Verified NeuraPay inbound transfers increase this balance.
       * Real SMS-provider purchases deduct from this balance.
       */
      balance: {
        type: Number,
        default: 0,
        min: 0,
      },

      /*
       * Preserved for backward compatibility with the previous
       * payment-testing architecture.
       */
      testBalance: {
        type: Number,
        default: 0,
        min: 0,
      },

      currency: {
        type: String,
        default: "NGN",
        enum: ["NGN"],
      },

      transactions: {
        type: [
          transactionSchema,
        ],
        default: [],
      },
    },
    {
      timestamps: true,
      versionKey: false,
    }
  );

walletSchema.index({
  "transactions.reference": 1,
});

walletSchema.index({
  "transactions.transactionId":
    1,
});

walletSchema.index({
  "transactions.environment":
    1,
});

walletSchema.virtual(
  "formattedBalance"
).get(
  function formattedBalance() {
    return Number(
      this.balance || 0
    ).toLocaleString(
      "en-NG",
      {
        style: "currency",
        currency: "NGN",
      }
    );
  }
);

walletSchema.virtual(
  "formattedTestBalance"
).get(
  function formattedTestBalance() {
    return Number(
      this.testBalance || 0
    ).toLocaleString(
      "en-NG",
      {
        style: "currency",
        currency: "NGN",
      }
    );
  }
);

walletSchema.methods
  .getBalanceForEnvironment =
  function getBalanceForEnvironment(
    environment
  ) {
    return environment ===
      "live"
      ? Number(
          this.balance || 0
        )
      : Number(
          this.testBalance ||
            0
        );
  };

walletSchema.set(
  "toJSON",
  {
    virtuals: true,
  }
);

walletSchema.set(
  "toObject",
  {
    virtuals: true,
  }
);

module.exports =
  mongoose.models.Wallet ||
  mongoose.model(
    "Wallet",
    walletSchema
  );