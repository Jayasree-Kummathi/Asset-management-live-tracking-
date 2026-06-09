'use strict';
// Backend/routes/licenseRoutes.js

const express = require('express');
const router  = express.Router();

const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/licenseController');

// 🔐 All routes require login
router.use(protect);

// ── Static GET routes (must come BEFORE /:id to avoid being swallowed) ────────

// 👀 Any logged-in user
router.get('/',           ctrl.getAll);
router.get('/employees',  ctrl.getEmployees);

// 📊 Dashboard home-stats (any logged-in user — used by Dashboard widget)
router.get('/home-stats', ctrl.getHomeStats);

// 📊 Report routes — admin only
router.get('/report/excel', authorize('superadmin', 'admin'), ctrl.exportExcelReport);
router.get('/report/data',  authorize('superadmin', 'admin'), ctrl.getReportData);
router.get('/custom',       authorize('superadmin', 'admin'), ctrl.getCustomLicenses);

// ── Admin-only write routes ───────────────────────────────────────────────────
router.post('/',   authorize('superadmin', 'admin'), ctrl.create);

// ── Assignment routes (static path first, then dynamic) ──────────────────────

// DELETE /api/licenses/assignments/:id  — revoke a specific assignment
router.delete('/assignments/:id', authorize('superadmin', 'admin'), ctrl.revokeAssignment);

// ── Dynamic :id routes (LAST — so static paths above are matched first) ───────
router.get   ('/:id',        ctrl.getAll);          // unused but safe fallback
router.put   ('/:id',        authorize('superadmin', 'admin'), ctrl.update);
router.delete('/:id',        authorize('superadmin', 'admin'), ctrl.remove);
router.post  ('/:id/assign', authorize('superadmin', 'admin'), ctrl.assign);

module.exports = router;
