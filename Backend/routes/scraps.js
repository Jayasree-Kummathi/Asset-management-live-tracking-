const express = require('express');
const router  = express.Router();
const { getScraps, createScrap, deleteScrap } = require('../controllers/scrapController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getScraps)
  .post(authorize('superadmin', 'admin'), createScrap);  // Changed from scrapAsset to createScrap

router.delete('/:id', authorize('superadmin', 'admin'), deleteScrap);

module.exports = router;