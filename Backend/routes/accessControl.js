// Backend/routes/accessControlRoutes.js
const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/accessControlController');

// 🔐 All routes require login
router.use(protect);

// 👀 Accessible to any logged-in user
router.get('/', ctrl.getAll);
router.get('/report', authorize('admin'), ctrl.getReport);

// 📊 Excel/CSV Report routes
router.get('/report/excel', authorize('admin'), ctrl.exportExcelReport);
router.get('/export/csv', authorize('admin'), ctrl.exportCSV);

// 🔒 Admin-only routes
router.post('/', authorize('admin'), ctrl.grantAccess);
router.put('/:id', authorize('admin'), ctrl.updateAccess);
router.put('/:id/revoke', authorize('admin'), ctrl.revokeAccess);
router.post('/:id/remind', authorize('admin'), ctrl.sendReminder);

module.exports = router;