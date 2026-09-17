/*
 * ONE-TIME LIVE PAYMENT RECONCILIATION
 *
 * Copy this file to:
 *   backend/scripts/reconcileLivePayment.js
 *
 * Run from the backend directory:
 *   node scripts/reconcileLivePayment.js YOUR_TX_REF
 *
 * The script verifies the payment with Flutterwave LIVE API, then moves the
 * already credited amount from testBalance to balance. It does not create
 * money from nothing.
 */

require("dotenv").config();

const axios = require("axios");
const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Wallet = require("../models/Wallet");

const FLW_BASE_URL = "https://api.flutterwave.com/v3";

function normalizeReference(value) {
  return String(value || "").trim().toUpperCase();
}

async function verifyByReference(txRef, secretKey) {
  const response = await axios.get(
    `${FLW_BASE_URL}/transactions/verify_by_reference`,
    {
      timeout: 20000,
      params: { tx_ref: txRef },
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.data?.data) {
    throw new Error("Flutterwave did not return transaction data");
  }

  return response.data.data;
}

async function run() {
  const txRef = normalizeReference(process.argv[2]);
  const mongoUri = String(
    process.env.MONGODB_URI || process.env.MONGO_URI || "",
  ).trim();
  const secretKey = String(process.env.FLW_SECRET_KEY || "").trim();

  if (!txRef) {
    throw new Error("Pass the Flutterwave txRef as the first argument");
  }

  if (!mongoUri) {
    throw new Error("MONGODB_URI or MONGO_URI is required");
  }

  if (!secretKey) {
    throw new Error("FLW_SECRET_KEY is required");
  }

  if (secretKey.toUpperCase().includes("_TEST")) {
    throw new Error(
      "FLW_SECRET_KEY is still a test key. Configure the live secret key first.",
    );
  }

  await mongoose.connect(mongoUri);

  const payment = await Payment.findOne({ txRef });

  if (!payment) {
    throw new Error(`Payment not found for txRef ${txRef}`);
  }

  const transaction = await verifyByReference(txRef, secretKey);
  const status = String(transaction.status || "").toLowerCase();
  const currency = String(transaction.currency || "").toUpperCase();
  const paidAmount = Number(transaction.amount);
  const expectedAmount = Number(payment.amount);

  if (status !== "successful") {
    throw new Error(`Flutterwave status is ${status || "unknown"}`);
  }

  if (normalizeReference(transaction.tx_ref) !== txRef) {
    throw new Error("Flutterwave reference does not match the Payment record");
  }

  if (currency !== "NGN") {
    throw new Error(`Unexpected currency: ${currency || "unknown"}`);
  }

  if (!Number.isFinite(paidAmount) || paidAmount < expectedAmount) {
    throw new Error("Flutterwave amount is below the expected amount");
  }

  const wallet = await Wallet.findOne({ user: payment.user });

  if (!wallet) {
    throw new Error("Wallet not found for this payment");
  }

  const deposit = wallet.transactions.find(
    (item) => normalizeReference(item.reference) === txRef,
  );

  if (!deposit) {
    throw new Error("Matching wallet deposit transaction was not found");
  }

  if (
    payment.environment === "live" &&
    deposit.environment === "live" &&
    deposit.balanceField === "balance"
  ) {
    console.log("Payment is already live. No change was made.");
    await mongoose.disconnect();
    return;
  }

  if (Number(wallet.testBalance || 0) < expectedAmount) {
    throw new Error(
      "testBalance is below the payment amount. No balance was changed.",
    );
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const updatedWallet = await Wallet.findOneAndUpdate(
        {
          user: payment.user,
          testBalance: { $gte: expectedAmount },
          "transactions.reference": txRef,
        },
        {
          $inc: {
            testBalance: -expectedAmount,
            balance: expectedAmount,
          },
          $set: {
            "transactions.$.environment": "live",
            "transactions.$.balanceField": "balance",
            "transactions.$.description":
              `Flutterwave live wallet funding: ₦${expectedAmount.toLocaleString("en-NG")}`,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!updatedWallet) {
        throw new Error("Wallet reconciliation failed");
      }

      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            environment: "live",
            status: "successful",
            credited: true,
            flutterwaveId: String(
              transaction.id || payment.flutterwaveId || "",
            ),
            verifiedAt: new Date(),
          },
        },
        { session },
      );

      console.log({
        success: true,
        txRef,
        amount: expectedAmount,
        liveBalance: updatedWallet.balance,
        testBalance: updatedWallet.testBalance,
      });
    });
  } finally {
    await session.endSession();
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error({
    success: false,
    message: error.message,
    flutterwave: error.response?.data,
  });

  await mongoose.disconnect().catch(() => null);
  process.exit(1);
});