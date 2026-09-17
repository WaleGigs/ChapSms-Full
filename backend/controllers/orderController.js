const crypto = require("node:crypto");

const Order = require("../models/Order");
const Wallet = require("../models/Wallet");
const providerManager = require(
  "../services/providers/providerManager"
);
const pricingService = require(
  "../services/pricingService"
);
const automaticPricingService = require(
  "../services/automaticPricingService"
);

const VALID_SERVERS = ["server1", "server2"];

function normalizeCountry(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeService(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeOperator(value) {
  return String(value || "any").trim().toLowerCase() || "any";
}

function normalizeServer(value) {
  return String(value || "").trim().toLowerCase();
}

function isDefinitiveAvailabilityFailure(error) {
  const code = String(
    error?.code || ""
  )
    .trim()
    .toUpperCase();

  /*
   * Only these responses prove that this particular operator/pool
   * did NOT create an activation.
   *
   * Never retry a purchase after timeout, connection reset,
   * invalid/unknown response, or any other uncertain mutation.
   */
  return new Set([
    "NO_NUMBERS",
    "NO_NUMBER",
    "NO_STOCK",
    "OPERATOR_NOT_AVAILABLE",
    "POOL_UNAVAILABLE",
    "NO_OPERATORS",
  ]).has(code);
}

function buildAutomaticPurchaseCandidates(
  automaticSelection,
  selectedOperator
) {
  const selected =
    normalizeOperator(
      selectedOperator
    );

  const candidates = [
    selected,
    ...(
      Array.isArray(
        automaticSelection?.cheapPool
      )
        ? automaticSelection.cheapPool.map(
            (item) =>
              normalizeOperator(
                item?.operator
              )
          )
        : []
    ),
  ].filter(
    (operator) =>
      operator &&
      operator !== "any"
  );

  return [
    ...new Set(candidates),
  ];
}

function extractProviderError(error) {
  const code = String(error?.code || "").trim().toUpperCase();

  const messages = {
    NO_PRICE:
      "ChapsSms does not currently have a live price for this selection.",
    NO_NUMBERS:
      "ChapsSms does not currently have a number available for this selection.",
    NO_STOCK:
      "ChapsSms does not currently have a number available for this selection.",
    INVALID_COUNTRY:
      "This country is not currently supported on ChapsSms.",
    INVALID_SERVICE:
      "This service is not currently supported on ChapsSms.",
    PROVIDER_BALANCE_LOW:
      "ChapsSms service is temporarily unavailable. Please try another server.",
    INVALID_API_KEY:
      "ChapsSms service is temporarily unavailable. Please try again later.",
    INVALID_PRICE:
      "ChapsSms could not retrieve a valid price right now.",
    INVALID_PRICE_RESPONSE:
      "ChapsSms could not retrieve a live price right now.",
    INVALID_UPSTREAM_RESPONSE:
      "ChapsSms received an invalid response from the SMS service. Please try again.",
    EMPTY_RESPONSE:
      "ChapsSms could not complete the request right now.",
    PROVIDER_ERROR:
      "ChapsSms could not complete the request right now.",
    BENOTP_REQUEST_FAILED:
      "ChapsSms could not connect to the SMS service right now.",
    SMSBOWER_REQUEST_FAILED:
      "ChapsSms could not connect to the SMS service right now.",
    INVALID_PURCHASE_RESPONSE:
      "ChapsSms could not complete the number purchase. Please try again.",
  };

  if (messages[code]) {
    return messages[code];
  }

  const rawMessage = String(
    error?.message ||
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      ""
  );

  if (/benotp|ben otp|smsbower|sms bower/i.test(rawMessage)) {
    return "ChapsSms could not complete this request. Please try again.";
  }

  return rawMessage || "ChapsSms could not complete this request. Please try again.";
}

function getPublicOrderErrorCode(
  error,
  fallback = "CHAPSSMS_ORDER_FAILED"
) {
  const code = String(error?.code || "").trim().toUpperCase();

  const safeCodes = new Set([
    "INSUFFICIENT_WALLET_BALANCE",
    "UNSAFE_PAYMENT_CONFIGURATION",
    "INVALID_ENVIRONMENT_MODE",
    "INVALID_SERVER",
    "NO_PRICE",
    "NO_NUMBERS",
    "NO_STOCK",
    "INVALID_COUNTRY",
    "INVALID_SERVICE",
    "INVALID_PRICE",
    "OPERATION_NOT_SUPPORTED",
    "ORDER_NOT_FOUND",
  ]);

  if (safeCodes.has(code)) {
    return code;
  }

  return fallback;
}

function sanitizeOrder(order) {
  if (!order) {
    return order;
  }

  const data =
    typeof order.toObject === "function"
      ? order.toObject()
      : { ...order };

  /*
   * Legacy orders may have been created before serviceName/countryName
   * fields existed. If an older pricing snapshot contains friendly labels,
   * expose them before removing the private pricing snapshot.
   */
  if (!String(data.serviceName || "").trim()) {
    data.serviceName =
      String(
        data.pricingSnapshot?.serviceName ||
          data.pricingSnapshot?.service?.name ||
          ""
      ).trim();
  }

  if (!String(data.countryName || "").trim()) {
    data.countryName =
      String(
        data.pricingSnapshot?.countryName ||
          data.pricingSnapshot?.country?.name ||
          ""
      ).trim();
  }

  const effectiveExpiresAt =
    getEffectiveOrderExpiresAt(order);

  if (effectiveExpiresAt) {
    data.expiresAt =
      effectiveExpiresAt.toISOString();
  }

  delete data.provider;
  delete data.providerResponse;
  delete data.providerPrice;
  delete data.providerCurrency;
  delete data.providerCostNgn;
  delete data.profit;
  delete data.financialStatus;
  delete data.pricingRule;
  delete data.pricingSnapshot;
  delete data.walletBalanceField;
  delete data.walletReservationReference;

  return data;
}

function sanitizeOrders(orders = []) {
  return orders.map(sanitizeOrder);
}

const VALID_ENVIRONMENTS = [
  "test",
  "live",
];

function normalizeEnvironment(
  value,
  fallback,
  variableName,
) {
  const environment =
    String(
      value || fallback,
    )
      .trim()
      .toLowerCase();

  if (
    !VALID_ENVIRONMENTS.includes(
      environment,
    )
  ) {
    const error =
      new Error(
        `${variableName} must be test or live`,
      );

    error.status = 500;
    error.code =
      "INVALID_ENVIRONMENT_MODE";

    throw error;
  }

  return environment;
}

function getPaymentEnvironment() {
  return normalizeEnvironment(
    process.env.PAYMENT_MODE,
    "test",
    "PAYMENT_MODE",
  );
}

function getSmsProviderEnvironment() {
  /*
   * SMSBower and BenOTP are live providers.
   * Defaulting this to live prevents accidental treatment as a mock.
   */
  return normalizeEnvironment(
    process.env.SMS_PROVIDER_MODE,
    "live",
    "SMS_PROVIDER_MODE",
  );
}

function getWalletBalanceField(
  environment,
) {
  return environment === "live"
    ? "balance"
    : "testBalance";
}

function getWalletBalance(
  wallet,
  balanceField,
) {
  return Number(
    wallet?.[balanceField] || 0,
  );
}


const ORDER_ACTIVATION_TTL_MS =
  20 * 60 * 1000;

function getPositiveInteger(
  value,
  fallback,
  maximum,
) {
  const parsed = Number.parseInt(
    value,
    10,
  );

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return maximum
    ? Math.min(parsed, maximum)
    : parsed;
}

function getOrderActivationTtlMs() {
  /*
   * ChapsSms activations are a fixed 20-minute window.
   * A stale/mistyped environment value must never turn this
   * into 200 minutes.
   */
  return ORDER_ACTIVATION_TTL_MS;
}

function parseProviderDate(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  const numeric = Number(value);

  if (
    Number.isFinite(numeric) &&
    numeric > 0
  ) {
    const date = new Date(
      numeric > 1e12
        ? numeric
        : numeric > 1e9
          ? numeric * 1000
          : Number.NaN,
    );

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const direct = new Date(text);

  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const isoLike = text.replace(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/,
    "$1T$2",
  );

  const normalized = new Date(isoLike);

  return Number.isNaN(normalized.getTime())
    ? null
    : normalized;
}

function getProviderStartedAtFromPurchase(
  providerOrder,
) {
  const raw = providerOrder?.raw;
  const now = Date.now();

  const candidates = [
    providerOrder?.activationTime,
    providerOrder?.activation_time,
    providerOrder?.startedAt,
    providerOrder?.started_at,
    raw?.activationTime,
    raw?.activation_time,
    raw?.startedAt,
    raw?.started_at,
    raw?.createdAt,
    raw?.created_at,
  ];

  for (const candidate of candidates) {
    const parsed = parseProviderDate(candidate);

    if (!parsed) {
      continue;
    }

    const driftMs = Math.abs(
      parsed.getTime() - now,
    );

    /*
     * The activation should have started around the current purchase.
     * Reject provider timestamps with a large timezone/format drift.
     */
    if (driftMs <= 5 * 60 * 1000) {
      return parsed;
    }
  }

  return new Date(now);
}

function getEffectiveOrderStartedAt(order) {
  const createdAt = parseProviderDate(
    order?.createdAt,
  );

  const providerStartedAt = parseProviderDate(
    order?.providerStartedAt,
  );

  if (
    providerStartedAt &&
    createdAt &&
    Math.abs(
      providerStartedAt.getTime() -
        createdAt.getTime(),
    ) <=
      5 * 60 * 1000
  ) {
    return providerStartedAt;
  }

  return createdAt || providerStartedAt;
}

function getEffectiveOrderExpiresAt(order) {
  const startedAt =
    getEffectiveOrderStartedAt(order);

  if (!startedAt) {
    return null;
  }

  return new Date(
    startedAt.getTime() +
      getOrderActivationTtlMs(),
  );
}

function getOrderBalanceContext(order) {
  const paymentEnvironment = String(
    order?.paymentEnvironment || "live",
  )
    .trim()
    .toLowerCase();

  const balanceField = [
    "balance",
    "testBalance",
  ].includes(order?.walletBalanceField)
    ? order.walletBalanceField
    : getWalletBalanceField(
        paymentEnvironment,
      );

  return {
    paymentEnvironment,
    balanceField,
  };
}

function orderExpiryHasPassed(order) {
  const expiresAt =
    getEffectiveOrderExpiresAt(order);

  return Boolean(
    expiresAt &&
      expiresAt.getTime() <=
        Date.now(),
  );
}

function createReservationReference(
  userId,
) {
  return [
    "ORDER",
    userId,
    Date.now(),
    crypto
      .randomBytes(5)
      .toString("hex"),
  ]
    .join("-")
    .toUpperCase();
}

async function ensureRefundHistoryRecord({
  userId,
  amount,
  balanceField,
  environment,
  refundReference,
  service,
  country,
  server,
  reason,
}) {
  const wallet =
    await Wallet.findOneAndUpdate(
      {
        user: userId,
        "transactions.reference": {
          $ne: refundReference,
        },
      },
      {
        $push: {
          transactions: {
            $each: [
              {
                type: "refund",
                amount,
                environment,
                balanceField,
                description:
                  `${reason}: ${service} (${country})`,
                status: "completed",
                reference:
                  refundReference,
                server,
                currency: "NGN",
              },
            ],
            $position: 0,
          },
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

  if (wallet) {
    return wallet;
  }

  return Wallet.findOne({
    user: userId,
  });
}

async function refundReservedWallet({
  userId,
  amount,
  balanceField,
  environment,
  reservationReference,
  service,
  country,
  server,
  reason,
}) {
  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(
      numericAmount,
    ) ||
    numericAmount <= 0
  ) {
    return Wallet.findOne({
      user: userId,
    });
  }

  const refundReference =
    `${reservationReference}-REFUND`
      .toUpperCase();

  /*
   * IMPORTANT:
   * Do NOT update a matched transactions element and $push to the same
   * transactions array in one MongoDB update. MongoDB can reject that as a
   * conflicting update path, which is exactly the situation that can leave a
   * failed purchase stuck as PENDING with the customer's balance still held.
   *
   * Refund in two idempotent stages instead:
   *   1. restore the balance + mark only the matching PENDING reservation FAILED;
   *   2. append the visible refund-history row, without changing the balance.
   *
   * Stage 1 is the money-critical operation. Because it only matches a PENDING
   * reservation, retries cannot credit the same reservation twice.
   */
  let wallet =
    await Wallet.findOneAndUpdate(
      {
        user: userId,
        transactions: {
          $elemMatch: {
            reference:
              reservationReference,
            status: "pending",
          },
        },
      },
      {
        $inc: {
          [balanceField]:
            numericAmount,
        },
        $set: {
          "transactions.$[purchase].status":
            "failed",
          "transactions.$[purchase].description":
            `${reason}: ${service} (${country})`,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
        arrayFilters: [
          {
            "purchase.reference":
              reservationReference,
            "purchase.status":
              "pending",
          },
        ],
      },
    );

  if (wallet) {
    try {
      return (
        await ensureRefundHistoryRecord({
          userId,
          amount: numericAmount,
          balanceField,
          environment,
          refundReference,
          service,
          country,
          server,
          reason,
        })
      ) || wallet;
    } catch (historyError) {
      /*
       * Never turn a successfully restored balance back into a customer-facing
       * refund failure merely because the extra history row could not be added.
       * The failed reservation itself still proves the reversal and prevents a
       * duplicate credit. A later recovery pass can add the history row.
       */
      console.error(
        "Refund history write failed after balance was restored:",
        historyError,
      );
      return wallet;
    }
  }

  const existingWallet =
    await Wallet.findOne({
      user: userId,
    });

  if (!existingWallet) {
    const error =
      new Error(
        "Wallet not found while reversing failed purchase",
      );

    error.status = 500;
    error.code =
      "WALLET_ROLLBACK_FAILED";
    throw error;
  }

  const refundExists =
    existingWallet.transactions
      .some(
        (item) =>
          String(
            item.reference ||
              "",
          ).toUpperCase() ===
            refundReference,
      );

  if (refundExists) {
    return existingWallet;
  }

  const reservation =
    existingWallet.transactions
      .find(
        (item) =>
          String(
            item.reference ||
              "",
          ).toUpperCase() ===
            String(
              reservationReference ||
                "",
            ).toUpperCase(),
      );

  /*
   * If stage 1 already ran on an earlier/retried request, the reservation is
   * FAILED and the balance has already been restored. Only repair the missing
   * history row here — never increment the balance again.
   */
  if (
    reservation &&
    String(
      reservation.status ||
        "",
    ).toLowerCase() ===
      "failed"
  ) {
    try {
      return (
        await ensureRefundHistoryRecord({
          userId,
          amount: numericAmount,
          balanceField,
          environment,
          refundReference,
          service,
          country,
          server,
          reason,
        })
      ) || existingWallet;
    } catch (historyError) {
      console.error(
        "Refund history recovery failed:",
        historyError,
      );
      return existingWallet;
    }
  }

  const error =
    new Error(
      reservation
        ? "Failed purchase reservation could not be reversed automatically"
        : "Failed purchase reservation was not found during automatic reversal",
    );

  error.status = 500;
  error.code =
    "WALLET_ROLLBACK_FAILED";
  throw error;
}

function getStaleReservationMs() {
  const configured = Number(
    process.env.STALE_ORDER_RESERVATION_MS,
  );

  if (
    Number.isFinite(configured) &&
    configured >= 60_000
  ) {
    return configured;
  }

  /*
   * Immediate purchase errors refund at once. This 10-minute window is only a
   * second safety net for a process/network interruption where the request died
   * before the normal catch block could reverse the wallet reservation.
   */
  return 10 * 60 * 1000;
}

async function recoverStaleReservationsForUser(
  userId,
) {
  const wallet =
    await Wallet.findOne({
      user: userId,
    });

  if (!wallet) {
    return {
      checked: 0,
      recovered: 0,
      reconciled: 0,
      failed: 0,
      wallet: null,
    };
  }

  const cutoff =
    Date.now() -
    getStaleReservationMs();

  const pendingReservations =
    (wallet.transactions || [])
      .filter((transaction) => {
        const reference =
          String(
            transaction?.reference ||
              "",
          ).toUpperCase();
        const createdAt =
          new Date(
            transaction?.createdAt ||
              0,
          ).getTime();

        return (
          transaction?.type ===
            "purchase" &&
          transaction?.status ===
            "pending" &&
          reference.startsWith(
            "ORDER-",
          ) &&
          Number.isFinite(
            createdAt,
          ) &&
          createdAt > 0 &&
          createdAt <= cutoff
        );
      });

  let recovered = 0;
  let reconciled = 0;
  let failed = 0;
  let latestWallet = wallet;

  for (
    const reservation of
    pendingReservations
  ) {
    const reference =
      String(
        reservation.reference ||
          "",
      ).toUpperCase();

    try {
      const matchingOrder =
        await Order.findOne({
          user: userId,
          walletReservationReference:
            reference,
        }).select(
          "_id sellingPrice price service serviceName country countryName server",
        );

      if (matchingOrder) {
        const amount =
          Number(
            matchingOrder.sellingPrice ||
              matchingOrder.price ||
              reservation.amount,
          );

        await Wallet.updateOne(
          {
            user: userId,
            transactions: {
              $elemMatch: {
                reference,
                status: "pending",
              },
            },
          },
          {
            $set: {
              "transactions.$[purchase].status":
                "completed",
              "transactions.$[purchase].amount":
                amount,
              "transactions.$[purchase].description":
                `${matchingOrder.serviceName || matchingOrder.service} (${matchingOrder.countryName || matchingOrder.country}) - ${matchingOrder.server}`,
              "transactions.$[purchase].orderId":
                matchingOrder._id,
            },
          },
          {
            runValidators: true,
            arrayFilters: [
              {
                "purchase.reference":
                  reference,
                "purchase.status":
                  "pending",
              },
            ],
          },
        );

        reconciled += 1;
        continue;
      }

      latestWallet =
        await refundReservedWallet({
          userId,
          amount:
            Number(
              reservation.amount,
            ),
          balanceField:
            [
              "balance",
              "testBalance",
            ].includes(
              reservation.balanceField,
            )
              ? reservation.balanceField
              : getWalletBalanceField(
                  reservation.environment ||
                    "live",
                ),
          environment:
            reservation.environment ||
            "live",
          reservationReference:
            reference,
          service:
            "Number purchase",
          country:
            "interrupted order",
          server:
            reservation.server ||
            null,
          reason:
            "Automatic refund for interrupted number purchase",
        });

      recovered += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "Stale wallet reservation recovery failed:",
        {
          reference,
          message:
            error?.message,
          code:
            error?.code,
        },
      );
    }
  }

  if (
    pendingReservations.length > 0
  ) {
    latestWallet =
      await Wallet.findOne({
        user: userId,
      });
  }

  return {
    checked:
      pendingReservations.length,
    recovered,
    reconciled,
    failed,
    wallet: latestWallet,
  };
}

async function reconcileReservation({
  userId,
  balanceField,
  reservationReference,
  reservedAmount,
  finalAmount,
}) {
  const difference =
    Number(finalAmount) -
    Number(reservedAmount);

  if (
    !Number.isFinite(
      difference,
    )
  ) {
    const error =
      new Error(
        "Invalid wallet reconciliation amount",
      );

    error.status = 500;
    error.code =
      "INVALID_RECONCILIATION_AMOUNT";

    throw error;
  }

  if (difference > 0) {
    return Wallet.findOneAndUpdate(
      {
        user: userId,

        [balanceField]: {
          $gte: difference,
        },

        "transactions.reference":
          reservationReference,
      },

      {
        $inc: {
          [balanceField]:
            -difference,
        },

        $set: {
          "transactions.$.amount":
            finalAmount,
        },
      },

      {
        returnDocument: "after",
        runValidators: true,
      },
    );
  }

  if (difference < 0) {
    return Wallet.findOneAndUpdate(
      {
        user: userId,

        "transactions.reference":
          reservationReference,
      },

      {
        $inc: {
          [balanceField]:
            Math.abs(
              difference,
            ),
        },

        $set: {
          "transactions.$.amount":
            finalAmount,
        },
      },

      {
        returnDocument: "after",
        runValidators: true,
      },
    );
  }

  return Wallet.findOneAndUpdate(
    {
      user: userId,

      "transactions.reference":
        reservationReference,
    },

    {
      $set: {
        "transactions.$.amount":
          finalAmount,
      },
    },

    {
      returnDocument: "after",
      runValidators: true,
    },
  );
}

async function completePurchaseTransaction({
  userId,
  reservationReference,
  orderId,
  amount,
  service,
  country,
  server,
}) {
  await Wallet.updateOne(
    {
      user: userId,

      "transactions.reference":
        reservationReference,
    },

    {
      $set: {
        "transactions.$.status":
          "completed",

        "transactions.$.amount":
          amount,

        "transactions.$.description":
          `${service} (${country}) - ${server}`,

        "transactions.$.orderId":
          orderId,
      },
    },

    {
      runValidators: true,
    },
  );
}

exports.createOrder =
  async (req, res) => {
    let purchasedProviderOrder =
      null;

    let walletWasDebited =
      false;

    let debitedAmount = 0;

    let reservationReference =
      "";

    let balanceField =
      "balance";

    let paymentEnvironment =
      "live";

    let normalizedCountry =
      "";

    let normalizedService =
      "";

    let normalizedServer =
      "";

    let displayCountryName =
      "";

    let displayServiceName =
      "";

    try {
      /*
       * Before starting a new purchase, repair any old interrupted reservation
       * for this user. This is only the stale safety net; normal failures are
       * refunded immediately in the catch block below.
       */
      await recoverStaleReservationsForUser(
        req.user._id,
      ).catch((recoveryError) => {
        console.error(
          "Pre-purchase stale reservation recovery failed:",
          recoveryError,
        );
      });

      paymentEnvironment =
        getPaymentEnvironment();

      const smsProviderEnvironment =
        getSmsProviderEnvironment();

      /*
       * The current provider manager contains real SMSBower and BenOTP
       * integrations. It does not contain a mock provider.
       */
      if (
        smsProviderEnvironment ===
        "test"
      ) {
        return res
          .status(503)
          .json({
            success: false,

            code:
              "MOCK_SMS_PROVIDER_NOT_CONFIGURED",

            message:
              "Test number purchasing is disabled on ChapsSms because a mock SMS service is not configured. Test wallet funds cannot be used for live number purchases.",
          });
      }

      /*
       * Most important safety gate:
       * test payment money cannot reach a live SMS provider.
       */
      if (
        paymentEnvironment !==
        smsProviderEnvironment
      ) {
        return res
          .status(503)
          .json({
            success: false,

            code:
              "UNSAFE_PAYMENT_CONFIGURATION",

            message:
              "Number purchasing is temporarily disabled on ChapsSms because payment testing is still enabled. Switch the payment and SMS systems to live before accepting real purchases.",
          });
      }

      balanceField =
        getWalletBalanceField(
          paymentEnvironment,
        );

      const {
        country,
        service,
        countryName,
        serviceName,
        operator,
        server,
      } = req.body;

      if (
        !country ||
        !service
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Country and service are required",
          });
      }

      normalizedCountry =
        normalizeCountry(
          country,
        );

      normalizedService =
        normalizeService(
          service,
        );

      const normalizedCountryName =
        String(
          countryName || "",
        ).trim();

      const normalizedServiceName =
        String(
          serviceName || "",
        ).trim();

      displayCountryName =
        normalizedCountryName ||
        normalizedCountry;

      displayServiceName =
        normalizedServiceName ||
        normalizedService;

      const requestedOperator =
        normalizeOperator(
          operator,
        );

      normalizedServer =
        normalizeServer(
          server,
        );

      if (
        !VALID_SERVERS.includes(
          normalizedServer,
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Select a valid SMS server",
          });
      }

      const pricingStrategy =
        await pricingService
          .resolvePricingStrategy({
            server:
              normalizedServer,

            country:
              normalizedCountry,

            service:
              normalizedService,

            countryName:
              normalizedCountryName,

            serviceName:
              normalizedServiceName,

            requestedOperator,
          });

      let normalizedOperator =
        pricingStrategy.operator;

      let preliminaryQuote;
      let automaticSelection =
        null;
      let fixedOperatorFallbackSelection =
        null;
      let pricingBasisNgn =
        null;

      /*
       * Only an ADMIN/DATABASE fixed-operator rule gets automatic operator
       * fallback. If a customer explicitly requested an operator, keep that
       * request exact and never silently switch it.
       *
       * The saved fixed operator always remains the preferred operator.
       * Every new order checks it first, so the system automatically returns
       * to it as soon as SMSBower reports live stock again.
       */
      const fixedOperatorFallbackEnabled =
        pricingStrategy.pricingStyle ===
          "fixed_operator" &&
        pricingStrategy.source ===
          "database";

      const preferredFixedOperator =
        fixedOperatorFallbackEnabled
          ? normalizeOperator(
              pricingStrategy.operator
            )
          : null;

      const fixedFallbackPoolPercent =
        Number(
          process.env
            .FIXED_OPERATOR_FALLBACK_POOL_PERCENT ||
            100
        );

      const resolveFixedOperatorFallback =
        async (excludeOperators = []) =>
          automaticPricingService
            .resolveFixedOperatorFallbackQuote({
              server:
                normalizedServer,
              country:
                normalizedCountry,
              service:
                normalizedService,
              excludeOperators,
              maxPriceBufferPercent:
                fixedFallbackPoolPercent,
            });

      /*
       * Cheapest + buffer continues to use the normal automatic selector.
       *
       * Fixed operator now means:
       *   1. Try the saved preferred operator first.
       *   2. If it definitively has no number/stock, select a fallback from
       *      the cheapest live operators.
       *   3. Inside that cheap pool, prefer SMSBower's provider-side
       *      ranking/statistics when available; otherwise use stock/cost.
       */
      if (
        pricingStrategy.pricingStyle ===
        "cheapest_buffer"
      ) {
        automaticSelection =
          await automaticPricingService
            .resolveAutomaticQuote({
              server:
                normalizedServer,
              country:
                normalizedCountry,
              service:
                normalizedService,
              maxPriceBufferPercent:
                pricingStrategy
                  .maxPriceBufferPercent,
            });

        normalizedOperator =
          automaticSelection.operator;

        preliminaryQuote =
          automaticSelection.quote;

        pricingBasisNgn =
          automaticSelection
            .pricingBasisNgn;
      } else {
        try {
          preliminaryQuote =
            await providerManager
              .getPrice({
                server:
                  normalizedServer,

                country:
                  normalizedCountry,

                service:
                  normalizedService,

                operator:
                  normalizedOperator,
              });
        } catch (quoteError) {
          if (
            !fixedOperatorFallbackEnabled ||
            !isDefinitiveAvailabilityFailure(
              quoteError
            )
          ) {
            throw quoteError;
          }

          fixedOperatorFallbackSelection =
            await resolveFixedOperatorFallback(
              [
                preferredFixedOperator,
              ]
            );

          normalizedOperator =
            fixedOperatorFallbackSelection
              .operator;

          preliminaryQuote =
            fixedOperatorFallbackSelection
              .quote;
        }

        /*
         * Some provider price endpoints return a valid quote with stock=0
         * instead of throwing NO_NUMBERS. Treat that as a definitive
         * availability failure and move to the ranked fallback pool.
         */
        const fixedQuoteStock =
          Number(
            preliminaryQuote?.stock
          );

        if (
          fixedOperatorFallbackEnabled &&
          !fixedOperatorFallbackSelection &&
          Number.isFinite(
            fixedQuoteStock
          ) &&
          fixedQuoteStock <= 0
        ) {
          fixedOperatorFallbackSelection =
            await resolveFixedOperatorFallback(
              [
                preferredFixedOperator,
              ]
            );

          normalizedOperator =
            fixedOperatorFallbackSelection
              .operator;

          preliminaryQuote =
            fixedOperatorFallbackSelection
              .quote;
        }
      }

      if (
        process.env.NODE_ENV !==
        "production"
      ) {
        const selectionDebug =
          automaticSelection ||
          fixedOperatorFallbackSelection;

        console.log(
          "[Operator selection] purchase selection:",
          {
            server:
              normalizedServer,
            country:
              normalizedCountry,
            service:
              normalizedService,
            operator:
              normalizedOperator,
            preferredFixedOperator:
              preferredFixedOperator ||
              null,
            strategy:
              selectionDebug
                ?.strategy ||
              "exact_operator",
            candidateCount:
              selectionDebug
                ?.candidateCount ||
              0,
            selectionPercent:
              selectionDebug
                ?.selectionPercent ??
              null,
            eligibleCount:
              selectionDebug
                ?.eligibleCount ||
              0,
            providerTier:
              selectionDebug
                ?.providerTier ??
              null,
            providerRank:
              selectionDebug
                ?.providerRank ??
              null,
            providerStatsSource:
              selectionDebug
                ?.providerStatsSource ??
              null,
          }
        );
      }

      const preliminaryStock =
        Number(
          preliminaryQuote?.stock,
        );

      /*
       * If the live quote already reports zero stock, stop before reserving
       * any customer money.
       */
      if (
        Number.isFinite(
          preliminaryStock,
        ) &&
        preliminaryStock <= 0
      ) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              "NO_NUMBERS",
            message:
              "ChapsSms does not currently have numbers available for this selection. Try another server or service.",
            walletDebited:
              false,
          });
      }

      const preliminaryPricing =
        await pricingService
          .resolveCustomerPricing({
            server:
              normalizedServer,

            country:
              normalizedCountry,

            service:
              normalizedService,

            countryName:
              normalizedCountryName,

            serviceName:
              normalizedServiceName,

            operator:
              normalizedOperator,

            providerPrice:
              preliminaryQuote.price,

            providerCurrency:
              preliminaryQuote.currency,

            pricingBasisNgn,
          });

      const reservedAmount =
        Number(
          preliminaryPricing
            .sellingPrice,
        );

      if (
        !Number.isFinite(
          reservedAmount,
        ) ||
        reservedAmount <= 0
      ) {
        return res
          .status(502)
          .json({
            success: false,
            message:
              "The calculated selling price is invalid",
          });
      }

      reservationReference =
        createReservationReference(
          req.user._id,
        );

      /*
       * Reserve/deduct the ChapsSmS wallet BEFORE purchasing
       * from SMSBower or BenOTP.
       */
      let wallet =
        await Wallet.findOneAndUpdate(
          {
            user:
              req.user._id,

            [balanceField]: {
              $gte:
                reservedAmount,
            },
          },

          {
            $inc: {
              [balanceField]:
                -reservedAmount,
            },

            $push: {
              transactions: {
                $each: [
                  {
                    type:
                      "purchase",

                    amount:
                      reservedAmount,

                    environment:
                      paymentEnvironment,

                    balanceField,

                    description:
                      `Reserved for ${displayServiceName} (${displayCountryName}) - ${normalizedServer}`,

                    status:
                      "pending",

                    reference:
                      reservationReference,

                    server:
                      normalizedServer,

                    currency:
                      "NGN",
                  },
                ],

                $position: 0,
              },
            },
          },

          {
            returnDocument: "after",
            runValidators: true,
          },
        );

      if (!wallet) {
        const latestWallet =
          await Wallet.findOne({
            user:
              req.user._id,
          }).select(
            "balance testBalance",
          );

        if (!latestWallet) {
          return res
            .status(404)
            .json({
              success: false,
              code:
                "WALLET_NOT_FOUND",
              message:
                "Wallet not found",
            });
        }

        return res
          .status(400)
          .json({
            success: false,

            code:
              "INSUFFICIENT_WALLET_BALANCE",

            message:
              "Insufficient ChapsSmS wallet balance. Fund your live wallet before purchasing a number.",

            walletBalance:
              getWalletBalance(
                latestWallet,
                balanceField,
              ),

            requiredAmount:
              reservedAmount,

            paymentEnvironment,
          });
      }

      walletWasDebited =
        true;

      debitedAmount =
        reservedAmount;

      /*
       * Availability failover safety:
       *
       * - A different operator is tried ONLY after a definitive availability
       *   response such as NO_NUMBERS / NO_STOCK.
       * - Network timeouts, connection resets, malformed responses, and other
       *   uncertain purchase results are NEVER retried on another operator,
       *   because the first provider request may already have created an
       *   activation.
       * - The fallback candidate must not make the customer pay more than the
       *   amount that was already calculated/reserved for this order.
       */
      const purchaseFromRankedSelection =
        async ({
          selection,
          customerPricingBasisNgn =
            null,
          logLabel =
            "automatic",
        }) => {
          const purchaseCandidates =
            buildAutomaticPurchaseCandidates(
              selection,
              selection?.operator ||
                normalizedOperator,
            );

          let lastAvailabilityError =
            null;

          for (
            const candidateOperator of
            purchaseCandidates
          ) {
            let candidateQuote;

            try {
              candidateQuote =
                candidateOperator ===
                  normalizedOperator
                  ? preliminaryQuote
                  : await providerManager
                      .getPrice({
                        server:
                          normalizedServer,
                        country:
                          normalizedCountry,
                        service:
                          normalizedService,
                        operator:
                          candidateOperator,
                      });
            } catch (quoteError) {
              /*
               * Quoting is read-only, so an unavailable candidate can be
               * skipped without creating a double-purchase risk.
               */
              if (
                isDefinitiveAvailabilityFailure(
                  quoteError
                )
              ) {
                lastAvailabilityError =
                  quoteError;
                continue;
              }

              throw quoteError;
            }

            const candidateStock =
              Number(
                candidateQuote?.stock
              );

            if (
              Number.isFinite(
                candidateStock
              ) &&
              candidateStock <= 0
            ) {
              const stockError =
                new Error(
                  "Fallback operator has no live stock"
                );

              stockError.status =
                409;
              stockError.code =
                "NO_NUMBERS";

              lastAvailabilityError =
                stockError;
              continue;
            }

            const candidatePricing =
              await pricingService
                .resolveCustomerPricing({
                  server:
                    normalizedServer,
                  country:
                    normalizedCountry,
                  service:
                    normalizedService,
                  countryName:
                    displayCountryName,
                  serviceName:
                    displayServiceName,
                  operator:
                    candidateOperator,
                  providerPrice:
                    candidateQuote.price,
                  providerCurrency:
                    candidateQuote.currency,
                  pricingBasisNgn:
                    customerPricingBasisNgn,
                });

            const candidateSellingPrice =
              Number(
                candidatePricing
                  .sellingPrice
              );

            /*
             * Do not silently increase the customer's charge after they
             * already initiated the order.
             */
            if (
              !Number.isFinite(
                candidateSellingPrice
              ) ||
              candidateSellingPrice >
                reservedAmount
            ) {
              continue;
            }

            try {
              purchasedProviderOrder =
                await providerManager
                  .buyNumber({
                    server:
                      normalizedServer,
                    country:
                      normalizedCountry,
                    service:
                      normalizedService,
                    operator:
                      candidateOperator,
                  });

              normalizedOperator =
                candidateOperator;

              preliminaryQuote =
                candidateQuote;

              if (
                process.env.NODE_ENV !==
                "production"
              ) {
                console.log(
                  `[${logLabel}] purchase candidate succeeded:`,
                  {
                    server:
                      normalizedServer,
                    country:
                      normalizedCountry,
                    service:
                      normalizedService,
                    operator:
                      candidateOperator,
                  }
                );
              }

              break;
            } catch (purchaseError) {
              if (
                isDefinitiveAvailabilityFailure(
                  purchaseError
                )
              ) {
                lastAvailabilityError =
                  purchaseError;

                if (
                  process.env.NODE_ENV !==
                  "production"
                ) {
                  console.log(
                    `[${logLabel}] candidate unavailable, checking next ranked operator:`,
                    {
                      server:
                        normalizedServer,
                      country:
                        normalizedCountry,
                      service:
                        normalizedService,
                      operator:
                        candidateOperator,
                      code:
                        purchaseError?.code,
                    }
                  );
                }

                continue;
              }

              /*
               * Uncertain mutation result: stop immediately. The outer error
               * path may restore the ChapsSms reservation, but we must not send
               * another provider purchase request.
               */
              throw purchaseError;
            }
          }

          if (!purchasedProviderOrder) {
            if (lastAvailabilityError) {
              throw lastAvailabilityError;
            }

            const noCandidateError =
              new Error(
                "No eligible fallback operator can currently provide this number at the displayed ChapsSms price"
              );

            noCandidateError.status =
              409;
            noCandidateError.code =
              "NO_NUMBERS";

            throw noCandidateError;
          }
        };

      if (automaticSelection) {
        /*
         * Existing Cheapest + buffer behaviour.
         */
        await purchaseFromRankedSelection({
          selection:
            automaticSelection,
          customerPricingBasisNgn:
            pricingBasisNgn,
          logLabel:
            "Automatic pricing",
        });
      } else if (
        fixedOperatorFallbackEnabled
      ) {
        /*
         * ADMIN FIXED OPERATOR:
         *
         * The configured operator remains the permanent preference.
         *
         * If it was healthy during the quote, try it first. If the provider
         * definitively reports that stock disappeared before the purchase
         * completed, build a FRESH fallback pool excluding that operator and
         * continue with the best cheap/ranked candidate.
         *
         * If the preferred operator was already unavailable during the quote,
         * fixedOperatorFallbackSelection is already populated and we can go
         * directly to the ranked fallback candidates.
         */
        if (
          !fixedOperatorFallbackSelection
        ) {
          try {
            purchasedProviderOrder =
              await providerManager
                .buyNumber({
                  server:
                    normalizedServer,
                  country:
                    normalizedCountry,
                  service:
                    normalizedService,
                  operator:
                    preferredFixedOperator,
                });

            normalizedOperator =
              preferredFixedOperator;
          } catch (purchaseError) {
            if (
              !isDefinitiveAvailabilityFailure(
                purchaseError
              )
            ) {
              throw purchaseError;
            }

            fixedOperatorFallbackSelection =
              await resolveFixedOperatorFallback(
                [
                  preferredFixedOperator,
                ]
              );

            normalizedOperator =
              fixedOperatorFallbackSelection
                .operator;

            preliminaryQuote =
              fixedOperatorFallbackSelection
                .quote;
          }
        }

        if (
          !purchasedProviderOrder &&
          fixedOperatorFallbackSelection
        ) {
          await purchaseFromRankedSelection({
            selection:
              fixedOperatorFallbackSelection,

            /*
             * Fixed-operator pricing should be recalculated from each actual
             * fallback operator's provider cost/rule. Do not carry a previous
             * operator's cost basis into the fallback.
             */
            customerPricingBasisNgn:
              null,

            logLabel:
              "Fixed operator fallback",
          });
        }
      } else {
        /*
         * Customer-selected/manual operator remains exact. Only an admin
         * database fixed-operator rule receives automatic fallback.
         */
        purchasedProviderOrder =
          await providerManager
            .buyNumber({
              server:
                normalizedServer,
              country:
                normalizedCountry,
              service:
                normalizedService,
              operator:
                normalizedOperator,
            });
      }

      const providerPrice =
        Number(
          purchasedProviderOrder
            .providerPrice,
        );

      if (
        !Number.isFinite(
          providerPrice,
        ) ||
        providerPrice <= 0
      ) {
        const error =
          new Error(
            "Provider returned an invalid purchase price",
          );

        error.status = 502;
        error.code =
          "INVALID_PROVIDER_PRICE";

        throw error;
      }

      const providerCurrency =
        purchasedProviderOrder
          .providerCurrency ||
        preliminaryQuote.currency;

      const actualOperator =
        normalizeOperator(
          purchasedProviderOrder
            .operator ||
            normalizedOperator,
        );

      const finalPricing =
        await pricingService
          .resolveCustomerPricing({
            server:
              normalizedServer,

            country:
              normalizedCountry,

            service:
              normalizedService,

            countryName:
              normalizedCountryName,

            serviceName:
              normalizedServiceName,

            operator:
              actualOperator,

            providerPrice,

            providerCurrency,

            pricingBasisNgn,
          });

      const finalAmount =
        Number(
          finalPricing
            .sellingPrice,
        );

      if (
        !Number.isFinite(
          finalAmount,
        ) ||
        finalAmount <= 0
      ) {
        const error =
          new Error(
            "The final selling price is invalid",
          );

        error.status = 502;
        error.code =
          "INVALID_FINAL_PRICE";

        throw error;
      }

      wallet =
        await reconcileReservation({
          userId:
            req.user._id,

          balanceField,

          reservationReference,

          reservedAmount,

          finalAmount,
        });

      if (!wallet) {
        /*
         * The final provider price increased and the customer cannot
         * cover the difference. Cancel the provider activation and
         * return the reserved amount.
         */
        try {
          await providerManager.cancelOrder(
            purchasedProviderOrder
              .internalProvider,

            purchasedProviderOrder
              .providerOrderId,
          );
        } catch (cancelError) {
          console.error(
            "Final-price cancellation failed:",
            cancelError,
          );
        }

        await refundReservedWallet({
          userId:
            req.user._id,

          amount:
            reservedAmount,

          balanceField,

          environment:
            paymentEnvironment,

          reservationReference,

          service:
            normalizedService,

          country:
            normalizedCountry,

          server:
            normalizedServer,

          reason:
            "Automatic refund because the final price exceeded the available wallet balance",
        });

        walletWasDebited =
          false;

        purchasedProviderOrder =
          null;

        const latestWallet =
          await Wallet.findOne({
            user:
              req.user._id,
          });

        return res
          .status(400)
          .json({
            success: false,

            code:
              "INSUFFICIENT_FINAL_BALANCE",

            message:
              "The live provider price changed and your wallet could not cover the difference. The provider order was cancelled and your wallet was refunded.",

            walletBalance:
              getWalletBalance(
                latestWallet,
                balanceField,
              ),

            requiredAmount:
              finalAmount,
          });
      }

      debitedAmount =
        finalAmount;

      const providerStartedAt =
        getProviderStartedAtFromPurchase(
          purchasedProviderOrder,
        );

      let order;

      try {
        order =
          await Order.create({
            user:
              req.user._id,

            customerEmail:
              req.user.email ||
              "",

            customerName:
              req.user.username ||
              [
                req.user
                  .firstName,
                req.user
                  .lastName,
              ]
                .filter(
                  Boolean,
                )
                .join(" ")
                .trim(),

            country:
              normalizedCountry,

            countryName:
              displayCountryName,

            service:
              normalizedService,

            serviceName:
              displayServiceName,

            operator:
              actualOperator,

            phoneNumber:
              purchasedProviderOrder
                .phoneNumber,

            price:
              finalAmount,

            sellingPrice:
              finalAmount,

            providerPrice,

            providerCurrency:
              finalPricing
                .providerCurrency,

            providerCostNgn:
              finalPricing
                .providerCostNgn,

            profit:
              finalPricing.profit,

            financialStatus:
              "charged",

            pricingRule:
              finalPricing
                .pricingRule ||
              null,

            pricingSnapshot:
              finalPricing
                .pricingSnapshot ||
              null,

            paymentEnvironment,

            walletBalanceField:
              balanceField,

            walletReservationReference:
              reservationReference,

            providerStartedAt,

            expiresAt:
              new Date(
                providerStartedAt.getTime() +
                  getOrderActivationTtlMs(),
              ),

            autoRefundEligible:
              true,

            server:
              purchasedProviderOrder
                .server ||
              normalizedServer,

            provider:
              purchasedProviderOrder
                .internalProvider,

            providerOrderId:
              String(
                purchasedProviderOrder
                  .providerOrderId,
              ),

            providerStatus:
              String(
                purchasedProviderOrder
                  .providerStatus ||
                  "STATUS_WAIT_CODE",
              ),

            providerResponse:
              purchasedProviderOrder
                .raw,

            status:
              "waiting",

            refunded:
              false,
          });
      } catch (saveError) {
        throw saveError;
      }

      await completePurchaseTransaction({
        userId:
          req.user._id,

        reservationReference,

        orderId:
          order._id,

        amount:
          finalAmount,

        service:
          displayServiceName,

        country:
          displayCountryName,

        server:
          normalizedServer,
      });

      walletWasDebited =
        false;

      purchasedProviderOrder =
        null;

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Number purchased successfully",

          order:
            sanitizeOrder(
              order,
            ),

          walletBalance:
            getWalletBalance(
              wallet,
              balanceField,
            ),

          paymentEnvironment,
        });
    } catch (error) {
      if (
        purchasedProviderOrder
          ?.providerOrderId
      ) {
        try {
          await providerManager.cancelOrder(
            purchasedProviderOrder
              .internalProvider,

            purchasedProviderOrder
              .providerOrderId,
          );
        } catch (cancelError) {
          console.error(
            "Provider rollback failed:",
            cancelError,
          );
        }
      }

      let rollbackWallet =
        null;

      let rollbackError =
        null;

      if (
        walletWasDebited &&
        debitedAmount > 0 &&
        reservationReference
      ) {
        try {
          rollbackWallet =
            await refundReservedWallet({
              userId:
                req.user._id,

              amount:
                debitedAmount,

              balanceField,

              environment:
                paymentEnvironment,

              reservationReference,

              service:
                displayServiceName ||
                normalizedService ||
                "SMS",

              country:
                displayCountryName ||
                normalizedCountry ||
                "unknown",

              server:
                normalizedServer ||
                null,

              reason:
                "Automatic refund for failed number purchase",
            });
        } catch (refundError) {
          rollbackError =
            refundError;

          console.error(
            "Automatic wallet rollback failed:",
            refundError,
          );
        }
      }

      console.error(
        "Create order error:",
        error,
      );

      /*
       * If the provider purchase failed AND the automatic balance reversal
       * also failed, expose that as a server problem instead of pretending
       * the normal provider error is the whole story. The stale-reservation
       * recovery endpoint remains a second safety net.
       */
      if (rollbackError) {
        return res
          .status(500)
          .json({
            success: false,
            code:
              "WALLET_ROLLBACK_FAILED",
            message:
              "The number purchase failed and ChapsSms could not immediately restore the reserved wallet balance. Please refresh Payment History while ChapsSms recovery retries the reversal.",
          });
      }

      return res
        .status(
          error.status ||
            500,
        )
        .json({
          success: false,

          code:
            getPublicOrderErrorCode(
              error,
              "ORDER_CREATION_FAILED",
            ),

          message:
            extractProviderError(
              error,
            ) ||
            "Unable to create order",

          /*
           * This lets clients reconcile immediately. Even clients that do
           * not read this field should refresh /wallet after an error.
           */
          refunded:
            Boolean(
              rollbackWallet,
            ),

          walletBalance:
            rollbackWallet
              ? getWalletBalance(
                  rollbackWallet,
                  balanceField,
                )
              : undefined,
        });
    }
  };


async function refundTerminalProviderOrder({
  order,
  providerOrder = null,
  terminalStatus,
}) {
  const latestOrder = await Order.findById(
    order._id,
  );

  if (!latestOrder) {
    const error = new Error(
      "Order not found while reconciling refund",
    );
    error.status = 404;
    error.code = "ORDER_NOT_FOUND";
    throw error;
  }

  if (
    latestOrder.status === "received" ||
    latestOrder.otpCode
  ) {
    return {
      order: latestOrder,
      wallet: null,
      refunded: Boolean(
        latestOrder.refunded,
      ),
    };
  }

  /*
   * Historical orders are deliberately excluded from automatic refunds.
   * Some of them were manually compensated before this fix existed.
   */
  if (!latestOrder.autoRefundEligible) {
    latestOrder.status = terminalStatus;
    latestOrder.providerStatus = String(
      providerOrder?.providerStatus ||
        latestOrder.providerStatus ||
        (terminalStatus === "expired"
          ? "NO_ACTIVATION"
          : "STATUS_CANCEL"),
    ).toUpperCase();
    latestOrder.providerLastCheckedAt =
      new Date();

    if (providerOrder?.raw !== undefined) {
      latestOrder.providerResponse =
        providerOrder.raw;
    }

    if (terminalStatus === "cancelled") {
      latestOrder.providerCancelledAt =
        latestOrder.providerCancelledAt ||
        new Date();
    }

    await latestOrder.save();

    return {
      order: latestOrder,
      wallet: null,
      refunded: false,
    };
  }

  const {
    paymentEnvironment,
    balanceField,
  } = getOrderBalanceContext(latestOrder);

  if (latestOrder.refunded) {
    const wallet = await Wallet.findOne({
      user: latestOrder.user,
    });

    return {
      order: latestOrder,
      wallet,
      refunded: true,
    };
  }

  const refundAmount = Number(
    latestOrder.sellingPrice ||
      latestOrder.price,
  );

  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0
  ) {
    const error = new Error(
      "Invalid automatic refund amount",
    );
    error.status = 500;
    error.code = "INVALID_REFUND_AMOUNT";
    throw error;
  }

  const providerStatus = String(
    providerOrder?.providerStatus ||
      latestOrder.providerStatus ||
      (terminalStatus === "expired"
        ? "NO_ACTIVATION"
        : "STATUS_CANCEL"),
  )
    .trim()
    .toUpperCase();

  /*
   * IMPORTANT: same idempotency reference used by manual Cancel Order.
   * Automatic timeout reconciliation and a user cancellation therefore
   * cannot credit the same activation twice.
   */
  const refundReference =
    `ORDER-${latestOrder._id}-CANCEL-REFUND`
      .toUpperCase();

  const claimedOrder =
    await Order.findOneAndUpdate(
      {
        _id: latestOrder._id,
        autoRefundEligible: true,
        refunded: { $ne: true },
        status: {
          $in: [
            "waiting",
            "cancelled",
            "expired",
          ],
        },
      },
      {
        $set: {
          status: "cancelling",
          providerStatus,
          providerLastCheckedAt:
            new Date(),
          ...(providerOrder?.raw !==
          undefined
            ? {
                providerResponse:
                  providerOrder.raw,
              }
            : {}),
        },
      },
      {
        returnDocument: "after",
      },
    );

  if (!claimedOrder) {
    const currentOrder =
      await Order.findById(
        latestOrder._id,
      );
    const wallet =
      await Wallet.findOne({
        user: latestOrder.user,
      });

    return {
      order: currentOrder || latestOrder,
      wallet,
      refunded: Boolean(
        currentOrder?.refunded,
      ),
    };
  }

  let wallet =
    await Wallet.findOneAndUpdate(
      {
        user: claimedOrder.user,
        "transactions.reference": {
          $ne: refundReference,
        },
      },
      {
        $inc: {
          [balanceField]: refundAmount,
        },
        $push: {
          transactions: {
            $each: [
              {
                type: "refund",
                amount: refundAmount,
                environment:
                  paymentEnvironment,
                balanceField,
                description:
                  `Automatic refund for ${terminalStatus} ${claimedOrder.serviceName || claimedOrder.service} activation`,
                status: "completed",
                reference:
                  refundReference,
                orderId: claimedOrder._id,
                server: claimedOrder.server,
                currency: "NGN",
              },
            ],
            $position: 0,
          },
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

  if (!wallet) {
    wallet = await Wallet.findOne({
      user: claimedOrder.user,
    });

    const refundExists =
      wallet?.transactions?.some(
        (transaction) =>
          String(
            transaction.reference || "",
          ) === refundReference,
      );

    if (!refundExists) {
      await Order.findByIdAndUpdate(
        claimedOrder._id,
        {
          $set: {
            status: terminalStatus,
            refunded: false,
            financialStatus: "charged",
            providerStatus,
            providerLastCheckedAt:
              new Date(),
          },
        },
      );

      const error = new Error(
        "The provider activation ended, but the ChapsSms wallet refund could not be completed",
      );
      error.status = 500;
      error.code = "WALLET_REFUND_FAILED";
      throw error;
    }
  }

  const updatedOrder =
    await Order.findByIdAndUpdate(
      claimedOrder._id,
      {
        $set: {
          status: terminalStatus,
          refunded: true,
          refundedAt: new Date(),
          financialStatus: "refunded",
          providerStatus,
          providerLastCheckedAt:
            new Date(),
          ...(terminalStatus === "cancelled"
            ? {
                providerCancelledAt:
                  claimedOrder.providerCancelledAt ||
                  new Date(),
              }
            : {}),
          ...(providerOrder?.raw !==
          undefined
            ? {
                providerResponse:
                  providerOrder.raw,
              }
            : {}),
        },
      },
      {
        returnDocument: "after",
      },
    );

  return {
    order: updatedOrder,
    wallet,
    refunded: true,
    refundAmount,
  };
}

async function reconcileOrderLifecycle(order) {
  if (!order) {
    return {
      order: null,
      wallet: null,
      refunded: false,
    };
  }

  if (
    order.status === "received" ||
    order.otpCode
  ) {
    return {
      order,
      wallet: null,
      refunded: Boolean(order.refunded),
    };
  }

  if (
    ["cancelled", "expired"].includes(
      order.status,
    )
  ) {
    if (order.refunded) {
      return {
        order,
        wallet: null,
        refunded: true,
      };
    }

    return refundTerminalProviderOrder({
      order,
      terminalStatus: order.status,
    });
  }

  if (order.status === "cancelling") {
    return {
      order,
      wallet: null,
      refunded: Boolean(order.refunded),
    };
  }

  if (
    !order.provider ||
    !order.providerOrderId
  ) {
    return {
      order,
      wallet: null,
      refunded: Boolean(order.refunded),
    };
  }

  let providerOrder;

  try {
    providerOrder =
      await providerManager.getOrder(
        order.provider,
        order.providerOrderId,
      );
  } catch (error) {
    /*
     * Some providers return NO_ACTIVATION after an activation has aged out.
     * Treat that as expiry only after ChapsSms' persisted expiry has passed.
     */
    if (
      String(error?.code || "")
        .trim()
        .toUpperCase() ===
        "NO_ACTIVATION" &&
      orderExpiryHasPassed(order)
    ) {
      return refundTerminalProviderOrder({
        order,
        providerOrder: {
          providerStatus:
            "NO_ACTIVATION",
          raw:
            error?.rawResponse ||
            "NO_ACTIVATION",
        },
        terminalStatus: "expired",
      });
    }

    throw error;
  }

  const providerStatus = String(
    providerOrder.providerStatus ||
      providerOrder.status ||
      "",
  )
    .trim()
    .toUpperCase();

  const normalizedStatus = String(
    providerOrder.status || "waiting",
  )
    .trim()
    .toLowerCase();

  const allowedStatuses = [
    "waiting",
    "received",
    "expired",
    "cancelled",
  ];

  const status = allowedStatuses.includes(
    normalizedStatus,
  )
    ? normalizedStatus
    : "waiting";

  const smsText = String(
    providerOrder.sms || "",
  ).trim();
  const directOtp = String(
    providerOrder.otpCode || "",
  ).trim();
  const otpMatch = smsText.match(
    /\b\d{4,8}\b/,
  );
  const otpCode =
    directOtp || otpMatch?.[0] || "";

  if (
    otpCode ||
    status === "received"
  ) {
    order.providerStatus =
      providerStatus ||
      order.providerStatus ||
      "STATUS_OK";
    order.providerLastCheckedAt =
      new Date();

    if (providerOrder.raw !== undefined) {
      order.providerResponse =
        providerOrder.raw;
    }

    if (providerOrder.operator) {
      order.operator = normalizeOperator(
        providerOrder.operator,
      );
    }

    if (smsText) {
      order.sms = smsText;
    }

    if (otpCode) {
      order.otpCode = otpCode;
    }

    order.status = "received";
    order.financialStatus = "earned";
    order.otpReceivedAt =
      order.otpReceivedAt || new Date();

    try {
      const finishedOrder =
        await providerManager.finishOrder(
          order.provider,
          order.providerOrderId,
        );

      if (finishedOrder?.providerStatus) {
        order.providerStatus = String(
          finishedOrder.providerStatus,
        ).toUpperCase();
      }

      order.providerFinishedAt =
        new Date();
    } catch (finishError) {
      if (
        finishError.code !==
        "OPERATION_NOT_SUPPORTED"
      ) {
        console.error(
          "Finish activation failed:",
          finishError,
        );
      }
    }

    await order.save();

    return {
      order,
      wallet: null,
      refunded: false,
    };
  }

  if (
    status === "cancelled" ||
    status === "expired"
  ) {
    return refundTerminalProviderOrder({
      order,
      providerOrder,
      terminalStatus: status,
    });
  }

  order.providerStatus =
    providerStatus ||
    order.providerStatus ||
    "STATUS_WAIT_CODE";
  order.status = "waiting";
  order.providerLastCheckedAt =
    new Date();

  if (providerOrder.raw !== undefined) {
    order.providerResponse =
      providerOrder.raw;
  }

  if (providerOrder.operator) {
    order.operator = normalizeOperator(
      providerOrder.operator,
    );
  }

  if (smsText) {
    order.sms = smsText;
  }

  await order.save();

  return {
    order,
    wallet: null,
    refunded: false,
  };
}

let lifecycleSweepRunning = false;
let lifecycleReconcilerStarted = false;

function getLifecycleSweepIntervalMs() {
  return getPositiveInteger(
    process.env.ORDER_RECONCILE_INTERVAL_MS,
    30000,
    5 * 60 * 1000,
  );
}

async function runLifecycleSweep() {
  if (lifecycleSweepRunning) {
    return;
  }

  lifecycleSweepRunning = true;

  try {
    const interval =
      getLifecycleSweepIntervalMs();
    const batchSize = getPositiveInteger(
      process.env.ORDER_RECONCILE_BATCH_SIZE,
      20,
      100,
    );
    const staleCheckBefore = new Date(
      Date.now() - interval,
    );

    const orders = await Order.find({
      autoRefundEligible: true,
      refunded: { $ne: true },
      status: "waiting",

      /*
       * createdAt is ChapsSms-controlled and cannot carry an upstream
       * timezone error. After 20 minutes, verify the real provider
       * status before refunding.
       */
      createdAt: {
        $lte: new Date(
          Date.now() -
            getOrderActivationTtlMs(),
        ),
      },

      $or: [
        { providerLastCheckedAt: null },
        {
          providerLastCheckedAt: {
            $lte: staleCheckBefore,
          },
        },
      ],
    })
      .sort({ expiresAt: 1 })
      .limit(batchSize);

    for (const order of orders) {
      try {
        const result =
          await reconcileOrderLifecycle(order);

        if (result.refunded) {
          console.log(
            "[Order lifecycle] automatic refund completed:",
            {
              orderId: String(
                result.order?._id || order._id,
              ),
              status: result.order?.status,
            },
          );
        }
      } catch (error) {
        console.warn(
          "[Order lifecycle] reconciliation failed:",
          {
            orderId: String(order._id),
            code: error?.code,
            message: error?.message,
          },
        );
      }
    }
  } catch (error) {
    console.warn(
      "[Order lifecycle] background sweep failed:",
      error?.message || error,
    );
  } finally {
    lifecycleSweepRunning = false;
  }
}

function startLifecycleReconciler() {
  if (
    lifecycleReconcilerStarted ||
    String(
      process.env.ORDER_RECONCILER_ENABLED ||
        "true",
    )
      .trim()
      .toLowerCase() === "false"
  ) {
    return;
  }

  lifecycleReconcilerStarted = true;

  const firstRun = setTimeout(
    () => {
      runLifecycleSweep().catch(() => null);
    },
    5000,
  );
  firstRun.unref?.();

  const timer = setInterval(
    () => {
      runLifecycleSweep().catch(() => null);
    },
    getLifecycleSweepIntervalMs(),
  );
  timer.unref?.();
}

startLifecycleReconciler();

exports.checkOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        code: "ORDER_NOT_FOUND",
        message: "Order not found",
      });
    }

    const result =
      await reconcileOrderLifecycle(order);

    const { balanceField } =
      getOrderBalanceContext(
        result.order || order,
      );

    return res.json({
      success: true,
      refunded: Boolean(result.refunded),
      walletBalance: result.wallet
        ? getWalletBalance(
            result.wallet,
            balanceField,
          )
        : undefined,
      order: sanitizeOrder(
        result.order || order,
      ),
    });
  } catch (error) {
    console.error("Check order error:", error);

    const temporaryFailure =
      Boolean(error.retryable) ||
      [
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNABORTED",
        "EPIPE",
        "EAI_AGAIN",
        "ERR_NETWORK",
      ].includes(
        String(error.code || "")
          .toUpperCase(),
      );

    return res
      .status(
        temporaryFailure
          ? 503
          : error.status || 502,
      )
      .json({
        success: false,
        temporary: temporaryFailure,
        code: getPublicOrderErrorCode(
          error,
          "ORDER_CHECK_FAILED",
        ),
        message: temporaryFailure
          ? "The SMS server is temporarily unavailable. Please try again."
          : extractProviderError(error),
      });
  }
};

exports.cancelOrder =
  async (req, res) => {
    let claimedOrder =
      null;

    let providerCancelled =
      false;

    try {
      const order =
        await Order.findOne({
          _id:
            req.params.id,

          user:
            req.user._id,
        });

      if (!order) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Order not found",
          });
      }

      const paymentEnvironment =
        String(
          order.paymentEnvironment ||
            "live",
        )
          .trim()
          .toLowerCase();

      const balanceField =
        ["balance", "testBalance"].includes(
          order.walletBalanceField,
        )
          ? order.walletBalanceField
          : getWalletBalanceField(
              paymentEnvironment,
            );

      const refundAmount =
        Number(
          order.sellingPrice ||
            order.price,
        );

      if (
        !Number.isFinite(
          refundAmount,
        ) ||
        refundAmount <= 0
      ) {
        return res
          .status(500)
          .json({
            success: false,
            message:
              "Invalid refund amount.",
          });
      }

      if (order.refunded) {
        const wallet =
          await Wallet.findOne({
            user:
              req.user._id,
          });

        return res.json({
          success: true,
          refunded: true,

          walletBalance:
            getWalletBalance(
              wallet,
              balanceField,
            ),

          order:
            sanitizeOrder(
              order,
            ),

          message:
            "Order was already cancelled and refunded.",
        });
      }

      if (
        order.status ===
          "received" ||
        order.otpCode
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "OTP has already been received. This order cannot be cancelled.",
          });
      }

      /*
       * A previous request may have cancelled the provider but failed
       * before refunding MongoDB. In that state, retry only the refund.
       */
      const providerAlreadyCancelled =
        order.status ===
          "cancelled" &&
        !order.refunded;

      if (
        providerAlreadyCancelled
      ) {
        claimedOrder =
          await Order.findOneAndUpdate(
            {
              _id:
                order._id,

              user:
                req.user._id,

              status:
                "cancelled",

              refunded: {
                $ne: true,
              },
            },

            {
              $set: {
                status:
                  "cancelling",
              },
            },

            {
              returnDocument:
                "after",
            },
          );

        providerCancelled =
          true;
      } else {
        claimedOrder =
          await Order.findOneAndUpdate(
            {
              _id:
                order._id,

              user:
                req.user._id,

              refunded: {
                $ne: true,
              },

              status:
                "waiting",
            },

            {
              $set: {
                status:
                  "cancelling",
              },
            },

            {
              returnDocument:
                "after",
            },
          );
      }

      if (!claimedOrder) {
        const latestOrder =
          await Order.findById(
            order._id,
          );

        const wallet =
          await Wallet.findOne({
            user:
              req.user._id,
          });

        return res
          .status(409)
          .json({
            success: false,

            refunded:
              Boolean(
                latestOrder
                  ?.refunded,
              ),

            walletBalance:
              getWalletBalance(
                wallet,
                balanceField,
              ),

            order:
              sanitizeOrder(
                latestOrder,
              ),

            message:
              "Order is already being processed.",
          });
      }

      let providerResponse =
        null;

      if (
        !providerAlreadyCancelled
      ) {
        providerResponse =
          await providerManager.cancelOrder(
            claimedOrder
              .provider,

            claimedOrder
              .providerOrderId,
          );

        providerCancelled =
          true;
      }

      const refundReference =
        `ORDER-${claimedOrder._id}-CANCEL-REFUND`
          .toUpperCase();

      let wallet =
        await Wallet.findOneAndUpdate(
          {
            user:
              req.user._id,

            "transactions.reference": {
              $ne:
                refundReference,
            },
          },

          {
            $inc: {
              [balanceField]:
                refundAmount,
            },

            $push: {
              transactions: {
                $each: [
                  {
                    type:
                      "refund",

                    amount:
                      refundAmount,

                    environment:
                      paymentEnvironment,

                    balanceField,

                    description:
                      `Refund for cancelled ${claimedOrder.serviceName || claimedOrder.service} activation`,

                    status:
                      "completed",

                    reference:
                      refundReference,

                    orderId:
                      claimedOrder._id,

                    server:
                      claimedOrder.server,

                    currency:
                      "NGN",
                  },
                ],

                $position: 0,
              },
            },
          },

          {
            returnDocument: "after",
            runValidators: true,
          },
        );

      if (!wallet) {
        wallet =
          await Wallet.findOne({
            user:
              req.user._id,
          });

        const refundExists =
          wallet?.transactions
            ?.some(
              (transaction) =>
                String(
                  transaction
                    .reference ||
                    "",
                ) ===
                refundReference,
            );

        if (!refundExists) {
          await Order.findByIdAndUpdate(
            claimedOrder._id,
            {
              status:
                providerCancelled
                  ? "cancelled"
                  : "waiting",

              refunded:
                false,

              financialStatus:
                "charged",

              providerStatus:
                providerResponse
                  ?.providerStatus ||
                claimedOrder
                  .providerStatus,

              providerCancelledAt:
                providerCancelled
                  ? new Date()
                  : claimedOrder
                      .providerCancelledAt,
            },
          );

          return res
            .status(500)
            .json({
              success: false,

              code:
                "WALLET_REFUND_FAILED",

              message:
                "The provider order was cancelled, but the wallet refund could not be completed. Retry cancellation to complete the refund.",
            });
        }
      }

      const updatedOrder =
        await Order.findByIdAndUpdate(
          claimedOrder._id,

          {
            $set: {
              status:
                "cancelled",

              refunded:
                true,

              refundedAt:
                new Date(),

              financialStatus:
                "refunded",

              providerStatus:
                providerResponse
                  ?.providerStatus ||
                claimedOrder
                  .providerStatus,

              providerCancelledAt:
                claimedOrder
                  .providerCancelledAt ||
                new Date(),

              providerResponse:
                providerResponse
                  ?.raw ??
                claimedOrder
                  .providerResponse,
            },
          },

          {
            returnDocument:
              "after",
          },
        );

      return res.json({
        success: true,
        refunded: true,
        refundAmount,

        walletBalance:
          getWalletBalance(
            wallet,
            balanceField,
          ),

        order:
          sanitizeOrder(
            updatedOrder,
          ),

        message:
          "Order cancelled and wallet refunded.",
      });
    } catch (error) {
      if (
        claimedOrder?._id
      ) {
        const fallbackStatus =
          providerCancelled
            ? "cancelled"
            : "waiting";

        await Order.findOneAndUpdate(
          {
            _id:
              claimedOrder._id,

            status:
              "cancelling",

            refunded: {
              $ne: true,
            },
          },

          {
            $set: {
              status:
                fallbackStatus,
            },
          },
        ).catch(
          () => null,
        );
      }

      console.error(
        "Cancel order error:",
        error,
      );

      return res
        .status(
          error.status ||
            500,
        )
        .json({
          success: false,

          code:
            getPublicOrderErrorCode(
              error,
              "ORDER_CANCELLATION_FAILED",
            ),

          message:
            extractProviderError(
              error,
            ),
        });
    }
  };

exports.recoverStaleReservations =
  async (req, res) => {
    try {
      const result =
        await recoverStaleReservationsForUser(
          req.user._id,
        );

      return res.json({
        success: true,
        checked: result.checked,
        recovered: result.recovered,
        reconciled: result.reconciled,
        failed: result.failed,
        walletBalance:
          result.wallet
            ? getWalletBalance(
                result.wallet,
                getWalletBalanceField(
                  getPaymentEnvironment(),
                ),
              )
            : undefined,
      });
    } catch (error) {
      console.error(
        "Recover stale reservations error:",
        error,
      );

      return res
        .status(
          error.status || 500,
        )
        .json({
          success: false,
          code:
            error.code ||
            "RESERVATION_RECOVERY_FAILED",
          message:
            error.message ||
            "Unable to recover pending wallet reservations",
        });
    }
  };

exports.getOrders = async (req, res) => {
  try {
    /*
     * Loading the customer's orders also runs the stale safety net. This means
     * an interrupted reservation can repair itself even if the frontend does
     * not explicitly call /orders/recover-pending.
     */
    await recoverStaleReservationsForUser(
      req.user._id,
    ).catch((recoveryError) => {
      console.error(
        "Order-list stale reservation recovery failed:",
        recoveryError,
      );
    });

    const orders = await Order.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      orders: sanitizeOrders(orders),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to load orders",
    });
  }
};

exports.getOrder = async (req, res) => {
  try {
    let order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        code: "ORDER_NOT_FOUND",
        message: "Order not found",
      });
    }

    let result = {
      order,
      wallet: null,
      refunded: Boolean(order.refunded),
    };

    if (
      ["cancelled", "expired"].includes(
        order.status,
      ) ||
      (
        order.status === "waiting" &&
        order.autoRefundEligible &&
        orderExpiryHasPassed(order)
      )
    ) {
      result =
        await reconcileOrderLifecycle(order);
      order = result.order || order;
    }

    const { balanceField } =
      getOrderBalanceContext(order);

    return res.json({
      success: true,
      refunded: Boolean(result.refunded),
      walletBalance: result.wallet
        ? getWalletBalance(
            result.wallet,
            balanceField,
          )
        : undefined,
      order: sanitizeOrder(order),
    });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({
        success: false,
        code: getPublicOrderErrorCode(
          error,
          "ORDER_LOAD_FAILED",
        ),
        message: extractProviderError(error),
      });
  }
};
