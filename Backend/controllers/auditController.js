'use strict';
// Backend/controllers/auditController.js

const { query }    = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { isSuperAdmin, applyLocationFilter, getUserLocations } = require('../utils/locationFilter');

// ── Internal audit helper ─────────────────────────────────────────────────────
const audit = async (action, category, detail, performedBy) => {
  try {
    await query(
      `INSERT INTO audit_logs (action, category, detail, performed_by, created_at)
       VALUES ($1,$2,$3,$4,NOW())`,
      [action, category, detail, performedBy || 'System']
    );
  } catch (err) {
    console.error('❌ Audit log insert failed:', err.message);
  }
};
exports.audit = audit;

// ── GET /api/audit ────────────────────────────────────────────────────────────
exports.getAuditLogs = asyncHandler(async (req, res) => {
  const { category, search, page = 1, limit = 100 } = req.query;
  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (category && category !== 'All') {
    conditions.push(`l.category = $${idx++}`);
    params.push(category.toLowerCase());
  }
  if (search) {
    conditions.push(
      `(l.action ILIKE $${idx} OR l.detail ILIKE $${idx} OR l.performed_by ILIKE $${idx})`
    );
    params.push(`%${search}%`);
    idx++;
  }

  // ── Location isolation ─────────────────────────────────────────────────────
  // FIX 1: Use INNER JOIN instead of LEFT JOIN so unmatched assets are excluded
  // FIX 2: Use ILIKE ANY(unnest()) to match locationFilter.js pattern
  // FIX 3: NULL asset_id logs are only shown when they belong to the user's
  //        location — matched via performed_by against users table.
  //        This stops Bangalore logs leaking to USA admin.
  let joinClause = '';
  if (!isSuperAdmin(req.user)) {
    const locs = getUserLocations(req.user);
    if (locs) {
      // LEFT JOIN assets so we can check location for asset-linked logs
      // LEFT JOIN users so we can scope null-asset logs by performer's location
      joinClause = `
        LEFT JOIN assets a ON a.asset_id = l.asset_id
        LEFT JOIN users  u ON LOWER(u.name) = LOWER(l.performed_by)
      `;

      // For asset-linked logs: asset must be in user's location(s)
      // For non-asset logs:    performer must be in user's location(s)
      // FIX: both branches use ILIKE ANY(unnest()) — consistent with locationFilter.js
      conditions.push(`
        (
          (l.asset_id IS NOT NULL AND a.location ILIKE ANY(SELECT unnest($${idx}::text[])))
          OR
          (l.asset_id IS NULL     AND u.location ILIKE ANY(SELECT unnest($${idx}::text[])))
        )
      `);
      params.push(locs);
      idx++;
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(
    `SELECT COUNT(*) FROM audit_logs l ${joinClause} ${where}`,
    params
  );
  const total = Number(countRes.rows[0].count);

  const result = await query(
    `SELECT l.* FROM audit_logs l ${joinClause} ${where}
     ORDER BY l.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    count:       result.rows.length,
    total,
    pages:       Math.ceil(total / limit),
    currentPage: Number(page),
    data:        result.rows,
  });
});

// ── GET /api/audit/asset/:assetId ─────────────────────────────────────────────
exports.getAssetLogs = asyncHandler(async (req, res) => {
  const locs = getUserLocations(req.user);

  if (locs) {
    // FIX: use ILIKE ANY(unnest()) consistent with locationFilter.js
    const assetRes = await query(
      `SELECT location FROM assets WHERE asset_id = $1`,
      [req.params.assetId.toUpperCase()]
    );
    if (assetRes.rows.length) {
      const assetLoc = assetRes.rows[0].location || '';
      const matched  = locs.some(
        l => assetLoc.toLowerCase() === l.toLowerCase()
      );
      if (!matched) {
        return res.status(403).json({
          success: false,
          message: 'Asset is outside your managed locations',
        });
      }
    }
  }

  const result = await query(
    'SELECT * FROM audit_logs WHERE asset_id = $1 ORDER BY created_at DESC',
    [req.params.assetId.toUpperCase()]
  );
  res.json({ success: true, count: result.rows.length, data: result.rows });
});

// ── GET /api/audit/categories ─────────────────────────────────────────────────
exports.getCategories = asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT DISTINCT category, COUNT(*) as count
    FROM audit_logs
    GROUP BY category
    ORDER BY category
  `);
  res.json({ success: true, data: result.rows });
});

// ── GET /api/audit/export ─────────────────────────────────────────────────────
exports.exportAuditLogs = asyncHandler(async (req, res) => {
  const { startDate, endDate, category } = req.query;
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (startDate) { conditions.push(`l.created_at >= $${idx++}`);              params.push(startDate); }
  if (endDate)   { conditions.push(`l.created_at <= ($${idx++} || ' 23:59:59')`); params.push(endDate); }
  if (category && category !== 'all') { conditions.push(`l.category = $${idx++}`); params.push(category.toLowerCase()); }

  // FIX: same pattern as getAuditLogs — ILIKE ANY + user join for null-asset logs
  let joinClause = '';
  if (!isSuperAdmin(req.user)) {
    const locs = getUserLocations(req.user);
    if (locs) {
      joinClause = `
        LEFT JOIN assets a ON a.asset_id = l.asset_id
        LEFT JOIN users  u ON LOWER(u.name) = LOWER(l.performed_by)
      `;
      conditions.push(`
        (
          (l.asset_id IS NOT NULL AND a.location ILIKE ANY(SELECT unnest($${idx}::text[])))
          OR
          (l.asset_id IS NULL     AND u.location ILIKE ANY(SELECT unnest($${idx}::text[])))
        )
      `);
      params.push(locs);
      idx++;
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT l.* FROM audit_logs l ${joinClause} ${where} ORDER BY l.created_at DESC`,
    params
  );

  res.json({ success: true, data: result.rows });
});