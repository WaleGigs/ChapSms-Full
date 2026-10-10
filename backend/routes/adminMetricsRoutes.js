const express = require("express");
const { protect, admin } = require("../middleware/authMiddleware");
const { getDailyMetrics } = require("../controllers/adminMetricsController");

const router = express.Router();
router.use(protect, admin);
router.get("/", getDailyMetrics);
router.get("/daily", getDailyMetrics);
module.exports = router;
