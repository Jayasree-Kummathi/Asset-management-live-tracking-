const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// @route  POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
  }

  const salt     = await bcrypt.genSalt(10);
  const hashed   = await bcrypt.hash(password, salt);
  const validRole = ['admin', 'manager', 'viewer'].includes(role) ? role : 'viewer';

  const result = await query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email, hashed, validRole]
  );

  const user  = result.rows[0];
  const token = signToken(user.id);

  res.status(201).json({ success: true, token, user });
});

// @route  POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  const result = await query(
    'SELECT id, name, email, password, role, is_active FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (!user.is_active) {
    return res.status(401).json({ success: false, message: 'Account is deactivated' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = signToken(user.id);
  const { password: _, ...safeUser } = user;

  res.json({ success: true, token, user: safeUser });
});

// @route  GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// @route  PUT /api/auth/password
exports.updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const result = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password);

  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  const salt   = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);

  await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);

  const token = signToken(req.user.id);
  res.json({ success: true, token, message: 'Password updated successfully' });
});
