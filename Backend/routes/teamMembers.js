const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { body, param, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/team-members
// PUBLIC — no auth required so the Homepage can display the team without login
// ─────────────────────────────────────────────────────────────────────────────
router.get('/team-members', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, name, email, role, employee_id, designation, photo, priority, online, created_at
      FROM team_members
      ORDER BY priority ASC, name ASC
    `);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching team members:', error);
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/team-members/stats — admin only
// ─────────────────────────────────────────────────────────────────────────────
router.get('/team-members/stats', protect, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)                                       AS total,
        COUNT(CASE WHEN role = 'admin'    THEN 1 END) AS admins,
        COUNT(CASE WHEN role = 'it_staff' THEN 1 END) AS it_staff,
        COUNT(CASE WHEN role = 'employee' THEN 1 END) AS employees,
        COUNT(CASE WHEN online = true     THEN 1 END) AS online
      FROM team_members
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching team stats:', error);
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/team-members/:id — protected
// ─────────────────────────────────────────────────────────────────────────────
router.get('/team-members/:id', protect, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, role, employee_id, designation, photo, priority, online, created_at
       FROM team_members WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching team member:', error);
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/team-members — create or update (upsert)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/team-members',
  protect,
  authorize('admin', 'it_staff'),
  [
    body('id').isInt().withMessage('Valid user ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['admin', 'it_staff', 'employee']).withMessage('Invalid role'),
    body('employee_id').optional().trim(),
    body('designation').optional().trim(),
    body('photo').optional(),
    body('priority').optional().isInt({ min: 1, max: 999 }).withMessage('Priority must be 1–999'),
    body('online').optional().isBoolean().withMessage('Online must be boolean'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id, name, email, role, employee_id, designation, photo, priority, online } = req.body;

    try {
      const check = await db.query('SELECT id FROM team_members WHERE id = $1', [id]);

      let result;
      if (check.rows.length) {
        // Update
        result = await db.query(
          `UPDATE team_members
           SET name        = $1,
               email       = $2,
               role        = $3,
               employee_id = $4,
               designation = $5,
               photo       = $6,
               priority    = $7,
               online      = COALESCE($8, online),
               updated_at  = CURRENT_TIMESTAMP
           WHERE id = $9
           RETURNING *`,
          [name, email, role, employee_id || null, designation || null,
           photo || null, priority ?? 999, online ?? true, id]
        );
        return res.json({ success: true, message: 'Team member updated', data: result.rows[0] });
      } else {
        // Insert
        result = await db.query(
          `INSERT INTO team_members (id, name, email, role, employee_id, designation, photo, priority, online)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [id, name, email, role, employee_id || null, designation || null,
           photo || null, priority ?? 999, online ?? true]
        );
        return res.status(201).json({ success: true, message: 'Team member created', data: result.rows[0] });
      }
    } catch (error) {
      console.error('Error saving team member:', error);
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/team-members/:id — partial update
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  '/team-members/:id',
  protect,
  authorize('admin', 'it_staff'),
  [
    param('id').isInt().withMessage('Invalid user ID'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('role').optional().isIn(['admin', 'it_staff', 'employee']).withMessage('Invalid role'),
    body('designation').optional().trim(),
    body('employee_id').optional().trim(),
    body('photo').optional(),
    body('priority').optional().isInt({ min: 1, max: 999 }).withMessage('Priority must be 1–999'),
    body('online').optional().isBoolean().withMessage('Online must be boolean'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { name, email, role, employee_id, designation, photo, priority, online } = req.body;

    try {
      const check = await db.query('SELECT * FROM team_members WHERE id = $1', [id]);
      if (!check.rows.length) {
        return res.status(404).json({ success: false, message: 'Team member not found' });
      }

      const updates = [];
      const values  = [];
      let vi = 1;

      if (name        !== undefined) { updates.push(`name = $${vi++}`);        values.push(name); }
      if (email       !== undefined) { updates.push(`email = $${vi++}`);       values.push(email); }
      if (role        !== undefined) { updates.push(`role = $${vi++}`);        values.push(role); }
      if (employee_id !== undefined) { updates.push(`employee_id = $${vi++}`); values.push(employee_id); }
      if (designation !== undefined) { updates.push(`designation = $${vi++}`); values.push(designation); }
      if (photo       !== undefined) { updates.push(`photo = $${vi++}`);       values.push(photo); }
      if (priority    !== undefined) { updates.push(`priority = $${vi++}`);    values.push(priority); }
      if (online      !== undefined) { updates.push(`online = $${vi++}`);      values.push(online); }

      if (!updates.length) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await db.query(
        `UPDATE team_members SET ${updates.join(', ')} WHERE id = $${vi} RETURNING *`,
        values
      );
      res.json({ success: true, message: 'Team member updated', data: result.rows[0] });
    } catch (error) {
      console.error('Error updating team member:', error);
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/team-members/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  '/team-members/:id',
  protect,
  authorize('admin', 'it_staff'),
  [param('id').isInt().withMessage('Invalid user ID')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const result = await db.query('DELETE FROM team_members WHERE id = $1 RETURNING id', [req.params.id]);
      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'Team member not found' });
      }
      res.json({ success: true, message: 'Team member deleted', data: { id: parseInt(req.params.id) } });
    } catch (error) {
      console.error('Error deleting team member:', error);
      next(error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/team-members/reorder — bulk priority update
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/team-members/reorder',
  protect,
  authorize('admin', 'it_staff'),
  [
    body('orders').isArray().withMessage('Orders must be an array'),
    body('orders.*.id').isInt().withMessage('Each item needs a valid ID'),
    body('orders.*.priority').isInt({ min: 1, max: 999 }).withMessage('Priority must be 1–999'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { orders } = req.body;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of orders) {
        await client.query(
          'UPDATE team_members SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [item.priority, item.id]
        );
      }
      await client.query('COMMIT');
      const result = await client.query('SELECT * FROM team_members ORDER BY priority ASC');
      res.json({ success: true, message: 'Reordered successfully', data: result.rows });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error reordering team members:', error);
      next(error);
    } finally {
      client.release();
    }
  }
);

module.exports = router;