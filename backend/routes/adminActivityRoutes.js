const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { getActivity } = require('../controllers/adminActivityController');
const router = express.Router();
router.use(protect, admin);
router.get('/', getActivity);
module.exports = router;