const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// @route  GET /api/audit
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
      `(action ILIKE $${idx} OR detail ILIKE $${idx} OR asset_id ILIKE $${idx} OR performed_by ILIKE $${idx})`
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

// @route  GET /api/audit/asset/:assetId
exports.getAssetLogs = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM audit_logs WHERE asset_id = $1 ORDER BY created_at DESC',
    [req.params.assetId.toUpperCase()]
  );

  res.json({ success: true, count: result.rows.length, data: result.rows });
});
