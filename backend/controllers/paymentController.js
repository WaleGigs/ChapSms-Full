const axios = require("axios");
const crypto = require("node:crypto");

const Payment = require("../models/Payment");
const Wallet = require("../models/Wallet");

const FLW_BASE_URL =
  "https://api.flutterwave.com/v3";

const FLW_WALLET_TRANSFER_NOTE =
  "ChapsSms Wallet Funding FLW";

const FLW_HTTP_TIMEOUT_MS = Math.max(
  30000,
  Number(
    process.env.FLW_HTTP_TIMEOUT_MS ||
      60000,
  ),
);

function isFlutterwaveTimeout(error) {
  const code = String(
    error?.code || "",
  ).toUpperCase();

  const message = String(
    error?.message || "",
  ).toLowerCase();

  const responseStatus = Number(
    error?.response?.status || 0,
  );

  const responseMessage = String(
    error?.response?.data?.message || "",
  ).toLowerCase();

  return (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    responseStatus === 503 ||
    message.includes("timeout") ||
    responseMessage.includes(
      "an error occurred. please contact support",
    )
  );
}

const VALID_PAYMENT_MODES = [
  "test",
  "live",
];

function requireEnvironment(name) {
  const value = String(
    process.env[name] || "",
  ).trim();

  if (!value) {
    const error = new Error(
      `${name} is missing from the backend environment`,
    );

    error.status = 500;
    error.code =
      "PAYMENT_CONFIGURATION_ERROR";

    throw error;
  }

  return value;
}

function getPaymentMode() {
  const mode = String(
    process.env.PAYMENT_MODE ||
      "test",
  )
    .trim()
    .toLowerCase();

  if (
    !VALID_PAYMENT_MODES.includes(
      mode,
    )
  ) {
    const error = new Error(
      "PAYMENT_MODE must be test or live",
    );

    error.status = 500;
    error.code =
      "PAYMENT_CONFIGURATION_ERROR";

    throw error;
  }

  return mode;
}

function getBalanceField(
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


function normalizeWalletReference(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function walletHasReference(
  wallet,
  reference,
) {
  const target =
    normalizeWalletReference(
      reference,
    );

  if (!target) {
    return false;
  }

  return Boolean(
    wallet?.transactions?.some(
      (item) =>
        normalizeWalletReference(
          item?.reference,
        ) === target,
    ),
  );
}

async function ensureWallet(userId) {
  try {
    const wallet =
      await Wallet.findOneAndUpdate(
        {
          user: userId,
        },
        {
          $setOnInsert: {
            user: userId,
            balance: 0,
            testBalance: 0,
            currency: "NGN",
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          runValidators: true,
        },
      );

    if (!wallet) {
      const error =
        new Error(
          "ChapsSms could not create the customer wallet",
        );

      error.status = 500;
      error.code =
        "WALLET_CREATE_FAILED";

      throw error;
    }

    return wallet;
  } catch (error) {
    /*
     * Wallet.user is unique. If two requests try to create the same
     * brand-new wallet at the same moment, one can receive E11000.
     * Recover by reading the wallet created by the winner.
     */
    if (error?.code === 11000) {
      const existing =
        await Wallet.findOne({
          user: userId,
        });

      if (existing) {
        return existing;
      }
    }

    if (
      !error.code ||
      error.code === 11000
    ) {
      error.code =
        "WALLET_CREATE_FAILED";
    }

    if (!error.status) {
      error.status = 500;
    }

    throw error;
  }
}

function createTransactionReference(
  userId,
) {
  return [
    "CHAPSMS",
    userId,
    Date.now(),
    crypto
      .randomBytes(6)
      .toString("hex"),
  ]
    .join("-")
    .toUpperCase();
}

function normalizePaymentMethod(
  value,
) {
  return String(
    value || "bank",
  ).toLowerCase() === "card"
    ? "card"
    : "bank";
}

function getPaymentOptions(
  paymentMethod,
) {
  return paymentMethod === "card"
    ? "card"
    : "banktransfer,account,internetbanking";
}

function getCustomerName(user) {
  const fullName = [
    user?.firstName,
    user?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    user?.username ||
    fullName ||
    "ChapsSmS User"
  );
}

async function fetchFlutterwaveTransaction(
  transactionId,
) {
  const secretKey =
    requireEnvironment(
      "FLW_SECRET_KEY",
    );

  const response =
    await axios.get(
      `${FLW_BASE_URL}/transactions/${encodeURIComponent(
        transactionId,
      )}/verify`,
      {
        timeout: FLW_HTTP_TIMEOUT_MS,

        headers: {
          Authorization:
            `Bearer ${secretKey}`,
          Accept:
            "application/json",
        },
      },
    );

  return response.data?.data;
}

async function fetchFlutterwaveTransactionByReference(
  txRef,
) {
  const secretKey =
    requireEnvironment(
      "FLW_SECRET_KEY",
    );

  const response =
    await axios.get(
      `${FLW_BASE_URL}/transactions/verify_by_reference`,
      {
        timeout: FLW_HTTP_TIMEOUT_MS,

        params: {
          tx_ref: txRef,
        },

        headers: {
          Authorization:
            `Bearer ${secretKey}`,
          Accept:
            "application/json",
        },
      },
    );

  return response.data?.data;
}

function parseFlutterwaveExpiration(
  value,
) {
  const raw =
    String(value || "").trim();

  if (raw) {
    const direct =
      new Date(raw);

    if (
      !Number.isNaN(
        direct.getTime(),
      )
    ) {
      return direct;
    }

    const normalized =
      new Date(
        raw.replace(
          " ",
          "T",
        ),
      );

    if (
      !Number.isNaN(
        normalized.getTime(),
      )
    ) {
      return normalized;
    }
  }

  /*
   * Flutterwave dynamic virtual accounts normally expire after the
   * transaction window returned in expiry_date. Fall back to 60 minutes
   * only if Flutterwave returns an unparsable date.
   */
  return new Date(
    Date.now() +
      60 * 60 * 1000,
  );
}

async function createFlutterwaveBankTransferCharge({
  payment,
  user,
}) {
  const secretKey =
    requireEnvironment(
      "FLW_SECRET_KEY",
    );

  const displayName =
    String(
      getCustomerName(user) ||
        "ChapsSms Customer",
    ).trim();

  const nameParts =
    displayName
      .split(/\s+/)
      .filter(Boolean);

  const firstName =
    String(
      user?.firstName ||
        nameParts[0] ||
        "ChapsSms",
    ).trim();

  const lastName =
    String(
      user?.lastName ||
        nameParts.slice(1).join(" ") ||
        "Customer",
    ).trim();

  /*
   * Use Flutterwave Dynamic Virtual Accounts for the bank-transfer UX.
   * The account details are returned to our backend and then rendered
   * directly on chapssms.com. The customer is never redirected away.
   */
  const response =
    await axios.post(
      `${FLW_BASE_URL}/virtual-account-numbers`,
      {
        email:
          user.email,
        amount:
          payment.amount,
        currency:
          payment.currency,
        tx_ref:
          payment.txRef,
        firstname:
          firstName,
        lastname:
          lastName,
        narration:
          FLW_WALLET_TRANSFER_NOTE,
        is_permanent:
          false,
      },
      {
        timeout:
          FLW_HTTP_TIMEOUT_MS,

        headers: {
          Authorization:
            `Bearer ${secretKey}`,
          Accept:
            "application/json",
          "Content-Type":
            "application/json",
        },
      },
    );

  const data =
    response.data?.data || {};

  const accountNumber =
    String(
      data.account_number || "",
    ).trim();

  const bankName =
    String(
      data.bank_name || "",
    ).trim();

  const transferAmount =
    Number(
      data.amount ??
        payment.amount,
    );

  if (
    response.data?.status !==
      "success" ||
    !accountNumber ||
    !bankName ||
    !Number.isFinite(
      transferAmount,
    ) ||
    transferAmount <= 0
  ) {
    const error =
      new Error(
        response.data?.message ||
          "Flutterwave did not return valid bank-transfer instructions",
      );

    error.status = 502;
    error.code =
      "INVALID_BANK_TRANSFER_RESPONSE";
    throw error;
  }

  return {
    transferReference:
      String(
        data.order_ref ||
          data.flw_ref ||
          payment.txRef,
      ).trim(),

    accountNumber,
    bankName,

    transferNote:
      FLW_WALLET_TRANSFER_NOTE,

    transferAmount,

    expiresAt:
      parseFlutterwaveExpiration(
        data.expiry_date,
      ),
  };
}

function serializeBankTransfer(
  payment,
) {
  const details =
    payment?.bankTransfer;

  if (
    !details ||
    !details.accountNumber
  ) {
    return null;
  }

  return {
    transferReference:
      details.transferReference ||
      payment.txRef,

    accountNumber:
      details.accountNumber,

    bankName:
      details.bankName,

    transferNote:
      FLW_WALLET_TRANSFER_NOTE,

    transferAmount:
      Number(
        details.transferAmount ||
          payment.amount,
      ),

    expiresAt:
      details.expiresAt ||
      null,
  };
}


function isValidTransaction(
  transaction,
  payment,
) {
  return Boolean(
    transaction &&
      transaction.status ===
        "successful" &&
      String(
        transaction.tx_ref,
      ) ===
        String(payment.txRef) &&
      String(
        transaction.currency,
      ).toUpperCase() ===
        payment.currency &&
      Number(
        transaction.amount,
      ) >=
        Number(payment.amount),
  );
}

async function markPaymentFailed(
  payment,
  reason,
) {
  payment.status = "failed";
  payment.failureReason =
    String(
      reason ||
        "Payment verification failed",
    );

  await payment.save();
}

async function markPaymentSuccessful({
  payment,
  transactionId,
}) {
  payment.flutterwaveId =
    String(transactionId || "");
  payment.status =
    "successful";
  payment.credited = true;
  payment.verifiedAt =
    new Date();
  payment.failureReason = "";

  await payment.save();
}

async function creditVerifiedPayment({
  payment,
  transaction,
}) {
  const paymentEnvironment =
    String(
      payment.environment ||
        getPaymentMode(),
    )
      .trim()
      .toLowerCase();

  const balanceField =
    getBalanceField(
      paymentEnvironment,
    );

  const transactionId =
    String(
      transaction?.id || "",
    ).trim();

  /*
   * FINANCIAL INVARIANT:
   * A verified external payment must always have a local wallet target.
   * Never assume signup/login created the row successfully.
   */
  let existingWallet =
    await ensureWallet(
      payment.user,
    );

  /*
   * The WALLET transaction is the authoritative idempotency record.
   *
   * This also repairs an older inconsistent state where Payment.credited
   * became true but the wallet transaction was missing: do NOT return early
   * just because payment.credited is true.
   */
  if (
    walletHasReference(
      existingWallet,
      payment.txRef,
    )
  ) {
    if (
      !payment.credited ||
      payment.status !==
        "successful"
    ) {
      await markPaymentSuccessful({
        payment,
        transactionId:
          transactionId ||
          payment.flutterwaveId,
      });
    }

    return {
      alreadyCredited: true,
      wallet:
        existingWallet,
      paymentEnvironment,
      balanceField,
    };
  }

  if (payment.credited) {
    console.warn(
      "[Flutterwave] repairing credited payment with missing wallet transaction:",
      {
        txRef:
          payment.txRef,
        userId:
          String(
            payment.user,
          ),
      },
    );
  }

  /*
   * Atomic idempotent credit.
   * Two webhook/callback requests racing together cannot both match after
   * one of them inserts this txRef into transactions.
   */
  let wallet =
    await Wallet.findOneAndUpdate(
      {
        user:
          payment.user,

        "transactions.reference": {
          $ne:
            payment.txRef,
        },
      },
      {
        $inc: {
          [balanceField]:
            Number(
              payment.amount,
            ),
        },

        $push: {
          transactions: {
            $each: [
              {
                type:
                  "deposit",

                amount:
                  Number(
                    payment.amount,
                  ),

                environment:
                  paymentEnvironment,

                balanceField,

                description:
                  `Flutterwave ${paymentEnvironment} wallet funding: ₦${Number(
                    payment.amount,
                  ).toLocaleString(
                    "en-NG",
                  )}`,

                status:
                  "completed",

                reference:
                  payment.txRef,

                transactionId,

                paymentGateway:
                  "flutterwave",

                currency:
                  payment.currency,

                paymentMethod:
                  payment.paymentMethod,
              },
            ],

            $position: 0,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

  if (!wallet) {
    /*
     * Most commonly this means a duplicate request won the atomic race.
     * Re-read and confirm the transaction reference before acknowledging.
     */
    existingWallet =
      await ensureWallet(
        payment.user,
      );

    if (
      !walletHasReference(
        existingWallet,
        payment.txRef,
      )
    ) {
      const error =
        new Error(
          "ChapsSms received the payment but could not credit the wallet",
        );

      error.status = 500;
      error.code =
        "WALLET_CREDIT_FAILED";

      throw error;
    }

    wallet =
      existingWallet;
  }

  /*
   * Mark Payment successful ONLY AFTER the wallet transaction is confirmed.
   * A crash before this save is safe: a retry sees the wallet reference and
   * repairs Payment.credited without adding the money twice.
   */
  await markPaymentSuccessful({
    payment,
    transactionId,
  });

  return {
    alreadyCredited:
      walletHasReference(
        existingWallet,
        payment.txRef,
      ),
    wallet,
    paymentEnvironment,
    balanceField,
  };
}

async function verifyAndCredit({
  transactionId,
  txRef,
  userId = null,
}) {
  const paymentQuery = {
    txRef,
  };

  if (userId) {
    paymentQuery.user =
      userId;
  }

  const payment =
    await Payment.findOne(
      paymentQuery,
    );

  if (!payment) {
    const error =
      new Error(
        "Payment record not found",
      );

    error.status = 404;
    error.code =
      "PAYMENT_NOT_FOUND";

    throw error;
  }

  const transaction =
    await fetchFlutterwaveTransaction(
      transactionId,
    );

  if (
    !isValidTransaction(
      transaction,
      payment,
    )
  ) {
    await markPaymentFailed(
      payment,
      "Flutterwave transaction details did not match",
    );

    const error =
      new Error(
        "Payment verification failed",
      );

    error.status = 400;
    error.code =
      "PAYMENT_VERIFICATION_FAILED";

    throw error;
  }

  const result =
    await creditVerifiedPayment({
      payment,
      transaction,
    });

  return {
    ...result,
    payment,
    transaction,
  };
}

async function verifyAndCreditByReference({
  txRef,
  userId = null,
}) {
  const normalizedTxRef =
    String(txRef || "")
      .trim()
      .toUpperCase();

  if (!normalizedTxRef) {
    const error =
      new Error(
        "Payment reference is required",
      );

    error.status = 400;
    error.code =
      "INVALID_PAYMENT_REFERENCE";
    throw error;
  }

  const query = {
    txRef:
      normalizedTxRef,
  };

  if (userId) {
    query.user = userId;
  }

  const payment =
    await Payment.findOne(
      query,
    );

  if (!payment) {
    const error =
      new Error(
        "Payment record not found",
      );

    error.status = 404;
    error.code =
      "PAYMENT_NOT_FOUND";
    throw error;
  }

  const transaction =
    await fetchFlutterwaveTransactionByReference(
      normalizedTxRef,
    );

  if (
    !transaction ||
    String(
      transaction.status ||
        "",
    ).toLowerCase() !==
      "successful"
  ) {
    const error =
      new Error(
        "Flutterwave payment is not successful yet",
      );

    error.status = 409;
    error.code =
      "PAYMENT_NOT_SUCCESSFUL";
    throw error;
  }

  if (
    !isValidTransaction(
      transaction,
      payment,
    )
  ) {
    const error =
      new Error(
        "Payment verification failed",
      );

    error.status = 400;
    error.code =
      "PAYMENT_VERIFICATION_FAILED";
    throw error;
  }

  const result =
    await creditVerifiedPayment({
      payment,
      transaction,
    });

  return {
    ...result,
    payment,
    transaction,
  };
}

exports.initializePayment =
  async (req, res) => {
    let payment = null;

    try {
      const amount =
        Number(
          req.body.amount,
        );

      const paymentMethod =
        normalizePaymentMethod(
          req.body.paymentMethod,
        );

      if (
        !Number.isFinite(
          amount,
        ) ||
        amount < 100
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Minimum funding amount is 100",
          });
      }

      requireEnvironment(
        "FLW_SECRET_KEY",
      );

      const paymentEnvironment =
        getPaymentMode();

      const txRef =
        createTransactionReference(
          req.user._id,
        );

      /*
       * Do not allow a customer to enter Flutterwave unless ChapsSms has
       * a durable wallet row ready to receive the verified payment.
       */
      await ensureWallet(
        req.user._id,
      );

      payment =
        await Payment.create({
          user:
            req.user._id,
          txRef,
          amount,
          currency: "NGN",
          paymentMethod,
          environment:
            paymentEnvironment,
          status: "pending",
          credited: false,
        });

      const common = {
        success: true,
        txRef,
        amount:
          payment.amount,
        currency:
          payment.currency,
        paymentMethod,
        environment:
          paymentEnvironment,
      };

      /*
       * BANK TRANSFER:
       * Generate the temporary Flutterwave account server-side and return
       * the instructions to ChapsSms. The customer stays on chapssms.com.
       */
      if (
        paymentMethod ===
        "bank"
      ) {
        const bankTransfer =
          await createFlutterwaveBankTransferCharge({
            payment,
            user: req.user,
          });

        payment.bankTransfer =
          bankTransfer;

        await payment.save();

        return res
          .status(200)
          .json({
            ...common,
            bankTransfer:
              serializeBankTransfer(
                payment,
              ),
          });
      }

      /*
       * CARD:
       * Keep Flutterwave Inline so card details remain inside Flutterwave's
       * secure overlay and never enter ChapsSms React inputs.
       */
      const publicKey =
        requireEnvironment(
          "FLW_PUBLIC_KEY",
        );

      return res
        .status(200)
        .json({
          ...common,
          paymentOptions:
            getPaymentOptions(
              paymentMethod,
            ),
          publicKey,

          customer: {
            email:
              req.user.email,
            name:
              getCustomerName(
                req.user,
              ),
          },

          meta: {
            userId:
              String(
                req.user._id,
              ),
            paymentId:
              String(
                payment._id,
              ),
            environment:
              paymentEnvironment,
          },
        });
    } catch (error) {
      const timedOut =
        isFlutterwaveTimeout(error);

      if (
        payment &&
        !payment.credited
      ) {
        /*
         * A network timeout does not prove Flutterwave rejected the charge.
         * Keep the local record pending rather than falsely marking it failed.
         * A normal provider/API error can still be marked failed.
         */
        payment.status = timedOut
          ? "pending"
          : "failed";

        payment.failureReason =
          String(
            timedOut
              ? "Flutterwave account generation timed out before ChapsSms received a response"
              : error.response
                  ?.data?.message ||
                error.message ||
                "Payment initialization failed",
          ).slice(0, 500);

        await payment
          .save()
          .catch(() => {});
      }

      console.error(
        "Flutterwave initialization error:",
        error.response
          ?.data ||
          error.message,
      );

      return res
        .status(
          timedOut
            ? 504
            : error.status ||
              500,
        )
        .json({
          success: false,
          message: timedOut
            ? "Flutterwave is temporarily taking too long to generate the bank account. Please wait a moment and try again. Your ChapsSms wallet was not charged."
            : error.response
                ?.data?.message ||
              error.message ||
              "Unable to initialize payment",
          code: timedOut
            ? "FLUTTERWAVE_TEMPORARY_UNAVAILABLE"
            : error.code ||
              "PAYMENT_INITIALIZATION_FAILED",
        });
    }
  };

exports.verifyPayment =
  async (req, res) => {
    try {
      const transactionId =
        req.body
          .transactionId;

      const txRef =
        String(
          req.body.txRef ||
            "",
        ).trim();

      if (
        !transactionId ||
        !txRef
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Transaction ID and reference are required",
          });
      }

      const result =
        await verifyAndCredit({
          transactionId,
          txRef,
          userId:
            req.user._id,
        });

      const walletBalance =
        getWalletBalance(
          result.wallet,
          result.balanceField,
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            result.alreadyCredited
              ? "Payment already credited"
              : result.paymentEnvironment ===
                  "live"
                ? "Wallet funded successfully"
                : "Test wallet funded successfully",

          amountCredited:
            result.payment.amount,

          currency:
            result.payment.currency,

          paymentEnvironment:
            result.paymentEnvironment,

          /*
           * Backward-compatible active balance.
           */
          walletBalance,

          liveBalance:
            Number(
              result.wallet
                ?.balance ||
                0,
            ),

          testBalance:
            Number(
              result.wallet
                ?.testBalance ||
                0,
            ),
        });
    } catch (error) {
      console.error(
        "Flutterwave verification error:",
        error.response
          ?.data ||
          error.message,
      );

      return res
        .status(
          error.status ||
            500,
        )
        .json({
          success: false,

          message:
            error.response
              ?.data
              ?.message ||
            error.message ||
            "Unable to verify payment",

          code:
            error.code ||
            "PAYMENT_VERIFICATION_ERROR",
        });
    }
  };


exports.getPaymentStatus =
  async (req, res) => {
    try {
      const txRef =
        String(
          req.params.txRef ||
            "",
        )
          .trim()
          .toUpperCase();

      if (!txRef) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Payment reference is required",
          });
      }

      let payment =
        await Payment.findOne({
          user:
            req.user._id,
          txRef,
        });

      if (!payment) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Payment record not found",
            code:
              "PAYMENT_NOT_FOUND",
          });
      }

      let newlyCredited =
        false;

      /*
       * Normal polling reads ChapsSms only. A forced refresh (the customer's
       * "I have paid" button) also checks Flutterwave by tx_ref. This avoids
       * hammering Flutterwave every few seconds while still recovering from
       * a delayed/missed webhook.
       */
      const forceRefresh =
        String(
          req.query.refresh ||
            "",
        ) === "1";

      if (
        forceRefresh &&
        !payment.credited &&
        payment.status ===
          "pending"
      ) {
        try {
          const transaction =
            await fetchFlutterwaveTransactionByReference(
              txRef,
            );

          if (
            transaction &&
            String(
              transaction.status ||
                "",
            ).toLowerCase() ===
              "successful" &&
            isValidTransaction(
              transaction,
              payment,
            )
          ) {
            const creditResult =
              await creditVerifiedPayment({
                payment,
                transaction,
              });

            newlyCredited =
              !creditResult
                .alreadyCredited;

            payment =
              await Payment.findOne({
                user:
                  req.user._id,
                txRef,
              });
          }
        } catch (error) {
          const status =
            Number(
              error.response
                ?.status ||
                0,
            );

          /*
           * A transfer that has not arrived yet may not be queryable.
           * Keep it pending rather than turning a normal wait into an error.
           */
          if (
            ![
              400,
              404,
            ].includes(status)
          ) {
            console.warn(
              "Flutterwave reference refresh failed:",
              error.response
                ?.data ||
                error.message,
            );
          }
        }
      }

      const paymentEnvironment =
        String(
          payment.environment ||
            getPaymentMode(),
        )
          .trim()
          .toLowerCase();

      const balanceField =
        getBalanceField(
          paymentEnvironment,
        );

      const wallet =
        await ensureWallet(
          req.user._id,
        );

      return res
        .status(200)
        .json({
          success: true,

          txRef:
            payment.txRef,

          status:
            payment.status,

          credited:
            Boolean(
              payment.credited,
            ),

          newlyCredited,

          amount:
            Number(
              payment.amount,
            ),

          amountCredited:
            payment.credited
              ? Number(
                  payment.amount,
                )
              : 0,

          currency:
            payment.currency,

          paymentMethod:
            payment.paymentMethod,

          paymentEnvironment,

          walletBalance:
            getWalletBalance(
              wallet,
              balanceField,
            ),

          liveBalance:
            Number(
              wallet?.balance ||
                0,
            ),

          testBalance:
            Number(
              wallet?.testBalance ||
                0,
            ),

          bankTransfer:
            serializeBankTransfer(
              payment,
            ),
        });
    } catch (error) {
      console.error(
        "Flutterwave payment status error:",
        error.response
          ?.data ||
          error.message,
      );

      return res
        .status(
          error.status ||
            500,
        )
        .json({
          success: false,
          message:
            error.response
              ?.data?.message ||
            error.message ||
            "Unable to check payment status",
          code:
            error.code ||
            "PAYMENT_STATUS_FAILED",
        });
    }
  };


function isValidWebhookSignature(
  req,
) {
  const secretHash =
    requireEnvironment(
      "FLW_SECRET_HASH",
    );

  const modernSignature =
    req.headers[
      "flutterwave-signature"
    ];

  if (
    modernSignature &&
    req.rawBody
  ) {
    const expected =
      crypto
        .createHmac(
          "sha256",
          secretHash,
        )
        .update(
          req.rawBody,
        )
        .digest(
          "base64",
        );

    const left =
      Buffer.from(
        String(
          modernSignature,
        ),
      );

    const right =
      Buffer.from(
        expected,
      );

    return (
      left.length ===
        right.length &&
      crypto.timingSafeEqual(
        left,
        right,
      )
    );
  }

  /*
   * Compatibility with older Flutterwave
   * webhook configuration.
   */
  const legacySignature =
    req.headers[
      "verif-hash"
    ];

  return Boolean(
    legacySignature &&
      legacySignature ===
        secretHash,
  );
}

exports.handleWebhook =
  async (req, res) => {
    try {
      if (
        !isValidWebhookSignature(
          req,
        )
      ) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Invalid webhook signature",
          });
      }

      const payload =
        req.body || {};

      const data =
        payload.data ||
        payload;

      const status =
        String(
          data.status ||
            "",
        ).toLowerCase();

      const txRef =
        String(
          data.tx_ref ||
            data.txRef ||
            "",
        ).trim();

      const transactionId =
        data.id ||
        data.transaction_id;

      if (
        status !==
          "successful" ||
        !txRef ||
        !transactionId
      ) {
        return res
          .sendStatus(200);
      }

      await verifyAndCredit({
        transactionId,
        txRef,
      });

      return res
        .sendStatus(200);
    } catch (error) {
      console.error(
        "Flutterwave webhook error:",
        error.response
          ?.data ||
          error.message,
      );

      /*
       * Never acknowledge a LOCAL wallet/database failure as success.
       * Returning HTTP 200 after WALLET_NOT_FOUND/WALLET_CREDIT_FAILED
       * is how a verified external debit can become permanently uncredited.
       *
       * Only genuinely permanent payment-record/verification mismatches are
       * acknowledged here. Everything else remains retryable with HTTP 500.
       */
      const permanentCodes =
        new Set([
          "PAYMENT_NOT_FOUND",
          "PAYMENT_VERIFICATION_FAILED",
        ]);

      if (
        permanentCodes.has(
          String(
            error.code || "",
          ),
        )
      ) {
        return res
          .sendStatus(200);
      }

      return res
        .sendStatus(500);
    }
  };

exports.flutterwaveWebhook =
  exports.handleWebhook;

/*
 * Used by the controlled reconciliation script.
 * It performs the same provider verification + idempotent wallet credit path.
 */
exports.verifyAndCreditByReference =
  verifyAndCreditByReference;