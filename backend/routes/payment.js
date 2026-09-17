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

module.exports = router;
