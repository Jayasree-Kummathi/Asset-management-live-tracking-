'use strict';
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// Include role + location in every token so downstream middleware
// can enforce location-based isolation without an extra DB round-trip.
const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, location: user.location || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

// @route  POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, location } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
  }

  const salt      = await bcrypt.genSalt(10);
  const hashed    = await bcrypt.hash(password, salt);
  const validRole = ['superadmin', 'admin', 'it_staff', 'employee'].includes(role) ? role : 'it_staff';

  const result = await query(
  `SELECT id, name, email, password, role, location, 
          managed_location, managed_locations, is_active
   FROM users WHERE email = $1`,
  [email.toLowerCase()]
);

  const user  = result.rows[0];
  const token = signToken(user);

  res.status(201).json({ success: true, token, user });
});

// @route  POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  // Fetch location alongside existing fields so it lands in the token
  const result = await query(
    `SELECT id, name, email, password, role, location, is_active
     FROM users WHERE email = $1`,
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

  const token = signToken(user);
  const { password: _, ...safeUser } = user;

  res.json({ success: true, token, user: safeUser });
});

exports.getMe = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, role, location, managed_location, managed_locations,
            is_active, created_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, user: result.rows[0] });
});
// @route  PUT /api/auth/password
exports.updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both currentPassword and newPassword are required' });
  }

  const result  = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password);

  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }

  const salt   = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);

  await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);

  // Re-issue token with up-to-date claims
  const token = signToken(req.user);
  res.json({ success: true, token, message: 'Password updated successfully' });
});