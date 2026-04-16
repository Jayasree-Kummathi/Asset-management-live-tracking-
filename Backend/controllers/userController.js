const bcrypt   = require('bcryptjs');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { sendWelcomeEmail } = require('../utils/emailService');

// @route  GET /api/users
// @access Admin only
exports.getUsers = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, role, is_active, created_at
     FROM users
     ORDER BY role, name`
  );
  res.json({ success: true, data: result.rows });
});

// @route  POST /api/users
// @access Admin only — create IT staff / admin / employee account
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required' });
  }

  const validRoles = ['admin', 'it_staff', 'employee'];
  const userRole   = validRoles.includes(role) ? role : 'it_staff';

  // Check for duplicate email
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) {
    return res.status(409).json({ success: false, message: 'A user with this email already exists' });
  }

  // Hash password
  const salt   = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  const result = await query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email.toLowerCase(), hashed, userRole]
  );

  const newUser = result.rows[0];

  // Send welcome email — await so we can log success/failure clearly
  try {
    const emailResult = await sendWelcomeEmail({ name, email, password, role: userRole });
    console.log(`✅ Welcome email sent to ${email}`, emailResult?.messageId || '');
  } catch (emailErr) {
    // Don't fail the whole request — user is already created
    console.error(`❌ Welcome email FAILED for ${email}:`, emailErr.message);
  }

  // Audit log
  await query(
    `INSERT INTO audit_logs (action, category, detail, performed_by)
     VALUES ('USER_CREATED', 'admin', $1, $2)`,
    [`New ${userRole} account created for ${name} (${email})`, req.user?.name || 'Admin']
  );

  res.status(201).json({ success: true, data: newUser });
});

// @route  PUT /api/users/:id
// @access Admin only — update role or deactivate
exports.updateUser = asyncHandler(async (req, res) => {
  const { role, is_active, name } = req.body;
  const updates = [];
  const params  = [];
  let idx = 1;

  if (role      !== undefined) { updates.push(`role = $${idx++}`);      params.push(role); }
  if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active); }
  if (name      !== undefined) { updates.push(`name = $${idx++}`);      params.push(name); }

  if (!updates.length) {
    return res.status(400).json({ success: false, message: 'Nothing to update' });
  }

  params.push(req.params.id);
  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, is_active`,
    params
  );

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({ success: true, data: result.rows[0] });
});

// @route  DELETE /api/users/:id
// @access Admin only
exports.deleteUser = asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
  }

  const check = await query('SELECT name, email FROM users WHERE id = $1', [req.params.id]);
  if (!check.rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  await query('DELETE FROM users WHERE id = $1', [req.params.id]);

  await query(
    `INSERT INTO audit_logs (action, category, detail, performed_by)
     VALUES ('USER_DELETED', 'admin', $1, $2)`,
    [`User ${check.rows[0].name} (${check.rows[0].email}) deleted`, req.user?.name || 'Admin']
  );

  res.json({ success: true, message: 'User deleted successfully' });
});

// @route  PUT /api/users/:id/reset-password
// @access Admin only
exports.resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  const salt   = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);

  await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.params.id]);

  res.json({ success: true, message: 'Password reset successfully' });
});