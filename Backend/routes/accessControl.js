// Backend/routes/accessControlRoutes.js
const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/accessControlController');

// 🔐 All routes require login
router.use(protect);

// 👀 Accessible to any logged-in user
router.get('/', ctrl.getAll);
router.get('/report', authorize('superadmin', 'admin'), ctrl.getReport);

// 📊 Excel/CSV Report routes
router.get('/report/excel', authorize('superadmin', 'admin'), ctrl.exportExcelReport);
router.get('/export/csv', authorize('superadmin', 'admin'), ctrl.exportCSV);

// 🔒 Admin-only routes
router.post('/', authorize('superadmin', 'admin'), ctrl.grantAccess);
router.put('/:id', authorize('superadmin', 'admin'), ctrl.updateAccess);
router.put('/:id/revoke', authorize('superadmin', 'admin'), ctrl.revokeAccess);
router.post('/:id/remind', authorize('superadmin', 'admin'), ctrl.sendReminder);

module.exports = router;
