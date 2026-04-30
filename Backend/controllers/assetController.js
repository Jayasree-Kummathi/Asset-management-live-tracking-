const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ── Date sanitizer ────────────────────────────────────────────────────────────
// Converts ANY date input (text string, JS Date, Excel serial, ISO datetime)
// into a plain 'YYYY-MM-DD' string for PostgreSQL DATE columns.
// Returns null if the value is empty / unparseable.
const toDateOnly = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  if (!s) return null;

  // Already clean YYYY-MM-DD — return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Excel numeric serial date (e.g. 45678)
  if (/^\d{5}$/.test(s)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + Number(s) * 86400000);
    return d.toISOString().split('T')[0];
  }

  // ISO string with time/timezone (e.g. "2024-01-10T00:00:00.000Z" or "2024-01-10T00:00:00+05:30")
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;

  // MM/DD/YYYY
  const mdyMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`;

  // Last resort — parse with Date (strip timezone by using UTC)
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null; // unparseable — let DB reject rather than corrupt
};

// helper to write audit log inline
const audit = (action, category, detail, assetId, performedBy, meta = null) =>
  query(
    `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by, meta)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [action, category, detail, assetId, performedBy, meta ? JSON.stringify(meta) : null]
  );

// @route  GET /api/assets
exports.getAssets = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];
  let idx = 1;

  if (status && status !== 'All') {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(
      `(asset_id ILIKE $${idx} OR serial ILIKE $${idx} OR brand ILIKE $${idx} OR model ILIKE $${idx})`
    );
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) FROM assets ${where}`, params);
  const total = Number(countResult.rows[0].count);

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

// @route  GET /api/assets/stats
exports.getStats = asyncHandler(async (req, res) => {
  const counts = await query(
    `SELECT
       COUNT(*)                                           AS total,
       COUNT(*) FILTER (WHERE status = 'Stock')          AS stock,
       COUNT(*) FILTER (WHERE status = 'Allocated')      AS allocated,
       COUNT(*) FILTER (WHERE status = 'Repair')         AS repair,
       COUNT(*) FILTER (WHERE status = 'Scrap')          AS scrap
     FROM assets`
  );

  const brands = await query(
    `SELECT brand AS name, COUNT(*) AS count
     FROM assets GROUP BY brand ORDER BY count DESC`
  );

  const locations = await query(
    `SELECT location AS name, COUNT(*) AS count
     FROM assets WHERE location IS NOT NULL
     GROUP BY location ORDER BY count DESC`
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

// @route  GET /api/assets/:id
exports.getAsset = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM assets WHERE asset_id = $1', [req.params.id.toUpperCase()]);

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: `Asset ${req.params.id} not found` });
  }

  res.json({ success: true, data: result.rows[0] });
});

// @route  POST /api/assets
exports.createAsset = asyncHandler(async (req, res) => {
  const {
    asset_id, serial, brand, model, config, processor, ram, storage,
    purchase_date, warranty_start, warranty_end, vendor, location, notes,
  } = req.body;

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
      vendor, location, notes,
    ]
  );

  const asset = result.rows[0];

  await audit('ASSET_ADDED', 'asset',
    `Asset ${asset.asset_id} (${asset.brand} ${asset.model}) added to inventory`,
    asset.asset_id, req.user?.name || 'Admin');

  res.status(201).json({ success: true, data: asset });
});

// @route  PUT /api/assets/:id
exports.updateAsset = asyncHandler(async (req, res) => {
  const id = req.params.id.toUpperCase();

  // Date fields that need sanitization before hitting Postgres
  const DATE_FIELDS = new Set(['purchase_date', 'warranty_start', 'warranty_end']);

  const allowed = [
    'serial', 'brand', 'model', 'config', 'processor', 'ram', 'storage',
    'purchase_date', 'warranty_start', 'warranty_end',
    'vendor', 'location', 'notes', 'status',
  ];

  const updates = [];
  const params  = [];
  let idx = 1;

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const value = DATE_FIELDS.has(key) ? toDateOnly(req.body[key]) : req.body[key];
      // Use explicit ::date cast for date columns to avoid timezone interpretation
      updates.push(DATE_FIELDS.has(key) ? `${key} = $${idx++}::date` : `${key} = $${idx++}`);
      params.push(value);
    }
  }

  if (!updates.length) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }

  params.push(id);
  const result = await query(
    `UPDATE assets SET ${updates.join(', ')} WHERE asset_id = $${idx} RETURNING *`,
    params
  );

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: `Asset ${id} not found` });
  }

  await audit('ASSET_UPDATED', 'asset', `Asset ${id} updated`, id, req.user?.name || 'Admin');

  res.json({ success: true, data: result.rows[0] });
});

// @route  DELETE /api/assets/:id
exports.deleteAsset = asyncHandler(async (req, res) => {
  const id = req.params.id.toUpperCase();

  // Block delete if asset is currently active/allocated
  const activeAlloc = await query(
    `SELECT id FROM allocations WHERE asset_id = $1 AND status = 'Active'`,
    [id]
  );
  if (activeAlloc.rows.length) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete — asset is currently allocated. Receive it first.',
    });
  }

  // Fetch asset details BEFORE anything is deleted
  const assetRes = await query(`SELECT * FROM assets WHERE asset_id = $1`, [id]);
  const asset    = assetRes.rows[0];
  if (!asset) {
    return res.status(404).json({ success: false, message: `Asset ${id} not found` });
  }

  // ── Delete in FK-safe order (children first, then parents) ─────────────────

  // 1. acceptance_tokens references allocations.id  ← MUST be first
  await query(
    `DELETE FROM acceptance_tokens
     WHERE allocation_id IN (SELECT id FROM allocations WHERE asset_id = $1)`,
    [id]
  );

  // 2. accessory_allocations references asset_id
  await query(`DELETE FROM accessory_allocations  WHERE asset_id = $1`, [id]);

  // 3. allocations — safe to delete now that acceptance_tokens is gone
  await query(`DELETE FROM allocations            WHERE asset_id = $1`, [id]);

  // 4. remaining referencing tables
  await query(`DELETE FROM repairs                WHERE asset_id = $1`, [id]);
  await query(`DELETE FROM scraps                 WHERE asset_id = $1`, [id]);
  await query(`DELETE FROM agent_registrations    WHERE asset_id = $1`, [id]);
  await query(`DELETE FROM asset_locations        WHERE asset_id = $1`, [id]);
  await query(`DELETE FROM asset_location_history WHERE asset_id = $1`, [id]);
  await query(`DELETE FROM asset_online_daily     WHERE asset_id = $1`, [id]);

  // ✅ Write audit log BEFORE deleting the asset row
  // (if audit_logs.asset_id has a FK to assets, this must come before DELETE)
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

  // 5. Finally delete the asset itself
  await query(`DELETE FROM assets WHERE asset_id = $1`, [id]);

  res.json({ success: true, message: 'Asset deleted successfully' });
});


// @route  POST /api/assets/bulk
// @access Admin only — import multiple assets at once
exports.bulkCreateAssets = asyncHandler(async (req, res) => {
  const { assets } = req.body;
  if (!assets || !Array.isArray(assets) || assets.length === 0) {
    return res.status(400).json({ success: false, message: 'No assets provided' });
  }

  const results = { created: [], failed: [] };

  for (const a of assets) {
    try {
      const result = await query(
        `INSERT INTO assets
           (asset_id, serial, brand, model, config, processor, ram, storage,
            purchase_date, warranty_start, warranty_end, vendor, location, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,$11::date,$12,$13,$14)
         RETURNING asset_id`,
        [
          (a.asset_id || a.id || '').toUpperCase(),
          a.serial, a.brand, a.model,
          a.config    || null,
          a.processor || null,
          a.ram       || null,
          a.storage   || null,
          toDateOnly(a.purchase_date),
          toDateOnly(a.warranty_start),
          toDateOnly(a.warranty_end),
          a.vendor   || null,
          a.location || null,
          a.notes    || null,
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