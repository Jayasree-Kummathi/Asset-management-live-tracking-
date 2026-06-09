'use strict';
// Backend/routes/employeeRoutes.js

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ── Static routes FIRST (before /:id) ────────────────────────────────────────

router.route('/')
  .get(ctrl.getEmployees)
  .post(authorize('superadmin', 'admin', 'it_staff'), ctrl.createEmployee);

router.get('/deleted', authorize('superadmin', 'admin', 'it_staff'), ctrl.getDeletedEmployees);

// Support Contacts — before /:id
router.get('/support-contacts',        ctrl.getSupportContactsList);
router.get('/support-contacts/all',    authorize('superadmin', 'admin', 'it_staff'), ctrl.getAllSupportContacts);
router.post('/support-contacts',       authorize('superadmin', 'admin', 'it_staff'), ctrl.createSupportContact);
router.put('/support-contacts/:id',    authorize('superadmin', 'admin', 'it_staff'), ctrl.updateSupportContact);
router.delete('/support-contacts/:id', authorize('superadmin', 'admin', 'it_staff'), ctrl.deleteSupportContact);

// ── Laptop status — all methods, both URL forms, before /:id ─────────────────
const laptopAuth = authorize('superadmin', 'admin', 'it_staff');
router.patch('/deleted/:id/laptop-status', laptopAuth, ctrl.updateDeletedLaptopStatus);
router.put('/deleted/:id/laptop-status',   laptopAuth, ctrl.updateDeletedLaptopStatus);
router.patch('/:id/laptop-status',         laptopAuth, ctrl.updateDeletedLaptopStatus);
router.put('/:id/laptop-status',           laptopAuth, ctrl.updateDeletedLaptopStatus);

// ── Dynamic /:id LAST ─────────────────────────────────────────────────────────
router.route('/:id')
  .get(ctrl.getEmployee)
  .put(authorize('superadmin', 'admin', 'it_staff'), ctrl.updateEmployee)
  .delete(authorize('superadmin', 'admin', 'it_staff'), ctrl.deleteEmployee);

module.exports = router;