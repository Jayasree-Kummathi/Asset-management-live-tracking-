'use strict';
const bcrypt       = require('bcryptjs');
const { query }    = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ── Bootstrap DB columns ───────────────────────────────────────────────────────
const bootstrapUserColumns = async () => {
  try {
    const cols  = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`
    );
    const names = cols.rows.map(c => c.column_name);

    if (!names.includes('location')) {
      await query(`ALTER TABLE users ADD COLUMN location VARCHAR(100) DEFAULT NULL`);
      console.log('✅ Added location column to users');
    }
    if (!names.includes('managed_location')) {
      await query(`ALTER TABLE users ADD COLUMN managed_location VARCHAR(100) DEFAULT NULL`);
      console.log('✅ Added managed_location column to users');
    }
    if (!names.includes('managed_locations')) {
      await query(`ALTER TABLE users ADD COLUMN managed_locations TEXT DEFAULT NULL`);
      console.log('✅ Added managed_locations (JSON) column to users');
      await query(`
        UPDATE users
        SET managed_locations = json_build_array(managed_location)::text
        WHERE managed_location IS NOT NULL AND managed_locations IS NULL
      `);
      console.log('✅ Back-filled managed_locations from managed_location');
    }
  } catch (e) {
    console.warn('User bootstrap warning:', e.message);
  }
};
bootstrapUserColumns();

// ── Helpers ────────────────────────────────────────────────────────────────────
const isSuperAdmin = (user) => user?.role === 'superadmin';

/**
 * Parse managed_locations — stored as JSON string e.g. '["Bengaluru","Mumbai"]'
 * Returns a JS array.
 */
const parseLocations = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p.filter(Boolean); } catch {}
  // Legacy: comma-separated string
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

const serializeLocations = (arr) => {
  if (!arr || !arr.length) return null;
  const parsed = Array.isArray(arr) ? arr : parseLocations(arr);
  return JSON.stringify(parsed.filter(Boolean));
};

/**
 * Trim and deduplicate a locations array.
 */
const normalizeLocations = (arr) => {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map(l => (l || '').trim()).filter(Boolean))];
};

/**
 * Return a single trimmed location string, or null.
 */
const normalizeLocation = (val) => {
  if (!val) return null;
  const trimmed = String(val).trim();
  return trimmed || null;
};

/**
 * Build a location-scope WHERE fragment for non-superadmin users.
 * Checks BOTH managed_location (legacy) and managed_locations (JSON array).
 * Returns { clause, param } — caller pushes param and uses $idx for the placeholder.
 */
const buildLocationScopeClause = (user, idx) => {
  if (isSuperAdmin(user)) return null;

  const myLocs = user.managed_locations_array ||
    (user.managed_location ? [user.managed_location] : []);

  if (!myLocs.length) return null;

  return {
    clause: `(
      managed_location = ANY($${idx}::text[])
      OR managed_locations LIKE ANY(
           SELECT '%' || unnest($${idx}::text[]) || '%'
         )
    )`,
    param: myLocs,
  };
};

// ── GET /users ─────────────────────────────────────────────────────────────────
exports.getUsers = asyncHandler(async (req, res) => {
  // Superadmin sees everyone
  if (isSuperAdmin(req.user)) {
    const result = await query(
      `SELECT id, name, email, role, location, managed_location, managed_locations,
              is_active, created_at FROM users ORDER BY role, name`
    );
    return res.json({
      success: true,
      data: result.rows.map(u => ({
        ...u,
        managed_locations: parseLocations(u.managed_locations || u.managed_location),
      })),
    });
  }

  // Non-superadmin — scope to their assigned locations
  const myLocs = req.user.managed_locations_array;
  if (!myLocs || !myLocs.length) {
    return res.json({ success: true, data: [] });
  }

  const result = await query(
    `SELECT id, name, email, role, location, managed_location, managed_locations,
            is_active, created_at
     FROM users
     WHERE managed_location = ANY($1::text[])
        OR managed_locations LIKE ANY(
             SELECT '%' || unnest($1::text[]) || '%'
           )
     ORDER BY role, name`,
    [myLocs]
  );

  return res.json({
    success: true,
    data: result.rows.map(u => ({
      ...u,
      managed_locations: parseLocations(u.managed_locations || u.managed_location),
    })),
  });
});

// ── POST /users ────────────────────────────────────────────────────────────────
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, managed_location, managed_locations } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, email and password are required',
    });
  }

  const validRoles = ['superadmin', 'admin', 'it_staff', 'employee'];
  const userRole   = validRoles.includes(role) ? role : 'it_staff';

  if (userRole === 'superadmin' && !isSuperAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Only a Super Admin can create another Super Admin account',
    });
  }

  // Superadmin: use the locations sent from the form.
  // Non-SA admin: automatically assign their own location(s).
  let locsArray;
  if (isSuperAdmin(req.user)) {
    locsArray = normalizeLocations(parseLocations(managed_locations || managed_location));
  } else {
    locsArray = normalizeLocations(
      req.user.managed_locations_array ||
      (req.user.managed_location ? [req.user.managed_location] : [])
    );
  }

  const locsSaved = serializeLocations(locsArray);
  const legacyLoc = normalizeLocation(locsArray[0] || null);

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) {
    return res.status(409).json({ success: false, message: 'A user with this email already exists' });
  }

  const salt   = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  const result = await query(
    `INSERT INTO users
       (name, email, password, role, location, managed_location, managed_locations)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, email, role, location, managed_location, managed_locations, created_at`,
    [name, email.toLowerCase(), hashed, userRole, legacyLoc, legacyLoc, locsSaved]
  );

  const row = result.rows[0];
  res.status(201).json({
    success: true,
    data: {
      ...row,
      managed_locations: parseLocations(row.managed_locations || row.managed_location),
    },
  });
});

// ── PUT /users/:id ─────────────────────────────────────────────────────────────
// ── PUT /users/:id ─────────────────────────────────────────────────────────────
exports.updateUser = asyncHandler(async (req, res) => {
  const { role, is_active, name, location, managed_location, managed_locations } = req.body;
  const updates = [];
  const params  = [];
  let idx = 1;

  if (role      !== undefined) { updates.push(`role = $${idx++}`);      params.push(role); }
  if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active); }
  if (name      !== undefined) { updates.push(`name = $${idx++}`);      params.push(name); }

  const canEditLoc = isSuperAdmin(req.user) || req.user?.role === 'admin';

  if (canEditLoc) {
    if (managed_locations !== undefined) {
      const locsArray = normalizeLocations(parseLocations(managed_locations));
      const locsSaved = serializeLocations(locsArray);
      const legacyLoc = normalizeLocation(locsArray[0] || null);
      updates.push(`managed_locations = $${idx++}`); params.push(locsSaved);
      updates.push(`managed_location  = $${idx++}`); params.push(legacyLoc);
      updates.push(`location          = $${idx++}`); params.push(legacyLoc);
    } else if (managed_location !== undefined) {
      const normLoc = normalizeLocation(managed_location || null);
      updates.push(`managed_location = $${idx++}`); params.push(normLoc);
      updates.push(`location         = $${idx++}`); params.push(normLoc);
    }
    if (location !== undefined && isSuperAdmin(req.user)) {
      updates.push(`location = $${idx++}`); params.push(location || null);
    }
  }

  // ── FIXED: nothing to update in users table is fine — team member fields
  //    are handled separately via /team-members. Return current user data.
  if (!updates.length) {
    const current = await query(
      `SELECT id, name, email, role, location, managed_location, managed_locations, is_active
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!current.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const row = current.rows[0];
    return res.json({
      success: true,
      data: {
        ...row,
        managed_locations: parseLocations(row.managed_locations || row.managed_location),
      },
    });
  }

  // Base WHERE
  params.push(req.params.id);
  let whereClause = `id = $${idx++}`;

  const scope = buildLocationScopeClause(req.user, idx);
  if (scope) {
    whereClause += ` AND ${scope.clause}`;
    params.push(scope.param);
    idx++;
  }

  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE ${whereClause}
     RETURNING id, name, email, role, location, managed_location, managed_locations, is_active`,
    params
  );

  if (!result.rows.length) {
    return res.status(404).json({
      success: false,
      message: 'User not found (or outside your location scope)',
    });
  }

  const row = result.rows[0];
  res.json({
    success: true,
    data: {
      ...row,
      managed_locations: parseLocations(row.managed_locations || row.managed_location),
    },
  });
});
// ── DELETE /users/:id ──────────────────────────────────────────────────────────
exports.deleteUser = asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
  }

  // Build scoped check query
  let checkSql    = 'SELECT name, email FROM users WHERE id = $1';
  let checkParams = [req.params.id];

  if (!isSuperAdmin(req.user)) {
    const myLocs = req.user.managed_locations_array ||
      (req.user.managed_location ? [req.user.managed_location] : []);
    if (myLocs.length) {
      checkSql += ` AND (
        managed_location = ANY($2::text[])
        OR managed_locations LIKE ANY(
             SELECT '%' || unnest($2::text[]) || '%'
           )
      )`;
      checkParams = [req.params.id, myLocs];
    }
  }

  const check = await query(checkSql, checkParams);
  if (!check.rows.length) {
    return res.status(404).json({
      success: false,
      message: 'User not found (or outside your location scope)',
    });
  }

  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  await query(
    `INSERT INTO audit_logs (action, category, detail, performed_by)
     VALUES ('USER_DELETED', 'admin', $1, $2)`,
    [
      `User ${check.rows[0].name} (${check.rows[0].email}) deleted`,
      req.user?.name || 'Admin',
    ]
  );

  res.json({ success: true, message: 'User deleted successfully' });
});

// ── PUT /users/:id/reset-password ─────────────────────────────────────────────
exports.resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  // Build scoped check query
  let checkSql    = 'SELECT id FROM users WHERE id = $1';
  let checkParams = [req.params.id];

  if (!isSuperAdmin(req.user)) {
    const myLocs = req.user.managed_locations_array ||
      (req.user.managed_location ? [req.user.managed_location] : []);
    if (myLocs.length) {
      checkSql += ` AND (
        managed_location = ANY($2::text[])
        OR managed_locations LIKE ANY(
             SELECT '%' || unnest($2::text[]) || '%'
           )
      )`;
      checkParams = [req.params.id, myLocs];
    }
  }

  const check = await query(checkSql, checkParams);
  if (!check.rows.length) {
    return res.status(404).json({
      success: false,
      message: 'User not found (or outside your location scope)',
    });
  }

  const salt   = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);
  await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.params.id]);
  res.json({ success: true, message: 'Password reset successfully' });
});

// ── PUT /users/me/change-password ─────────────────────────────────────────────
exports.changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both current and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }

  const result = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const match = await bcrypt.compare(currentPassword, result.rows[0].password);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  const salt   = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);
  await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);

  res.json({ success: true, message: 'Password changed successfully' });
});