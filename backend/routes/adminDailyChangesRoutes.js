const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { getDailyChanges } = require('../controllers/adminDailyChangesController');
const { saveProviderSnapshots } = require('../controllers/adminProviderSnapshotController');
const router = express.Router();
router.use(protect, admin);
router.get('/', getDailyChanges);
router.post('/provider-snapshots', saveProviderSnapshots);
module.exports = router;