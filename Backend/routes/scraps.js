const express = require('express');
const router  = express.Router();
const { getScraps, scrapAsset, deleteScrap } = require('../controllers/scrapController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getScraps)
  .post(authorize('admin'), scrapAsset);

router.delete('/:id', authorize('admin'), deleteScrap);

module.exports = router;
