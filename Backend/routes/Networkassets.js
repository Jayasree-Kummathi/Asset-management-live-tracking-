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
router.post('/',      authorize('admin'), createNetworkAsset);
router.post('/bulk',  authorize('admin'), bulkImportNetworkAssets);
router.put('/:id',    authorize('admin'), updateNetworkAsset);
router.delete('/:id', authorize('admin'), deleteNetworkAsset);

module.exports = router;