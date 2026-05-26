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
router.get('/report/excel', authorize('admin'), ctrl.exportExcelReport);
router.get('/report/data',  authorize('admin'), ctrl.getReportData);
router.get('/custom',       authorize('admin'), ctrl.getCustomLicenses);

// ── Admin-only write routes ───────────────────────────────────────────────────
router.post('/',   authorize('admin'), ctrl.create);

// ── Assignment routes (static path first, then dynamic) ──────────────────────

// DELETE /api/licenses/assignments/:id  — revoke a specific assignment
router.delete('/assignments/:id', authorize('admin'), ctrl.revokeAssignment);

// ── Dynamic :id routes (LAST — so static paths above are matched first) ───────
router.get   ('/:id',        ctrl.getAll);          // unused but safe fallback
router.put   ('/:id',        authorize('admin'), ctrl.update);
router.delete('/:id',        authorize('admin'), ctrl.remove);
router.post  ('/:id/assign', authorize('admin'), ctrl.assign);

module.exports = router;