'use strict';
// Backend/controllers/accessoryController.js

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const {
  sendAccessoryAllocatedEmail,
  sendAccessoryReceivedEmail,
} = require('../utils/emailService');
const { applyLocationFilter, getUserLocations } = require('../utils/locationFilter');

// ── STOCK ─────────────────────────────────────────────────────────────────────

const getStock = asyncHandler(async (req, res) => {
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  // ── Location filter on accessory_stock.location ────────────────────────────
  idx = applyLocationFilter(conditions, params, idx, req.user);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT * FROM accessory_stock ${where} ORDER BY name, created_at DESC`,
    params
  );
  res.json({ success: true, data: result.rows });
});

const addToStock = asyncHandler(async (req, res) => {
  const { name, brand, model, serial_no, quantity, location, notes } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Item name required' });

  // Non-superadmins stamp their own location
  const locs = getUserLocations(req.user);
  const effectiveLocation = locs ? (req.user?.location || location || null) : (location || null);

  const result = await query(
    `INSERT INTO accessory_stock (name, brand, model, serial_no, quantity, location, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, brand || null, model || null, serial_no || null, quantity || 1, effectiveLocation, notes || null]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
});

const updateStock = asyncHandler(async (req, res) => {
  const { name, brand, model, serial_no, quantity, location, notes, status } = req.body;

  // Location guard
  const locs = getUserLocations(req.user);
  if (locs) {
    const existing = await query('SELECT location FROM accessory_stock WHERE id=$1', [req.params.id]);
    if (existing.rows.length && existing.rows[0].location && !locs.includes(existing.rows[0].location)) {
      return res.status(403).json({ success: false, message: 'Item is outside your managed locations' });
    }
  }

  const result = await query(
    `UPDATE accessory_stock SET
       name=$1, brand=$2, model=$3, serial_no=$4, quantity=$5,
       location=$6, notes=$7, status=COALESCE($8,status)
     WHERE id=$9 RETURNING *`,
    [name, brand || null, model || null, serial_no || null, quantity || 1,
     location || null, notes || null, status || null, req.params.id]
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Stock item not found' });

  res.json({ success: true, data: result.rows[0] });
});

const deleteStock = asyncHandler(async (req, res) => {
  const locs = getUserLocations(req.user);
  if (locs) {
    const existing = await query('SELECT location FROM accessory_stock WHERE id=$1', [req.params.id]);
    if (existing.rows.length && existing.rows[0].location && !locs.includes(existing.rows[0].location)) {
      return res.status(403).json({ success: false, message: 'Item is outside your managed locations' });
    }
  }
  await query('DELETE FROM accessory_stock WHERE id=$1', [req.params.id]);
  res.json({ success: true, message: 'Stock item deleted' });
});

// ── ALLOCATIONS ───────────────────────────────────────────────────────────────

const getAllocations = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (status && status !== 'All') {
    conditions.push(`aa.status = $${idx++}`);
    params.push(status);
  }

  // ── Filter via accessory_stock.location ────────────────────────────────────
  idx = applyLocationFilter(conditions, params, idx, req.user, 's.location');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT aa.*, s.name AS stock_name, s.brand AS stock_brand, s.model AS stock_model
     FROM accessory_allocations aa
     LEFT JOIN accessory_stock s ON s.id = aa.stock_id
     ${where}
     ORDER BY aa.created_at DESC`,
    params
  );

  res.json({ success: true, data: result.rows });
});

const allocateAccessory = asyncHandler(async (req, res) => {
  const {
    stock_id, item_name, quantity,
    emp_id, emp_name, emp_email, department, mobile_no, asset_id,
    notes, extra_ccs,
  } = req.body;

  if (!emp_name || !item_name)
    return res.status(400).json({ success: false, message: 'Employee name and item name required' });

  if (stock_id) {
    const stock = await query('SELECT quantity, location FROM accessory_stock WHERE id=$1', [stock_id]);
    if (!stock.rows.length)
      return res.status(404).json({ success: false, message: 'Stock item not found' });

    // Location guard
    const locs = getUserLocations(req.user);
    if (locs && stock.rows[0].location && !locs.includes(stock.rows[0].location)) {
      return res.status(403).json({ success: false, message: 'Stock item is outside your managed locations' });
    }

    if (stock.rows[0].quantity < (quantity || 1))
      return res.status(400).json({ success: false, message: 'Insufficient stock quantity' });

    await query(`UPDATE accessory_stock SET quantity = quantity - $1 WHERE id=$2`, [quantity || 1, stock_id]);
  }

  const result = await query(
    `INSERT INTO accessory_allocations
       (stock_id, item_name, quantity, emp_id, emp_name, emp_email,
        department, mobile_no, asset_id, allocated_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      stock_id || null, item_name, quantity || 1,
      emp_id || null, emp_name, emp_email || null,
      department || null, mobile_no || null, asset_id || null,
      req.user?.name || 'IT Staff', notes || null,
    ]
  );

  if (emp_email) {
    try {
      await sendAccessoryAllocatedEmail({
        empName: emp_name, empId: emp_id || '—', empEmail: emp_email,
        department: department || '—', mobileNo: mobile_no || '—',
        assetId: asset_id || '—', items: [{ item: item_name, quantity: quantity || 1 }],
        notes: notes || '', allocatedBy: req.user?.name || 'IT Staff',
        allocatedByEmail: req.user?.email || '', extraCCs: extra_ccs || [],
      });
    } catch (e) { console.error('Accessory allocation email failed:', e.message); }
  }

  res.status(201).json({ success: true, data: result.rows[0] });
});

const receiveAccessory = asyncHandler(async (req, res) => {
  const allocResult = await query(
    `SELECT aa.*, s.name AS stock_name, s.location AS stock_location
     FROM accessory_allocations aa
     LEFT JOIN accessory_stock s ON s.id = aa.stock_id
     WHERE aa.id = $1`,
    [req.params.id]
  );
  if (!allocResult.rows.length)
    return res.status(404).json({ success: false, message: 'Allocation not found' });

  const alloc = allocResult.rows[0];

  // Location guard
  const locs = getUserLocations(req.user);
  if (locs && alloc.stock_location && !locs.includes(alloc.stock_location)) {
    return res.status(403).json({ success: false, message: 'Item is outside your managed locations' });
  }

  await query(
    `UPDATE accessory_allocations SET status='Received', received_date=CURRENT_DATE WHERE id=$1`,
    [req.params.id]
  );

  if (alloc.emp_email) {
    try {
      await sendAccessoryReceivedEmail({
        empName: alloc.emp_name, empId: alloc.emp_id || '—', empEmail: alloc.emp_email,
        department: alloc.department || '—', mobileNo: alloc.mobile_no || '—',
        assetId: alloc.asset_id || '—', itemName: alloc.item_name,
        quantity: alloc.quantity || 1, receivedBy: req.user?.name || 'IT Staff',
        receivedByEmail: req.user?.email || '', extraCCs: [],
      });
    } catch (e) { console.error('Accessory receive email failed:', e.message); }
  }

  res.json({ success: true, message: 'Accessory marked as received' });
});

const returnAccessory = asyncHandler(async (req, res) => {
  const alloc = await query('SELECT * FROM accessory_allocations WHERE id=$1', [req.params.id]);

  if (alloc.rows.length && alloc.rows[0].stock_id) {
    await query(
      `UPDATE accessory_stock SET quantity = quantity + $1 WHERE id=$2`,
      [alloc.rows[0].quantity, alloc.rows[0].stock_id]
    );
  }

  await query(`UPDATE accessory_allocations SET status='Returned' WHERE id=$1`, [req.params.id]);
  res.json({ success: true, message: 'Returned successfully' });
});

module.exports = {
  getStock, addToStock, updateStock, deleteStock,
  getAllocations, allocateAccessory, receiveAccessory, returnAccessory,
  getRequests: getAllocations,
};