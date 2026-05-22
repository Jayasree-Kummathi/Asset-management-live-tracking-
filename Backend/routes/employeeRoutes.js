'use strict';
// Backend/routes/employeeRoutes.js

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(ctrl.getEmployees)
  .post(authorize('admin', 'it_staff'), ctrl.createEmployee);

router.get('/deleted', authorize('admin', 'it_staff'), ctrl.getDeletedEmployees);
router.patch('/deleted/:id/laptop-status', authorize('admin', 'it_staff'), ctrl.updateDeletedLaptopStatus);

router.route('/:id')
  .get(ctrl.getEmployee)
  .put(authorize('admin', 'it_staff'), ctrl.updateEmployee)
  .delete(authorize('admin', 'it_staff'), ctrl.deleteEmployee);

// Support Contacts Routes (using 'ctrl' instead of 'employeeController')
router.get('/support-contacts', ctrl.getSupportContactsList);
router.get('/support-contacts/all', authorize('admin', 'it_staff'), ctrl.getAllSupportContacts);
router.post('/support-contacts', authorize('admin', 'it_staff'), ctrl.createSupportContact);
router.put('/support-contacts/:id', authorize('admin', 'it_staff'), ctrl.updateSupportContact);
router.delete('/support-contacts/:id', authorize('admin', 'it_staff'), ctrl.deleteSupportContact);

module.exports = router;