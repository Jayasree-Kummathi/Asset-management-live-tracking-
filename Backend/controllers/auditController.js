'use strict';
// Backend/controllers/auditController.js

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// Internal audit helper — called by other controllers to log actions
// Usage: await audit('ACCESS_GRANTED', 'access_control', 'description', 'Admin')
// ─────────────────────────────────────────────────────────────────────────────
const audit = async (action, category, detail, performedBy) => {
  try {
    await query(
      `INSERT INTO audit_logs (action, category, detail, performed_by, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [action, category, detail, performedBy || 'System']
    );
    console.log(`📝 [Audit] ${action} | ${category} | ${detail} | by: ${performedBy || 'System'}`);
  } catch (err) {
    // Never crash the caller — audit failures are non-fatal
    console.error('❌ Audit log insert failed:', err.message);
  }
};

// ── Export audit helper IMMEDIATELY so other controllers get the function ─────
// (Must be before any other exports.* assignments to avoid load-order issues)
exports.audit = audit;

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/audit
// ─────────────────────────────────────────────────────────────────────────────
exports.getAuditLogs = asyncHandler(async (req, res) => {
  const { category, search, page = 1, limit = 100 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];
  let idx = 1;

  if (category && category !== 'All') {
    conditions.push(`category = $${idx++}`);
    params.push(category.toLowerCase());
  }
  if (search) {
    conditions.push(
      `(action ILIKE $${idx} OR detail ILIKE $${idx} OR performed_by ILIKE $${idx})`
    );
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*) FROM audit_logs ${where}`, params);
  const total = Number(countRes.rows[0].count);

  const result = await query(
    `SELECT * FROM audit_logs ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    count: result.rows.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: Number(page),
    data: result.rows,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/audit/asset/:assetId
// ─────────────────────────────────────────────────────────────────────────────
exports.getAssetLogs = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM audit_logs WHERE asset_id = $1 ORDER BY created_at DESC',
    [req.params.assetId.toUpperCase()]
  );
  res.json({ success: true, count: result.rows.length, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/audit/categories
// ─────────────────────────────────────────────────────────────────────────────
exports.getCategories = asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT DISTINCT category, COUNT(*) as count
    FROM audit_logs
    GROUP BY category
    ORDER BY category
  `);
  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/audit/export
// ─────────────────────────────────────────────────────────────────────────────
exports.exportAuditLogs = asyncHandler(async (req, res) => {
  const { startDate, endDate, category } = req.query;
  const conditions = [];
  const params = [];
  let idx = 1;

  if (startDate) {
    conditions.push(`created_at >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`created_at <= $${idx++} || ' 23:59:59'`);
    params.push(endDate);
  }
  if (category && category !== 'all') {
    conditions.push(`category = $${idx++}`);
    params.push(category.toLowerCase());
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC`,
    params
  );

  res.json({ success: true, data: result.rows });
});