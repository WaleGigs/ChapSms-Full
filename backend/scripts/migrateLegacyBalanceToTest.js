/*
 * DEVELOPMENT DATABASE ONLY
 * =========================
 *
 * This moves every existing Wallet.balance value into Wallet.testBalance
 * and resets Wallet.balance to zero.
 *
 * Run this only when the current balances came from Flutterwave test
 * payments and the database contains no genuine live customer funds.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");

async function run() {
  const mongoUri = String(
    process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      "",
  ).trim();

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI or MONGO_URI is required",
    );
  }

  if (
    process.env.ALLOW_TEST_BALANCE_MIGRATION !==
    "YES"
  ) {
    throw new Error(
      "Set ALLOW_TEST_BALANCE_MIGRATION=YES before running this development-only migration",
    );
  }

  await mongoose.connect(mongoUri);

  console.log(
    "Connected to MongoDB. Starting wallet balance migration...",
  );

  const result = await Wallet.updateMany(
    {},
    [
      {
        $set: {
          testBalance: {
            $add: [
              {
                $ifNull: [
                  "$testBalance",
                  0,
                ],
              },
              {
                $ifNull: [
                  "$balance",
                  0,
                ],
              },
            ],
          },

          balance: 0,
        },
      },
    ],
    {
      updatePipeline: true,
    },
  );

  console.log(
    "Wallet balance migration completed.",
  );

  console.log({
    acknowledged: result.acknowledged,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  });

  await mongoose.disconnect();

  console.log(
    "Disconnected from MongoDB.",
  );
}

run().catch(async (error) => {
  console.error(
    "Wallet balance migration failed:",
    error,
  );

  await mongoose
    .disconnect()
    .catch(() => null);

  process.exit(1);
});