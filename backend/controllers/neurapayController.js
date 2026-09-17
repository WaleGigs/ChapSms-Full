const crypto =
  require("crypto");

const Wallet =
  require("../models/Wallet");

const NeuraPayAccount =
  require("../models/NeuraPayAccount");

const NeuraPayTransaction =
  require("../models/NeuraPayTransaction");

const {
  createVirtualAccount,
  getTransactionStatus,
  normalizeProviderChannel,
} = require("../services/neurapayService");

function requireEnvironment(
  name
) {
  const value = String(
    process.env[name] || ""
  ).trim();

  if (!value) {
    const error =
      new Error(
        `${name} is not configured`
      );

    error.status = 500;
    error.code =
      "NEURAPAY_CONFIGURATION_ERROR";

    throw error;
  }

  return value;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
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
    fullName ||
    String(
      user?.username || ""
    ).trim() ||
    "ChapsSms Customer"
  );
}

function makeAccountReference(
  userId,
  providerChannel
) {
  const provider =
    String(
      providerChannel || "Paga"
    )
      .replace(
        /[^a-z0-9]/gi,
        ""
      )
      .toUpperCase();

  const random =
    crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();

  return [
    "CHAPSMS",
    "VA",
    provider,
    String(userId).slice(-8),
    Date.now(),
    random,
  ].join("-");
}

function serializeAccount(
  account
) {
  if (!account) {
    return null;
  }

  return {
    id:
      account._id ||
      account.id,
    providerChannel:
      account.providerChannel,
    reference:
      account.requestReference,
    bankName:
      account.bankName,
    accountNumber:
      account.accountNumber,
    accountName:
      account.accountName,
    customerName:
      account.customerName,
    customerEmail:
      account.customerEmail,
    status:
      account.status,
    createdAt:
      account.createdAt ||
      account.providerCreatedAt,
  };
}

function getCreditBasis() {
  const basis =
    String(
      process.env
        .NEURAPAY_WALLET_CREDIT_BASIS ||
        "amount"
    )
      .trim()
      .toLowerCase();

  return basis ===
    "net_amount"
    ? "net_amount"
    : "amount";
}

function getCreditedAmount(
  transaction
) {
  const gross =
    Number(
      transaction?.amount
    );

  const net =
    Number(
      transaction?.net_amount
    );

  const basis =
    getCreditBasis();

  const value =
    basis === "net_amount"
      ? net
      : gross;

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    const error =
      new Error(
        "NeuraPay returned an invalid payment amount"
      );

    error.status = 422;
    error.code =
      "INVALID_NEURAPAY_AMOUNT";

    throw error;
  }

  return {
    amount: value,
    basis,
  };
}

function validateVerifiedTransaction(
  result,
  expectedReference
) {
  if (
    String(
      result?.status || ""
    ).toLowerCase() !==
      "success" ||
    !result?.data
  ) {
    const error =
      new Error(
        "NeuraPay transaction could not be verified"
      );

    error.status = 502;
    error.code =
      "NEURAPAY_VERIFICATION_FAILED";

    throw error;
  }

  const transaction =
    result.data;

  const reference =
    String(
      transaction?.reference ||
        ""
    ).trim();

  const status =
    String(
      transaction?.status || ""
    )
      .trim()
      .toLowerCase();

  const type =
    String(
      transaction?.type || ""
    )
      .trim()
      .toLowerCase();

  const virtualAccount =
    String(
      transaction
        ?.virtual_account ||
        ""
    ).trim();

  if (
    !reference ||
    reference !==
      String(
        expectedReference || ""
      ).trim()
  ) {
    const error =
      new Error(
        "NeuraPay transaction reference mismatch"
      );

    error.status = 422;
    error.code =
      "NEURAPAY_REFERENCE_MISMATCH";

    throw error;
  }

  if (
    status !== "successful"
  ) {
    const error =
      new Error(
        "NeuraPay transaction is not successful"
      );

    error.status = 409;
    error.code =
      "NEURAPAY_PAYMENT_NOT_SUCCESSFUL";

    throw error;
  }

  if (
    type !== "inbound_transfer"
  ) {
    const error =
      new Error(
        "NeuraPay transaction is not an inbound transfer"
      );

    error.status = 422;
    error.code =
      "INVALID_NEURAPAY_TRANSACTION_TYPE";

    throw error;
  }

  if (!virtualAccount) {
    const error =
      new Error(
        "NeuraPay transaction has no virtual account"
      );

    error.status = 422;
    error.code =
      "NEURAPAY_ACCOUNT_MISSING";

    throw error;
  }

  return transaction;
}

async function ensureWallet(
  userId
) {
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
          setDefaultsOnInsert:
            true,
          runValidators: true,
        }
      );

    if (!wallet) {
      const error =
        new Error(
          "ChapsSms could not create the customer wallet"
        );

      error.status = 500;
      error.code =
        "WALLET_CREATE_FAILED";
      throw error;
    }

    return wallet;
  } catch (error) {
    if (
      error?.code === 11000
    ) {
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

async function upsertTransactionRecord({
  account,
  transaction,
  creditedAmount,
  eventName,
}) {
  const reference =
    String(
      transaction.reference
    )
      .trim()
      .toUpperCase();

  const update = {
    $set: {
      user: account.user,
      account: account._id,
      providerReference:
        String(
          transaction
            .provider_reference ||
            ""
        ).trim(),
      amount:
        Number(
          transaction.amount ||
            0
        ),
      fees:
        Number(
          transaction.fees ||
            0
        ),
      netAmount:
        Number(
          transaction
            .net_amount ||
            0
        ),
      creditedAmount:
        Number(
          creditedAmount || 0
        ),
      type:
        String(
          transaction.type ||
            "inbound_transfer"
        ).trim(),
      status:
        String(
          transaction.status ||
            "successful"
        )
          .trim()
          .toLowerCase(),
      virtualAccount:
        String(
          transaction
            .virtual_account ||
            ""
        ).trim(),
      bankName:
        String(
          transaction
            .bank_name || ""
        ).trim(),
      sender: {
        name:
          String(
            transaction
              ?.sender?.name ||
              ""
          ).trim(),
        accountNumber:
          String(
            transaction
              ?.sender
              ?.account_number ||
              ""
          ).trim(),
        bank:
          String(
            transaction
              ?.sender?.bank ||
              ""
          ).trim(),
      },
      description:
        String(
          transaction
            .description || ""
        ).trim(),
      eventName:
        String(
          eventName ||
            "payment.successful"
        ).trim(),
      providerCreatedAt:
        transaction
          .created_at
          ? new Date(
              transaction
                .created_at
            )
          : null,
    },

    $setOnInsert: {
      reference,
      credited: false,
      creditedAt: null,
    },
  };

  try {
    return await NeuraPayTransaction
      .findOneAndUpdate(
        {
          reference,
        },
        update,
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert:
            true,
        }
      );
  } catch (error) {
    if (
      error?.code !== 11000
    ) {
      throw error;
    }

    return NeuraPayTransaction
      .findOne({
        reference,
      });
  }
}

async function verifyAndCredit({
  reference,
  expectedUserId,
  eventName =
    "payment.successful",
}) {
  const normalizedReference =
    String(
      reference || ""
    ).trim();

  if (!normalizedReference) {
    const error =
      new Error(
        "NeuraPay transaction reference is required"
      );

    error.status = 400;
    error.code =
      "INVALID_TRANSACTION_REFERENCE";

    throw error;
  }

  /*
   * SECURITY:
   * Never credit from the webhook body alone.
   * Always ask NeuraPay's Transaction Status API for the authoritative
   * transaction before modifying a ChapsSms wallet.
   */
  const statusResult =
    await getTransactionStatus(
      normalizedReference
    );

  const transaction =
    validateVerifiedTransaction(
      statusResult,
      normalizedReference
    );

  const virtualAccount =
    String(
      transaction
        .virtual_account
    ).trim();

  const account =
    await NeuraPayAccount
      .findOne({
        accountNumber:
          virtualAccount,
        status: "active",
      })
      .sort({
        createdAt: -1,
      });

  if (!account) {
    const error =
      new Error(
        "This NeuraPay virtual account is not linked to a ChapsSms wallet"
      );

    error.status = 409;
    error.code =
      "UNMAPPED_NEURAPAY_ACCOUNT";

    throw error;
  }

  if (
    expectedUserId &&
    String(account.user) !==
      String(expectedUserId)
  ) {
    const error =
      new Error(
        "This payment does not belong to your ChapsSms account"
      );

    error.status = 403;
    error.code =
      "PAYMENT_OWNER_MISMATCH";

    throw error;
  }

  const {
    amount:
      creditedAmount,
    basis:
      creditBasis,
  } =
    getCreditedAmount(
      transaction
    );

  const referenceForWallet =
    normalizedReference
      .toUpperCase();

  await ensureWallet(
    account.user
  );

  /*
   * IDEMPOTENCY:
   * The transaction reference must not already exist inside the user's
   * wallet. MongoDB evaluates this filter and the $inc/$push atomically.
   *
   * Two duplicate webhooks racing at the same time cannot both match.
   */
  let wallet =
    await Wallet
      .findOneAndUpdate(
        {
          user:
            account.user,

          "transactions.reference":
            {
              $ne:
                referenceForWallet,
            },
        },
        {
          $inc: {
            balance:
              creditedAmount,
          },

          $push: {
            transactions: {
              type:
                "deposit",

              amount:
                creditedAmount,

              environment:
                "live",

              balanceField:
                "balance",

              description:
                `NeuraPay wallet funding: ₦${Number(
                  creditedAmount
                ).toLocaleString(
                  "en-NG"
                )}`,

              status:
                "completed",

              reference:
                referenceForWallet,

              transactionId:
                String(
                  transaction
                    .provider_reference ||
                    normalizedReference
                ).trim(),

              paymentGateway:
                "neurapay",

              currency:
                "NGN",

              paymentMethod:
                "bank_transfer",
            },
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

  let alreadyCredited =
    false;

  if (!wallet) {
    wallet =
      await Wallet.findOne({
        user:
          account.user,
      });

    alreadyCredited =
      Boolean(
        wallet?.transactions?.some(
          (item) =>
            String(
              item.reference ||
                ""
            )
              .trim()
              .toUpperCase() ===
            referenceForWallet
        )
      );

    if (
      !alreadyCredited
    ) {
      const error =
        new Error(
          "Unable to credit the ChapsSms wallet"
        );

      error.status = 500;
      error.code =
        "WALLET_CREDIT_FAILED";

      throw error;
    }
  }

  const record =
    await upsertTransactionRecord(
      {
        account,
        transaction,
        creditedAmount,
        eventName,
      }
    );

  if (
    record &&
    !record.credited
  ) {
    record.credited = true;
    record.creditedAt =
      new Date();
    record.creditedAmount =
      creditedAmount;

    await record.save();
  }

  return {
    wallet,
    account,
    transaction,
    creditedAmount,
    creditBasis,
    alreadyCredited,
  };
}

function isValidWebhookSignature(
  req
) {
  const signingSecret =
    requireEnvironment(
      "NEURAPAY_WEBHOOK_SECRET"
    );

  const receivedSignature =
    String(
      req.headers[
        "x-neurapay-signature"
      ] || ""
    )
      .trim()
      .toLowerCase();

  if (
    !receivedSignature ||
    !req.rawBody
  ) {
    return false;
  }

  /*
   * Official NeuraPay docs:
   * HMAC-SHA256 over the RAW JSON request body.
   * Their PHP sample uses hash_hmac("sha256", ...) without the binary
   * flag, which produces a lowercase hex digest.
   */
  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        signingSecret
      )
      .update(req.rawBody)
      .digest("hex")
      .toLowerCase();

  const receivedBuffer =
    Buffer.from(
      receivedSignature,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  return (
    receivedBuffer.length ===
      expectedBuffer.length &&
    crypto.timingSafeEqual(
      receivedBuffer,
      expectedBuffer
    )
  );
}

exports.getVirtualAccount =
  async (req, res) => {
    try {
      const providerChannel =
        normalizeProviderChannel(
          req.query
            ?.providerChannel ||
            "Paga"
        );

      const account =
        await NeuraPayAccount
          .findOne({
            user:
              req.user._id,
            providerChannel,
            status: "active",
          })
          .sort({
            createdAt: -1,
          });

      return res
        .status(200)
        .json({
          success: true,
          account:
            serializeAccount(
              account
            ),
        });
    } catch (error) {
      console.error(
        "NeuraPay account lookup failed:",
        error.message
      );

      return res
        .status(
          error.status ||
            500
        )
        .json({
          success: false,
          message:
            error.message ||
            "Unable to load NeuraPay account",
          code:
            error.code ||
            "NEURAPAY_ACCOUNT_LOOKUP_FAILED",
        });
    }
  };

exports.createVirtualAccount =
  async (req, res) => {
    try {
      /*
       * Financial invariant: create/repair the local wallet BEFORE creating
       * or returning an external bank account that can receive real money.
       */
      await ensureWallet(
        req.user._id
      );

      const providerChannel =
        normalizeProviderChannel(
          req.body
            ?.providerChannel ||
            "Paga"
        );

      /*
       * Return the existing active reserved account instead of creating
       * a fresh bank account every time the customer opens Add Funds.
       */
      const existing =
        await NeuraPayAccount
          .findOne({
            user:
              req.user._id,
            providerChannel,
            status: "active",
          })
          .sort({
            createdAt: -1,
          });

      if (existing) {
        return res
          .status(200)
          .json({
            success: true,
            message:
              "NeuraPay account ready",
            account:
              serializeAccount(
                existing
              ),
          });
      }

      const customerEmail =
        normalizeEmail(
          req.user.email
        );

      if (!customerEmail) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Your ChapsSms account needs a valid email before a NeuraPay account can be created.",
            code:
              "CUSTOMER_EMAIL_REQUIRED",
          });
      }

      const customerName =
        getCustomerName(
          req.user
        );

      const requestReference =
        makeAccountReference(
          req.user._id,
          providerChannel
        );

      /*
       * For Paga, the official NeuraPay docs require only:
       * customer_name, customer_email, provider_channel and reference.
       *
       * PalmPay additionally requires identity_type + license_number.
       * Identity values are forwarded directly and are NEVER stored in
       * the ChapsSms database.
       */
      const response =
        await createVirtualAccount({
          customerName,
          customerEmail,
          providerChannel,
          reference:
            requestReference,
          identityType:
            req.body
              ?.identityType,
          licenseNumber:
            req.body
              ?.licenseNumber,
        });

      const data =
        response.data;

      const accountNumber =
        String(
          data
            ?.account_number ||
            ""
        ).trim();

      const bankName =
        String(
          data?.bank_name ||
            providerChannel
        ).trim();

      const accountName =
        String(
          data
            ?.account_name ||
            ""
        ).trim();

      if (
        !accountNumber ||
        !accountName
      ) {
        const error =
          new Error(
            "NeuraPay did not return complete bank account details"
          );

        error.status = 502;
        error.code =
          "INCOMPLETE_VIRTUAL_ACCOUNT_RESPONSE";

        throw error;
      }

      let account;

      try {
        account =
          await NeuraPayAccount
            .create({
              user:
                req.user._id,
              providerChannel,
              requestReference:
                String(
                  data
                    ?.reference ||
                    requestReference
                ).trim(),
              bankName,
              accountNumber,
              accountName,
              customerName:
                String(
                  data
                    ?.customer_name ||
                    customerName
                ).trim(),
              customerEmail:
                normalizeEmail(
                  data
                    ?.customer_email ||
                    customerEmail
                ),
              status:
                String(
                  data?.status ||
                    "active"
                )
                  .trim()
                  .toLowerCase(),
              providerCreatedAt:
                data?.created_at
                  ? new Date(
                      data
                        .created_at
                    )
                  : null,
            });
      } catch (error) {
        if (
          error?.code !== 11000
        ) {
          throw error;
        }

        account =
          await NeuraPayAccount
            .findOne({
              $or: [
                {
                  accountNumber,
                },
                {
                  requestReference:
                    String(
                      data
                        ?.reference ||
                        requestReference
                    ).trim(),
                },
              ],
            });
      }

      return res
        .status(201)
        .json({
          success: true,
          message:
            "NeuraPay account created successfully",
          account:
            serializeAccount(
              account
            ),
        });
    } catch (error) {
      /*
       * Never log req.body here: PalmPay can contain BVN/NIN/CAC
       * identity data.
       */
      console.error(
        "NeuraPay account creation failed:",
        {
          code:
            error.code,
          status:
            error.status,
          message:
            error.message,
        }
      );

      return res
        .status(
          error.status ||
            500
        )
        .json({
          success: false,
          message:
            error.message ||
            "Unable to create NeuraPay account",
          code:
            error.code ||
            "NEURAPAY_ACCOUNT_CREATION_FAILED",
        });
    }
  };

exports.verifyTransaction =
  async (req, res) => {
    try {
      const reference =
        String(
          req.body
            ?.reference ||
            ""
        ).trim();

      const result =
        await verifyAndCredit({
          reference,
          expectedUserId:
            req.user._id,
          eventName:
            "manual.verification",
        });

      return res
        .status(200)
        .json({
          success: true,
          message:
            result
              .alreadyCredited
              ? "Payment was already credited"
              : "Wallet funded successfully",
          alreadyCredited:
            result
              .alreadyCredited,
          creditedAmount:
            result
              .creditedAmount,
          walletBalance:
            Number(
              result.wallet
                ?.balance ||
                0
            ),
          reference:
            result
              .transaction
              .reference,
        });
    } catch (error) {
      console.error(
        "NeuraPay manual verification failed:",
        {
          code:
            error.code,
          status:
            error.status,
          message:
            error.message,
        }
      );

      return res
        .status(
          error.status ||
            500
        )
        .json({
          success: false,
          message:
            error.message ||
            "Unable to verify NeuraPay payment",
          code:
            error.code ||
            "NEURAPAY_VERIFICATION_FAILED",
        });
    }
  };

exports.handleWebhook =
  async (req, res) => {
    if (
      !isValidWebhookSignature(
        req
      )
    ) {
      return res
        .status(401)
        .json({
          status: "error",
          message:
            "Invalid signature",
        });
    }

    const payload =
      req.body || {};

    const eventName =
      String(
        payload.event || ""
      )
        .trim()
        .toLowerCase();

    /*
     * Valid signed events that ChapsSms does not currently consume are
     * acknowledged so NeuraPay does not needlessly retry them.
     */
    if (
      eventName !==
        "payment.successful"
    ) {
      return res
        .status(200)
        .json({
          status: "success",
        });
    }

    const reference =
      String(
        payload?.data
          ?.reference ||
          ""
      ).trim();

    if (!reference) {
      return res
        .status(400)
        .json({
          status: "error",
          message:
            "Transaction reference missing",
        });
    }

    try {
      const result =
        await verifyAndCredit({
          reference,
          eventName,
        });

      console.log(
        "[NeuraPay] verified wallet funding:",
        {
          reference:
            String(
              result
                .transaction
                .reference
            ),
          userId:
            String(
              result.account
                .user
            ),
          creditedAmount:
            result
              .creditedAmount,
          alreadyCredited:
            result
              .alreadyCredited,
        }
      );

      /*
       * NeuraPay documentation expects HTTP 200 after an authenticated,
       * successfully handled webhook.
       */
      return res
        .status(200)
        .json({
          status: "success",
        });
    } catch (error) {
      console.error(
        "[NeuraPay] webhook processing failed:",
        {
          reference,
          code:
            error.code,
          status:
            error.status,
          message:
            error.message,
        }
      );

      /*
       * A 5xx signals a transient ChapsSms/NeuraPay verification or
       * database problem. If NeuraPay retries failed webhook deliveries,
       * this gives it the chance to redeliver.
       *
       * Permanent 4xx verification mismatches are acknowledged after
       * logging so an invalid event cannot create an endless retry loop.
       */
      if (
        Number(
          error.status || 500
        ) >= 500
      ) {
        return res
          .status(500)
          .json({
            status: "error",
            message:
              "Temporary processing failure",
          });
      }

      return res
        .status(200)
        .json({
          status: "success",
        });
    }
  };

exports.verifyAndCredit =
  verifyAndCredit;
