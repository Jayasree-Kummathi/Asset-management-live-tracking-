'use strict';
// Backend/controllers/accessControlController.js
// Manages website & USB access duration for employees
// Auto-sends expiry emails via cron job

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const nodemailer   = require('nodemailer');

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST,
  port:   Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const FROM = process.env.MAIL_FROM || `AssetOps <${process.env.MAIL_USER}>`;
const SYSADMIN_EMAIL = process.env.SYSADMIN_EMAIL;

// ── Send access notification email ────────────────────────────────────────────
const sendAccessEmail = async ({ to, empName, accessType, action, expiryDate, daysLeft, notes, ccSysadmin = false }) => {
  const accessLabel = accessType === 'website' ? 'Website Access'
                    : accessType === 'usb'     ? 'USB Access'
                    : 'Website & USB Access';

  const isExpired  = action === 'expired';
  const isRevoked  = action === 'revoked';
  const isReminder = action === 'reminder';
  const isGranted  = action === 'granted';

  // Color scheme based on action
  const colors = {
    primary: isGranted ? '#10B981' : isRevoked ? '#EF4444' : isExpired ? '#F59E0B' : '#3B82F6',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    border: '#E5E7EB',
    text: '#111827',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    headerBg: isGranted ? '#ECFDF5' : isRevoked ? '#FEF2F2' : isExpired ? '#FFFBEB' : '#EFF6FF'
  };

  const subject =
    isGranted  ? `✅ Access Granted — ${accessLabel}` :
    isRevoked  ? `🔒 Access Revoked — ${accessLabel}` :
    isExpired  ? `⚠️ Access Expired — ${accessLabel}` :
    isReminder ? `⏰ Access Expiring Soon — ${accessLabel} (${daysLeft} days left)` :
    `Access Update — ${accessLabel}`;

  const iconMap = {
    granted: '✅',
    revoked: '🔒',
    expired: '⚠️',
    reminder: '⏰'
  };

  const icon = iconMap[action] || '📧';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      margin: 0;
      padding: 0;
      background-color: #F3F4F6;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.5;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
    }
    .card {
      background: ${colors.background};
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }
    .header {
      background: ${colors.headerBg};
      padding: 32px 32px 24px;
      border-bottom: 1px solid ${colors.border};
    }
    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .icon-box {
      width: 48px;
      height: 48px;
      background: white;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: ${colors.text};
      margin: 0;
    }
    .subtitle {
      font-size: 13px;
      color: ${colors.textSecondary};
      margin: 4px 0 0;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 16px;
      color: ${colors.text};
      margin: 0 0 24px;
    }
    .greeting strong {
      color: ${colors.primary};
    }
    .message-box {
      background: ${colors.surface};
      border-left: 4px solid ${colors.primary};
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .message-text {
      color: ${colors.text};
      font-size: 14px;
      margin: 0;
      line-height: 1.6;
    }
    .details-table {
      background: ${colors.surface};
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .detail-row {
      display: flex;
      padding: 10px 0;
      border-bottom: 1px solid ${colors.border};
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      width: 140px;
      font-size: 13px;
      font-weight: 500;
      color: ${colors.textSecondary};
    }
    .detail-value {
      flex: 1;
      font-size: 14px;
      font-weight: 600;
      color: ${colors.text};
    }
    .detail-value.highlight {
      color: ${colors.primary};
    }
    .warning-box {
      background: ${isExpired || isRevoked ? '#FEF2F2' : '#FFFBEB'};
      border: 1px solid ${isExpired || isRevoked ? '#FEE2E2' : '#FDE68A'};
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
    }
    .warning-text {
      color: ${isExpired || isRevoked ? '#DC2626' : '#D97706'};
      font-size: 13px;
      font-weight: 500;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .footer {
      background: ${colors.surface};
      padding: 20px 32px;
      border-top: 1px solid ${colors.border};
      text-align: center;
    }
    .footer-text {
      color: ${colors.textLight};
      font-size: 12px;
      margin: 0;
    }
    .button {
      display: inline-block;
      background: ${colors.primary};
      color: white;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      margin-top: 16px;
    }
    @media (max-width: 600px) {
      .container {
        margin: 20px auto;
        padding: 12px;
      }
      .content {
        padding: 24px;
      }
      .detail-label {
        width: 110px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="header-content">
          <div class="icon-box">${icon}</div>
          <div>
            <h1 class="title">${subject}</h1>
            <p class="subtitle">AssetOps Access Management System</p>
          </div>
        </div>
      </div>

      <div class="content">
        <p class="greeting">Hi <strong>${empName}</strong>,</p>

        ${isGranted ? `
        <div class="message-box">
          <p class="message-text">
            Your <strong style="color: ${colors.primary}">${accessLabel}</strong> has been successfully granted. 
            You now have access to the requested resources.
          </p>
        </div>` : ''}

        ${isRevoked ? `
        <div class="message-box">
          <p class="message-text">
            Your <strong style="color: ${colors.primary}">${accessLabel}</strong> has been <strong>revoked</strong> by the system administrator.
            This action was taken in accordance with company policies.
          </p>
        </div>` : ''}

        ${isExpired ? `
        <div class="message-box">
          <p class="message-text">
            Your <strong style="color: ${colors.primary}">${accessLabel}</strong> has <strong>expired</strong> and has been automatically deactivated.
            Please contact IT support if you need extended access.
          </p>
        </div>` : ''}

        ${isReminder ? `
        <div class="message-box">
          <p class="message-text">
            Your <strong style="color: ${colors.primary}">${accessLabel}</strong> is expiring in 
            <strong style="color: ${colors.primary}">${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.
            Please take necessary action to renew your access if required.
          </p>
        </div>` : ''}

        <div class="details-table">
          <div class="detail-row">
            <div class="detail-label">Access Type</div>
            <div class="detail-value">${accessLabel}</div>
          </div>
          ${expiryDate ? `
          <div class="detail-row">
            <div class="detail-label">Expiry Date</div>
            <div class="detail-value highlight">${new Date(expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>` : ''}
          ${daysLeft !== null && daysLeft !== undefined && !isRevoked && !isExpired ? `
          <div class="detail-row">
            <div class="detail-label">Days Remaining</div>
            <div class="detail-value highlight">${daysLeft} day${daysLeft !== 1 ? 's' : ''}</div>
          </div>` : ''}
          ${notes ? `
          <div class="detail-row">
            <div class="detail-label">Additional Notes</div>
            <div class="detail-value">${notes}</div>
          </div>` : ''}
        </div>

        ${isExpired || isRevoked ? `
        <div class="warning-box">
          <div class="warning-text">
            <span>⚠️</span>
            <span>Your access has been deactivated. Any attempts to access restricted resources will be denied.</span>
          </div>
        </div>` : ''}

        ${isReminder && !isExpired && !isRevoked ? `
        <div class="warning-box">
          <div class="warning-text">
            <span>⏰</span>
            <span>Please contact IT support before the expiry date to avoid service interruption.</span>
          </div>
        </div>` : ''}
      </div>

      <div class="footer">
        <p class="footer-text">
          This is an automated message from AssetOps. Please do not reply to this email.<br>
          For assistance, contact IT Support at <a href="mailto:${process.env.MAIL_USER}" style="color: ${colors.primary};">${process.env.MAIL_USER}</a>
        </p>
        <p class="footer-text" style="margin-top: 12px;">
          &copy; ${new Date().getFullYear()} AssetOps. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const mailOptions = { from: FROM, to, subject, html };
  
  // CC sysadmin for critical events
  if (ccSysadmin || isRevoked || isExpired || (isReminder && daysLeft <= 2)) {
    mailOptions.cc = SYSADMIN_EMAIL;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}${mailOptions.cc ? ` (CC: ${mailOptions.cc})` : ''} - ${subject}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

// ── CREATE sequences (run once on startup) ────────────────────────────────────
const bootstrapTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS access_control (
        id            SERIAL PRIMARY KEY,
        emp_id        VARCHAR(50)  NOT NULL,
        emp_name      VARCHAR(200) NOT NULL,
        emp_email     VARCHAR(200) NOT NULL,
        department    VARCHAR(100),
        access_type   VARCHAR(20)  NOT NULL DEFAULT 'website', -- website | usb | both
        duration_days INTEGER,
        expiry_date   DATE,
        status        VARCHAR(20)  NOT NULL DEFAULT 'active',  -- active | revoked | expired
        notes         TEXT,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ac_emp_email ON access_control(emp_email);
      CREATE INDEX IF NOT EXISTS idx_ac_status    ON access_control(status);
      CREATE INDEX IF NOT EXISTS idx_ac_expiry    ON access_control(expiry_date);
    `);
    console.log('✅ access_control table ready');
  } catch (err) {
    console.error('⚠️  access_control table setup failed:', err.message);
  }
};

bootstrapTable();

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/access-control
// ─────────────────────────────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT * FROM access_control ORDER BY created_at DESC`
  );
  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route POST /api/access-control — Grant access
// ─────────────────────────────────────────────────────────────────────────────
exports.grantAccess = asyncHandler(async (req, res) => {
  const { emp_id, emp_name, emp_email, department, access_type,
          access_value, duration_days, expiry_date, notes } = req.body;
 
  if (!emp_id || !emp_name || !emp_email) {
    return res.status(400).json({
      success: false,
      message: 'emp_id, emp_name, and emp_email are required'
    });
  }
 
  const result = await query(
    `INSERT INTO access_control
       (emp_id, emp_name, emp_email, department, access_type,
        access_value, duration_days, expiry_date, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
     RETURNING *`,
    [
      emp_id, emp_name, emp_email,
      department   || null,
      access_type  || 'website',
      access_value || null,       // ← the custom URL/resource
      duration_days || null,
      expiry_date   || null,
      notes         || null,
    ]
  );
 
  const record = result.rows[0];
 
  try {
    const days = expiry_date
      ? Math.ceil((new Date(expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    await sendAccessEmail({
      to: emp_email, empName: emp_name,
      accessType: access_type,
      accessValue: access_value || null,   // ← pass to email
      action: 'granted',
      expiryDate: expiry_date, daysLeft: days, notes,
      ccSysadmin: true,
    });
  } catch (e) { console.error('Grant email failed:', e.message); }
 
  res.status(201).json({ success: true, data: record });
});
 
// @route PUT /api/access-control/:id — Update access
exports.updateAccess = asyncHandler(async (req, res) => {
  const { emp_id, emp_name, emp_email, department, access_type,
          access_value, duration_days, expiry_date, notes } = req.body;
 
  const result = await query(
    `UPDATE access_control
     SET emp_id=$1, emp_name=$2, emp_email=$3, department=$4,
         access_type=$5, access_value=$6,
         duration_days=$7, expiry_date=$8, notes=$9,
         status='active', updated_at=NOW()
     WHERE id=$10 RETURNING *`,
    [
      emp_id, emp_name, emp_email,
      department   || null,
      access_type  || 'website',
      access_value || null,
      duration_days || null,
      expiry_date   || null,
      notes         || null,
      req.params.id,
    ]
  );
 
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Record not found' });
 
  res.json({ success: true, data: result.rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route PUT /api/access-control/:id — Update access
// ─────────────────────────────────────────────────────────────────────────────
exports.updateAccess = asyncHandler(async (req, res) => {
  const { emp_id, emp_name, emp_email, department, access_type, duration_days, expiry_date, notes } = req.body;

  const result = await query(
    `UPDATE access_control
     SET emp_id=$1, emp_name=$2, emp_email=$3, department=$4, access_type=$5,
         duration_days=$6, expiry_date=$7, notes=$8, status='active', updated_at=NOW()
     WHERE id=$9 RETURNING *`,
    [emp_id, emp_name, emp_email, department || null, access_type || 'website',
     duration_days || null, expiry_date || null, notes || null, req.params.id]
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Record not found' });

  const record = result.rows[0];
  
  // Send update notification email
  try {
    const days = expiry_date
      ? Math.ceil((new Date(expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    await sendAccessEmail({
      to: emp_email, 
      empName: emp_name,
      accessType: access_type, 
      action: 'granted', // Using granted action for update
      expiryDate: expiry_date, 
      daysLeft: days, 
      notes: `Updated: ${notes || 'Access details have been modified'}`,
      ccSysadmin: true // Notify sysadmin of update
    });
  } catch (e) { 
    console.error('Update email failed:', e.message);
  }

  res.json({ success: true, data: record });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route PUT /api/access-control/:id/revoke — Revoke access
// ─────────────────────────────────────────────────────────────────────────────
exports.revokeAccess = asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE access_control SET status='revoked', updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Record not found' });

  const r = result.rows[0];

  // Send revoke email (automatically CCs sysadmin)
  try {
    await sendAccessEmail({
      to: r.emp_email, 
      empName: r.emp_name,
      accessType: r.access_type, 
      action: 'revoked',
      expiryDate: r.expiry_date, 
      notes: r.notes,
      ccSysadmin: true
    });
  } catch (e) { 
    console.error('Revoke email failed:', e.message);
  }

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
    return res.status(400).json({ 
      success: false, 
      message: 'Cannot send reminder for access without expiry date' 
    });
  }

  try {
    await sendAccessEmail({
      to: r.emp_email, 
      empName: r.emp_name,
      accessType: r.access_type, 
      action: 'reminder',
      expiryDate: r.expiry_date, 
      daysLeft: days, 
      notes: r.notes,
      ccSysadmin: days <= 2 // CC sysadmin for urgent reminders
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Email failed: ' + e.message });
  }

  res.json({ success: true, message: 'Reminder sent successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// CRON JOB — runs every day at midnight
// Auto-expires records and sends 7d / 3d / 1d / 0d warning emails
// Call this from your main server.js cron scheduler
// ─────────────────────────────────────────────────────────────────────────────
exports.runExpiryJob = async () => {
  console.log('🔐 [Access Control] Running expiry check at:', new Date().toISOString());
  
  try {
    // 1. Mark expired records
    const expired = await query(`
      UPDATE access_control
      SET status='expired', updated_at=NOW()
      WHERE status='active'
        AND expiry_date IS NOT NULL
        AND expiry_date < CURRENT_DATE
      RETURNING *
    `);

    for (const r of expired.rows) {
      console.log(`🔐 Expired: ${r.emp_name} (${r.access_type}) - Expired on ${r.expiry_date}`);
      try {
        await sendAccessEmail({
          to: r.emp_email, 
          empName: r.emp_name,
          accessType: r.access_type, 
          action: 'expired',
          expiryDate: r.expiry_date,
          notes: r.notes,
          ccSysadmin: true // Always notify sysadmin of expirations
        });
      } catch (e) { 
        console.error(`Expiry email failed for ${r.emp_email}:`, e.message); 
      }
    }

    // 2. Send reminders for records expiring in 7, 3, 2, 1 days
    const reminders = await query(`
      SELECT *, (expiry_date - CURRENT_DATE) AS days_left
      FROM access_control
      WHERE status = 'active'
        AND expiry_date IS NOT NULL
        AND (expiry_date - CURRENT_DATE) IN (7, 3, 2, 1)
    `);

    for (const r of reminders.rows) {
      console.log(`⏰ Reminder: ${r.emp_name} — ${r.days_left} days left (Expires: ${r.expiry_date})`);
      try {
        await sendAccessEmail({
          to: r.emp_email, 
          empName: r.emp_name,
          accessType: r.access_type, 
          action: 'reminder',
          expiryDate: r.expiry_date,
          daysLeft: Number(r.days_left),
          notes: r.notes,
          ccSysadmin: r.days_left <= 2 // CC sysadmin for urgent reminders (2 days or less)
        });
      } catch (e) { 
        console.error(`Reminder email failed for ${r.emp_email}:`, e.message); 
      }
    }

    console.log(`🔐 [Access Control] Job completed. Expired: ${expired.rows.length}, Reminders: ${reminders.rows.length}`);
    
    // Return summary for monitoring
    return { 
      success: true, 
      expired: expired.rows.length, 
      reminders: reminders.rows.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (err) {
    console.error('🔐 [Access Control] Job error:', err.message);
    return { success: false, error: err.message };
  }
};