'use strict';
// Backend/controllers/assetController.js
// ── Location isolation added to every query ───────────────────────────────────

const { query }    = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { isSuperAdmin, applyLocationFilter, buildLocClause } = require('../utils/locationFilter');

// ── Bootstrap: add location column to assets table ────────────────────────────
const bootstrapAssetLocation = async () => {
  try {
    const t = await query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assets')`
    );
    if (!t.rows[0].exists) return;

    const cols  = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'assets'`
    );
    const names = cols.rows.map(c => c.column_name);

    if (!names.includes('location')) {
      await query(`ALTER TABLE assets ADD COLUMN location VARCHAR(100) DEFAULT NULL`);
      console.log('✅ Added location column to assets');

      // Back-fill from the allocated employee's location
      await query(`
        UPDATE assets a
        SET    location = e.location
        FROM   allocations al
        JOIN   employees e ON e.emp_id = al.emp_id
        WHERE  al.asset_id = a.asset_id
          AND  al.status = 'Active'
          AND  e.location IS NOT NULL
          AND  a.location IS NULL
      `).catch(() => {});

      console.log('✅ Back-filled asset locations from allocations');
    }
  } catch (err) {
    console.warn('Asset bootstrap warning:', err.message);
  }
};
bootstrapAssetLocation();

// ── Date sanitizer (unchanged from your original) ─────────────────────────────
const toDateOnly = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{5}$/.test(s)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + Number(s) * 86400000);
    return d.toISOString().split('T')[0];
  }
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];
  const dmyMatch = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const mdyMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
};

const audit = (action, category, detail, assetId, performedBy, meta = null) =>
  query(
    `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by, meta)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [action, category, detail, assetId, performedBy, meta ? JSON.stringify(meta) : null]
  );


// ── GET /api/assets ───────────────────────────────────────────────────────────
exports.getAssets = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const offset     = (page - 1) * limit;
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (status && status !== 'All') { conditions.push(`status = $${idx++}`); params.push(status); }
  if (search) {
    conditions.push(`(asset_id ILIKE $${idx} OR serial ILIKE $${idx} OR brand ILIKE $${idx} OR model ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  // ── Location isolation ──────────────────────────────────────────────────────
  idx = applyLocationFilter(conditions, params, idx, req.user);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) FROM assets ${where}`, params);
  const total       = Number(countResult.rows[0].count);

  const dataResult = await query(
    `SELECT * FROM assets ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    count: dataResult.rows.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: Number(page),
    data: dataResult.rows,
  });
});


// ── GET /api/assets/stats ─────────────────────────────────────────────────────
exports.getStats = asyncHandler(async (req, res) => {
  const { locClause, locParams } = buildLocClause(req.user, 1);

  const counts = await query(
    `SELECT
       COUNT(*)                                        AS total,
       COUNT(*) FILTER (WHERE status = 'Stock')       AS stock,
       COUNT(*) FILTER (WHERE status = 'Allocated')   AS allocated,
       COUNT(*) FILTER (WHERE status = 'Repair')      AS repair,
       COUNT(*) FILTER (WHERE status = 'Scrap')       AS scrap
     FROM assets WHERE 1=1 ${locClause}`,
    locParams
  );

  const brands = await query(
    `SELECT brand AS name, COUNT(*) AS count
     FROM assets WHERE 1=1 ${locClause}
     GROUP BY brand ORDER BY count DESC`,
    locParams
  );

  const locations = await query(
    `SELECT location AS name, COUNT(*) AS count
     FROM assets WHERE location IS NOT NULL ${locClause.replace('AND', 'AND')}
     GROUP BY location ORDER BY count DESC`,
    locParams
  );

  res.json({
    success: true,
    data: {
      ...counts.rows[0],
      brandBreakdown:    brands.rows,
      locationBreakdown: locations.rows,
    },
  });
});


// ── GET /api/assets/:id ───────────────────────────────────────────────────────
exports.getAsset = asyncHandler(async (req, res) => {
  const { locClause, locParams } = buildLocClause(req.user, 2);

  const result = await query(
    `SELECT * FROM assets WHERE asset_id = $1 ${locClause}`,
    [req.params.id.toUpperCase(), ...locParams]
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: `Asset ${req.params.id} not found` });

  res.json({ success: true, data: result.rows[0] });
});


// ── POST /api/assets ──────────────────────────────────────────────────────────
exports.createAsset = asyncHandler(async (req, res) => {
  const {
    asset_id, serial, brand, model, config, processor, ram, storage,
    purchase_date, warranty_start, warranty_end, vendor, location, notes,
  } = req.body;

  // Non-superadmins always get their own location stamped
  const effectiveLocation = isSuperAdmin(req.user)
    ? (location || null)
    : (req.user?.location || null);

  const result = await query(
    `INSERT INTO assets
       (asset_id, serial, brand, model, config, processor, ram, storage,
        purchase_date, warranty_start, warranty_end, vendor, location, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,$11::date,$12,$13,$14)
     RETURNING *`,
    [
      asset_id?.toUpperCase(), serial, brand, model, config, processor,
      ram, storage,
      toDateOnly(purchase_date),
      toDateOnly(warranty_start),
      toDateOnly(warranty_end),
      vendor, effectiveLocation, notes,
    ]
  );

  const asset = result.rows[0];
  await audit('ASSET_ADDED', 'asset',
    `Asset ${asset.asset_id} (${asset.brand} ${asset.model}) added to inventory`,
    asset.asset_id, req.user?.name || 'Admin');

  res.status(201).json({ success: true, data: asset });
});


// ── PUT /api/assets/:id ───────────────────────────────────────────────────────
exports.updateAsset = asyncHandler(async (req, res) => {
  const id          = req.params.id.toUpperCase();
  const DATE_FIELDS = new Set(['purchase_date', 'warranty_start', 'warranty_end']);

  const allowed = [
    'serial', 'brand', 'model', 'config', 'processor', 'ram', 'storage',
    'purchase_date', 'warranty_start', 'warranty_end',
    'vendor', 'notes', 'status',
  ];
  // Only superadmin can move an asset to a different location
  if (isSuperAdmin(req.user)) allowed.push('location');

  const updates = [];
  const params  = [];
  let   idx     = 1;

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const value = DATE_FIELDS.has(key) ? toDateOnly(req.body[key]) : req.body[key];
      updates.push(DATE_FIELDS.has(key) ? `${key} = $${idx++}::date` : `${key} = $${idx++}`);
      params.push(value);
    }
  }

  if (!updates.length)
    return res.status(400).json({ success: false, message: 'No valid fields to update' });

  // Non-superadmins can only update assets within their own location
  let whereClause = `asset_id = $${idx}`;
  params.push(id); idx++;

  if (!isSuperAdmin(req.user) && req.user?.location) {
    whereClause += ` AND location = $${idx}`;
    params.push(req.user.location);
  }

  const result = await query(
    `UPDATE assets SET ${updates.join(', ')} WHERE ${whereClause} RETURNING *`,
    params
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: `Asset ${id} not found (or outside your location)` });

  await audit('ASSET_UPDATED', 'asset', `Asset ${id} updated`, id, req.user?.name || 'Admin');
  res.json({ success: true, data: result.rows[0] });
});


// ── DELETE /api/assets/:id ────────────────────────────────────────────────────
exports.deleteAsset = asyncHandler(async (req, res) => {
  const id = req.params.id.toUpperCase();

  // Block delete if currently allocated
  const activeAlloc = await query(
    `SELECT id FROM allocations WHERE asset_id = $1 AND status = 'Active'`, [id]
  );
  if (activeAlloc.rows.length)
    return res.status(400).json({
      success: false,
      message: 'Cannot delete — asset is currently allocated. Receive it first.',
    });

  // Fetch asset details + enforce location boundary
  const { locClause, locParams } = buildLocClause(req.user, 2);
  const assetRes = await query(
    `SELECT * FROM assets WHERE asset_id = $1 ${locClause}`,
    [id, ...locParams]
  );
  if (!assetRes.rows.length)
    return res.status(404).json({ success: false, message: `Asset ${id} not found (or outside your location)` });

  const asset = assetRes.rows[0];

  // Delete in FK-safe order (children first)
  await query(
    `DELETE FROM acceptance_tokens
     WHERE allocation_id IN (SELECT id FROM allocations WHERE asset_id = $1)`, [id]
  );
  await query(`DELETE FROM accessory_allocations  WHERE asset_id = $1`, [id]);
  await query(`DELETE FROM allocations            WHERE asset_id = $1`, [id]);
  await query(`DELETE FROM repairs                WHERE asset_id = $1`, [id]);
  await query(`DELETE FROM scraps                 WHERE asset_id = $1`, [id]);
  await query(`DELETE FROM agent_registrations    WHERE asset_id = $1`, [id]).catch(() => {});
  await query(`DELETE FROM asset_locations        WHERE asset_id = $1`, [id]).catch(() => {});
  await query(`DELETE FROM asset_location_history WHERE asset_id = $1`, [id]).catch(() => {});
  await query(`DELETE FROM asset_online_daily     WHERE asset_id = $1`, [id]).catch(() => {});

  // Audit BEFORE deleting the asset row (FK safety)
  await query(
    `INSERT INTO audit_logs (action, category, detail, performed_by, meta)
     VALUES ('ASSET_DELETED', 'asset', $1, $2, $3)`,
    [
      `Asset ${id} (${asset.brand} ${asset.model}, S/N: ${asset.serial}) permanently deleted`,
      req.user?.name || 'Admin',
      JSON.stringify({
        brand: asset.brand, model: asset.model, serial: asset.serial,
        status: asset.status, location: asset.location, vendor: asset.vendor,
      }),
    ]
  );

  await query(`DELETE FROM assets WHERE asset_id = $1`, [id]);
  res.json({ success: true, message: 'Asset deleted successfully' });
});


// ── POST /api/assets/bulk ─────────────────────────────────────────────────────
exports.bulkCreateAssets = asyncHandler(async (req, res) => {
  const { assets } = req.body;
  if (!assets || !Array.isArray(assets) || assets.length === 0)
    return res.status(400).json({ success: false, message: 'No assets provided' });

  // Non-superadmins can only bulk-import into their own location
  const effectiveLocation = isSuperAdmin(req.user)
    ? null  // each row may carry its own location
    : (req.user?.location || null);

  const results = { created: [], failed: [] };

  for (const a of assets) {
    try {
      const loc = effectiveLocation || a.location || null;
      const result = await query(
        `INSERT INTO assets
           (asset_id, serial, brand, model, config, processor, ram, storage,
            purchase_date, warranty_start, warranty_end, vendor, location, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,$11::date,$12,$13,$14)
         RETURNING asset_id`,
        [
          (a.asset_id || a.id || '').toUpperCase(),
          a.serial, a.brand, a.model,
          a.config    || null, a.processor || null,
          a.ram       || null, a.storage   || null,
          toDateOnly(a.purchase_date),
          toDateOnly(a.warranty_start),
          toDateOnly(a.warranty_end),
          a.vendor || null, loc, a.notes || null,
        ]
      );
      results.created.push(result.rows[0].asset_id);
    } catch (err) {
      results.failed.push({ id: a.asset_id || a.id, reason: err.message });
    }
  }

  await query(
    `INSERT INTO audit_logs (action, category, detail, performed_by)
     VALUES ('BULK_ASSET_IMPORT','asset',$1,$2)`,
    [
      `Bulk import: ${results.created.length} created, ${results.failed.length} failed`,
      req.user?.name || 'Admin',
    ]
  );

  res.status(201).json({ success: true, data: results });
});