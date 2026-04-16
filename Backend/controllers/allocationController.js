const { query, getClient } = require('../config/db');

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const localDate = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const asyncHandler = require('../utils/asyncHandler');
const generateId   = require('../utils/generateId');
const { sendAllocationEmail, sendReceiveEmail, sendSwapEmail } = require('../utils/emailService');
const { generateToken } = require('./acceptanceController');

const audit = (action, category, detail, assetId, performedBy, meta = null) =>
  query(
    `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by, meta)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [action, category, detail, assetId, performedBy, meta ? JSON.stringify(meta) : null]
  );

// ── Deduct accessory stock when laptop is allocated ───────────────────────────
const deductAccessoryStock = async (client_pg, accessoryDetails) => {
  if (!accessoryDetails || !accessoryDetails.length) return;
  for (const acc of accessoryDetails) {
    if (!acc.stockId) continue;
    await client_pg.query(
      `UPDATE accessory_stock
       SET quantity = GREATEST(0, quantity - $1)
       WHERE id = $2`,
      [acc.quantity || 1, acc.stockId]
    );
  }
};

// ── Restore accessory stock when laptop is received back / swapped ─────────────
const restoreAccessoryStock = async (client_pg, allocationId) => {
  const allocRow = await client_pg.query(
    `SELECT asset_id, emp_id FROM allocations WHERE id = $1`,
    [allocationId]
  );
  if (!allocRow.rows.length) return;

  const { asset_id, emp_id } = allocRow.rows[0];

  // Find all non-returned accessory allocations for this asset
  const accAllocs = await client_pg.query(
    `SELECT id, stock_id, quantity
     FROM accessory_allocations
     WHERE asset_id = $1
       AND status NOT IN ('Returned')`,
    [asset_id]
  );

  console.log(`Restoring ${accAllocs.rows.length} accessories for asset ${asset_id}`);

  for (const row of accAllocs.rows) {
    if (row.stock_id) {
      await client_pg.query(
        `UPDATE accessory_stock
         SET quantity = quantity + $1
         WHERE id = $2`,
        [row.quantity, row.stock_id]
      );
    }
    await client_pg.query(
      `UPDATE accessory_allocations
       SET status = 'Returned', received_date = CURRENT_DATE
       WHERE id = $1`,
      [row.id]
    );
  }
};

// @route  GET /api/allocations
exports.getAllocations = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];
  let idx = 1;

  if (status && status !== 'All') {
    conditions.push(`a.status = $${idx++}`);
    params.push(status);
  }
  if (search) {
    conditions.push(
      `(a.emp_id ILIKE $${idx} OR a.emp_name ILIKE $${idx} OR a.asset_id ILIKE $${idx} OR a.project ILIKE $${idx})`
    );
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*) FROM allocations a ${where}`, params);
  const total = Number(countResult.rows[0].count);

  const result = await query(
    `SELECT 
       a.*,
       TO_CHAR(a.allocation_date, 'YYYY-MM-DD') as allocation_date,
       TO_CHAR(a.return_date, 'YYYY-MM-DD') as return_date,
       ast.brand, ast.model, ast.config, ast.serial
     FROM allocations a
     LEFT JOIN assets ast ON ast.asset_id = a.asset_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const formattedData = result.rows.map(row => ({
    ...row,
    allocation_date: row.allocation_date || null,
    return_date: row.return_date || null
  }));

  res.json({ success: true, count: formattedData.length, total, data: formattedData });
});

// @route  GET /api/allocations/:id
exports.getAllocation = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT a.*, ast.brand, ast.model, ast.config, ast.serial, ast.warranty_end
     FROM allocations a
     LEFT JOIN assets ast ON ast.asset_id = a.asset_id
     WHERE a.id = $1`,
    [req.params.id]
  );
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Allocation not found' });
  res.json({ success: true, data: result.rows[0] });
});

// @route  POST /api/allocations  — Allocate laptop
exports.allocateLaptop = asyncHandler(async (req, res) => {
  const {
    asset_id, emp_id, emp_name, emp_email,
    department, client, project, allocation_date, accessories,
    mobile_no, personal_email, photo_url,
    delivery_method, delivery_address,
    accessoryDetails, // ✅ [{ stockId, name, quantity }]
  } = req.body;

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
    if (assetRes.rows[0].status !== 'Stock') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Asset ${asset_id} is not available (current status: ${assetRes.rows[0].status})`,
      });
    }

    const allocationId = await generateId('ALO');

    const allocResult = await client_pg.query(
      `INSERT INTO allocations
         (allocation_id, asset_id, emp_id, emp_name, emp_email,
          department, client, project, allocation_date, accessories)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        allocationId, asset_id.toUpperCase(),
        emp_id, emp_name, emp_email || null,
        department || null, client || null, project || null,
        allocation_date || localDate(),
        accessories || [],
      ]
    );

    await client_pg.query(
      'UPDATE assets SET status = $1 WHERE asset_id = $2',
      ['Allocated', asset_id.toUpperCase()]
    );

    // ✅ Deduct accessory stock quantities
    await deductAccessoryStock(client_pg, accessoryDetails);

    // ✅ Create accessory_allocations records
    // NOTE: Do NOT include 'status' in INSERT — DB default is 'Allocated' ✅
    if (accessoryDetails && accessoryDetails.length) {
      for (const acc of accessoryDetails) {
        console.log(`Creating accessory allocation: ${acc.name} x${acc.quantity} for ${asset_id.toUpperCase()}`);
        await client_pg.query(
          `INSERT INTO accessory_allocations
             (stock_id, item_name, quantity, emp_id, emp_name, emp_email,
              department, mobile_no, asset_id, allocated_by, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            acc.stockId || null,
            acc.name,
            acc.quantity || 1,
            emp_id || null,
            emp_name,
            emp_email || null,
            department || null,
            mobile_no || null,
            asset_id.toUpperCase(),
            req.user?.name || 'IT Staff',
            `Allocated with laptop ${asset_id.toUpperCase()}`,
          ]
        );
      }
    }

    await client_pg.query(
      `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by, meta)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        'ASSET_ALLOCATED', 'allocate',
        `${asset_id.toUpperCase()} allocated to ${emp_name} (${emp_id}) — Project: ${project || '—'}`,
        asset_id.toUpperCase(), req.user?.name || 'Admin',
        JSON.stringify({ allocationId, empId: emp_id, project }),
      ]
    );

    await client_pg.query('COMMIT');

    const allocationDbId = allocResult.rows[0].id;
    let acceptanceLink = '';
    try {
      acceptanceLink = await generateToken(allocationDbId, asset_id.toUpperCase(), emp_name, emp_email || '');
    } catch(e) { console.error('Token gen failed:', e.message); }

    const assetInfoRes = await query('SELECT brand, model, config, serial FROM assets WHERE asset_id = $1', [asset_id.toUpperCase()]);
    const assetInfo = assetInfoRes.rows[0] || {};
    sendAllocationEmail({
      empName:          emp_name,
      empEmail:         emp_email,
      empId:            emp_id,
      department:       department || '',
      mobileNo:         mobile_no || '',
      personalEmail:    personal_email || '',
      photoUrl:         photo_url || '',
      deliveryMethod:   delivery_method || 'hand',
      deliveryAddress:  delivery_address || '',
      assetId:          asset_id.toUpperCase(),
      brand:            assetInfo.brand || '',
      model:            assetInfo.model || '',
      config:           assetInfo.config || '',
      serial:           assetInfo.serial || '',
      accessories:      accessories || [],
      project:          project || '',
      client:           client || '',
      allocationDate:   allocation_date || localDate(),
      allocatedBy:      req.user?.name  || 'IT Staff',
      allocatedByEmail: req.user?.email || '',
      extraCCs:         req.body.extra_ccs || [],
      acceptanceLink,
    });

    res.status(201).json({ success: true, data: allocResult.rows[0] });
  } catch (err) {
    await client_pg.query('ROLLBACK');
    throw err;
  } finally {
    client_pg.release();
  }
});

// @route  PUT /api/allocations/:id/receive  — Receive laptop back
exports.receiveLaptop = asyncHandler(async (req, res) => {
  const { condition, damage_description } = req.body;

  const client_pg = await getClient();

  try {
    await client_pg.query('BEGIN');

    const allocRes = await client_pg.query(
      'SELECT * FROM allocations WHERE id = $1',
      [req.params.id]
    );
    if (!allocRes.rows.length) {
      await client_pg.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }

    const alloc = allocRes.rows[0];
    if (alloc.status !== 'Active') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'This allocation is not active' });
    }

    const statusMap = { good: 'Stock', repair: 'Repair', scrap: 'Scrap' };
    const newStatus = statusMap[condition] || 'Stock';

    const updatedAlloc = await client_pg.query(
      `UPDATE allocations
       SET status = 'Returned', return_date = CURRENT_DATE, notes = $1
       WHERE id = $2 RETURNING *`,
      [damage_description || null, req.params.id]
    );

    await client_pg.query(
      'UPDATE assets SET status = $1 WHERE asset_id = $2',
      [newStatus, alloc.asset_id]
    );

    if (condition === 'repair') {
      const repairId = await generateId('REP');
      await client_pg.query(
        `INSERT INTO repairs (repair_id, asset_id, issue, status)
         VALUES ($1, $2, $3, 'In Repair')`,
        [repairId, alloc.asset_id, damage_description || 'Reported at return']
      );
    }

    if (condition === 'scrap') {
      const scrapId = await generateId('SCR');
      await client_pg.query(
        `INSERT INTO scraps (scrap_id, asset_id, reason, approved_by)
         VALUES ($1, $2, $3, $4)`,
        [scrapId, alloc.asset_id, damage_description || 'Poor condition at return', req.user?.name || 'Admin']
      );
    }

    // ✅ Auto-restore accessory stock + mark as Returned
    await restoreAccessoryStock(client_pg, req.params.id);

    await client_pg.query(
      `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        'ASSET_RECEIVED', 'receive',
        `${alloc.asset_id} returned by ${alloc.emp_name}. Condition: ${condition}. New status: ${newStatus}`,
        alloc.asset_id, req.user?.name || 'Admin',
      ]
    );

    await client_pg.query('COMMIT');

    const conditionLabel = { good: 'Good — No damage', repair: 'Needs Repair', scrap: 'Damaged / Unrepairable' };
    if (alloc.emp_email) {
      const assetForEmail = await query('SELECT brand, model, serial FROM assets WHERE asset_id = $1', [alloc.asset_id]);
      const ae = assetForEmail.rows[0] || {};
      sendReceiveEmail({
        empName:           alloc.emp_name,
        empEmail:          alloc.emp_email,
        empId:             alloc.emp_id,
        department:        alloc.department,
        assetId:           alloc.asset_id,
        brand:             ae.brand || '',
        model:             ae.model || '',
        serial:            ae.serial || '',
        returnDate:        localDate(),
        condition:         conditionLabel[condition] || condition,
        newStatus,
        damageDescription: damage_description || '',
        receivedBy:        req.user?.name  || 'IT Staff',
        receivedByEmail:   req.user?.email || '',
        extraCCs:          req.body.extra_ccs || [],
      });
    }

    res.json({ success: true, data: updatedAlloc.rows[0], newAssetStatus: newStatus });
  } catch (err) {
    await client_pg.query('ROLLBACK');
    throw err;
  } finally {
    client_pg.release();
  }
});

// @route  PUT /api/allocations/:id/swap  — Swap laptop
exports.swapLaptop = asyncHandler(async (req, res) => {
  const { new_asset_id, issue_type, issue_description, old_condition } = req.body;

  const client_pg = await getClient();

  try {
    await client_pg.query('BEGIN');

    const allocRes = await client_pg.query(
      'SELECT * FROM allocations WHERE id = $1',
      [req.params.id]
    );
    if (!allocRes.rows.length) {
      await client_pg.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }

    const alloc = allocRes.rows[0];
    if (alloc.status !== 'Active') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Allocation is not active' });
    }

    const newAssetRes = await client_pg.query(
      'SELECT * FROM assets WHERE asset_id = $1',
      [new_asset_id.toUpperCase()]
    );
    if (!newAssetRes.rows.length) {
      await client_pg.query('ROLLBACK');
      return res.status(404).json({ success: false, message: `New asset ${new_asset_id} not found` });
    }
    if (newAssetRes.rows[0].status !== 'Stock') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Asset ${new_asset_id} is not in Stock` });
    }

    const newAsset = newAssetRes.rows[0];

    await client_pg.query(
      `UPDATE allocations
       SET status = 'Swapped', return_date = CURRENT_DATE, notes = $1
       WHERE id = $2`,
      [`Swapped — ${issue_type}: ${issue_description || ''}`, req.params.id]
    );

    const oldStatus = old_condition === 'working' ? 'Stock' : 'Repair';
    await client_pg.query(
      'UPDATE assets SET status = $1 WHERE asset_id = $2',
      [oldStatus, alloc.asset_id]
    );

    if (old_condition === 'repair') {
      const repairId = await generateId('REP');
      await client_pg.query(
        `INSERT INTO repairs (repair_id, asset_id, issue, status)
         VALUES ($1, $2, $3, 'In Repair')`,
        [
          repairId, alloc.asset_id,
          `${issue_type}${issue_description ? ': ' + issue_description : ''} (returned via swap)`,
        ]
      );
    }

    // ✅ Restore accessories to stock on swap too
    await restoreAccessoryStock(client_pg, req.params.id);

    await client_pg.query(
      'UPDATE assets SET status = $1 WHERE asset_id = $2',
      ['Allocated', newAsset.asset_id]
    );

    const newAllocId = await generateId('ALO');
    const newAllocResult = await client_pg.query(
      `INSERT INTO allocations
         (allocation_id, asset_id, emp_id, emp_name, emp_email,
          department, client, project, accessories, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        newAllocId, newAsset.asset_id,
        alloc.emp_id, alloc.emp_name, alloc.emp_email,
        alloc.department, alloc.client, alloc.project,
        alloc.accessories,
        `Swapped from ${alloc.asset_id}`,
      ]
    );

    await client_pg.query(
      `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by, meta)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        'ASSET_SWAPPED', 'swap',
        `${alloc.asset_id} swapped with ${newAsset.asset_id} for ${alloc.emp_name}. Reason: ${issue_type}`,
        alloc.asset_id, req.user?.name || 'Admin',
        JSON.stringify({ oldAssetId: alloc.asset_id, newAssetId: newAsset.asset_id, issue_type }),
      ]
    );

    await client_pg.query('COMMIT');

    const oldAssetInfoRes = await query('SELECT brand, model, serial FROM assets WHERE asset_id = $1', [alloc.asset_id]);
    const oldAssetInfo = oldAssetInfoRes.rows[0] || {};
    if (alloc.emp_email) {
      sendSwapEmail({
        empName:          alloc.emp_name,
        empEmail:         alloc.emp_email,
        empId:            alloc.emp_id,
        department:       alloc.department,
        project:          alloc.project,
        mobileNo:         alloc.mobile_no || '',
        photoUrl:         alloc.photo_url || '',
        oldAssetId:       alloc.asset_id,
        oldBrand:         oldAssetInfo.brand || '',
        oldModel:         oldAssetInfo.model || '',
        oldSerial:        oldAssetInfo.serial || '',
        newAssetId:       newAsset.asset_id,
        newBrand:         newAsset.brand || '',
        newModel:         newAsset.model || '',
        newConfig:        newAsset.config || '',
        newSerial:        newAsset.serial || '',
        issueType:        issue_type,
        issueDescription: issue_description || '',
        swapDate:         localDate(),
        swappedBy:        req.user?.name  || 'IT Staff',
        swappedByEmail:   req.user?.email || '',
        extraCCs:         req.body.extra_ccs || [],
      });
    }

    res.json({ success: true, data: newAllocResult.rows[0] });
  } catch (err) {
    await client_pg.query('ROLLBACK');
    throw err;
  } finally {
    client_pg.release();
  }
});

// @route  GET /api/allocations/my
exports.getMyAllocation = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT
       a.id, a.allocation_id, a.asset_id, a.emp_id, a.emp_name, a.emp_email,
       a.department, a.client, a.project, a.allocation_date, a.accessories, a.status,
       ast.brand, ast.model, ast.config, ast.processor, ast.ram, ast.storage,
       ast.serial, ast.warranty_end, ast.warranty_start, ast.vendor, ast.location
     FROM allocations a
     LEFT JOIN assets ast ON ast.asset_id = a.asset_id
     WHERE LOWER(a.emp_email) = LOWER($1) AND a.status = 'Active'
     ORDER BY a.created_at DESC LIMIT 1`,
    [req.user.email]
  );

  if (!result.rows.length)
    return res.json({ success: true, data: null });

  res.json({ success: true, data: result.rows[0] });
});