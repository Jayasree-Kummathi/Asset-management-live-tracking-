const express = require('express');
const router  = express.Router();
const { getRepairs, createRepair, updateRepair } = require('../controllers/repairController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getRepairs)
  .post(authorize('admin', 'it_staff'), createRepair);

router.route('/:id')
  .put(authorize('admin', 'it_staff'), updateRepair);

module.exports = router;
