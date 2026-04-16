const express = require('express');
const router  = express.Router();
const { getAllocations, getAllocation, allocateLaptop, receiveLaptop, swapLaptop, getMyAllocation } = require('../controllers/allocationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getAllocations)
  .post(authorize('admin', 'it_staff'), allocateLaptop);

router.get('/my', getMyAllocation);
router.get('/:id', getAllocation);
router.put('/:id/receive', authorize('admin', 'it_staff'), receiveLaptop);
router.put('/:id/swap',    authorize('admin', 'it_staff'), swapLaptop);

module.exports = router;
