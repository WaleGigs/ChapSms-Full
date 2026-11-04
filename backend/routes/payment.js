const express = require("express");

const router = express.Router();

const {
  initializePayment,
  verifyPayment,
  getPaymentStatus,
  handleWebhook: handleFlutterwaveWebhook,
} = require("../controllers/paymentController");

const {
  getVirtualAccount,
  createVirtualAccount,
  verifyTransaction: verifyNeuraPayTransaction,
  handleWebhook: handleNeuraPayWebhook,
} = require("../controllers/neurapayController");

const {
  getVirtualAccount: getPocketFiAccount,
  createVirtualAccount: createPocketFiAccount,
  handleWebhook: handlePocketFiWebhook,
} = require("../controllers/pocketfiController");

const {
  getActiveGateway,
} = require("../services/paymentGatewayService");

const {
  protect,
} = require("../middleware/authMiddleware");

/*
 * ============================================================
 * FLUTTERWAVE
 * ============================================================
 */
router.post(
  "/webhook",
  handleFlutterwaveWebhook
);

router.post(
  "/initialize",
  protect,
  initializePayment
);

router.post(
  "/verify",
  protect,
  verifyPayment
);

router.get(
  "/status/:txRef",
  protect,
  getPaymentStatus
);

/*
 * ============================================================
 * NEURAPAY
 * ============================================================
 * The webhook is public but authenticated by NeuraPay's HMAC
 * signature inside neurapayController. Customer routes are protected.
 */
router.post(
  "/neurapay/webhook",
  handleNeuraPayWebhook
);

router.get(
  "/neurapay/account",
  protect,
  getVirtualAccount
);

router.post(
  "/neurapay/account",
  protect,
  createVirtualAccount
);

router.post(
  "/neurapay/verify",
  protect,
  verifyNeuraPayTransaction
);

/*
 * ============================================================
 * POCKETFI
 * ============================================================
 * The webhook is public but authenticated by PocketFi's HMAC
 * signature inside pocketfiService. Customer routes are protected.
 */
router.post(
  "/pocketfi/webhook",
  handlePocketFiWebhook
);

router.get(
  "/pocketfi/account",
  protect,
  getPocketFiAccount
);

router.post(
  "/pocketfi/account",
  protect,
  createPocketFiAccount
);

/*
 * Which gateway the Add Funds page should use right now.
 */
router.get(
  "/gateway",
  protect,
  async (_req, res) => {
    res.set("Cache-Control", "no-store");

    return res.json({
      success: true,
      gateway: await getActiveGateway(),
    });
  }
);

module.exports = router;
