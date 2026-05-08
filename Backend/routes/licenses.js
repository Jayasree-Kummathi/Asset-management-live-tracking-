// Backend/routes/licenseRoutes.js
const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/licenseController');

// 🔐 All routes require login
router.use(protect);

// 👀 Accessible to any logged-in user
router.get('/', ctrl.getAll);
router.get('/employees', ctrl.getEmployees);

// 📊 Report routes (accessible to admin only)
router.get('/report/excel', authorize('admin'), ctrl.exportExcelReport);
router.get('/report/data', authorize('admin'), ctrl.getReportData);
router.get('/custom', authorize('admin'), ctrl.getCustomLicenses);

// 🔒 Admin-only routes
router.post('/', authorize('admin'), ctrl.create);
router.put('/:id', authorize('admin'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);
router.post('/:id/assign', authorize('admin'), ctrl.assign);
router.delete('/assignments/:id', authorize('admin'), ctrl.revokeAssignment);

module.exports = router;