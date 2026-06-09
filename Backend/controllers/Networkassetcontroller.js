'use strict';
// Backend/controllers/Networkassetcontroller.js

const { query }    = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const {
  isSuperAdmin,
  applyLocationFilter,
  buildLocClause,
  getUserLocations,
} = require('../utils/locationFilter');

// ── GET /api/network-assets ───────────────────────────────────────────────────
exports.getNetworkAssets = asyncHandler(async (req, res) => {
  const { type, status } = req.query;
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (type   && type   !== 'All') { conditions.push(`asset_type = $${idx++}`); params.push(type); }
  if (status && status !== 'All') { conditions.push(`status = $${idx++}`);     params.push(status); }

  // ── Multi-location filter ──────────────────────────────────────────────────
  idx = applyLocationFilter(conditions, params, idx, req.user);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT * FROM network_assets ${where} ORDER BY asset_type, asset_id`,
    params
  );

  res.json({ success: true, count: result.rows.length, data: result.rows });
});

// ── GET /api/network-assets/:id ───────────────────────────────────────────────
exports.getNetworkAsset = asyncHandler(async (req, res) => {
  const { locClause, locParams } = buildLocClause(req.user, 2);

  const result = await query(
    `SELECT * FROM network_assets WHERE id = $1 ${locClause}`,
    [req.params.id, ...locParams]
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Asset not found (or outside your managed locations)' });

  res.json({ success: true, data: result.rows[0] });
});

// ── POST /api/network-assets ──────────────────────────────────────────────────
exports.createNetworkAsset = asyncHandler(async (req, res) => {
  const p = req.body;

  const effectiveLocation = isSuperAdmin(req.user)
    ? (p.location || null)
    : (req.user?.location || null);

  const result = await query(
    `INSERT INTO network_assets
       (asset_id, asset_type, make, model, asset_owner, serial_number,
        ip_address, subnet, location, warranty_start, warranty_end, warranty_status,
        status, used_for, remarks, brand, cartridge_no, rent_or_own,
        allocated_dept, his_status, notes, added_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [
      p.asset_id, p.asset_type,
      p.make            || null, p.model           || null,
      p.asset_owner     || 'IT', p.serial_number   || null,
      p.ip_address      || null, p.subnet          || null,
      effectiveLocation,
      p.warranty_start  || null, p.warranty_end    || null,
      p.warranty_status || null, p.status          || 'In Use',
      p.used_for        || null, p.remarks         || null,
      p.brand           || null, p.cartridge_no    || null,
      p.rent_or_own     || null, p.allocated_dept  || null,
      p.his_status      || null, p.notes           || null,
      req.user?.name    || 'Admin',
    ]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

// ── PUT /api/network-assets/:id ───────────────────────────────────────────────
exports.updateNetworkAsset = asyncHandler(async (req, res) => {
  const p = req.body;

  // Location guard
  const locs = getUserLocations(req.user);
  if (locs) {
    const existing = await query('SELECT location FROM network_assets WHERE id = $1', [req.params.id]);
    if (existing.rows.length && existing.rows[0].location && !locs.includes(existing.rows[0].location)) {
      return res.status(403).json({ success: false, message: 'Asset is outside your managed locations' });
    }
  }

  let whereClause = 'id = $20';
  const baseParams = [
    p.asset_type,
    p.make            || null,  p.model           || null,
    p.serial_number   || null,  p.ip_address      || null,
    p.subnet          || null,
    isSuperAdmin(req.user) ? (p.location || null) : (req.user?.location || null),
    p.warranty_start  || null,  p.warranty_end    || null,
    p.warranty_status || null,  p.status          || 'In Use',
    p.used_for        || null,  p.remarks         || null,
    p.brand           || null,  p.cartridge_no    || null,
    p.rent_or_own     || null,  p.allocated_dept  || null,
    p.his_status      || null,  p.notes           || null,
    req.params.id,
  ];

  const result = await query(
    `UPDATE network_assets SET
       asset_type=$1, make=$2, model=$3, serial_number=$4, ip_address=$5, subnet=$6,
       location=$7, warranty_start=$8, warranty_end=$9, warranty_status=$10,
       status=$11, used_for=$12, remarks=$13, brand=$14, cartridge_no=$15,
       rent_or_own=$16, allocated_dept=$17, his_status=$18, notes=$19,
       updated_at=NOW()
     WHERE ${whereClause} RETURNING *`,
    baseParams
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Asset not found (or outside your managed locations)' });

  res.json({ success: true, data: result.rows[0] });
});

// ── DELETE /api/network-assets/:id ───────────────────────────────────────────
exports.deleteNetworkAsset = asyncHandler(async (req, res) => {
  const { locClause, locParams } = buildLocClause(req.user, 2);

  const check = await query(
    `SELECT id FROM network_assets WHERE id = $1 ${locClause}`,
    [req.params.id, ...locParams]
  );
  if (!check.rows.length)
    return res.status(404).json({ success: false, message: 'Asset not found (or outside your managed locations)' });

  await query('DELETE FROM network_assets WHERE id = $1', [req.params.id]);
  res.json({ success: true, message: 'Deleted successfully' });
});

// ── POST /api/network-assets/bulk ────────────────────────────────────────────
exports.bulkImportNetworkAssets = asyncHandler(async (req, res) => {
  const { assets } = req.body;
  if (!assets?.length)
    return res.status(400).json({ success: false, message: 'No assets provided' });

  const effectiveLocation = isSuperAdmin(req.user) ? null : (req.user?.location || null);
  const results = { created: [], failed: [] };

  for (const p of assets) {
    try {
      const g = (...keys) => {
        for (const k of keys) {
          const v = p[k];
          if (v !== undefined && v !== null && v !== '') return String(v).trim();
        }
        return null;
      };

      const resolvedId = g('asset_id', 'Printer Asset Number', 'Asset Number')
        || `PRI-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;

      let ip = g('ip_address', 'IP', 'IP address');
      if (ip) ip = ip.replace(/^https?:\/\//i, '').replace(/:\d+\/?$/, '').trim() || null;

      await query(
        `INSERT INTO network_assets
           (asset_id, asset_type, make, model, serial_number,
            ip_address, subnet, location, status,
            warranty_start, warranty_end, warranty_status,
            used_for, remarks, brand, cartridge_no, rent_or_own,
            allocated_dept, his_status, notes, added_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (asset_id) DO UPDATE SET
           asset_type=EXCLUDED.asset_type, make=EXCLUDED.make, model=EXCLUDED.model,
           serial_number=EXCLUDED.serial_number, ip_address=EXCLUDED.ip_address,
           subnet=EXCLUDED.subnet, location=EXCLUDED.location, status=EXCLUDED.status,
           warranty_start=EXCLUDED.warranty_start, warranty_end=EXCLUDED.warranty_end,
           warranty_status=EXCLUDED.warranty_status, used_for=EXCLUDED.used_for,
           remarks=EXCLUDED.remarks, brand=EXCLUDED.brand, cartridge_no=EXCLUDED.cartridge_no,
           rent_or_own=EXCLUDED.rent_or_own, allocated_dept=EXCLUDED.allocated_dept,
           his_status=EXCLUDED.his_status, notes=EXCLUDED.notes, updated_at=NOW()`,
        [
          resolvedId, g('asset_type') || 'Printer',
          g('make','Make','Brand')       || null, g('model','Printer Model NO','Model') || null,
          g('serial_number','Serial Number','S/N','SN') || null,
          ip, g('subnet') || null,
          effectiveLocation || g('location') || null,
          g('status') || 'In Use',
          g('warranty_start') || null, g('warranty_end') || null,
          g('warranty_status') || null, g('used_for') || null,
          g('remarks') || null, g('brand') || null,
          g('cartridge_no','Cartridge NO') || null,
          g('rent_or_own','RENT/OWN PRINTER') || null,
          g('allocated_dept','Allocated To') || null,
          g('his_status') || null, g('notes') || null,
          req.user?.name || 'Admin',
        ]
      );
      results.created.push(resolvedId);
    } catch (err) {
      results.failed.push({ id: p.asset_id || '?', reason: err.message });
    }
  }

  res.status(201).json({ success: true, message: 'Bulk upload completed', data: results });
});

// ── GET /api/network-assets/stats ────────────────────────────────────────────
exports.getNetworkStats = asyncHandler(async (req, res) => {
  const { locClause, locParams } = buildLocClause(req.user, 1, 'AND');

  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE asset_type='Switch')   AS switches,
       COUNT(*) FILTER (WHERE asset_type='Server')   AS servers,
       COUNT(*) FILTER (WHERE asset_type='Router')   AS routers,
       COUNT(*) FILTER (WHERE asset_type='Printer')  AS printers,
       COUNT(*) FILTER (WHERE asset_type='Firewall') AS firewalls,
       COUNT(*) FILTER (WHERE status='In Use')       AS in_use,
       COUNT(*) FILTER (WHERE status='Not In Use')   AS not_in_use,
       COUNT(*)                                       AS total
     FROM network_assets WHERE 1=1 ${locClause}`,
    locParams
  );

  res.json({ success: true, data: result.rows[0] });
});