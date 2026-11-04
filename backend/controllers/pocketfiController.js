const Wallet = require("../models/Wallet");
const PocketFiAccount = require("../models/PocketFiAccount");
const PocketFiTransaction = require("../models/PocketFiTransaction");

const { ensureWallet } = require("./neurapayController");
const pocketfi = require("../services/pocketfiService");
const { getActiveGateway } = require("../services/paymentGatewayService");
const { reportDepositPurchase } = require("../services/tiktokEventsService");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function serializeAccount(account) {
  if (!account) {
    return null;
  }

  return {
    id: account._id || account.id,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    status: account.status,
    createdAt: account.createdAt,
  };
}

/*
 * PocketFi's docs show the payee account masked ("******3995"). The signature
 * is verified, so this is one of our accounts: if exactly one ends in those
 * digits it is that one, and anything ambiguous stays unattributed.
 */
async function findAccountForWebhook(accountNumber) {
  if (!accountNumber.includes("*")) {
    return PocketFiAccount.findOne({ accountNumber });
  }

  const suffix = accountNumber.replace(/^\*+/, "");

  if (!/^\d{3,}$/.test(suffix)) {
    return null;
  }

  const matches = await PocketFiAccount.find({
    accountNumber: { $regex: `${suffix}$` },
  }).limit(2);

  return matches.length === 1 ? matches[0] : null;
}

/*
 * Credits the GROSS amount, matching NEURAPAY_WALLET_CREDIT_BASIS=amount. The
 * customer gets every naira sent and ChapsSms absorbs PocketFi's fee.
 */
async function creditTransfer({ account, reference, amount, fee, settlementAmount, description }) {
  await ensureWallet(account.user);

  /*
   * IDEMPOTENCY: MongoDB evaluates this filter and the $inc/$push atomically,
   * so PocketFi's retries and duplicate deliveries cannot both match.
   */
  let wallet = await Wallet.findOneAndUpdate(
    {
      user: account.user,
      "transactions.reference": { $ne: reference },
    },
    {
      $inc: { balance: amount },
      $push: {
        transactions: {
          type: "deposit",
          amount,
          environment: "live",
          balanceField: "balance",
          description: `PocketFi wallet funding: ₦${amount.toLocaleString("en-NG")}`,
          status: "completed",
          reference,
          transactionId: reference,
          paymentGateway: "pocketfi",
          currency: "NGN",
          paymentMethod: "bank_transfer",
        },
      },
    },
    { returnDocument: "after", runValidators: true },
  );

  let alreadyCredited = false;

  if (!wallet) {
    wallet = await Wallet.findOne({ user: account.user });
    alreadyCredited = Boolean(
      wallet?.transactions?.some(
        (item) => String(item.reference || "").trim().toUpperCase() === reference,
      ),
    );

    if (!alreadyCredited) {
      const error = new Error("Unable to credit the ChapsSms wallet");
      error.status = 500;
      error.code = "WALLET_CREDIT_FAILED";
      throw error;
    }
  }

  await PocketFiTransaction.updateOne(
    { reference },
    {
      $set: {
        user: account.user,
        account: account._id,
        amount,
        fee,
        settlementAmount,
        creditedAmount: amount,
        virtualAccount: account.accountNumber,
        description,
        credited: true,
      },
      $setOnInsert: { reference, creditedAt: new Date() },
    },
    { upsert: true },
  );

  // Only the call that actually credited the wallet reports the conversion.
  if (!alreadyCredited) {
    reportDepositPurchase({
      userId: account.user,
      reference,
      amount,
      gateway: "PocketFi",
    });
  }

  return { alreadyCredited };
}

exports.getVirtualAccount = async (req, res) => {
  try {
    const account = await PocketFiAccount.findOne({ user: req.user._id, status: "active" });

    return res.status(200).json({ success: true, account: serializeAccount(account) });
  } catch (error) {
    console.error("PocketFi account lookup failed:", error.message);

    return res.status(error.status || 500).json({
      success: false,
      message: "Unable to load PocketFi account",
      code: error.code || "POCKETFI_ACCOUNT_LOOKUP_FAILED",
    });
  }
};

exports.createVirtualAccount = async (req, res) => {
  try {
    /*
     * Financial invariant: create/repair the local wallet BEFORE creating or
     * returning an external bank account that can receive real money.
     */
    await ensureWallet(req.user._id);

    const existing = await PocketFiAccount.findOne({ user: req.user._id, status: "active" });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "PocketFi account ready",
        account: serializeAccount(existing),
      });
    }

    const active = await getActiveGateway();

    if (active.id !== "pocketfi") {
      return res.status(409).json({
        success: false,
        message: "This payment method is no longer available. Please reload the page.",
        code: "PAYMENT_GATEWAY_NOT_ACTIVE",
      });
    }

    const customerEmail = normalizeEmail(req.user.email);

    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        message: "Your ChapsSms account needs a valid email before a PocketFi account can be created.",
        code: "CUSTOMER_EMAIL_REQUIRED",
      });
    }

    const created = await pocketfi.createVirtualAccount({
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      username: req.user.username,
      email: customerEmail,
    });

    let account;

    try {
      account = await PocketFiAccount.create({
        user: req.user._id,
        bank: created.bank,
        bankName: created.bankName,
        accountNumber: created.accountNumber,
        accountName: created.accountName,
        customerEmail,
      });
    } catch (error) {
      if (error?.code !== 11000) {
        // The account exists upstream but transfers to it cannot be attributed.
        console.error("[PocketFi] CRITICAL: provisioned account not saved:", {
          userId: String(req.user._id),
          accountNumber: created.accountNumber,
          message: error.message,
        });
        throw error;
      }

      account = await PocketFiAccount.findOne({
        $or: [{ user: req.user._id }, { accountNumber: created.accountNumber }],
      });
    }

    return res.status(201).json({
      success: true,
      message: "PocketFi account created successfully",
      account: serializeAccount(account),
    });
  } catch (error) {
    console.error("PocketFi account creation failed:", {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to create PocketFi account",
      code: error.code || "POCKETFI_ACCOUNT_CREATION_FAILED",
    });
  }
};

exports.handleWebhook = async (req, res) => {
  if (!pocketfi.isValidWebhookSignature(req)) {
    return res.status(401).json({ status: "error", message: "Invalid signature" });
  }

  const payload = req.body || {};
  const reference = String(payload?.transaction?.reference || "").trim().toUpperCase();
  const accountNumber = String(payload?.account_number || "").trim();
  const amount = Number(payload?.order?.amount);

  if (!reference) {
    return res.status(400).json({ status: "error", message: "Transaction reference missing" });
  }

  try {
    const account = accountNumber ? await findAccountForWebhook(accountNumber) : null;

    /*
     * Money moved but cannot be attributed, or the amount is unusable. Neither
     * fixes itself on retry, so acknowledge it and leave a loud log.
     */
    if (!account || !Number.isFinite(amount) || amount <= 0) {
      console.error("[PocketFi] CRITICAL: transfer needs a manual credit:", {
        reference,
        accountNumber,
        amount: payload?.order?.amount,
      });

      return res.status(200).json({ status: "success" });
    }

    const { alreadyCredited } = await creditTransfer({
      account,
      reference,
      amount,
      fee: Number(payload?.order?.fee) || 0,
      settlementAmount: Number(payload?.order?.settlement_amount) || 0,
      description: String(payload?.order?.description || "").trim(),
    });

    console.log("[PocketFi] verified wallet funding:", {
      reference,
      userId: String(account.user),
      amount,
      alreadyCredited,
    });

    return res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("[PocketFi] webhook processing failed:", {
      reference,
      code: error.code,
      status: error.status,
      message: error.message,
    });

    // PocketFi retries a non-2xx up to 5 times, and the credit is idempotent.
    return res.status(500).json({ status: "error", message: "Temporary processing failure" });
  }
};
