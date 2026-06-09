'use strict';
// Backend/controllers/repairController.js

const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const generateId   = require('../utils/generateId');
const { isSuperAdmin, applyLocationFilter } = require('../utils/locationFilter');

// ── GET /api/repairs ──────────────────────────────────────────────────────────
exports.getRepairs = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const params     = [];
  const conditions = [];
  let   idx        = 1;

  if (status && status !== 'All') {
    conditions.push(`r.status = $${idx++}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(r.asset_id ILIKE $${idx} OR r.issue ILIKE $${idx} OR r.vendor ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  // ── Location isolation: filter via assets.location ─────────────────────────
  // applyLocationFilter with column 'a.location' because we JOIN assets
  idx = applyLocationFilter(conditions, params, idx, req.user, 'a.location');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT r.*, a.brand, a.model, a.config, a.serial, a.location
     FROM repairs r
     LEFT JOIN assets a ON a.asset_id = r.asset_id
     ${where}
     ORDER BY r.created_at DESC`,
    params
  );

  res.json({ success: true, count: result.rows.length, data: result.rows });
});

// ── POST /api/repairs ─────────────────────────────────────────────────────────
exports.createRepair = asyncHandler(async (req, res) => {
  const {
    asset_id, assetId,
    issue,
    vendor,
    estimated_return, estimatedReturn,
    cost,
    notes,
  } = req.body;

  const finalAssetId         = (asset_id || assetId || '').toUpperCase();
  const finalEstimatedReturn = estimated_return || estimatedReturn;

  const client_pg = await getClient();
  try {
    await client_pg.query('BEGIN');

    // Fetch asset + enforce location boundary
    const assetRes = await client_pg.query(
      'SELECT asset_id, status, location FROM assets WHERE asset_id = $1',
      [finalAssetId]
    );
    if (!assetRes.rows.length) {
      await client_pg.query('ROLLBACK');
      return res.status(404).json({ success: false, message: `Asset ${finalAssetId} not found` });
    }

    // Non-superadmins can only repair assets in their managed locations
    const locs = require('../utils/locationFilter').getUserLocations(req.user);
    if (locs && assetRes.rows[0].location && !locs.includes(assetRes.rows[0].location)) {
      await client_pg.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: `Asset ${finalAssetId} is outside your managed locations`,
      });
    }

    const repairId = await generateId('REP');

    const result = await client_pg.query(
      `INSERT INTO repairs
         (repair_id, asset_id, issue, vendor, estimated_return, cost, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        repairId, finalAssetId,
        issue,
        vendor             || null,
        finalEstimatedReturn || null,
        cost               || 0,
        notes              || null,
        'In Repair',
      ]
    );

    await client_pg.query(
      'UPDATE assets SET status = $1 WHERE asset_id = $2',
      ['Repair', finalAssetId]
    );

    await client_pg.query(
      `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
       VALUES ($1,'repair',$2,$3,$4)`,
      [
        'ASSET_SENT_TO_REPAIR',
        `${finalAssetId} sent to repair. Issue: ${issue}`,
        finalAssetId,
        req.user?.name || 'Admin',
      ]
    );

    await client_pg.query('COMMIT');
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client_pg.query('ROLLBACK');
    throw err;
  } finally {
    client_pg.release();
  }
});

// ── PUT /api/repairs/:id ──────────────────────────────────────────────────────
exports.updateRepair = asyncHandler(async (req, res) => {
  const client_pg = await getClient();
  try {
    await client_pg.query('BEGIN');

    // Fetch current repair + asset location (for boundary check)
    const existing = await client_pg.query(
      `SELECT r.*, a.location AS asset_location
       FROM repairs r
       LEFT JOIN assets a ON a.asset_id = r.asset_id
       WHERE r.id = $1
       FOR UPDATE`,
      [req.params.id]
    );
    if (!existing.rows.length) {
      await client_pg.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Repair record not found' });
    }

    const repair = existing.rows[0];

    // Location guard
    const locs = require('../utils/locationFilter').getUserLocations(req.user);
    if (locs && repair.asset_location && !locs.includes(repair.asset_location)) {
      await client_pg.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Asset is outside your managed locations',
      });
    }

    if (repair.status === 'Completed' || repair.status === 'Unrepairable') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Repair record is locked (status: ${repair.status}). Completed and Unrepairable records cannot be modified.`,
      });
    }

    const allowed = ['status', 'vendor', 'estimated_return', 'actual_return', 'cost', 'notes'];
    const updates = [];
    const params  = [];
    let   idx     = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        params.push(req.body[key]);
      }
    }

    if (!updates.length) {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    params.push(req.params.id);
    const result = await client_pg.query(
      `UPDATE repairs SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    const updated   = result.rows[0];
    const newStatus = req.body.status;

    if (newStatus === 'Completed') {
      await client_pg.query('UPDATE assets SET status = $1 WHERE asset_id = $2', ['Stock', updated.asset_id]);
      await client_pg.query(
        `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
         VALUES ('REPAIR_COMPLETED','repair',$1,$2,$3)`,
        [`${updated.asset_id} repair completed. Asset returned to Stock.`, updated.asset_id, req.user?.name || 'Admin']
      );
    } else if (newStatus === 'Unrepairable') {
      await client_pg.query('UPDATE assets SET status = $1 WHERE asset_id = $2', ['Scrap', updated.asset_id]);

      const scrapCountRes = await client_pg.query('SELECT COUNT(*) AS cnt FROM scraps');
      const scrapId = 'SCR-' + String(Number(scrapCountRes.rows[0].cnt) + 1).padStart(3, '0');

      await client_pg.query(
        `INSERT INTO scraps (scrap_id, asset_id, reason, approved_by, notes)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (scrap_id) DO NOTHING`,
        [scrapId, updated.asset_id, 'Unrepairable — ' + updated.issue, req.user?.name || 'Admin', req.body.notes || null]
      );

      await client_pg.query(
        `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
         VALUES ('ASSET_SCRAPPED','scrap',$1,$2,$3)`,
        [`${updated.asset_id} marked Unrepairable. Asset moved to Scrap.`, updated.asset_id, req.user?.name || 'Admin']
      );
    } else if (newStatus === 'In Repair') {
      await client_pg.query('UPDATE assets SET status = $1 WHERE asset_id = $2', ['Repair', updated.asset_id]);
      await client_pg.query(
        `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
         VALUES ('REPAIR_REOPENED','repair',$1,$2,$3)`,
        [`${updated.asset_id} repair re-opened.`, updated.asset_id, req.user?.name || 'Admin']
      );
    }

    await client_pg.query('COMMIT');
    res.json({ success: true, data: updated });
  } catch (err) {
    await client_pg.query('ROLLBACK');
    throw err;
  } finally {
    client_pg.release();
  }
});