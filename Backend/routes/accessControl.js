const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');// adjust to your auth middleware
const ctrl = require('../controllers/Accesscontrolcontroller');
 
// All routes require login + admin role
router.use(protect, authorize('admin'));

 
router.get('/',           ctrl.getAll);
router.post('/',          ctrl.grantAccess);
router.put('/:id',        ctrl.updateAccess);
router.put('/:id/revoke', ctrl.revokeAccess);
router.post('/:id/remind',ctrl.sendReminder);
 
module.exports = router;