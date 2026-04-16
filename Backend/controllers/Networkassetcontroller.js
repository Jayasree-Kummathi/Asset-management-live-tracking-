const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ================= GET ALL =================
exports.getNetworkAssets = asyncHandler(async (req, res) => {
  const { type, status } = req.query;
  const conditions = [];
  const params = [];

  if (type && type !== 'All') {
    params.push(type);
    conditions.push(`asset_type = $${params.length}`);
  }

  if (status && status !== 'All') {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT * FROM network_assets ${where} ORDER BY asset_type, asset_id`,
    params
  );

  res.json({ success: true, count: result.rows.length, data: result.rows });
});

// ================= GET ONE =================
exports.getNetworkAsset = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM network_assets WHERE id = $1',
    [req.params.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Asset not found' });
  }

  res.json({ success: true, data: result.rows[0] });
});

// ================= CREATE =================
exports.createNetworkAsset = asyncHandler(async (req, res) => {
  const p = req.body;

  const result = await query(
    `INSERT INTO network_assets
     (asset_id, asset_type, make, model, asset_owner, serial_number,
      ip_address, subnet, location, warranty_start, warranty_end, warranty_status,
      status, used_for, remarks, brand, cartridge_no, rent_or_own,
      allocated_dept, his_status, notes, added_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [
      p.asset_id,
      p.asset_type,
      p.make             || null,
      p.model            || null,
      p.asset_owner      || 'IT',
      p.serial_number    || null,
      p.ip_address       || null,
      p.subnet           || null,
      p.location         || null,
      p.warranty_start   || null,
      p.warranty_end     || null,
      p.warranty_status  || null,
      p.status           || 'In Use',
      p.used_for         || null,
      p.remarks          || null,
      p.brand            || null,
      p.cartridge_no     || null,
      p.rent_or_own      || null,
      p.allocated_dept   || null,
      p.his_status       || null,
      p.notes            || null,
      req.user?.name     || 'Admin',
    ]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

// ================= UPDATE =================
exports.updateNetworkAsset = asyncHandler(async (req, res) => {
  const p = req.body;

  const result = await query(
    `UPDATE network_assets SET
      asset_type=$1, make=$2, model=$3,
      serial_number=$4, ip_address=$5, subnet=$6,
      location=$7, warranty_start=$8, warranty_end=$9, warranty_status=$10,
      status=$11, used_for=$12, remarks=$13, brand=$14,
      cartridge_no=$15, rent_or_own=$16, allocated_dept=$17,
      his_status=$18, notes=$19, updated_at=NOW()
     WHERE id=$20 RETURNING *`,
    [
      p.asset_type,
      p.make            || null,
      p.model           || null,
      p.serial_number   || null,
      p.ip_address      || null,
      p.subnet          || null,
      p.location        || null,
      p.warranty_start  || null,
      p.warranty_end    || null,
      p.warranty_status || null,
      p.status          || 'In Use',
      p.used_for        || null,
      p.remarks         || null,
      p.brand           || null,
      p.cartridge_no    || null,
      p.rent_or_own     || null,
      p.allocated_dept  || null,
      p.his_status      || null,
      p.notes           || null,
      req.params.id,
    ]
  );

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Asset not found' });
  }

  res.json({ success: true, data: result.rows[0] });
});

// ================= DELETE =================
exports.deleteNetworkAsset = asyncHandler(async (req, res) => {
  await query('DELETE FROM network_assets WHERE id=$1', [req.params.id]);
  res.json({ success: true, message: 'Deleted successfully' });
});

// ================= BULK IMPORT =================
exports.bulkImportNetworkAssets = asyncHandler(async (req, res) => {
  const { assets } = req.body;

  if (!assets?.length) {
    return res.status(400).json({ success: false, message: 'No assets provided' });
  }

  const results = { created: [], failed: [] };

  for (const p of assets) {
    try {
      // Helper: try multiple key names, return first non-empty value
      const g = (...keys) => {
        for (const k of keys) {
          const v = p[k];
          if (v !== undefined && v !== null && v !== '') {
            return String(v).trim();
          }
        }
        return null;
      };

      // ── Field mapping: check frontend camelCase keys first, then original Excel names ──
      const resolvedId =
        g('asset_id', 'Printer Asset Number', 'Asset Number') ||
        `PRI-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`;

      const assetType     = g('asset_type') || 'Printer';
      const make          = g('make', 'Make', 'Brand') || null;
      const model         = g('model', 'Printer Model NO', 'Model') || null;
      const serial        = g('serial_number', 'Serial Number', 'S/N', 'SN') || null;
      const allocatedDept = g('allocated_dept', 'Allocated To') || null;
      const rentOrOwn     = g('rent_or_own', 'RENT/OWN PRINTER') || null;
      const cartridge     = g('cartridge_no', 'Cartridge NO') || null;
      const location      = g('location') || null;
      const notes         = g('notes') || null;
      const status        = g('status') || 'In Use';
      const subnet        = g('subnet') || null;
      const warrantyStart = g('warranty_start') || null;
      const warrantyEnd   = g('warranty_end') || null;
      const warrantyStatus= g('warranty_status') || null;
      const usedFor       = g('used_for') || null;
      const remarks       = g('remarks') || null;
      const brand         = g('brand') || null;
      const hisStatus     = g('his_status') || null;

      // Clean IP — strip http:// and :port/
      let ip = g('ip_address', 'IP', 'IP address');
      if (ip) {
        ip = ip.replace(/^https?:\/\//i, '').replace(/:\d+\/?$/, '').trim() || null;
      }

      await query(
        `INSERT INTO network_assets
          (asset_id, asset_type, make, model, serial_number,
           ip_address, subnet, location, status,
           warranty_start, warranty_end, warranty_status,
           used_for, remarks, brand, cartridge_no, rent_or_own,
           allocated_dept, his_status, notes, added_by)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (asset_id) DO UPDATE SET
           asset_type      = EXCLUDED.asset_type,
           make            = EXCLUDED.make,
           model           = EXCLUDED.model,
           serial_number   = EXCLUDED.serial_number,
           ip_address      = EXCLUDED.ip_address,
           subnet          = EXCLUDED.subnet,
           location        = EXCLUDED.location,
           status          = EXCLUDED.status,
           warranty_start  = EXCLUDED.warranty_start,
           warranty_end    = EXCLUDED.warranty_end,
           warranty_status = EXCLUDED.warranty_status,
           used_for        = EXCLUDED.used_for,
           remarks         = EXCLUDED.remarks,
           brand           = EXCLUDED.brand,
           cartridge_no    = EXCLUDED.cartridge_no,
           rent_or_own     = EXCLUDED.rent_or_own,
           allocated_dept  = EXCLUDED.allocated_dept,
           his_status      = EXCLUDED.his_status,
           notes           = EXCLUDED.notes,
           updated_at      = NOW()`,
        [
          resolvedId, assetType, make, model, serial,
          ip, subnet, location, status,
          warrantyStart, warrantyEnd, warrantyStatus,
          usedFor, remarks, brand, cartridge, rentOrOwn,
          allocatedDept, hisStatus, notes,
          req.user?.name || 'Admin',
        ]
      );

      results.created.push(resolvedId);

    } catch (err) {
      console.error('Bulk import error for asset:', p.asset_id, err.message);
      results.failed.push({
        id: p.asset_id || p['Printer Asset Number'] || '?',
        reason: err.message,
      });
    }
  }

  res.status(201).json({
    success: true,
    message: 'Bulk upload completed',
    data: results,
  });
});

// ================= STATS =================
exports.getNetworkStats = asyncHandler(async (req, res) => {
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
     FROM network_assets`
  );

  res.json({ success: true, data: result.rows[0] });
});