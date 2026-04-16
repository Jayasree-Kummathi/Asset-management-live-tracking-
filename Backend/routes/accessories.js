const express = require('express');
const router  = express.Router();
const {
  getStock, addToStock, updateStock, deleteStock,
  getAllocations, allocateAccessory, receiveAccessory, returnAccessory,
  getRequests,
} = require('../controllers/accessoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/stock',         getStock);
router.post('/stock',        authorize('admin'), addToStock);
router.put('/stock/:id',     authorize('admin'), updateStock);
router.delete('/stock/:id',  authorize('admin'), deleteStock);

router.get('/allocations',   getAllocations);
router.post('/allocations',  allocateAccessory);
router.put('/allocations/:id/receive', receiveAccessory);
router.put('/allocations/:id/return',  authorize('admin'), returnAccessory);

router.get('/', getRequests);

module.exports = router;