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
router.post('/stock',        authorize('superadmin', 'admin'), addToStock);
router.put('/stock/:id',     authorize('superadmin', 'admin'), updateStock);
router.delete('/stock/:id',  authorize('superadmin', 'admin'), deleteStock);

router.get('/allocations',   getAllocations);
router.post('/allocations',  allocateAccessory);
router.put('/allocations/:id/receive', receiveAccessory);
router.put('/allocations/:id/return',  authorize('superadmin', 'admin'), returnAccessory);

router.get('/', getRequests);

module.exports = router;
