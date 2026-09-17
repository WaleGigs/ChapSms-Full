const express = require("express");
const router = express.Router();

const {
  getWallet,
  getTransactions,
  verifyFlutterwavePayment,
} = require("../controllers/walletController");

const {
  protect,
} = require("../middleware/authMiddleware");

router.get("/", protect, getWallet);

router.get(
  "/transactions",
  protect,
  getTransactions
);

router.post(
  "/verify-payment",
  protect,
  verifyFlutterwavePayment
);

module.exports = router;