const express = require('express');
const router  = express.Router();
const { getAuditLogs, getAssetLogs } = require('../controllers/auditController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/',               getAuditLogs);
router.get('/asset/:assetId', getAssetLogs);

module.exports = router;
