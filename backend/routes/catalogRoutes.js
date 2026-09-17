const express = require("express");
const {
  getCatalog,
  getPrice,
} = require("../controllers/catalogController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/price", protect, getPrice);
router.get("/", protect, getCatalog);

module.exports = router;