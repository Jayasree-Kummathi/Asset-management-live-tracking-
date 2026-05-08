'use strict';
// Backend/controllers/accessControlController.js
// Manages website & USB access duration for employees
// Auto-sends expiry emails via cron job

const { query }    = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const nodemailer   = require('nodemailer');
const ExcelJS      = require('exceljs');

// ── audit helper — safe import to avoid "audit is not a function" ─────────────
// We require the full module and pull .audit, so Node's export object
// is always fully populated before we destructure.
const auditController = require('./auditController');
const audit = (...args) => auditController.audit(...args);

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST,
  port:   Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

const FROM           = process.env.MAIL_FROM || `AssetOps <${process.env.MAIL_USER}>`;
const SYSADMIN_EMAIL = process.env.SYSADMIN_EMAIL;

// ── Send access notification email ────────────────────────────────────────────
const sendAccessEmail = async ({
  to, empName, accessType, action, expiryDate, daysLeft, notes, ccSysadmin = false,
}) => {
  const accessLabel =
    accessType === 'website' ? 'Website Access'
    : accessType === 'usb'  ? 'USB Access'
    : accessType === 'both' ? 'Website & USB Access'
    : accessType === 'full' ? 'Full System Access'
    : accessType === 'custom' ? 'Custom Resource Access'
    : 'Access';

  const isExpired  = action === 'expired';
  const isRevoked  = action === 'revoked';
  const isReminder = action === 'reminder';
  const isGranted  = action === 'granted';

  const colors = {
    primary:       isGranted ? '#10B981' : isRevoked ? '#EF4444' : isExpired ? '#F59E0B' : '#3B82F6',
    background:    '#FFFFFF',
    surface:       '#F9FAFB',
    border:        '#E5E7EB',
    text:          '#111827',
    textSecondary: '#6B7280',
    textLight:     '#9CA3AF',
    headerBg:      isGranted ? '#ECFDF5' : isRevoked ? '#FEF2F2' : isExpired ? '#FFFBEB' : '#EFF6FF',
  };

  const subject =
    isGranted  ? `✅ Access Granted — ${accessLabel}` :
    isRevoked  ? `🔒 Access Revoked — ${accessLabel}` :
    isExpired  ? `⚠️ Access Expired — ${accessLabel}` :
    isReminder ? `⏰ Access Expiring Soon — ${accessLabel} (${daysLeft} days left)` :
    `Access Update — ${accessLabel}`;

  const icon = { granted: '✅', revoked: '🔒', expired: '⚠️', reminder: '⏰' }[action] || '📧';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { margin:0; padding:0; background-color:#F3F4F6; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; line-height:1.5; }
    .container { max-width:600px; margin:40px auto; padding:20px; }
    .card { background:${colors.background}; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06); overflow:hidden; }
    .header { background:${colors.headerBg}; padding:32px 32px 24px; border-bottom:1px solid ${colors.border}; }
    .header-content { display:flex; align-items:center; gap:12px; }
    .icon-box { width:48px; height:48px; background:white; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
    .title { font-size:20px; font-weight:700; color:${colors.text}; margin:0; }
    .subtitle { font-size:13px; color:${colors.textSecondary}; margin:4px 0 0; }
    .content { padding:32px; }
    .greeting { font-size:16px; color:${colors.text}; margin:0 0 24px; }
    .greeting strong { color:${colors.primary}; }
    .message-box { background:${colors.surface}; border-left:4px solid ${colors.primary}; padding:16px 20px; border-radius:8px; margin-bottom:24px; }
    .message-text { color:${colors.text}; font-size:14px; margin:0; line-height:1.6; }
    .details-table { background:${colors.surface}; border-radius:8px; padding:20px; margin-bottom:24px; }
    .detail-row { display:flex; padding:10px 0; border-bottom:1px solid ${colors.border}; }
    .detail-row:last-child { border-bottom:none; }
    .detail-label { width:140px; font-size:13px; font-weight:500; color:${colors.textSecondary}; }
    .detail-value { flex:1; font-size:14px; font-weight:600; color:${colors.text}; }
    .detail-value.highlight { color:${colors.primary}; }
    .warning-box { background:${isExpired || isRevoked ? '#FEF2F2' : '#FFFBEB'}; border:1px solid ${isExpired || isRevoked ? '#FEE2E2' : '#FDE68A'}; border-radius:8px; padding:14px 18px; margin-bottom:24px; }
    .warning-text { color:${isExpired || isRevoked ? '#DC2626' : '#D97706'}; font-size:13px; font-weight:500; margin:0; display:flex; align-items:center; gap:8px; }
    .footer { background:${colors.surface}; padding:20px 32px; border-top:1px solid ${colors.border}; text-align:center; }
    .footer-text { color:${colors.textLight}; font-size:12px; margin:0; }
    @media (max-width:600px) { .container { margin:20px auto; padding:12px; } .content { padding:24px; } .detail-label { width:110px; } }
  </style>
</head>
<body>
  <div class="container"><div class="card">
    <div class="header"><div class="header-content">
      <div class="icon-box">${icon}</div>
      <div><h1 class="title">${subject}</h1><p class="subtitle">AssetOps Access Management System</p></div>
    </div></div>

    <div class="content">
      <p class="greeting">Hi <strong>${empName}</strong>,</p>

      ${isGranted ? `<div class="message-box"><p class="message-text">Your <strong style="color:${colors.primary}">${accessLabel}</strong> has been successfully granted. You now have access to the requested resources.</p></div>` : ''}
      ${isRevoked ? `<div class="message-box"><p class="message-text">Your <strong style="color:${colors.primary}">${accessLabel}</strong> has been <strong>revoked</strong> by the system administrator. This action was taken in accordance with company policies.</p></div>` : ''}
      ${isExpired ? `<div class="message-box"><p class="message-text">Your <strong style="color:${colors.primary}">${accessLabel}</strong> has <strong>expired</strong> and has been automatically deactivated. Please contact IT support if you need extended access.</p></div>` : ''}
      ${isReminder ? `<div class="message-box"><p class="message-text">Your <strong style="color:${colors.primary}">${accessLabel}</strong> is expiring in <strong style="color:${colors.primary}">${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. Please take necessary action to renew your access if required.</p></div>` : ''}

      <div class="details-table">
        <div class="detail-row"><div class="detail-label">Access Type</div><div class="detail-value">${accessLabel}</div></div>
        ${expiryDate ? `<div class="detail-row"><div class="detail-label">Expiry Date</div><div class="detail-value highlight">${new Date(expiryDate).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</div></div>` : ''}
        ${daysLeft !== null && daysLeft !== undefined && !isRevoked && !isExpired ? `<div class="detail-row"><div class="detail-label">Days Remaining</div><div class="detail-value highlight">${daysLeft} day${daysLeft !== 1 ? 's' : ''}</div></div>` : ''}
        ${notes ? `<div class="detail-row"><div class="detail-label">Additional Notes</div><div class="detail-value">${notes}</div></div>` : ''}
      </div>

      ${isExpired || isRevoked ? `<div class="warning-box"><div class="warning-text"><span>⚠️</span><span>Your access has been deactivated. Any attempts to access restricted resources will be denied.</span></div></div>` : ''}
      ${isReminder && !isExpired && !isRevoked ? `<div class="warning-box"><div class="warning-text"><span>⏰</span><span>Please contact IT support before the expiry date to avoid service interruption.</span></div></div>` : ''}
    </div>

    <div class="footer">
      <p class="footer-text">This is an automated message from AssetOps. Please do not reply to this email.<br>
        For assistance, contact IT Support at <a href="mailto:${process.env.MAIL_USER}" style="color:${colors.primary};">${process.env.MAIL_USER}</a>
      </p>
      <p class="footer-text" style="margin-top:12px;">&copy; ${new Date().getFullYear()} AssetOps. All rights reserved.</p>
    </div>
  </div></div>
</body>
</html>`;

  const mailOptions = { from: FROM, to, subject, html };
  if (ccSysadmin || isRevoked || isExpired || (isReminder && daysLeft <= 2)) {
    mailOptions.cc = SYSADMIN_EMAIL;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}${mailOptions.cc ? ` (CC: ${mailOptions.cc})` : ''} — ${subject}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

// ── Bootstrap table (run once on startup) ─────────────────────────────────────
const bootstrapTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS access_control (
        id            SERIAL PRIMARY KEY,
        emp_id        VARCHAR(50)  NOT NULL,
        emp_name      VARCHAR(200) NOT NULL,
        emp_email     VARCHAR(200) NOT NULL,
        department    VARCHAR(100),
        access_type   VARCHAR(20)  NOT NULL DEFAULT 'website',
        access_value  TEXT,
        duration_days INTEGER,
        expiry_date   DATE,
        status        VARCHAR(20)  NOT NULL DEFAULT 'active',
        notes         TEXT,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ac_emp_email   ON access_control(emp_email);
      CREATE INDEX IF NOT EXISTS idx_ac_status      ON access_control(status);
      CREATE INDEX IF NOT EXISTS idx_ac_expiry      ON access_control(expiry_date);
      CREATE INDEX IF NOT EXISTS idx_ac_access_type ON access_control(access_type);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id           SERIAL PRIMARY KEY,
        action       VARCHAR(100) NOT NULL,
        category     VARCHAR(100),
        detail       TEXT,
        performed_by VARCHAR(200),
        asset_id     VARCHAR(50),
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_al_category   ON audit_logs(category);
      CREATE INDEX IF NOT EXISTS idx_al_created_at ON audit_logs(created_at);
    `);
    console.log('✅ access_control + audit_logs tables ready');
  } catch (err) {
    console.error('⚠️  Table setup failed:', err.message);
  }
};

bootstrapTable();

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/access-control
// ─────────────────────────────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const result = await query(`SELECT * FROM access_control ORDER BY created_at DESC`);
  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/access-control/report
// ─────────────────────────────────────────────────────────────────────────────
exports.getReport = asyncHandler(async (req, res) => {
  const { status, access_type, startDate, endDate } = req.query;
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status && status !== 'all') { conditions.push(`status = $${idx++}`); params.push(status); }
  if (access_type && access_type !== 'all') { conditions.push(`access_type = $${idx++}`); params.push(access_type); }
  if (startDate) { conditions.push(`created_at >= $${idx++}`); params.push(startDate); }
  if (endDate)   { conditions.push(`created_at <= $${idx++} || ' 23:59:59'`); params.push(endDate); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(`
    SELECT
      id, emp_id, emp_name, emp_email, department,
      access_type, access_value, duration_days, expiry_date, status,
      TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_fmt,
      TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at_fmt,
      CASE
        WHEN expiry_date IS NULL              THEN 'No Expiry'
        WHEN expiry_date < CURRENT_DATE       THEN 'Expired'
        WHEN expiry_date - CURRENT_DATE <= 7  THEN 'Expiring Soon (≤7d)'
        WHEN expiry_date - CURRENT_DATE <= 30 THEN 'Expiring Soon (≤30d)'
        ELSE 'Active'
      END as expiry_status,
      (expiry_date - CURRENT_DATE) as days_remaining,
      notes
    FROM access_control ${where}
    ORDER BY created_at DESC
  `, params);

  const stats = {
    total:        result.rows.length,
    active:       result.rows.filter(r => r.status === 'active' && (r.days_remaining === null || r.days_remaining > 0)).length,
    expiring_7d:  result.rows.filter(r => r.days_remaining !== null && r.days_remaining >= 0 && r.days_remaining <= 7).length,
    expiring_30d: result.rows.filter(r => r.days_remaining !== null && r.days_remaining >= 0 && r.days_remaining <= 30).length,
    expired:      result.rows.filter(r => r.status === 'expired' || (r.days_remaining !== null && r.days_remaining < 0)).length,
    revoked:      result.rows.filter(r => r.status === 'revoked').length,
    by_access_type: {
      website: result.rows.filter(r => r.access_type === 'website').length,
      usb:     result.rows.filter(r => r.access_type === 'usb').length,
      both:    result.rows.filter(r => r.access_type === 'both').length,
      custom:  result.rows.filter(r => r.access_type === 'custom').length,
      full:    result.rows.filter(r => r.access_type === 'full').length,
    },
  };

  res.json({ success: true, data: result.rows, stats, count: result.rows.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/access-control/report/excel
// ─────────────────────────────────────────────────────────────────────────────
exports.exportExcelReport = asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();

  const result = await query(`
    SELECT
      id, emp_id, emp_name, emp_email, department,
      access_type, access_value, duration_days, expiry_date, status, notes,
      TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at_fmt,
      TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at_fmt,
      CASE
        WHEN expiry_date IS NULL              THEN 'No Expiry'
        WHEN expiry_date < CURRENT_DATE       THEN 'Expired'
        WHEN expiry_date - CURRENT_DATE <= 7  THEN 'Expiring Soon (≤7d)'
        WHEN expiry_date - CURRENT_DATE <= 30 THEN 'Expiring Soon (≤30d)'
        ELSE 'Active'
      END as expiry_status,
      (expiry_date - CURRENT_DATE) as days_remaining
    FROM access_control
    ORDER BY created_at DESC
  `);

  const GREEN = 'FF1B5E3F';
  const WHITE = 'FFFFFFFF';
  const AMBER = 'FFF59E0B';

  const styleHeader = (sheet, color = GREEN) => {
    const row = sheet.getRow(1);
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    row.font = { color: { argb: WHITE }, bold: true };
  };

  // ── Sheet 1: Main Report ──────────────────────────────────────────────────
  const mainSheet = workbook.addWorksheet('Access Control Report');
  mainSheet.columns = [
    { header: 'ID',              key: 'id',             width: 8  },
    { header: 'Employee ID',     key: 'emp_id',         width: 12 },
    { header: 'Employee Name',   key: 'emp_name',       width: 25 },
    { header: 'Email',           key: 'emp_email',      width: 25 },
    { header: 'Department',      key: 'department',     width: 15 },
    { header: 'Access Type',     key: 'access_type',    width: 15 },
    { header: 'Resource/URL',    key: 'access_value',   width: 35 },
    { header: 'Duration (Days)', key: 'duration_days',  width: 12 },
    { header: 'Expiry Date',     key: 'expiry_date',    width: 12 },
    { header: 'Days Remaining',  key: 'days_remaining', width: 12 },
    { header: 'Status',          key: 'status',         width: 10 },
    { header: 'Expiry Status',   key: 'expiry_status',  width: 18 },
    { header: 'Created At',      key: 'created_at',     width: 20 },
    { header: 'Updated At',      key: 'updated_at',     width: 20 },
    { header: 'Notes',           key: 'notes',          width: 30 },
  ];
  styleHeader(mainSheet);

  for (const record of result.rows) {
    const row = mainSheet.addRow({
      id:             record.id,
      emp_id:         record.emp_id,
      emp_name:       record.emp_name,
      emp_email:      record.emp_email,
      department:     record.department    || '—',
      access_type:    record.access_type,
      access_value:   record.access_value  || '—',
      duration_days:  record.duration_days || '—',
      expiry_date:    record.expiry_date ? new Date(record.expiry_date).toLocaleDateString() : '—',
      days_remaining: record.days_remaining !== null ? record.days_remaining : '—',
      status:         record.status,
      expiry_status:  record.expiry_status,
      created_at:     record.created_at_fmt,
      updated_at:     record.updated_at_fmt,
      notes:          record.notes || '—',
    });

    let fgColor = null;
    if (record.status === 'expired' || (record.days_remaining !== null && record.days_remaining < 0)) {
      fgColor = 'FFFFCCCC';
    } else if (record.days_remaining !== null && record.days_remaining <= 7 && record.days_remaining >= 0) {
      fgColor = 'FFFFE5CC';
    } else if (record.status === 'revoked') {
      fgColor = 'FFE6E6E6';
    }
    if (fgColor) {
      row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } }; });
    }
  }

  // ── Sheet 2: Summary Statistics ───────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary Statistics');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value',  key: 'value',  width: 15 },
  ];
  styleHeader(summarySheet);

  const stats = {
    total:          result.rows.length,
    active:         result.rows.filter(r => r.status === 'active' && (r.days_remaining === null || r.days_remaining > 0)).length,
    expiring_7d:    result.rows.filter(r => r.days_remaining !== null && r.days_remaining >= 0 && r.days_remaining <= 7).length,
    expiring_30d:   result.rows.filter(r => r.days_remaining !== null && r.days_remaining >= 0 && r.days_remaining <= 30).length,
    expired:        result.rows.filter(r => r.status === 'expired' || (r.days_remaining !== null && r.days_remaining < 0)).length,
    revoked:        result.rows.filter(r => r.status === 'revoked').length,
    website_access: result.rows.filter(r => r.access_type === 'website').length,
    usb_access:     result.rows.filter(r => r.access_type === 'usb').length,
    both_access:    result.rows.filter(r => r.access_type === 'both').length,
    custom_access:  result.rows.filter(r => r.access_type === 'custom').length,
    full_access:    result.rows.filter(r => r.access_type === 'full').length,
  };

  summarySheet.addRow({ metric: '📊 TOTAL RECORDS',         value: stats.total });
  summarySheet.addRow({ metric: '✅ Active Access',          value: stats.active });
  summarySheet.addRow({ metric: '⚠️ Expiring in ≤7 days',   value: stats.expiring_7d });
  summarySheet.addRow({ metric: '⚠️ Expiring in ≤30 days',  value: stats.expiring_30d });
  summarySheet.addRow({ metric: '❌ Expired',                value: stats.expired });
  summarySheet.addRow({ metric: '🔒 Revoked',                value: stats.revoked });
  summarySheet.addRow({ metric: '',                          value: '' });
  summarySheet.addRow({ metric: '📱 ACCESS TYPE BREAKDOWN',  value: '' });
  summarySheet.addRow({ metric: '  🌐 Website Access',       value: stats.website_access });
  summarySheet.addRow({ metric: '  🔌 USB Access',           value: stats.usb_access });
  summarySheet.addRow({ metric: '  ⚡ Both Website & USB',   value: stats.both_access });
  summarySheet.addRow({ metric: '  🔗 Custom/URL Access',    value: stats.custom_access });
  summarySheet.addRow({ metric: '  ✨ Full System Access',   value: stats.full_access });
  summarySheet.getCell('A2').font = { bold: true };
  summarySheet.getCell('A9').font = { bold: true };

  // ── Sheet 3: Department Wise ──────────────────────────────────────────────
  const deptSheet = workbook.addWorksheet('Department Wise');
  deptSheet.columns = [
    { header: 'Department',    key: 'department',  width: 25 },
    { header: 'Total',         key: 'total',       width: 12 },
    { header: 'Active',        key: 'active',      width: 12 },
    { header: 'Expired',       key: 'expired',     width: 12 },
    { header: 'Revoked',       key: 'revoked',     width: 12 },
    { header: 'Utilization %', key: 'utilization', width: 15 },
  ];
  styleHeader(deptSheet);

  const deptStats = {};
  for (const record of result.rows) {
    const dept = record.department || 'Unknown';
    if (!deptStats[dept]) deptStats[dept] = { total: 0, active: 0, expired: 0, revoked: 0 };
    deptStats[dept].total++;
    if (record.status === 'active' && (record.days_remaining === null || record.days_remaining > 0)) deptStats[dept].active++;
    if (record.status === 'expired' || (record.days_remaining !== null && record.days_remaining < 0)) deptStats[dept].expired++;
    if (record.status === 'revoked') deptStats[dept].revoked++;
  }
  for (const [dept, data] of Object.entries(deptStats)) {
    const utilization = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;
    deptSheet.addRow({ department: dept, total: data.total, active: data.active, expired: data.expired, revoked: data.revoked, utilization: `${utilization}%` });
  }

  // ── Sheet 4: Expiring Soon ────────────────────────────────────────────────
  const expiringSheet = workbook.addWorksheet('Expiring Soon');
  expiringSheet.columns = [
    { header: 'Employee Name', key: 'emp_name',    width: 25 },
    { header: 'Employee ID',   key: 'emp_id',      width: 12 },
    { header: 'Email',         key: 'emp_email',   width: 25 },
    { header: 'Access Type',   key: 'access_type', width: 15 },
    { header: 'Expiry Date',   key: 'expiry_date', width: 12 },
    { header: 'Days Left',     key: 'days_left',   width: 10 },
    { header: 'Urgency',       key: 'urgency',     width: 15 },
  ];
  styleHeader(expiringSheet, AMBER);

  const expiringRecords = result.rows
    .filter(r => r.days_remaining !== null && r.days_remaining >= 0 && r.days_remaining <= 30)
    .sort((a, b) => a.days_remaining - b.days_remaining);

  for (const record of expiringRecords) {
    expiringSheet.addRow({
      emp_name:    record.emp_name,
      emp_id:      record.emp_id,
      emp_email:   record.emp_email,
      access_type: record.access_type,
      expiry_date: record.expiry_date ? new Date(record.expiry_date).toLocaleDateString() : '—',
      days_left:   record.days_remaining,
      urgency:     record.days_remaining <= 7 ? 'URGENT' : 'Soon',
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=access-control-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// @route POST /api/access-control — Grant access
// ─────────────────────────────────────────────────────────────────────────────
exports.grantAccess = asyncHandler(async (req, res) => {
  const {
    emp_id, emp_name, emp_email, department,
    access_type, access_value, duration_days, expiry_date, notes,
  } = req.body;

  if (!emp_id || !emp_name || !emp_email) {
    return res.status(400).json({ success: false, message: 'emp_id, emp_name, and emp_email are required' });
  }

  const result = await query(
    `INSERT INTO access_control
       (emp_id, emp_name, emp_email, department, access_type,
        access_value, duration_days, expiry_date, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
     RETURNING *`,
    [emp_id, emp_name, emp_email, department || null, access_type || 'website',
     access_value || null, duration_days || null, expiry_date || null, notes || null]
  );

  const record = result.rows[0];

  await audit(
    'ACCESS_GRANTED',
    'access_control',
    `Access "${access_type}" granted to ${emp_name} (${emp_id})${access_value ? ` for URL: ${access_value}` : ''}${expiry_date ? ` expiring on ${expiry_date}` : ''}`,
    req.user?.name || 'Admin'
  );

  try {
    const days = expiry_date
      ? Math.ceil((new Date(expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    await sendAccessEmail({ to: emp_email, empName: emp_name, accessType: access_type, action: 'granted', expiryDate: expiry_date, daysLeft: days, notes, ccSysadmin: true });
  } catch (e) { console.error('Grant email failed:', e.message); }

  res.status(201).json({ success: true, data: record });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route PUT /api/access-control/:id — Update access
// ─────────────────────────────────────────────────────────────────────────────
exports.updateAccess = asyncHandler(async (req, res) => {
  const {
    emp_id, emp_name, emp_email, department,
    access_type, access_value, duration_days, expiry_date, notes,
  } = req.body;

  const oldAccess = await query(`SELECT * FROM access_control WHERE id=$1`, [req.params.id]);
  if (!oldAccess.rows.length)
    return res.status(404).json({ success: false, message: 'Record not found' });

  const result = await query(
    `UPDATE access_control
     SET emp_id=$1, emp_name=$2, emp_email=$3, department=$4,
         access_type=$5, access_value=$6, duration_days=$7,
         expiry_date=$8, notes=$9, status='active', updated_at=NOW()
     WHERE id=$10 RETURNING *`,
    [emp_id, emp_name, emp_email, department || null, access_type || 'website',
     access_value || null, duration_days || null, expiry_date || null, notes || null, req.params.id]
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Record not found' });

  const record = result.rows[0];

  await audit(
    'ACCESS_UPDATED',
    'access_control',
    `Access for ${emp_name} (${emp_id}) updated from "${oldAccess.rows[0].access_type}" to "${access_type}"${access_value ? ` with URL: ${access_value}` : ''}`,
    req.user?.name || 'Admin'
  );

  try {
    const days = expiry_date
      ? Math.ceil((new Date(expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    await sendAccessEmail({ to: emp_email, empName: emp_name, accessType: access_type, action: 'granted', expiryDate: expiry_date, daysLeft: days, notes: `Updated: ${notes || 'Access details have been modified'}`, ccSysadmin: true });
  } catch (e) { console.error('Update email failed:', e.message); }

  res.json({ success: true, data: record });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route PUT /api/access-control/:id/revoke — Revoke access
// ─────────────────────────────────────────────────────────────────────────────
exports.revokeAccess = asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE access_control SET status='revoked', updated_at=NOW() WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Record not found' });

  const r = result.rows[0];

  await audit(
    'ACCESS_REVOKED',
    'access_control',
    `Access "${r.access_type}" revoked for ${r.emp_name} (${r.emp_id})`,
    req.user?.name || 'Admin'
  );

  try {
    await sendAccessEmail({ to: r.emp_email, empName: r.emp_name, accessType: r.access_type, action: 'revoked', expiryDate: r.expiry_date, notes: r.notes, ccSysadmin: true });
  } catch (e) { console.error('Revoke email failed:', e.message); }

  res.json({ success: true, data: r });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route POST /api/access-control/:id/remind — Manual reminder
// ─────────────────────────────────────────────────────────────────────────────
exports.sendReminder = asyncHandler(async (req, res) => {
  const result = await query(`SELECT * FROM access_control WHERE id=$1`, [req.params.id]);
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Record not found' });

  const r    = result.rows[0];
  const days = r.expiry_date
    ? Math.ceil((new Date(r.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  if (!r.expiry_date) {
    return res.status(400).json({ success: false, message: 'Cannot send reminder for access without expiry date' });
  }

  await audit(
    'ACCESS_REMINDER_SENT',
    'access_control',
    `Reminder sent to ${r.emp_name} (${r.emp_id}) — ${days} days left for ${r.access_type} access`,
    req.user?.name || 'Admin'
  );

  try {
    await sendAccessEmail({ to: r.emp_email, empName: r.emp_name, accessType: r.access_type, action: 'reminder', expiryDate: r.expiry_date, daysLeft: days, notes: r.notes, ccSysadmin: days <= 2 });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Email failed: ' + e.message });
  }

  res.json({ success: true, message: 'Reminder sent successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/access-control/export/csv
// ─────────────────────────────────────────────────────────────────────────────
exports.exportCSV = asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT emp_id, emp_name, emp_email, department,
           access_type, access_value, expiry_date, status,
           TO_CHAR(created_at, 'YYYY-MM-DD') as created_date
    FROM access_control ORDER BY created_at DESC
  `);

  let csv = 'Employee ID,Employee Name,Email,Department,Access Type,Resource/URL,Expiry Date,Status,Created Date\n';
  for (const r of result.rows) {
    csv += `"${r.emp_id}","${r.emp_name}","${r.emp_email}","${r.department || ''}","${r.access_type}","${r.access_value || ''}","${r.expiry_date || ''}","${r.status}","${r.created_date}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=access-control-${new Date().toISOString().split('T')[0]}.csv`);
  res.send(csv);
});

// ─────────────────────────────────────────────────────────────────────────────
// CRON JOB — runs every day at midnight
// Auto-expires records; sends reminders at 7d / 3d / 2d / 1d
// ─────────────────────────────────────────────────────────────────────────────
exports.runExpiryJob = async () => {
  console.log('🔐 [Access Control] Running expiry check at:', new Date().toISOString());

  try {
    // 1. Mark expired records
    const expired = await query(`
      UPDATE access_control SET status='expired', updated_at=NOW()
      WHERE status='active' AND expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE
      RETURNING *
    `);

    for (const r of expired.rows) {
      console.log(`🔐 Expired: ${r.emp_name} (${r.access_type}) — expired on ${r.expiry_date}`);
      await audit('ACCESS_EXPIRED', 'access_control', `Access "${r.access_type}" auto-expired for ${r.emp_name} (${r.emp_id})`, 'System');
      try {
        await sendAccessEmail({ to: r.emp_email, empName: r.emp_name, accessType: r.access_type, action: 'expired', expiryDate: r.expiry_date, notes: r.notes, ccSysadmin: true });
      } catch (e) { console.error(`Expiry email failed for ${r.emp_email}:`, e.message); }
    }

    // 2. Send reminders for records expiring in 7, 3, 2, 1 days
    const reminders = await query(`
      SELECT *, (expiry_date - CURRENT_DATE) AS days_left
      FROM access_control
      WHERE status = 'active' AND expiry_date IS NOT NULL
        AND (expiry_date - CURRENT_DATE) IN (7, 3, 2, 1)
    `);

    for (const r of reminders.rows) {
      console.log(`⏰ Reminder: ${r.emp_name} — ${r.days_left} days left (expires: ${r.expiry_date})`);
      await audit('ACCESS_REMINDER_AUTO', 'access_control', `Auto-reminder sent to ${r.emp_name} (${r.emp_id}) — ${r.days_left} days left for ${r.access_type} access`, 'System');
      try {
        await sendAccessEmail({ to: r.emp_email, empName: r.emp_name, accessType: r.access_type, action: 'reminder', expiryDate: r.expiry_date, daysLeft: Number(r.days_left), notes: r.notes, ccSysadmin: r.days_left <= 2 });
      } catch (e) { console.error(`Reminder email failed for ${r.emp_email}:`, e.message); }
    }

    console.log(`🔐 [Access Control] Job done. Expired: ${expired.rows.length}, Reminders: ${reminders.rows.length}`);
    return { success: true, expired: expired.rows.length, reminders: reminders.rows.length, timestamp: new Date().toISOString() };

  } catch (err) {
    console.error('🔐 [Access Control] Job error:', err.message);
    return { success: false, error: err.message };
  }
};