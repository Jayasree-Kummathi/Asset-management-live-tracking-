const express = require('express');
const router  = express.Router();
const { getAssets, getAsset, createAsset, updateAsset, deleteAsset, getStats, bulkCreateAssets } = require('../controllers/assetController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getStats);

router.route('/')
  .get(getAssets)
  .post(authorize('admin', 'it_staff'), createAsset);

router.post('/bulk', authorize('admin'), bulkCreateAssets);

router.route('/:id')
  .get(getAsset)
  .put(authorize('admin', 'it_staff'), updateAsset)
  .delete(authorize('admin'), deleteAsset);

module.exports = router;
