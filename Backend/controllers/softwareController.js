'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Backend/controllers/softwareController.js
// Save as: Backend/controllers/softwareController.js
// ─────────────────────────────────────────────────────────────────────────────

const crypto       = require('crypto');
const fs           = require('fs');
const path         = require('path');
const multer       = require('multer');
const { query }    = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ── Upload directory ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../uploads/software');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer storage config ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    // Sanitize filename — remove special chars
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

// ── FIX: use exports.upload (CommonJS) NOT "export const" (ES module) ─────────
exports.upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.exe', '.msi', '.zip', '.bat'].includes(ext)) {
      return cb(new Error('Only .exe .msi .zip .bat files are allowed'));
    }
    cb(null, true);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/software
// Admin uploads a software package
// ─────────────────────────────────────────────────────────────────────────────
exports.uploadSoftware = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const { name, version, description, silent_args } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Package name is required' });
  }

  // Compute SHA256 — agent verifies this before installing
  const fileBuffer = fs.readFileSync(req.file.path);
  const sha256     = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const filesize   = req.file.size;

  const r = await query(
    `INSERT INTO software_packages
       (name, version, filename, filepath, filesize, sha256, description, silent_args, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      name,
      version      || null,
      req.file.originalname,
      req.file.path,
      filesize,
      sha256,
      description  || null,
      silent_args  || '/S /silent /quiet',
      req.user?.name || 'Admin',
    ]
  );

  console.log(`📦 [Software] Uploaded: ${name} v${version || 'N/A'} (${(filesize/1024/1024).toFixed(1)}MB) by ${req.user?.name}`);

  res.json({
    success: true,
    id:      r.rows[0].id,
    sha256,
    message: `${name} uploaded successfully`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/software
// List all active packages with push stats
// ─────────────────────────────────────────────────────────────────────────────
exports.listSoftware = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT s.*,
       COUNT(t.id) FILTER (WHERE t.status = 'done')        AS push_success,
       COUNT(t.id) FILTER (WHERE t.status = 'failed')      AS push_failed,
       COUNT(t.id) FILTER (WHERE t.status = 'pending')     AS push_pending,
       COUNT(t.id) FILTER (WHERE t.status = 'downloading') AS push_downloading,
       COUNT(t.id) FILTER (WHERE t.status = 'installing')  AS push_installing
     FROM software_packages s
     LEFT JOIN software_push_tasks t ON t.software_id = s.id
     WHERE s.is_active = TRUE
     GROUP BY s.id
     ORDER BY s.uploaded_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/software/:id/push
// Push to specific assets or all enabled agents
// Body: { asset_ids: ['LTB-001','LTB-002'] }  OR  { all: true }
// ─────────────────────────────────────────────────────────────────────────────
exports.pushSoftware = asyncHandler(async (req, res) => {
  const { id }              = req.params;
  const { asset_ids, all }  = req.body;

  // Verify package exists
  const pkg = await query(
    `SELECT * FROM software_packages WHERE id = $1 AND is_active = TRUE`,
    [id]
  );
  if (!pkg.rows.length) {
    return res.status(404).json({ success: false, message: 'Package not found' });
  }

  // Build target list
  let targets = [];
  if (all) {
    const r = await query(
      `SELECT DISTINCT asset_id FROM agent_registrations
       WHERE asset_id IS NOT NULL AND is_enabled = TRUE`
    );
    targets = r.rows.map(r => r.asset_id);
  } else {
    targets = Array.isArray(asset_ids) ? asset_ids : [];
  }

  if (!targets.length) {
    return res.status(400).json({ success: false, message: 'No target assets specified' });
  }

  // Create pending task per asset (skip if already in progress)
  let created = 0;
  let skipped = 0;
  for (const assetId of targets) {
    const existing = await query(
      `SELECT id FROM software_push_tasks
       WHERE software_id = $1 AND asset_id = $2
         AND status IN ('pending','downloading','installing')`,
      [id, assetId]
    );
    if (existing.rows.length) { skipped++; continue; }

    await query(
      `INSERT INTO software_push_tasks (software_id, asset_id, pushed_by)
       VALUES ($1, $2, $3)`,
      [id, assetId, req.user?.name || 'Admin']
    );
    created++;
  }

  console.log(`📦 [Software] Push scheduled: ${pkg.rows[0].name} → ${created} new, ${skipped} skipped by ${req.user?.name}`);

  res.json({
    success: true,
    created,
    skipped,
    message: created > 0
      ? `Push scheduled for ${created} laptop(s). Agents will install within ~3 minutes.`
      : `All selected laptops already have a pending task for this software.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/software/:id/status
// Get per-laptop push status for admin view
// ─────────────────────────────────────────────────────────────────────────────
exports.getPushStatus = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT t.id, t.asset_id, t.status,
            t.pushed_at, t.started_at, t.completed_at,
            t.error_msg, t.result_log,
            a.brand, a.model,
            al.emp_name, al.emp_id
     FROM software_push_tasks t
     LEFT JOIN assets a      ON a.asset_id = t.asset_id
     LEFT JOIN allocations al ON al.asset_id = t.asset_id AND al.status = 'Active'
     WHERE t.software_id = $1
     ORDER BY t.pushed_at DESC`,
    [req.params.id]
  );
  res.json({ success: true, data: r.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/pending-tasks?device_key=XXX
// Called by agent every 3 min — returns pending software installs
// Auth: device_key (no JWT — agent has no browser)
// ─────────────────────────────────────────────────────────────────────────────
exports.getPendingTasks = asyncHandler(async (req, res) => {
  const { device_key } = req.query;
  if (!device_key) return res.status(400).json({ success: false, message: 'device_key required' });

  // Verify device key + agent is enabled
  const reg = await query(
    `SELECT asset_id FROM agent_registrations
     WHERE device_key = $1 AND is_enabled = TRUE`,
    [device_key]
  );
  if (!reg.rows.length) return res.json({ success: true, tasks: [] });

  const assetId = reg.rows[0].asset_id;
  if (!assetId)  return res.json({ success: true, tasks: [] });

  // Get up to 3 pending tasks
  const tasks = await query(
    `SELECT t.id, t.software_id,
            s.name, s.filename, s.sha256, s.filesize, s.silent_args, s.version
     FROM software_push_tasks t
     JOIN software_packages s ON s.id = t.software_id
     WHERE t.asset_id = $1 AND t.status = 'pending'
     ORDER BY t.pushed_at ASC
     LIMIT 3`,
    [assetId]
  );

  if (!tasks.rows.length) return res.json({ success: true, tasks: [] });

  // Mark as downloading so we don't send duplicate
  const taskIds = tasks.rows.map(t => t.id);
  await query(
    `UPDATE software_push_tasks
     SET status = 'downloading', started_at = NOW()
     WHERE id = ANY($1::int[])`,
    [taskIds]
  );

  // FIX: Build download URL from request itself — works for ANY server (HTTP or HTTPS)
  // This avoids the SERVER_URL env mismatch that caused the sucuri.net cert error
  const proto   = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host    = req.headers['x-forwarded-host']  || req.headers.host || '172.16.16.101:5000';
  const baseUrl = process.env.SERVER_URL || `${proto}://${host}`;
  const result  = tasks.rows.map(t => ({
    ...t,
    download_url: `${baseUrl}/api/agent/download/${t.software_id}?device_key=${device_key}`,
  }));

  res.json({ success: true, tasks: result });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/download/:id?device_key=XXX
// Serve the installer file to the authenticated agent
// ─────────────────────────────────────────────────────────────────────────────
exports.downloadSoftware = asyncHandler(async (req, res) => {
  const { device_key } = req.query;
  const { id }         = req.params;

  if (!device_key) return res.status(401).json({ success: false, message: 'device_key required' });

  // Verify agent is registered and enabled
  const reg = await query(
    `SELECT asset_id FROM agent_registrations
     WHERE device_key = $1 AND is_enabled = TRUE`,
    [device_key]
  );
  if (!reg.rows.length) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const pkg = await query(
    `SELECT * FROM software_packages WHERE id = $1 AND is_active = TRUE`,
    [id]
  );
  if (!pkg.rows.length) {
    return res.status(404).json({ success: false, message: 'Package not found' });
  }

  const filePath = pkg.rows[0].filepath;
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found on server' });
  }

  console.log(`📦 [Download] ${pkg.rows[0].name} → ${reg.rows[0].asset_id}`);

  res.setHeader('Content-Disposition', `attachment; filename="${pkg.rows[0].filename}"`);
  res.setHeader('X-File-SHA256', pkg.rows[0].sha256); // agent checks this
  res.sendFile(path.resolve(filePath));               // must be absolute path
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/task-result
// Agent reports success or failure after install attempt
// Body: { device_key, task_id, status: 'done'|'failed', error_msg, result_log }
// ─────────────────────────────────────────────────────────────────────────────
exports.reportTaskResult = asyncHandler(async (req, res) => {
  const { device_key, task_id, status, error_msg, result_log } = req.body;

  if (!device_key || !task_id || !status) {
    return res.status(400).json({ success: false, message: 'device_key, task_id, status required' });
  }
  if (!['done', 'failed', 'installing'].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be: done | failed | installing' });
  }

  const reg = await query(
    `SELECT asset_id FROM agent_registrations WHERE device_key = $1`,
    [device_key]
  );
  if (!reg.rows.length) return res.status(401).json({ success: false, message: 'Unauthorized' });

  await query(
    `UPDATE software_push_tasks
     SET status       = $1,
         completed_at = CASE WHEN $1 IN ('done','failed') THEN NOW() ELSE completed_at END,
         error_msg    = $2,
         result_log   = $3
     WHERE id = $4 AND asset_id = $5`,
    [status, error_msg || null, result_log || null, task_id, reg.rows[0].asset_id]
  );

  console.log(`📦 [Software] Task #${task_id} → ${status} on ${reg.rows[0].asset_id}`);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/agent/software/:id
// Soft delete — keeps file on disk for audit trail
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteSoftware = asyncHandler(async (req, res) => {
  const pkg = await query(
    `SELECT id, name FROM software_packages WHERE id = $1`,
    [req.params.id]
  );
  if (!pkg.rows.length) {
    return res.status(404).json({ success: false, message: 'Package not found' });
  }

  await query(
    `UPDATE software_packages SET is_active = FALSE WHERE id = $1`,
    [req.params.id]
  );

  console.log(`📦 [Software] Deleted: ${pkg.rows[0].name} by ${req.user?.name}`);
  res.json({ success: true, message: `${pkg.rows[0].name} removed` });
});