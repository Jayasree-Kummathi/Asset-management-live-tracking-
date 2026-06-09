'use strict';
const jwt  = require('jsonwebtoken');
const { query } = require('../config/db');
const { normalizeLocation, normalizeLocations } = require('../utils/locationNormalizer');

exports.protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result  = await query(
      `SELECT id, name, email, role, location, managed_location, managed_locations, is_active
       FROM users WHERE id = $1`,
      [decoded.id]
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    // ── Parse managed_locations into a JS array ──────────────────────────────
    let managed_locations_array = [];
    if (user.managed_locations) {
      try {
        const parsed = JSON.parse(user.managed_locations);
        managed_locations_array = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        managed_locations_array = user.managed_locations
          .split(',').map(s => s.trim()).filter(Boolean);
      }
    } else if (user.managed_location) {
      managed_locations_array = [user.managed_location];
    }

    // ── Normalize all location spellings ─────────────────────────────────────
    managed_locations_array = normalizeLocations(managed_locations_array);

    req.user = {
      ...user,
      location:               normalizeLocation(user.managed_location || user.location || null),
      managed_location:       normalizeLocation(user.managed_location),
      managed_locations:      user.managed_locations,
      managed_locations_array,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized for this action`,
    });
  }
  next();
};