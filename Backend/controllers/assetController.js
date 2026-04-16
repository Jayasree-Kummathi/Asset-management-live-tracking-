const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

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
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [asset_id?.toUpperCase(), serial, brand, model, config, processor,
     ram, storage, purchase_date || null, warranty_start || null,
     warranty_end || null, vendor, location, notes]
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

  // Build dynamic SET clause
  const allowed = ['serial','brand','model','config','processor','ram','storage',
                   'purchase_date','warranty_start','warranty_end','vendor','location','notes','status'];
  const updates = [];
  const params  = [];
  let idx = 1;

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = $${idx++}`);
      params.push(req.body[key]);
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

  const check = await query('SELECT status FROM assets WHERE asset_id = $1', [id]);
  if (!check.rows.length) {
    return res.status(404).json({ success: false, message: `Asset ${id} not found` });
  }
  if (check.rows[0].status === 'Allocated') {
    return res.status(400).json({ success: false, message: 'Cannot delete an allocated asset. Receive it first.' });
  }

  await query('DELETE FROM assets WHERE asset_id = $1', [id]);
  await audit('ASSET_DELETED', 'asset', `Asset ${id} deleted from system`, id, req.user?.name || 'Admin');

  res.json({ success: true, message: 'Asset deleted successfully' });
});

// @route  POST /api/assets/bulk
// @access Admin only — import multiple assets at once
exports.bulkCreateAssets = asyncHandler(async (req, res) => {
  const { assets } = req.body; // array of asset objects
  if (!assets || !Array.isArray(assets) || assets.length === 0) {
    return res.status(400).json({ success: false, message: 'No assets provided' });
  }

  const results  = { created: [], failed: [] };

  for (const a of assets) {
    try {
      const result = await query(
        `INSERT INTO assets
           (asset_id, serial, brand, model, config, processor, ram, storage,
            purchase_date, warranty_start, warranty_end, vendor, location, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING asset_id`,
        [
          (a.asset_id || a.id || '').toUpperCase(),
          a.serial, a.brand, a.model,
          a.config || null, a.processor || null, a.ram || null, a.storage || null,
          a.purchase_date || null, a.warranty_start || null, a.warranty_end || null,
          a.vendor || null, a.location || null, a.notes || null,
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
    [`Bulk import: ${results.created.length} created, ${results.failed.length} failed`,
     req.user?.name || 'Admin']
  );

  res.status(201).json({ success: true, data: results });
});
