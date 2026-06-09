const express = require('express');
const router  = express.Router();
const {
  getNetworkAssets, getNetworkAsset, createNetworkAsset,
  updateNetworkAsset, deleteNetworkAsset, bulkImportNetworkAssets, getNetworkStats
} = require('../controllers/Networkassetcontroller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/stats',  getNetworkStats);
router.get('/',       getNetworkAssets);
router.get('/:id',    getNetworkAsset);
router.post('/',      authorize('superadmin', 'admin'), createNetworkAsset);
router.post('/bulk',  authorize('superadmin', 'admin'), bulkImportNetworkAssets);
router.put('/:id',    authorize('superadmin', 'admin'), updateNetworkAsset);
router.delete('/:id', authorize('superadmin', 'admin'), deleteNetworkAsset);

module.exports = router;
