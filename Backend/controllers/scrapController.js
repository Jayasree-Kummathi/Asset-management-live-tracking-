'use strict';
// Backend/controllers/scrapController.js

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { applyLocationFilter, buildLocClause, getUserLocations } = require('../utils/locationFilter');

// ── GET /api/scraps ───────────────────────────────────────────────────────────
exports.getScraps = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (search) {
    conditions.push(`(s.asset_id ILIKE $${idx} OR s.reason ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  // ── Location isolation: filter via assets.location ─────────────────────────
  idx = applyLocationFilter(conditions, params, idx, req.user, 'a.location');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT s.*, a.brand, a.model, a.serial, a.config, a.location
     FROM scraps s
     LEFT JOIN assets a ON a.asset_id = s.asset_id
     ${where}
     ORDER BY s.created_at DESC`,
    params
  );

  res.json({ success: true, count: result.rows.length, data: result.rows });
});

// ── POST /api/scraps ──────────────────────────────────────────────────────────
exports.createScrap = asyncHandler(async (req, res) => {
  const { asset_id, reason, approved_by, notes } = req.body;
  const id = (asset_id || '').toUpperCase();

  // Fetch asset + enforce location boundary
  const assetRes = await query('SELECT asset_id, status, location FROM assets WHERE asset_id = $1', [id]);
  if (!assetRes.rows.length) {
    return res.status(404).json({ success: false, message: `Asset ${id} not found` });
  }

  const locs = getUserLocations(req.user);
  if (locs && assetRes.rows[0].location && !locs.includes(assetRes.rows[0].location)) {
    return res.status(403).json({
      success: false,
      message: `Asset ${id} is outside your managed locations`,
    });
  }

  const scrapCountRes = await query('SELECT COUNT(*) AS cnt FROM scraps');
  const scrapId = 'SCR-' + String(Number(scrapCountRes.rows[0].cnt) + 1).padStart(3, '0');

  const result = await query(
    `INSERT INTO scraps (scrap_id, asset_id, reason, approved_by, notes)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [scrapId, id, reason, approved_by || req.user?.name || 'Admin', notes || null]
  );

  await query('UPDATE assets SET status = $1 WHERE asset_id = $2', ['Scrap', id]);

  await query(
    `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
     VALUES ('ASSET_SCRAPPED','scrap',$1,$2,$3)`,
    [`${id} moved to Scrap. Reason: ${reason}`, id, req.user?.name || 'Admin']
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

// ── DELETE /api/scraps/:id ────────────────────────────────────────────────────
exports.deleteScrap = asyncHandler(async (req, res) => {
  // Fetch scrap + asset location
  const scrapRes = await query(
    `SELECT s.*, a.location AS asset_location
     FROM scraps s
     LEFT JOIN assets a ON a.asset_id = s.asset_id
     WHERE s.id = $1`,
    [req.params.id]
  );
  if (!scrapRes.rows.length) {
    return res.status(404).json({ success: false, message: 'Scrap record not found' });
  }

  const locs = getUserLocations(req.user);
  if (locs && scrapRes.rows[0].asset_location && !locs.includes(scrapRes.rows[0].asset_location)) {
    return res.status(403).json({
      success: false,
      message: 'Asset is outside your managed locations',
    });
  }

  await query('DELETE FROM scraps WHERE id = $1', [req.params.id]);
  res.json({ success: true, message: 'Scrap record deleted' });
});