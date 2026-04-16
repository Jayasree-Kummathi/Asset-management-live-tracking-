const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const generateId   = require('../utils/generateId');

// @route  GET /api/scraps
exports.getScraps = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const params = [];
  let where = '';

  if (search) {
    where = 'WHERE s.asset_id ILIKE $1 OR s.reason ILIKE $1';
    params.push(`%${search}%`);
  }

  const result = await query(
    `SELECT s.*, a.brand, a.model, a.config, a.serial
     FROM scraps s
     LEFT JOIN assets a ON a.asset_id = s.asset_id
     ${where} ORDER BY s.created_at DESC`,
    params
  );

  res.json({ success: true, count: result.rows.length, data: result.rows });
});

// @route  POST /api/scraps
exports.scrapAsset = asyncHandler(async (req, res) => {
  const { asset_id, reason, notes } = req.body;

  const client_pg = await getClient();
  try {
    await client_pg.query('BEGIN');

    const assetRes = await client_pg.query(
      'SELECT asset_id, status FROM assets WHERE asset_id = $1',
      [asset_id.toUpperCase()]
    );
    if (!assetRes.rows.length) {
      await client_pg.query('ROLLBACK');
      return res.status(404).json({ success: false, message: `Asset ${asset_id} not found` });
    }
    if (assetRes.rows[0].status === 'Allocated') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot scrap an allocated asset. Receive it first.' });
    }

    const scrapId = await generateId('SCR');
    const result = await client_pg.query(
      `INSERT INTO scraps (scrap_id, asset_id, reason, approved_by, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [scrapId, asset_id.toUpperCase(), reason, req.user?.name || 'Admin', notes || null]
    );

    await client_pg.query(
      'UPDATE assets SET status = $1 WHERE asset_id = $2',
      ['Scrap', asset_id.toUpperCase()]
    );

    await client_pg.query(
      `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
       VALUES ('ASSET_SCRAPPED','scrap',$1,$2,$3)`,
      [`${asset_id.toUpperCase()} scrapped. Reason: ${reason}`,
       asset_id.toUpperCase(), req.user?.name || 'Admin']
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

// @route  DELETE /api/scraps/:id
// @access Admin only
exports.deleteScrap = asyncHandler(async (req, res) => {
  const scrap = await query('SELECT * FROM scraps WHERE id = $1', [req.params.id]);
  if (!scrap.rows.length) {
    return res.status(404).json({ success: false, message: 'Scrap record not found' });
  }
  const s = scrap.rows[0];

  await query('DELETE FROM scraps WHERE id = $1', [req.params.id]);
  // Restore asset to Stock
  await query("UPDATE assets SET status = 'Stock' WHERE asset_id = $1", [s.asset_id]);

  await query(
    `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
     VALUES ('SCRAP_DELETED','scrap',$1,$2,$3)`,
    [`Scrap record for ${s.asset_id} deleted. Asset restored to Stock.`, s.asset_id, req.user?.name || 'Admin']
  );

  res.json({ success: true, message: 'Scrap record deleted and asset restored to Stock' });
});
