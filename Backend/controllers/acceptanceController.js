const crypto     = require('crypto');
const { query }  = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ── Generate a unique token ──────────────────────────────────────────────────
const makeToken = () => crypto.randomBytes(32).toString('hex');

// @route  POST /api/acceptance/generate
// Called internally after allocation — creates token and returns link
exports.generateToken = async (allocationDbId, assetId, empName, empEmail) => {
  const token = makeToken();
  await query(
    `INSERT INTO acceptance_tokens
       (token, allocation_id, asset_id, emp_name, emp_email, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '10 days')
     ON CONFLICT DO NOTHING`,
    [token, allocationDbId, assetId, empName, empEmail]
  );
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/accept/${token}`;
};

// @route  GET /api/acceptance/:token   — public, no auth
// Returns allocation + asset details for the acceptance form
exports.getAcceptanceData = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const result = await query(
    `SELECT
       t.id, t.token, t.status, t.asset_id, t.emp_name, t.emp_email,
       t.has_damage, t.damage_desc, t.damage_images, t.submitted_at,
       t.expires_at,
       a.emp_id, a.department, a.project, a.client,
       a.allocation_date, a.accessories, a.mobile_no,
       a.delivery_method, a.delivery_address,
       ast.brand, ast.model, ast.config, ast.serial,
       ast.processor, ast.ram, ast.storage, ast.warranty_end
     FROM acceptance_tokens t
     LEFT JOIN allocations a  ON a.id = t.allocation_id
     LEFT JOIN assets ast     ON ast.asset_id = t.asset_id
     WHERE t.token = $1`,
    [token]
  );

  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Invalid or expired link.' });
  }

  const row = result.rows[0];

  if (new Date(row.expires_at) < new Date()) {
    return res.status(410).json({ success: false, message: 'This acceptance link has expired.' });
  }

  res.json({ success: true, data: row });
});

// @route  POST /api/acceptance/:token/submit   — public, no auth
// Employee submits acceptance (no damage) or damage report with images
exports.submitAcceptance = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { has_damage, damage_desc, damage_images } = req.body;
 
  const result = await query(
    'SELECT id, allocation_id, asset_id, emp_name, emp_email, status FROM acceptance_tokens WHERE token = $1',
    [token]
  );
 
  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Invalid link.' });
  }
 
  const row = result.rows[0];
 
  // ✅ Already submitted — never process twice, never send more reminders
  if (row.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: row.status === 'accepted'
        ? 'You have already confirmed receipt of this laptop. No further action needed.'
        : 'Your damage report has already been submitted. IT team will contact you shortly.',
    });
  }
 
  const newStatus = has_damage ? 'damaged' : 'accepted';
  const images    = Array.isArray(damage_images) ? damage_images : [];
 
  // ✅ Mark as accepted/damaged + set expires_at = NOW() so it's fully closed
  // The reminder job checks status = 'pending', so this naturally stops all reminders
  await query(
    `UPDATE acceptance_tokens
     SET status        = $1,
         has_damage    = $2,
         damage_desc   = $3,
         damage_images = $4,
         submitted_at  = NOW(),
         expires_at    = NOW()   -- ✅ close the token immediately
     WHERE token = $5`,
    [newStatus, !!has_damage, damage_desc || null, JSON.stringify(images), token]
  );
 
  // Audit log
  await query(
    `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
     VALUES ($1, 'allocate', $2, $3, $4)`,
    [
      has_damage ? 'EMPLOYEE_REPORTED_DAMAGE' : 'EMPLOYEE_ACCEPTED',
      has_damage
        ? `${row.emp_name} reported damage on ${row.asset_id}: ${damage_desc}`
        : `${row.emp_name} accepted ${row.asset_id} — no damage`,
      row.asset_id,
      row.emp_name,
    ]
  );
 
  res.json({
    success: true,
    message: has_damage
      ? 'Damage report submitted. IT team will contact you shortly.'
      : 'Thank you! Asset acceptance confirmed. No further action needed.',
    status: newStatus,
  });
});
// @route  GET /api/acceptance   — admin/IT staff only
// List all acceptance responses
exports.listAcceptances = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = status && status !== 'all' ? `WHERE t.status = '${status}'` : '';

  const result = await query(
    `SELECT
       t.id, t.token, t.status, t.asset_id, t.emp_name, t.emp_email,
       t.has_damage, t.damage_desc, t.damage_images, t.submitted_at,
       t.created_at, t.expires_at,
       ast.brand, ast.model
     FROM acceptance_tokens t
     LEFT JOIN assets ast ON ast.asset_id = t.asset_id
     ${where}
     ORDER BY t.created_at DESC`
  );

  res.json({ success: true, count: result.rows.length, data: result.rows });
});
