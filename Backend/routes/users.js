const express = require('express');
const router  = express.Router();
const { getUsers, createUser, updateUser, deleteUser, resetPassword } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .put(updateUser)
  .delete(deleteUser);

router.put('/:id/reset-password', resetPassword);

module.exports = router;
