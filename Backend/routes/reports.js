const express = require('express');
const router  = express.Router();
const { getDashboardReport, getWarrantyReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', getDashboardReport);
router.get('/warranty',  getWarrantyReport);

module.exports = router;
