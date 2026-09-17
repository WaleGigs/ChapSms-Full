const express = require("express");
const {
  createOrder,
  getOrders,
  getOrder,
  checkOrder,
  cancelOrder,
  recoverStaleReservations,
} = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createOrder);
router.get("/", protect, getOrders);

// Recover interrupted/stale wallet reservations before the dynamic /:id routes.
router.post(
  "/recover-pending",
  protect,
  recoverStaleReservations,
);

router.get("/:id/check", protect, checkOrder);
router.post("/:id/cancel", protect, cancelOrder);
router.get("/:id", protect, getOrder);

module.exports = router;