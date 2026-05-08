// Backend/routes/auditRoutes.js
const express = require('express');
const router = express.Router();
const { getAuditLogs, getAssetLogs, getCategories, exportAuditLogs } = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

router.get('/', getAuditLogs);
router.get('/categories', getCategories);
router.get('/export', exportAuditLogs);
router.get('/asset/:assetId', getAssetLogs);

module.exports = router;