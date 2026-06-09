'use strict';
// Backend/controllers/allocationController.js
// Includes: allocate, receive, swap, getMyAllocation, sendAuditEmail, sendBulkAuditEmail
// ── Location isolation added to list queries and action guards ────────────────

const { query, getClient } = require('../config/db');
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const asyncHandler      = require('../utils/asyncHandler');
const generateId        = require('../utils/generateId');
const { sendAllocationEmail, sendReceiveEmail, sendSwapEmail, sendAuditEmail } = require('../utils/emailService');
const { generateToken } = require('./acceptanceController');
const { isSuperAdmin, applyLocationFilter, buildLocClause, getUserLocations } = require('../utils/locationFilter');

// ── Accessory stock helpers ───────────────────────────────────────────────────
const deductAccessoryStock = async (client_pg, accessoryDetails) => {
  if (!accessoryDetails?.length) return;
  for (const acc of accessoryDetails) {
    if (!acc.stockId) continue;
    await client_pg.query(
      `UPDATE accessory_stock SET quantity = GREATEST(0, quantity - $1) WHERE id = $2`,
      [acc.quantity || 1, acc.stockId]
    );
  }
};

const restoreAccessoryStock = async (client_pg, allocationId) => {
  const allocRow = await client_pg.query(
    `SELECT asset_id FROM allocations WHERE id = $1`, [allocationId]
  );
  if (!allocRow.rows.length) return;
  const { asset_id } = allocRow.rows[0];
  const accAllocs = await client_pg.query(
    `SELECT id, stock_id, quantity FROM accessory_allocations
     WHERE asset_id = $1 AND status NOT IN ('Returned')`, [asset_id]
  );
  for (const row of accAllocs.rows) {
    if (row.stock_id) {
      await client_pg.query(
        `UPDATE accessory_stock SET quantity = quantity + $1 WHERE id = $2`,
        [row.quantity, row.stock_id]
      );
    }
    await client_pg.query(
      `UPDATE accessory_allocations SET status = 'Returned', received_date = CURRENT_DATE WHERE id = $1`,
      [row.id]
    );
  }
};

const parsePhotoArray = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try { return JSON.parse(raw) || []; } catch (_) { return []; }
};


// ── GET /api/allocations ──────────────────────────────────────────────────────
exports.getAllocations = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const offset     = (page - 1) * limit;
  const params     = [];
  const conditions = [];
  let   idx        = 1;

  if (status && status !== 'All') { conditions.push(`a.status = $${idx++}`); params.push(status); }
  if (search) {
    conditions.push(`(a.emp_id ILIKE $${idx} OR a.emp_name ILIKE $${idx} OR a.asset_id ILIKE $${idx} OR a.project ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  idx = applyLocationFilter(conditions, params, idx, req.user, 'ast.location');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM allocations a
     LEFT JOIN assets ast ON ast.asset_id = a.asset_id ${where}`,
    params
  );
  const total = Number(countResult.rows[0].count);

  const result = await query(
    `SELECT a.*,
       TO_CHAR(a.allocation_date,'YYYY-MM-DD') as allocation_date,
       TO_CHAR(a.return_date,'YYYY-MM-DD') as return_date,
       ast.brand, ast.model, ast.config, ast.serial, ast.location
     FROM allocations a
     LEFT JOIN assets ast ON ast.asset_id = a.asset_id
     ${where} ORDER BY a.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, count: result.rows.length, total, data: result.rows });
});


// ── GET /api/allocations/:id ──────────────────────────────────────────────────
exports.getAllocation = asyncHandler(async (req, res) => {
  const { locClause, locParams } = buildLocClause(req.user, 2, 'AND', 'ast.location');

  const result = await query(
    `SELECT a.*, ast.brand, ast.model, ast.config, ast.serial, ast.warranty_end, ast.location
     FROM allocations a
     LEFT JOIN assets ast ON ast.asset_id = a.asset_id
     WHERE a.id = $1 ${locClause}`,
    [req.params.id, ...locParams]
  );
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Allocation not found' });
  res.json({ success: true, data: result.rows[0] });
});


// ── POST /api/allocations — Allocate laptop ───────────────────────────────────
exports.allocateLaptop = asyncHandler(async (req, res) => {
  const {
    asset_id, emp_id, emp_name, emp_email, department, client, project,
    allocation_date, accessories, mobile_no, personal_email, photo_url,
    delivery_method, delivery_address, accessoryDetails, extra_ccs,
    prepared_by, damage_photos,
  } = req.body;

  const client_pg = await getClient();
  try {
    await client_pg.query('BEGIN');

    const assetRes = await client_pg.query(
      'SELECT asset_id, status, location FROM assets WHERE asset_id = $1',
      [asset_id.toUpperCase()]
    );
    if (!assetRes.rows.length) {
      await client_pg.query('ROLLBACK');
      return res.status(404).json({ success: false, message: `Asset ${asset_id} not found` });
    }

    const locs = getUserLocations(req.user);
    if (locs && assetRes.rows[0].location && !locs.includes(assetRes.rows[0].location)) {
      await client_pg.query('ROLLBACK');
      return res.status(403).json({ success: false, message: `Asset ${asset_id} is outside your location(s)` });
    }

    if (assetRes.rows[0].status !== 'Stock') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Asset ${asset_id} is not available` });
    }

    const allocationId = await generateId('ALO');
    const staffName    = prepared_by || req.user?.name || 'IT Staff';

    const allocResult = await client_pg.query(
      `INSERT INTO allocations
         (allocation_id, asset_id, emp_id, emp_name, emp_email,
          department, client, project, allocation_date, accessories,
          mobile_no, personal_email, photo_url, delivery_method, delivery_address,
          prepared_by, damage_photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        allocationId, asset_id.toUpperCase(),
        emp_id, emp_name, emp_email || null,
        department || null, client || null, project || null,
        allocation_date || localDate(),
        accessories || [],
        mobile_no || null, personal_email || null, photo_url || null,
        delivery_method || 'hand', delivery_address || null,
        staffName,
        damage_photos || '[]',
      ]
    );

    await client_pg.query('UPDATE assets SET status = $1 WHERE asset_id = $2', ['Allocated', asset_id.toUpperCase()]);
    await deductAccessoryStock(client_pg, accessoryDetails);

    if (accessoryDetails?.length) {
      for (const acc of accessoryDetails) {
        await client_pg.query(
          `INSERT INTO accessory_allocations
             (stock_id, item_name, quantity, emp_id, emp_name, emp_email,
              department, mobile_no, asset_id, allocated_by, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            acc.stockId || null, acc.name, acc.quantity || 1,
            emp_id || null, emp_name, emp_email || null,
            department || null, mobile_no || null,
            asset_id.toUpperCase(), staffName,
            `Allocated with laptop ${asset_id.toUpperCase()}`
          ]
        );
      }
    }

    await client_pg.query(
      `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by, meta)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        'ASSET_ALLOCATED', 'allocate',
        `${asset_id.toUpperCase()} allocated to ${emp_name} (${emp_id})`,
        asset_id.toUpperCase(), staffName,
        JSON.stringify({ allocationId, empId: emp_id, project }),
      ]
    );

    await client_pg.query('COMMIT');

    const allocationDbId = allocResult.rows[0].id;
    let acceptanceLink = '';
    try {
      acceptanceLink = await generateToken(allocationDbId, asset_id.toUpperCase(), emp_name, emp_email || '');
    } catch (e) { console.error('Token gen failed:', e.message); }

    const assetInfoRes = await query(
      'SELECT brand, model, config, serial FROM assets WHERE asset_id = $1',
      [asset_id.toUpperCase()]
    );
    const assetInfo         = assetInfoRes.rows[0] || {};
    const damagePhotosArray = parsePhotoArray(damage_photos);

    sendAllocationEmail({
      empName: emp_name, empEmail: emp_email, empId: emp_id,
      department: department || '', mobileNo: mobile_no || '',
      personalEmail: personal_email || '', photoUrl: photo_url || '',
      deliveryMethod: delivery_method || 'hand',
      deliveryAddress: delivery_address || '',
      assetId: asset_id.toUpperCase(),
      brand: assetInfo.brand || '', model: assetInfo.model || '',
      config: assetInfo.config || '', serial: assetInfo.serial || '',
      accessories: accessories || [], project: project || '', client: client || '',
      allocationDate: allocation_date || localDate(),
      allocatedBy: staffName,
      allocatedByEmail: req.user?.email || '',
      extraCCs: extra_ccs || [],
      acceptanceLink,
      qrCodeBuffer: null,
      qrCardUrl: '',
      allocationId,
      preparedBy: staffName,
      damagePhotos: damage_photos || '[]',
      damagePhotosArray,
    });

    res.status(201).json({ success: true, data: allocResult.rows[0] });
  } catch (err) {
    await client_pg.query('ROLLBACK');
    throw err;
  } finally {
    client_pg.release();
  }
});


// ── PUT /api/allocations/:id/receive ─────────────────────────────────────────
exports.receiveLaptop = asyncHandler(async (req, res) => {
  const { condition, damage_description, extra_ccs, return_photos, returned_accessories } = req.body;

  const client_pg = await getClient();
  try {
    await client_pg.query('BEGIN');

    const allocRes = await client_pg.query(
      `SELECT al.*, ast.location FROM allocations al
       LEFT JOIN assets ast ON ast.asset_id = al.asset_id
       WHERE al.id = $1`,
      [req.params.id]
    );
    if (!allocRes.rows.length) {
      await client_pg.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }
    const alloc = allocRes.rows[0];

    const locs = getUserLocations(req.user);
    if (locs && alloc.location && !locs.includes(alloc.location)) {
      await client_pg.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Asset is outside your location(s)' });
    }

    if (alloc.status !== 'Active') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Allocation is not active' });
    }

    const statusMap   = { good: 'Stock', repair: 'Repair', scrap: 'Scrap' };
    const newStatus   = statusMap[condition] || 'Stock';

    const updatedAlloc = await client_pg.query(
      `UPDATE allocations SET status = 'Returned', return_date = CURRENT_DATE, notes = $1
       WHERE id = $2 RETURNING *`,
      [damage_description || null, req.params.id]
    );
    await client_pg.query('UPDATE assets SET status = $1 WHERE asset_id = $2', [newStatus, alloc.asset_id]);

    if (condition === 'repair') {
      const repairId = await generateId('REP');
      await client_pg.query(
        `INSERT INTO repairs (repair_id, asset_id, issue, status) VALUES ($1,$2,$3,'In Repair')`,
        [repairId, alloc.asset_id, damage_description || 'Reported at return']
      );
    }
    if (condition === 'scrap') {
      const scrapId = await generateId('SCR');
      await client_pg.query(
        `INSERT INTO scraps (scrap_id, asset_id, reason, approved_by) VALUES ($1,$2,$3,$4)`,
        [scrapId, alloc.asset_id, damage_description || 'Poor condition at return', req.user?.name || 'Admin']
      );
    }

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

    if (alloc.emp_email) {
      const ae = (await query('SELECT brand, model, config, serial FROM assets WHERE asset_id = $1', [alloc.asset_id])).rows[0] || {};
      const conditionLabel  = { good: 'Good — No damage', repair: 'Needs Repair', scrap: 'Damaged / Unrepairable' };
      const returnPhotosArray = parsePhotoArray(return_photos);

      sendReceiveEmail({
        empName:             alloc.emp_name,
        empEmail:            alloc.emp_email,
        empId:               alloc.emp_id,
        department:          alloc.department,
        mobileNo:            alloc.mobile_no    || '',
        assetId:             alloc.asset_id,
        brand:               ae.brand           || '',
        model:               ae.model           || '',
        config:              ae.config          || '',
        serial:              ae.serial          || '',
        returnDate:          localDate(),
        condition:           conditionLabel[condition] || condition,
        newStatus,
        damageDescription:   damage_description || '',
        receivedBy:          req.user?.name     || 'IT Staff',
        receivedByEmail:     req.user?.email    || '',
        extraCCs:            extra_ccs          || [],
        damagePhotos:        returnPhotosArray,
        returnedAccessories: Array.isArray(returned_accessories) ? returned_accessories : [],
        accessories:         alloc.accessories  || [],
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


// ── PUT /api/allocations/:id/swap ─────────────────────────────────────────────
exports.swapLaptop = asyncHandler(async (req, res) => {
  const {
    new_asset_id, issue_type, issue_description,
    old_condition, extra_ccs, issue_images, prepared_by,
  } = req.body;

  const client_pg = await getClient();
  try {
    await client_pg.query('BEGIN');

    const allocRes = await client_pg.query(
      `SELECT al.*, ast.location FROM allocations al
       LEFT JOIN assets ast ON ast.asset_id = al.asset_id
       WHERE al.id = $1`,
      [req.params.id]
    );
    if (!allocRes.rows.length) {
      await client_pg.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const alloc = allocRes.rows[0];

    const locs = getUserLocations(req.user);
    if (locs && alloc.location && !locs.includes(alloc.location)) {
      await client_pg.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Asset is outside your location(s)' });
    }

    if (alloc.status !== 'Active') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Not active' });
    }

    const newAssetRes = await client_pg.query(
      'SELECT * FROM assets WHERE asset_id = $1',
      [new_asset_id.toUpperCase()]
    );
    if (!newAssetRes.rows.length || newAssetRes.rows[0].status !== 'Stock') {
      await client_pg.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Asset ${new_asset_id} not available` });
    }
    const newAsset = newAssetRes.rows[0];

    if (locs && newAsset.location && !locs.includes(newAsset.location)) {
      await client_pg.query('ROLLBACK');
      return res.status(403).json({ success: false, message: `Replacement asset ${new_asset_id} is outside your location(s)` });
    }

    await client_pg.query(
      `UPDATE allocations SET status='Swapped', return_date=CURRENT_DATE, notes=$1 WHERE id=$2`,
      [`Swapped — ${issue_type}: ${issue_description || ''}`, req.params.id]
    );

    const oldStatus = old_condition === 'working' ? 'Stock' : 'Repair';
    await client_pg.query('UPDATE assets SET status=$1 WHERE asset_id=$2', [oldStatus, alloc.asset_id]);

    if (old_condition === 'repair') {
      const repairId = await generateId('REP');
      await client_pg.query(
        `INSERT INTO repairs (repair_id, asset_id, issue, status) VALUES ($1,$2,$3,'In Repair')`,
        [repairId, alloc.asset_id, `${issue_type}${issue_description ? ': ' + issue_description : ''}`]
      );
    }

    await restoreAccessoryStock(client_pg, req.params.id);
    await client_pg.query('UPDATE assets SET status=$1 WHERE asset_id=$2', ['Allocated', newAsset.asset_id]);

    const staffName  = prepared_by || req.user?.name || 'IT Staff';
    const newAllocId = await generateId('ALO');

    const newAllocResult = await client_pg.query(
      `INSERT INTO allocations
         (allocation_id, asset_id, emp_id, emp_name, emp_email,
          department, client, project, accessories, notes,
          mobile_no, delivery_method, prepared_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        newAllocId, newAsset.asset_id,
        alloc.emp_id, alloc.emp_name, alloc.emp_email,
        alloc.department, alloc.client, alloc.project,
        alloc.accessories,
        `Swapped from ${alloc.asset_id}`,
        alloc.mobile_no, alloc.delivery_method || 'hand',
        staffName,
      ]
    );

    await client_pg.query(
      `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by, meta)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        'ASSET_SWAPPED', 'swap',
        `${alloc.asset_id} swapped with ${newAsset.asset_id} for ${alloc.emp_name}`,
        alloc.asset_id, staffName,
        JSON.stringify({ oldAssetId: alloc.asset_id, newAssetId: newAsset.asset_id, issue_type }),
      ]
    );

    await client_pg.query('COMMIT');

    const issuePhotosArray = parsePhotoArray(issue_images);
    if (alloc.emp_email) {
      const oldAE = (await query('SELECT brand, model, serial FROM assets WHERE asset_id=$1', [alloc.asset_id])).rows[0] || {};
      sendSwapEmail({
        empName:          alloc.emp_name,
        empEmail:         alloc.emp_email,
        empId:            alloc.emp_id,
        department:       alloc.department,
        project:          alloc.project,
        mobileNo:         alloc.mobile_no   || '',
        photoUrl:         alloc.photo_url   || '',
        oldAssetId:       alloc.asset_id,
        oldBrand:         oldAE.brand       || '',
        oldModel:         oldAE.model       || '',
        oldSerial:        oldAE.serial      || '',
        newAssetId:       newAsset.asset_id,
        newBrand:         newAsset.brand    || '',
        newModel:         newAsset.model    || '',
        newConfig:        newAsset.config   || '',
        newSerial:        newAsset.serial   || '',
        issueType:        issue_type,
        issueDescription: issue_description || '',
        swapDate:         localDate(),
        swappedBy:        staffName,
        swappedByEmail:   req.user?.email   || '',
        extraCCs:         extra_ccs         || [],
        qrCodeBuffer:     null,
        qrCardUrl:        '',
        newAllocationId:  newAllocId,
        preparedBy:       staffName,
        issueImages:      issuePhotosArray,
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


// ── POST /api/allocations/:id/send-audit-email ────────────────────────────────
exports.sendAuditEmail = asyncHandler(async (req, res) => {
  const param = req.params.id;
  const isInt = /^\d+$/.test(param);

  const { locClause, locParams } = buildLocClause(req.user, 2, 'AND', 'ast.location');

  const alloc = (await query(
    `SELECT a.*, ast.brand, ast.model, ast.config, ast.serial,
            ast.processor, ast.ram, ast.storage, ast.location
     FROM allocations a
     LEFT JOIN assets ast ON ast.asset_id = a.asset_id
     WHERE ${isInt ? 'a.id = $1' : 'a.allocation_id = $1'} ${locClause}`,
    [param, ...locParams]
  )).rows[0];

  if (!alloc)
    return res.status(404).json({ success: false, message: 'Allocation not found' });
  if (alloc.status !== 'Active')
    return res.status(400).json({ success: false, message: 'Only active allocations can be audited' });
  if (!alloc.emp_email)
    return res.status(400).json({ success: false, message: 'Employee email not on record' });

  let confirmLink = '';
  try {
    confirmLink = await generateToken(alloc.id, alloc.asset_id, alloc.emp_name, alloc.emp_email);
  } catch (e) { console.error('Audit token gen failed:', e.message); }

  await query(
    `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      'AUDIT_EMAIL_SENT', 'audit',
      `Audit confirmation email sent to ${alloc.emp_name} (${alloc.emp_email}) for ${alloc.asset_id}`,
      alloc.asset_id,
      req.user?.name || 'IT Staff',
    ]
  );

  await sendAuditEmail({
    empName:        alloc.emp_name,
    empEmail:       alloc.emp_email,
    empId:          alloc.emp_id,
    department:     alloc.department     || '',
    assetId:        alloc.asset_id,
    brand:          alloc.brand          || '',
    model:          alloc.model          || '',
    config:         alloc.config         || '',
    serial:         alloc.serial         || '',
    processor:      alloc.processor      || '',
    ram:            alloc.ram            || '',
    storage:        alloc.storage        || '',
    accessories:    alloc.accessories    || [],
    project:        alloc.project        || '',
    client:         alloc.client         || '',
    allocationDate: alloc.allocation_date,
    sentBy:         req.user?.name       || 'IT Staff',
    sentByEmail:    req.user?.email      || '',
    confirmLink,
    itEmail:        process.env.IT_EMAIL || req.user?.email || '',
  });

  res.json({ success: true, message: `Audit email sent to ${alloc.emp_email}` });
});


// ── POST /api/allocations/send-audit-email/bulk ───────────────────────────────
exports.sendBulkAuditEmail = asyncHandler(async (req, res) => {
  const { ids } = req.body; // optional array of specific allocation IDs

  // Build location scope
  const conditions = ['a.status = $1', 'a.emp_email IS NOT NULL'];
  const params     = ['Active'];
  let   idx        = 2;

  idx = applyLocationFilter(conditions, params, idx, req.user, 'ast.location');

  // Optionally restrict to specific IDs
  if (ids?.length) {
    conditions.push(`a.id = ANY($${idx}::int[])`);
    params.push(ids);
    idx++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = (await query(
    `SELECT a.*, ast.brand, ast.model, ast.config, ast.serial,
            ast.processor, ast.ram, ast.storage, ast.location
     FROM allocations a
     LEFT JOIN assets ast ON ast.asset_id = a.asset_id
     ${where}
     ORDER BY a.id`,
    params
  )).rows;

  if (!rows.length) {
    return res.json({
      success: true,
      sent: 0, failed: 0, total: 0,
      message: 'No active allocations with a recorded email address found',
    });
  }

  let sent = 0, failed = 0;
  const failures = [];

  for (const alloc of rows) {
    try {
      let confirmLink = '';
      try {
        confirmLink = await generateToken(
          alloc.id, alloc.asset_id, alloc.emp_name, alloc.emp_email
        );
      } catch (e) { console.error('Token gen failed:', e.message); }

      await sendAuditEmail({
        empName:        alloc.emp_name,
        empEmail:       alloc.emp_email,
        empId:          alloc.emp_id,
        department:     alloc.department  || '',
        assetId:        alloc.asset_id,
        brand:          alloc.brand       || '',
        model:          alloc.model       || '',
        config:         alloc.config      || '',
        serial:         alloc.serial      || '',
        processor:      alloc.processor   || '',
        ram:            alloc.ram         || '',
        storage:        alloc.storage     || '',
        accessories:    alloc.accessories || [],
        project:        alloc.project     || '',
        client:         alloc.client      || '',
        allocationDate: alloc.allocation_date,
        sentBy:         req.user?.name    || 'IT Staff',
        sentByEmail:    req.user?.email   || '',
        confirmLink,
        itEmail:        process.env.IT_EMAIL || req.user?.email || '',
      });

      await query(
        `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          'AUDIT_EMAIL_SENT', 'audit',
          `Bulk audit email sent to ${alloc.emp_name} (${alloc.emp_email}) for ${alloc.asset_id}`,
          alloc.asset_id,
          req.user?.name || 'IT Staff',
        ]
      );

      sent++;
    } catch (e) {
      console.error(`Bulk audit failed for ${alloc.emp_email}:`, e.message);
      failed++;
      failures.push({ id: alloc.id, email: alloc.emp_email, error: e.message });
    }
  }

  res.json({
    success: true,
    sent,
    failed,
    total: rows.length,
    failures: failures.length ? failures : undefined,
    message: `Audit emails: ${sent} sent, ${failed} failed out of ${rows.length} active allocations`,
  });
});


// ── GET /api/allocations/my ───────────────────────────────────────────────────
exports.getMyAllocation = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT a.id, a.allocation_id, a.asset_id, a.emp_id, a.emp_name, a.emp_email,
       a.department, a.client, a.project, a.allocation_date, a.accessories,
       a.status, a.prepared_by,
       ast.brand, ast.model, ast.config, ast.processor, ast.ram, ast.storage,
       ast.serial, ast.warranty_end, ast.warranty_start, ast.vendor, ast.location
     FROM allocations a
     LEFT JOIN assets ast ON ast.asset_id = a.asset_id
     WHERE LOWER(a.emp_email) = LOWER($1) AND a.status = 'Active'
     ORDER BY a.created_at DESC LIMIT 1`,
    [req.user.email]
  );
  res.json({ success: true, data: result.rows.length ? result.rows[0] : null });
});