require("dotenv").config();

const mongoose =
  require("mongoose");

const Payment =
  require("../models/Payment");

const NeuraPayTransaction =
  require("../models/NeuraPayTransaction");

const paymentController =
  require("../controllers/paymentController");

const neurapayController =
  require("../controllers/neurapayController");

function envInteger(
  name,
  fallback,
  maximum
) {
  const value =
    Number.parseInt(
      process.env[name] || "",
      10
    );

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return fallback;
  }

  return maximum
    ? Math.min(value, maximum)
    : value;
}

async function reconcileFlutterwave({
  cutoff,
  limit,
}) {
  const payments =
    await Payment.find({
      createdAt: {
        $gte: cutoff,
      },
      status: {
        $in: [
          "pending",
          "successful",
        ],
      },
    })
      .sort({
        createdAt: 1,
      })
      .limit(limit);

  const result = {
    checked: 0,
    repaired: 0,
    alreadyOkay: 0,
    notSuccessful: 0,
    errors: 0,
  };

  for (const payment of payments) {
    result.checked += 1;

    try {
      const credit =
        await paymentController
          .verifyAndCreditByReference({
            txRef:
              payment.txRef,
          });

      if (
        credit.alreadyCredited
      ) {
        result.alreadyOkay += 1;
      } else {
        result.repaired += 1;
      }

      console.log(
        "[reconcile][flutterwave]",
        {
          txRef:
            payment.txRef,
          userId:
            String(
              payment.user
            ),
          alreadyCredited:
            credit.alreadyCredited,
          balance:
            credit.wallet?.balance,
          testBalance:
            credit.wallet?.testBalance,
        }
      );
    } catch (error) {
      if (
        [
          "PAYMENT_NOT_SUCCESSFUL",
          "PAYMENT_NOT_FOUND",
        ].includes(
          String(
            error?.code || ""
          )
        ) ||
        [400, 404, 409].includes(
          Number(
            error?.response?.status ||
              error?.status ||
              0
          )
        )
      ) {
        result.notSuccessful += 1;
        continue;
      }

      result.errors += 1;

      console.error(
        "[reconcile][flutterwave] ERROR",
        {
          txRef:
            payment.txRef,
          code:
            error?.code,
          status:
            error?.status ||
            error?.response?.status,
          message:
            error?.response?.data
              ?.message ||
            error?.message,
        }
      );
    }
  }

  return result;
}

async function reconcileNeuraPay({
  cutoff,
  limit,
}) {
  if (
    typeof neurapayController
      .verifyAndCredit !==
    "function"
  ) {
    throw new Error(
      "neurapayController.verifyAndCredit is not exported"
    );
  }

  const records =
    await NeuraPayTransaction
      .find({
        createdAt: {
          $gte: cutoff,
        },
        status:
          "successful",
      })
      .sort({
        createdAt: 1,
      })
      .limit(limit);

  const result = {
    checked: 0,
    repaired: 0,
    alreadyOkay: 0,
    errors: 0,
  };

  for (const record of records) {
    result.checked += 1;

    try {
      const credit =
        await neurapayController
          .verifyAndCredit({
            reference:
              record.reference,
            expectedUserId:
              record.user,
            eventName:
              "reconciliation",
          });

      if (
        credit.alreadyCredited
      ) {
        result.alreadyOkay += 1;
      } else {
        result.repaired += 1;
      }

      console.log(
        "[reconcile][neurapay]",
        {
          reference:
            record.reference,
          userId:
            String(
              record.user
            ),
          alreadyCredited:
            credit.alreadyCredited,
          creditedAmount:
            credit.creditedAmount,
          balance:
            credit.wallet?.balance,
        }
      );
    } catch (error) {
      result.errors += 1;

      console.error(
        "[reconcile][neurapay] ERROR",
        {
          reference:
            record.reference,
          code:
            error?.code,
          status:
            error?.status,
          message:
            error?.message,
        }
      );
    }
  }

  return result;
}

async function main() {
  const mongoUri =
    String(
      process.env.MONGO_URI ||
        ""
    ).trim();

  if (!mongoUri) {
    throw new Error(
      "MONGO_URI is required"
    );
  }

  const days =
    envInteger(
      "FUNDING_RECONCILE_DAYS",
      30,
      365
    );

  const limit =
    envInteger(
      "FUNDING_RECONCILE_LIMIT",
      500,
      5000
    );

  const cutoff =
    new Date(
      Date.now() -
        days *
          24 *
          60 *
          60 *
          1000
    );

  console.log(
    "ChapsSms wallet-funding reconciliation starting",
    {
      cutoff:
        cutoff.toISOString(),
      limit,
    }
  );

  await mongoose.connect(
    mongoUri
  );

  const flutterwave =
    await reconcileFlutterwave({
      cutoff,
      limit,
    });

  const neurapay =
    await reconcileNeuraPay({
      cutoff,
      limit,
    });

  console.log(
    "ChapsSms wallet-funding reconciliation complete",
    {
      flutterwave,
      neurapay,
    }
  );
}

main()
  .catch((error) => {
    console.error(
      "Wallet-funding reconciliation FAILED:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose
      .disconnect()
      .catch(() => {});
  });
