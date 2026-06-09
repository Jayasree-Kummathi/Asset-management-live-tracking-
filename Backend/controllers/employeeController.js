'use strict';
// Backend/controllers/employeeController.js

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const nodemailer   = require('nodemailer');
const fs           = require('fs');
const path         = require('path');
const { isSuperAdmin, getUserLocations } = require('../utils/locationFilter');

const FROM     = process.env.MAIL_FROM || `Mindteck IT Team <${process.env.MAIL_USER}>`;
const HR_EMAIL = process.env.HR_EMAIL;
const HELPDESK_URL = 'https://helpdesk.mindteck.com';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST, port: Number(process.env.MAIL_PORT) || 587,
  secure: false, auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

// ── Bootstrap columns ─────────────────────────────────────────────────────────
const bootstrapColumn = async () => {
  try {
    const tableCheck = await query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'employees');`);
    if (!tableCheck.rows[0].exists) { console.log('⚠️ Employees table not found'); return; }
    const existingCols = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'`);
    const columnNames  = existingCols.rows.map(c => c.column_name);
    const toAdd = [
      ['company_email_password', 'VARCHAR(200)'],
      ['deleted_at',             'TIMESTAMPTZ DEFAULT NULL'],
      ['cc_emails',              "TEXT DEFAULT ''"],
      ['portal_url',             'VARCHAR(500) DEFAULT NULL'],
      ['exit_checklist',         'JSONB DEFAULT NULL'],
      ['created_by_admin_id',    'INTEGER REFERENCES users(id) DEFAULT NULL'],
    ];
    for (const [col, def] of toAdd) {
      if (!columnNames.includes(col)) {
        await query(`ALTER TABLE employees ADD COLUMN ${col} ${def};`);
        console.log(`✅ Added ${col} column`);
      }
    }

    await query(`
      UPDATE employees
      SET created_by_admin_id = (
        SELECT id FROM users
        WHERE role IN ('admin','it_staff','superadmin')
        ORDER BY id ASC
        LIMIT 1
      )
      WHERE created_by_admin_id IS NULL
    `).catch(() => {});

    const contactsCheck = await query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'support_contacts');`);
    if (!contactsCheck.rows[0].exists) {
      await query(`
        CREATE TABLE support_contacts (
          id         SERIAL PRIMARY KEY,
          name       VARCHAR(200) NOT NULL,
          phone      VARCHAR(50),
          email      VARCHAR(200),
          role       VARCHAR(200),
          sort_order INTEGER DEFAULT 0,
          is_active  BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await query(`
        INSERT INTO support_contacts (name, phone, email, role, sort_order) VALUES
          ('Hari Patnaik',  '9916675460', 'sysadmin@mindteck.com',  'IT Head',    1),
          ('Praveen MK',    '9500932816', NULL,                     'IT Support', 2),
          ('Lokesh M',      '9100656740', NULL,                     'IT Support', 3),
          ('Kondal Rao',    '9845327182', NULL,                     'IT Support', 4);
      `);
      console.log('✅ support_contacts table created and seeded');
    }
    console.log('✅ Employee table columns verified');
  } catch (err) { console.warn('Bootstrap warning:', err.message); }
};
bootstrapColumn().catch(err => console.warn('Bootstrap skipped:', err.message));

// ── Audit helper ──────────────────────────────────────────────────────────────
const audit = (action, detail, performedBy) =>
  query(`INSERT INTO audit_logs (action, category, detail, performed_by) VALUES ($1,'employee',$2,$3)`,
    [action, detail, performedBy]);

// ── Logo attachment helper ────────────────────────────────────────────────────
const getLogoAttachment = () => {
  try {
    for (const ext of ['png', 'jpg', 'jpeg', 'gif']) {
      const p = path.join(__dirname, `../utils/mindteck_logo.${ext}`);
      if (fs.existsSync(p))
        return [{ filename: `mindteck_logo.${ext}`, path: p, cid: 'mindteck_logo', contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` }];
    }
    for (const name of ['logo.png', 'logo.jpg', 'mindteck.png', 'mindteck.jpg']) {
      const p = path.join(__dirname, `../utils/${name}`);
      if (fs.existsSync(p)) {
        const ext = name.split('.').pop();
        return [{ filename: name, path: p, cid: 'mindteck_logo', contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` }];
      }
    }
  } catch (e) { console.error('Logo attachment error:', e.message); }
  return [];
};

// ── Employee photo attachment helper ─────────────────────────────────────────
const getEmpPhotoAttachment = (photoUrl) => {
  if (!photoUrl || !photoUrl.trim()) return [];
  const url = photoUrl.trim();
  if (!url.startsWith('data:image')) return [];
  try {
    const [meta, b64] = url.split(',');
    if (!b64) return [];
    const mimeMatch = meta.match(/data:(image\/[a-zA-Z+]+);base64/);
    const mimeType  = mimeMatch ? mimeMatch[1] : 'image/png';
    const ext       = mimeType.split('/')[1].replace('jpeg', 'jpg');
    return [{
      filename:    `emp_photo.${ext}`,
      content:     Buffer.from(b64, 'base64'),
      cid:         'emp_photo',
      contentType: mimeType,
      encoding:    'base64',
    }];
  } catch (e) {
    console.error('Employee photo attachment error:', e.message);
    return [];
  }
};

// ── Fetch support contacts from DB ────────────────────────────────────────────
const getSupportContacts = async () => {
  try {
    const result = await query(
      `SELECT name, phone, email, role FROM support_contacts WHERE is_active = TRUE ORDER BY sort_order ASC`
    );
    return result.rows;
  } catch (e) {
    console.error('Failed to fetch support contacts:', e.message);
    return [
      { name: 'Hari Patnaik', phone: '9916675460', email: 'sysadmin@mindteck.com', role: 'IT Head' },
      { name: 'Praveen MK',   phone: '9500932816', email: null,                   role: 'IT Support' },
      { name: 'Lokesh M',     phone: '9100656740', email: null,                   role: 'IT Support' },
      { name: 'Kondal Rao',   phone: '9845327182', email: null,                   role: 'IT Support' },
    ];
  }
};

// ── Laptop status config ──────────────────────────────────────────────────────
const LAPTOP_STATUS_MAP = {
  collected: {
    label: 'Laptop Collected (Company Asset)', icon: '&#10003;',
    iconBg: '#dcfce7', iconColor: '#166534', badgeBg: '#dcfce7', badgeText: '#166534', badgeBorder: '#86efac',
    emailText: 'The company-issued laptop has been successfully collected from the employee.',
  },
  client_return: {
    label: 'Client-Owned Laptop - To Be Returned to Client', icon: '&#127970;',
    iconBg: '#dbeafe', iconColor: '#1e40af', badgeBg: '#dbeafe', badgeText: '#1e40af', badgeBorder: '#93c5fd',
    emailText: 'The employee was using a client-owned laptop. Please confirm that the asset has been returned to the respective client.',
  },
  no_laptop: {
    label: 'No Laptop Assigned', icon: '&#10007;',
    iconBg: '#f3f4f6', iconColor: '#6b7280', badgeBg: '#f3f4f6', badgeText: '#6b7280', badgeBorder: '#d1d5db',
    emailText: 'No laptop or company asset was assigned to this employee.',
  },
  pending: {
    label: 'Pending Verification', icon: '&#8987;',
    iconBg: '#fef3c7', iconColor: '#92400e', badgeBg: '#fef3c7', badgeText: '#92400e', badgeBorder: '#fcd34d',
    emailText: 'The laptop has not been received yet, and the asset status remains pending verification. Please coordinate with the client, reporting manager, or relevant team to confirm the handover/return status.',
  },
};

// ── Employee photo block (Outlook-safe) ───────────────────────────────────────
const empPhotoBlock = (photoUrl, empName, size = 60) => {
  const nameParts = (empName || 'MT').split(' ');
  const initials  = (nameParts[0][0] + (nameParts[1]?.[0] || '')).toUpperCase();
  if (photoUrl && photoUrl.trim()) {
    const url = photoUrl.trim();
    const src = url.startsWith('data:image') ? 'cid:emp_photo' : url;
    return `<img src="${src}" alt="${empName}" width="${size}" height="${size}"
      style="width:${size}px;height:${size}px;border-radius:${size/2}px;border:3px solid #ffffff;display:block;">`;
  }
  return `<table cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="${size}" height="${size}" align="center" valign="middle"
      style="width:${size}px;height:${size}px;background-color:#c8d8e8;border-radius:${size/2}px;
      border:3px solid #d0d8e4;font-size:${Math.round(size*0.28)}px;font-weight:700;
      color:#4a6080;font-family:Arial,sans-serif;">${initials}</td>
  </tr></table>`;
};

// ── Logo block helper ─────────────────────────────────────────────────────────
const logoBlock = (hasLogo) => {
  if (hasLogo) {
    return `<img src="cid:mindteck_logo" alt="MINDTECK" width="160" height="44"
      style="display:block;width:160px;height:44px;border:0;outline:none;text-decoration:none;">`;
  }
  return `<table cellpadding="0" cellspacing="0" border="0">
    <tr><td style="font-size:24px;font-weight:900;color:#0D2E6E;font-family:Arial Black,Arial,sans-serif;letter-spacing:-0.5px;line-height:1;">MINDTECK</td></tr>
    <tr><td style="font-size:10px;color:#555555;font-family:Arial,sans-serif;letter-spacing:1px;padding-top:2px;">Welcome to possible</td></tr>
  </table>`;
};

// ── Support contacts rows HTML ────────────────────────────────────────────────
const buildSupportContactsHtml = (contacts) =>
  contacts.slice(0, 4).map((c, i) =>
    `<tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f8f9fc'};">
      <td style="padding:8px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;border-bottom:1px solid #e0e0e0;">${c.name}</td>
      <td style="padding:8px 14px;font-size:13px;color:#555555;font-family:Arial,sans-serif;border-bottom:1px solid #e0e0e0;">${c.phone || ''}</td>
    </tr>`
  ).join('');

// ══════════════════════════════════════════════════════════════════════════════
// BUILD WELCOME EMAIL HTML  ← First document format
// ── Logo left · Round employee photo right (NO employee profile table)
// ══════════════════════════════════════════════════════════════════════════════
const buildWelcomeEmailHtml = async (emp) => {
  const {
    emp_name, emp_id, company_email, personal_email,
    designation, service_line, location, doj,
    reporting_manager, portal_url, photo_url,
  } = emp;

  const dojFormatted = doj
    ? new Date(doj).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let portalLabel = 'GoDaddy SSO (Titan Email)';
  let portalHref  = 'https://sso.godaddy.com/login?app=titan&realm=pass';
  if (portal_url) {
    try {
      if (typeof portal_url === 'string' && portal_url.trim().startsWith('[')) {
        const parsed = JSON.parse(portal_url);
        if (Array.isArray(parsed) && parsed.length > 0) {
          portalHref  = parsed[0].url;
          portalLabel = parsed[0].label || portalLabel;
        }
      } else if (typeof portal_url === 'string' && portal_url.trim().startsWith('http')) {
        portalHref  = portal_url.trim();
        portalLabel = portal_url.trim();
      }
    } catch (e) { /* keep defaults */ }
  }

  const username        = company_email || personal_email || 'See IT team';
  const supportContacts = await getSupportContacts();
  const logoAtts        = getLogoAttachment();
  const hasLogo         = logoAtts.length > 0;

  // ── Round employee photo block (Outlook-safe) ─────────────────────────────
  const nameParts = (emp_name || 'MT').split(' ');
  const initials  = (nameParts[0][0] + (nameParts[1]?.[0] || '')).toUpperCase();
  const photoHtml = (photo_url && photo_url.trim())
    ? `<img src="${photo_url.trim().startsWith('data:image') ? 'cid:emp_photo' : photo_url.trim()}"
          alt="${emp_name}" width="80" height="80"
          style="width:80px;height:80px;border-radius:40px;object-fit:cover;
                 border:3px solid #003366;display:block;">`
    : `<table cellpadding="0" cellspacing="0" border="0"><tr>
         <td width="80" height="80" align="center" valign="middle"
           style="width:80px;height:80px;background-color:#003366;border-radius:40px;
                  border:3px solid #003366;font-size:22px;font-weight:700;
                  color:#ffffff;font-family:Arial,sans-serif;">${initials}</td>
       </tr></table>`;

  // ── Support contacts rows ─────────────────────────────────────────────────
  const contactRows = supportContacts.slice(0, 4).map((c, i) =>
    `<tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f8f9fc'};">
       <td style="padding:8px 14px;font-size:13px;color:#333333;font-family:Arial,sans-serif;
                  border-bottom:1px solid #e0e0e0;">${c.name}</td>
       <td style="padding:8px 14px;font-size:13px;color:#555555;font-family:Arial,sans-serif;
                  border-bottom:1px solid #e0e0e0;">${c.phone || ''}</td>
     </tr>`
  ).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Welcome to Mindteck</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f6f9" style="padding:20px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" border="0"
       style="max-width:620px;width:100%;background:#ffffff;border-radius:10px;
              overflow:hidden;border:1px solid #e0e0e0;">

  <!-- ══ HEADER: Logo left · Round photo right ══ -->
  <tr>
    <td style="background:#ffffff;padding:20px 28px;border-bottom:3px solid #003366;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr valign="middle">
          <!-- Logo -->
          <td valign="middle">
            ${hasLogo
              ? `<img src="cid:mindteck_logo" alt="Mindteck" height="48"
                      style="height:48px;width:auto;display:block;border:0;">`
              : `<div style="font-size:26px;font-weight:900;color:#003366;
                             font-family:Arial Black,Arial,sans-serif;letter-spacing:-0.5px;">
                   MINDTECK
                 </div>
                 <div style="font-size:10px;color:#888888;letter-spacing:1px;
                             font-family:Arial,sans-serif;margin-top:2px;">
                   Welcome to possible
                 </div>`
            }
        </tr>
      </table>
    </td>
  </tr>

  <!-- ══ DARK BANNER ══ -->
  <tr>
    <td style="background:#4B5563;padding:24px 28px;text-align:center;">
      <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;
                 font-family:Arial,sans-serif;line-height:1.2;">
        Welcome to the Mindteck Family!
      </h1>
      <div style="margin-top:8px;font-size:13px;color:#d1d5db;font-family:Arial,sans-serif;">
        &#128197;&nbsp; Date of Joining: <strong style="color:#ffffff;">${dojFormatted}</strong>
      </div>
    </td>
  </tr>

  <!-- ══ INTRO TEXT ══ -->
  <tr>
    <td style="padding:28px 28px 20px;">
      <p style="font-size:15px;line-height:1.8;color:#333333;margin:0 0 12px;">
        Dear <strong>${emp_name}</strong>,
      </p>
      <p style="font-size:14px;line-height:1.8;color:#333333;margin:0 0 10px;">
        Welcome to Mindteck. As part of your onboarding process, the IT Team is here to ensure a
        smooth setup of your systems and provide the necessary information required to begin your
        assignment successfully.
      </p>
      <p style="font-size:14px;line-height:1.8;color:#333333;margin:0;">
        Should you require any assistance, please contact us using the details below.
      </p>
    </td>
  </tr>

  <!-- ══ IT SUPPORT INFO ══ -->
  <tr>
    <td style="padding:0 28px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e0e0e0;border-radius:6px;border-collapse:collapse;">
        <tr style="background:#f8f9fc;">
          <td colspan="2" style="padding:10px 14px;">
            <strong style="font-size:16px;color:#003366;font-family:Arial,sans-serif;">
              IT Support Information
            </strong>
          </td>
        </tr>
        <tr>
          <td style="padding:9px 14px;font-size:13px;font-weight:600;color:#555555;
                     width:180px;border-bottom:1px solid #eeeeee;border-right:1px solid #eeeeee;">
            Email
          </td>
          <td style="padding:9px 14px;font-size:13px;color:#333333;border-bottom:1px solid #eeeeee;">
            <a href="mailto:sysadmin@mindteck.com"
               style="color:#2563eb;text-decoration:none;">sysadmin@mindteck.com</a>
          </td>
        </tr>
        <tr style="background:#fafafa;">
          <td style="padding:9px 14px;font-size:13px;font-weight:600;color:#555555;
                     border-bottom:1px solid #eeeeee;border-right:1px solid #eeeeee;">
            Landline
          </td>
          <td style="padding:9px 14px;font-size:13px;color:#333333;border-bottom:1px solid #eeeeee;">
            41548000 (Ext: 8091 / 8092)
          </td>
        </tr>
        <tr>
          <td style="padding:9px 14px;font-size:13px;font-weight:600;color:#555555;
                     border-right:1px solid #eeeeee;">
            Help Desk
          </td>
          <td style="padding:9px 14px;font-size:13px;color:#333333;">
            <a href="${HELPDESK_URL}"
               style="color:#2563eb;text-decoration:none;">${HELPDESK_URL}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ══ EMERGENCY CONTACTS ══ -->
  <tr>
    <td style="padding:0 28px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e0e0e0;border-radius:6px;border-collapse:collapse;">
        <tr style="background:#f8f9fc;">
          <td colspan="2" style="padding:10px 14px;">
            <strong style="font-size:16px;color:#003366;font-family:Arial,sans-serif;">
               Emergency Contacts (Emergency Use Only)
            </strong>
          </td>
        </tr>
        ${contactRows}
      </table>
    </td>
  </tr>

  <!-- ══ ACCOUNT INFORMATION ══ -->
  <tr>
    <td style="padding:0 28px 20px;">
      <h2 style="font-size:16px;color:#003366;font-family:Arial,sans-serif;margin:0 0 10px;">
         Account Information
      </h2>
      <table width="100%" cellpadding="12" cellspacing="0"
             style="border-collapse:collapse;border:1px solid #dddddd;">
        <tr style="background:#4B5563;color:#ffffff;">
          <th align="left" style="padding:10px 14px;font-size:13px;font-family:Arial,sans-serif;
                                  border-right:1px solid #6b7280;">Service</th>
          <th align="left" style="padding:10px 14px;font-size:13px;font-family:Arial,sans-serif;
                                  border-right:1px solid #6b7280;">URL</th>
          <th align="left" style="padding:10px 14px;font-size:13px;font-family:Arial,sans-serif;">
            Username
          </th>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:13px;color:#333333;
                     border-bottom:1px solid #eeeeee;border-right:1px solid #eeeeee;">
            Email
          </td>
          <td style="padding:10px 14px;font-size:13px;color:#333333;
                     border-bottom:1px solid #eeeeee;border-right:1px solid #eeeeee;">
            <a href="${portalHref}" style="color:#2563eb;text-decoration:none;font-size:12px;">
              ${portalLabel}
            </a>
          </td>
          <td style="padding:10px 14px;font-size:13px;color:#003366;font-weight:600;
                     border-bottom:1px solid #eeeeee;">
            ${username}
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0;color:#d9534f;font-weight:bold;font-size:13px;
                font-family:Arial,sans-serif;">
        &#9888; Your password has been sent in a separate confidential email.
        Please change it immediately upon first login.
      </p>
    </td>
  </tr>

  <!-- ══ IT SECURITY GUIDELINES ══ -->
  <tr>
    <td style="padding:0 28px 24px;">
      <h2 style="font-size:16px;color:#003366;font-family:Arial,sans-serif;margin:0 0 10px;">
         IT Security Guidelines
      </h2>
      <ul style="color:#333333;line-height:1.85;padding-left:20px;margin:0;
                 font-size:13px;font-family:Arial,sans-serif;">
        <li>Never share confidential company information with unauthorized individuals.</li>
        <li>Do not use unprotected or public computers for official work.</li>
        <li>Lock your computer whenever you leave your workstation.</li>
        <li>Report suspicious emails, activities, or security incidents immediately.</li>
        <li>Use strong and unique passwords.</li>
        <li>Do not connect personal devices without IT approval.</li>
        <li>Do not install any software without prior authorization from the IT Team.</li>
        <li>Unauthorized software installations may result in audit findings and accountability.</li>
        <li>Avoid downloading files, applications, or executables from untrusted sources.</li>
        <li>Do not store installers, license keys, or unauthorized software on company devices.</li>
        <li>Store all official data only on approved repositories such as SVN or Central File Servers.</li>
        <li>Do not retain official business data solely on local laptops.</li>
      </ul>
    </td>
  </tr>

  <!-- ══ CLOSING / REGARDS ══ -->
  <tr>
    <td style="background:#f8f9fc;padding:24px 28px;text-align:center;
               border-top:1px solid #e0e0e0;">
      <p style="font-size:16px;color:#003366;font-weight:700;margin:0;
                font-family:Arial,sans-serif;line-height:1.8;">
        Best Regards,<br>
        IT Team<br>
        Mindteck
      </p>
    </td>
  </tr>

  <!-- ══ FOOTER ══ -->
  <tr>
    <td style="background:#003366;padding:12px 28px;" align="center">
      <div style="font-size:11px;color:#aaccee;font-family:Arial,sans-serif;line-height:1.8;">
        This is an automated message from <strong style="color:#ffffff;">Mindteck IT Team</strong>
        &bull; AssetOps System<br>
        &copy; ${new Date().getFullYear()} Mindteck &bull; All rights reserved &bull; Internal use only
      </div>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
};

// ══════════════════════════════════════════════════════════════════════════════
// BUILD PASSWORD EMAIL HTML
// ══════════════════════════════════════════════════════════════════════════════
const buildPasswordEmailHtml = async (emp) => {
  const {
    emp_name, emp_id, company_email, personal_email,
    designation, doj, portal_url, company_email_password,
  } = emp;

  const dojFormatted = doj
    ? new Date(doj).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const username = company_email || personal_email || 'Please contact IT team';

  let portalLabel = 'GoDaddy SSO (Titan Email)';
  let portalHref  = HELPDESK_URL;
  if (portal_url) {
    try {
      if (typeof portal_url === 'string' && portal_url.trim().startsWith('[')) {
        const parsed = JSON.parse(portal_url);
        if (Array.isArray(parsed) && parsed.length > 0) {
          portalHref  = parsed[0].url;
          portalLabel = parsed[0].label || portalLabel;
        }
      } else if (typeof portal_url === 'string' && portal_url.trim().startsWith('http')) {
        portalHref  = portal_url.trim();
        portalLabel = portal_url.trim();
      }
    } catch (e) { /* keep defaults */ }
  }

  const logoAtts = getLogoAttachment();
  const hasLogo  = logoAtts.length > 0;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Your Mindteck Login Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f2f5">
<tr><td align="center" style="padding:20px 10px;">
<table width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;width:100%;background-color:#ffffff;border:1px solid #dde2e8;">

  <!-- ═══ HEADER: Logo + Confidential badge ═══ -->
  <tr>
    <td style="background-color:#ffffff;padding:16px 22px 12px;border-bottom:3px solid #1B5E3F;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
        <td valign="middle">
          ${logoBlock(hasLogo)}
        </td>
        <td align="right" valign="middle">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="background-color:#fff3cd;border:1px solid #ffc107;padding:5px 12px;" align="center">
              <span style="font-size:11px;font-weight:700;color:#856404;font-family:Arial,sans-serif;letter-spacing:0.5px;">&#128274; CONFIDENTIAL</span>
            </td>
          </tr></table>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- ═══ DARK NAVY HERO ═══ -->
  <tr>
    <td style="background-color:#0D2E6E;padding:24px 24px 20px;" align="center">
      <div style="font-size:10px;color:#aaaacc;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:4px;">Your Login Credentials</div>
      <div style="font-size:20px;font-weight:800;color:#ffffff;font-family:Arial Black,Arial,sans-serif;line-height:1.2;">IT Access Details</div>
      <div style="font-size:11px;color:#8888aa;margin-top:6px;font-family:Arial,sans-serif;">Confidential &mdash; do not share with anyone</div>
    </td>
  </tr>

  <!-- ═══ BODY ═══ -->
  <tr><td style="padding:22px 22px 8px;">

    <!-- Greeting -->
    <div style="font-size:13px;color:#4a5568;line-height:1.7;font-family:Arial,sans-serif;margin-bottom:18px;">
      Dear <strong style="color:#0D2E6E;">${emp_name}</strong>,<br>
      Welcome to Mindteck! Here are your <strong style="color:#1B5E3F;">personal login credentials</strong>. Please keep this email confidential.
    </div>

    <!-- Credentials Box -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #1B5E3F;margin-bottom:16px;">
      <tr><td style="background-color:#1B5E3F;padding:9px 14px;">
        <span style="font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.5px;text-transform:uppercase;font-family:Arial,sans-serif;">&#128274; Your Login Information</span>
      </td></tr>
      <!-- Portal URL -->
      <tr><td style="padding:11px 14px;background-color:#f7faf8;border-bottom:1px solid #e0ece8;">
        <table cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
          <td width="32" height="32" align="center" valign="middle"
            style="width:32px;height:32px;background-color:#e8f0fc;border-radius:16px;font-size:15px;font-family:Arial,sans-serif;border:1px solid #c0d0f0;">&#127760;</td>
          <td style="padding-left:10px;">
            <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;margin-bottom:2px;">Portal URL</div>
            <a href="${portalHref}" style="font-size:12px;color:#2563eb;font-weight:600;font-family:Arial,sans-serif;text-decoration:none;">${portalLabel}</a>
          </td>
        </tr></table>
      </td></tr>
      <!-- Username -->
      <tr><td style="padding:11px 14px;background-color:#ffffff;border-bottom:1px solid #e0ece8;">
        <table cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
          <td width="32" height="32" align="center" valign="middle"
            style="width:32px;height:32px;background-color:#dbeafe;border-radius:16px;font-size:15px;font-family:Arial,sans-serif;border:1px solid #bcd0f0;">&#128100;</td>
          <td style="padding-left:10px;">
            <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;margin-bottom:2px;">Username</div>
            <div style="font-size:13px;color:#2563eb;font-weight:600;font-family:Arial,sans-serif;">${username}</div>
          </td>
        </tr></table>
      </td></tr>
      <!-- Password -->
      <tr><td style="background-color:#1B5E3F;padding:14px 16px;">
        <div style="font-size:10px;font-weight:500;color:#ffffff;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:10px;">&#128273; Your Temporary Password</div>
        <table cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td style="background-color:#ffffff;padding:12px 28px;" align="center">
            <span style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:700;color:#1B5E3F;letter-spacing:4px;">${company_email_password || 'Please contact IT'}</span>
          </td>
        </tr></table>
        <div style="margin-top:12px;font-size:11px;color:#a7f3d0;font-family:Arial,sans-serif;text-align:center;">&#9888; Change this password immediately on first login</div>
      </td></tr>
    </table>

    <!-- Profile snippet -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f9fb;border:1px solid #e2e8f0;margin-bottom:14px;">
      <tr><td style="padding:10px 14px;">
        <div style="font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;font-family:Arial,sans-serif;">&#128203; Your Profile</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="25%" style="font-size:11px;color:#6b7280;padding:3px 0;font-family:Arial,sans-serif;">Employee ID</td>
            <td width="25%" style="font-size:11px;font-weight:700;color:#0D2E6E;padding:3px 0;font-family:Arial,sans-serif;">${emp_id}</td>
            <td width="20%" style="font-size:11px;color:#6b7280;padding:3px 0;font-family:Arial,sans-serif;">Name</td>
            <td width="30%" style="font-size:11px;font-weight:700;color:#111111;padding:3px 0;font-family:Arial,sans-serif;">${emp_name}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#6b7280;padding:3px 0;font-family:Arial,sans-serif;">Designation</td>
            <td style="font-size:11px;font-weight:600;color:#111111;padding:3px 0;font-family:Arial,sans-serif;">${designation || 'N/A'}</td>
            <td style="font-size:11px;color:#6b7280;padding:3px 0;font-family:Arial,sans-serif;">Joining Date</td>
            <td style="font-size:11px;font-weight:600;color:#111111;padding:3px 0;font-family:Arial,sans-serif;">${dojFormatted}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- Security reminder -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffde7;border:1px solid #fde68a;margin-bottom:18px;">
      <tr><td style="padding:11px 14px;">
        <div style="font-size:12px;color:#7c5a00;line-height:1.7;font-family:Arial,sans-serif;">
          <strong>&#128274; Security Reminder:</strong><br>
          &bull; Change your password after first login<br>
          &bull; Never share your credentials with anyone<br>
          &bull; Contact IT if you suspect unauthorized access:
          <a href="mailto:sysadmin@mindteck.com" style="color:#7c5a00;font-weight:600;font-family:Arial,sans-serif;">sysadmin@mindteck.com</a> / 41548000 / Ext: 8091, 8092
        </div>
      </td></tr>
    </table>

  </td></tr>

  <!-- ═══ FOOTER ═══ -->
  <tr>
    <td style="background-color:#1B5E3F;padding:11px 22px;" align="center">
      <div style="font-size:11px;color:#cceecc;line-height:1.8;font-family:Arial,sans-serif;">
        This is a <strong style="color:#ffffff;">confidential</strong> automated message from <strong style="color:#ffffff;">Mindteck IT Team</strong> &bull; AssetOps<br>
        &copy; ${new Date().getFullYear()} Mindteck &bull; Do not forward this email
      </div>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
};

// ══════════════════════════════════════════════════════════════════════════════
// SEND WELCOME EMAIL
// ══════════════════════════════════════════════════════════════════════════════
const sendWelcomeEmail = async (emp) => {
  const { emp_name, company_email, personal_email, cc_emails } = emp;
  const firstName = (emp_name || '').split(' ')[0] || 'Employee';

  const employeeEmails = [company_email, personal_email].filter(Boolean);
  if (!employeeEmails.length) return;

  const SYSADMIN = 'sysadmin@mindteck.com';
  let ccList = [];

  if (cc_emails) {
    ccList = cc_emails.split(',').map(e => e.trim()).filter(Boolean);
    ccList = ccList.filter(
      e => !employeeEmails.some(empEmail => empEmail.toLowerCase() === e.toLowerCase())
    );
  }

  if (
    !employeeEmails.some(e => e.toLowerCase() === SYSADMIN.toLowerCase()) &&
    !ccList.some(e => e.toLowerCase() === SYSADMIN.toLowerCase())
  ) {
    ccList.unshift(SYSADMIN);
  }

  console.log('📧 Welcome Email TO:', employeeEmails.join(', '));
  console.log('📧 Welcome Email CC:', ccList.join(', ') || 'none');

  const logoAtts    = getLogoAttachment();
  const photoAtts   = getEmpPhotoAttachment(emp.photo_url);
  const htmlWelcome = await buildWelcomeEmailHtml(emp);

  const mailOptions = {
    from:        FROM,
    to:          employeeEmails.join(', '),
    subject:     `Welcome to Mindteck, ${firstName}! — Your IT Access Details`,
    html:        htmlWelcome,
    attachments: [...logoAtts, ...photoAtts],
  };
  if (ccList.length > 0) mailOptions.cc = ccList.join(', ');

  await transporter.sendMail(mailOptions);
  console.log(`✅ Welcome email sent to: ${employeeEmails.join(', ')}${ccList.length ? ` | CC: ${ccList.join(', ')}` : ''}`);
};

// ══════════════════════════════════════════════════════════════════════════════
// SEND PASSWORD EMAIL
// → Sent ONLY to: Employee + sysadmin. CC list is NEVER included here.
// ══════════════════════════════════════════════════════════════════════════════
const sendPasswordEmail = async (emp) => {
  const { company_email, personal_email, company_email_password, emp_name } = emp;

  if (!company_email_password) {
    console.log(`⚠️ No password set for ${emp_name}, skipping password email`);
    return;
  }

  const employeeEmail = company_email || personal_email;
  if (!employeeEmail) {
    console.log(`⚠️ No email address found for ${emp_name}, skipping password email`);
    return;
  }

  const SYSADMIN = 'sysadmin@mindteck.com';
  const toEmail  = employeeEmail;
  const ccEmail  = toEmail.toLowerCase() !== SYSADMIN.toLowerCase() ? SYSADMIN : null;

  const logoAtts     = getLogoAttachment();
  const photoAtts    = getEmpPhotoAttachment(emp.photo_url);
  const htmlPassword = await buildPasswordEmailHtml(emp);

  const mailOptions = {
    from:        FROM,
    to:          toEmail,
    subject:     `Confidential: Your Mindteck Login Password — ${emp_name}`,
    html:        htmlPassword,
    attachments: [...logoAtts, ...photoAtts],
  };
  if (ccEmail) mailOptions.cc = ccEmail;

  await transporter.sendMail(mailOptions);
  console.log(`✅ Password email sent to: ${toEmail}${ccEmail ? ` | CC: ${ccEmail}` : ''}`);
};

// ══════════════════════════════════════════════════════════════════════════════
// SEND EXIT EMAIL
// ══════════════════════════════════════════════════════════════════════════════
const sendExitEmail = async (emp, deletedBy, checklist = {}, extraCc = []) => {
  const {
    emp_id, emp_name, designation, service_line, company_email, personal_email,
    location, reporting_manager, doj, photo_url,
  } = emp;

  const logoAtts  = getLogoAttachment();
  const photoAtts = getEmpPhotoAttachment(photo_url);
  const hasLogo   = logoAtts.length > 0;

  const SYSADMIN = 'sysadmin@mindteck.com';
  let toList = [];
  let ccList = [];

  if (HR_EMAIL && HR_EMAIL.trim()) {
    toList = [HR_EMAIL.trim()];
    if (HR_EMAIL.trim().toLowerCase() !== SYSADMIN.toLowerCase()) {
      ccList = [SYSADMIN];
    }
  } else {
    toList = [SYSADMIN];
    console.log(`ℹ️ No HR_EMAIL configured — exit email sent only to sysadmin`);
  }

  const allRecipients = [...toList, ...ccList].map(e => e.toLowerCase());
  for (const addr of extraCc) {
    if (addr && !allRecipients.includes(addr.toLowerCase())) {
      ccList.push(addr);
      allRecipients.push(addr.toLowerCase());
    }
  }

  console.log(`📧 Exit email TO: ${toList.join(', ')} | CC: ${ccList.join(', ') || 'none'}`);

  const deletedDate  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dojFormatted = doj
    ? new Date(doj).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  const laptopStatusKey = checklist.laptop_status || '';
  const laptopInfo      = LAPTOP_STATUS_MAP[laptopStatusKey] || null;

  const laptopStatusRow = laptopInfo
    ? `<tr><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr valign="middle">
          <td width="26" height="26" align="center" valign="middle"
            style="width:26px;height:26px;background-color:${laptopInfo.iconBg};border-radius:4px;border:1px solid ${laptopInfo.badgeBorder};font-size:14px;font-family:Arial,sans-serif;">
            ${laptopInfo.icon}</td>
          <td style="padding-left:10px;font-size:12px;color:${laptopInfo.iconColor};font-weight:600;font-family:Arial,sans-serif;">
            Laptop &amp; Hardware &mdash; ${laptopInfo.label}</td>
          <td align="right" style="white-space:nowrap;">
            <table cellpadding="0" cellspacing="0" border="0" align="right"><tr>
              <td style="background-color:${laptopInfo.badgeBg};color:${laptopInfo.badgeText};border:1px solid ${laptopInfo.badgeBorder};border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;font-family:Arial,sans-serif;">RECORDED</td>
            </tr></table>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:6px 14px 10px;border-bottom:1px solid #f1f5f9;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td style="background-color:${laptopInfo.iconBg};border:1px solid ${laptopInfo.badgeBorder};border-radius:6px;padding:8px 12px;font-size:11px;color:${laptopInfo.iconColor};font-family:Arial,sans-serif;line-height:1.6;">
            &#128231; <strong>Asset note:</strong>&nbsp;${laptopInfo.emailText}
          </td>
        </tr></table>
      </td></tr>`
    : `<tr><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr valign="middle">
          <td width="26" height="26" align="center" valign="middle"
            style="width:26px;height:26px;background-color:#f3f4f6;border-radius:4px;border:1px solid #d1d5db;font-size:14px;font-family:Arial,sans-serif;">&#9675;</td>
          <td style="padding-left:10px;font-size:12px;color:#6b7280;font-family:Arial,sans-serif;">
            Laptop &amp; Hardware &mdash; <em>Status not recorded</em></td>
          <td align="right">
            <table cellpadding="0" cellspacing="0" border="0" align="right"><tr>
              <td style="background-color:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;font-family:Arial,sans-serif;">PENDING</td>
            </tr></table>
          </td>
        </tr></table>
      </td></tr>`;

  const checklistItems = [
    { key: 'email_deactivated', label: 'Email account &amp; portal access deactivated' },
    { key: 'licenses_revoked',  label: 'Software licenses revoked and reassigned' },
    { key: 'vpn_revoked',       label: 'VPN and remote access credentials revoked' },
    { key: 'ad_removed',        label: 'Removed from Active Directory / Azure AD' },
  ];

  const renderChecklist = checklistItems.map(item => {
    const done = checklist[item.key] === true || checklist[item.key] === 'true';
    return `<tr><td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-family:Arial,sans-serif;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr valign="middle">
        <td width="26" height="26" align="center" valign="middle"
          style="width:26px;height:26px;background-color:${done ? '#dcfce7' : '#f3f4f6'};border-radius:4px;border:1px solid ${done ? '#86efac' : '#d1d5db'};font-size:14px;font-family:Arial,sans-serif;">
          ${done ? '&#10003;' : '&#9675;'}</td>
        <td style="padding-left:10px;font-size:12px;color:${done ? '#166534' : '#6b7280'};font-weight:${done ? '600' : '400'};font-family:Arial,sans-serif;">
          ${item.label}</td>
        <td align="right" style="white-space:nowrap;">
          <table cellpadding="0" cellspacing="0" border="0" align="right"><tr>
            <td style="background-color:${done ? '#dcfce7' : '#fef3c7'};color:${done ? '#166534' : '#92400e'};border:1px solid ${done ? '#86efac' : '#fcd34d'};border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;font-family:Arial,sans-serif;">
              ${done ? 'DONE' : 'PENDING'}</td>
          </tr></table>
        </td>
      </tr></table>
    </td></tr>`;
  }).join('');

  const adminNotes = checklist.notes
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#fffbeb;border:1px solid #fcd34d;">
        <tr><td style="padding:12px 16px;">
          <div style="font-size:12px;font-weight:700;color:#92400e;font-family:Arial,sans-serif;margin-bottom:4px;">&#128203; Admin Notes:</div>
          <div style="font-size:12px;color:#92400e;font-family:Arial,sans-serif;line-height:1.6;">${checklist.notes}</div>
        </td></tr>
      </table>`
    : '';

  const photoHtml = empPhotoBlock(photo_url, emp_name, 56);

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Employee Exit Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
<tr><td align="center" style="padding:24px 16px;">
  <table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background-color:#ffffff;">

    <!-- Logo bar -->
    <tr>
      <td style="background-color:#ffffff;border-bottom:3px solid #1B5E3F;padding:16px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
          <td valign="middle">
            ${logoBlock(hasLogo)}
          </td>
          <td align="right" valign="middle">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="background-color:#fee2e2;border:1px solid #fca5a5;padding:5px 12px;" align="center">
                <span style="font-size:11px;font-weight:700;color:#991b1b;font-family:Arial,sans-serif;letter-spacing:0.5px;">EXIT NOTIFICATION</span>
              </td>
            </tr></table>
          </td>
        </tr></table>
      </td>
    </tr>

    <!-- Hero banner -->
    <tr>
      <td style="background-color:#475569;padding:34px 24px 30px;" align="center">
        <div style="font-size:22px;font-weight:800;color:#ffffff;font-family:Arial,sans-serif;margin-bottom:8px;">Employee Exit Notification</div>
        <div style="font-size:13px;color:#cccccc;font-family:Arial,sans-serif;margin-bottom:12px;">
          Automated notification from AssetOps &bull; ${deletedDate}
        </div>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="background-color:#ffffff;padding:24px;">

        <!-- Alert strip -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;background-color:#f8fafc;border:1px solid #cbd5e1;">
          <tr><td style="padding:14px 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr valign="middle">
              <td width="60" valign="middle" style="padding-right:14px;">${photoHtml}</td>
              <td style="font-size:13px;color:#1e293b;font-family:Arial,sans-serif;font-weight:600;" valign="middle">
                Employee <strong style="color:#334155;">${emp_name}</strong> (${emp_id}) has been removed from the system on
                <strong style="color:#334155;">${deletedDate}</strong> by ${deletedBy || 'IT Admin'}.
              </td>
            </tr></table>
          </td></tr>
        </table>

        <!-- Employee details -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border:1px solid #cbd5e1;">
          <tr><td style="background-color:#475569;padding:11px 16px;">
            <span style="font-size:12px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:0.5px;">&#128100; EXITED EMPLOYEE DETAILS</span>
          </td></tr>
          <tr><td style="padding:14px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="20%" style="font-size:12px;color:#64748b;padding:5px 0;font-family:Arial,sans-serif;">Employee ID</td>
                <td width="30%" style="font-size:12px;font-weight:700;color:#475569;padding:5px 0;font-family:Arial,sans-serif;">${emp_id}</td>
                <td width="20%" style="font-size:12px;color:#64748b;padding:5px 0;padding-left:20px;font-family:Arial,sans-serif;">Full Name</td>
                <td width="30%" style="font-size:12px;font-weight:700;color:#0f172a;padding:5px 0;font-family:Arial,sans-serif;">${emp_name}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#64748b;padding:5px 0;font-family:Arial,sans-serif;">Designation</td>
                <td style="font-size:12px;font-weight:600;color:#0f172a;padding:5px 0;font-family:Arial,sans-serif;">${designation || 'N/A'}</td>
                <td style="font-size:12px;color:#64748b;padding:5px 0;padding-left:20px;font-family:Arial,sans-serif;">Service Line</td>
                <td style="font-size:12px;font-weight:600;color:#0f172a;padding:5px 0;font-family:Arial,sans-serif;">${service_line || 'N/A'}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#64748b;padding:5px 0;font-family:Arial,sans-serif;">Location</td>
                <td style="font-size:12px;font-weight:600;color:#0f172a;padding:5px 0;font-family:Arial,sans-serif;">${location || 'N/A'}</td>
                <td style="font-size:12px;color:#64748b;padding:5px 0;padding-left:20px;font-family:Arial,sans-serif;">Company Email</td>
                <td style="font-size:12px;font-weight:600;color:#0f172a;padding:5px 0;font-family:Arial,sans-serif;">${company_email || 'N/A'}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#64748b;padding:5px 0;font-family:Arial,sans-serif;">Exit Date</td>
                <td style="font-size:12px;font-weight:700;color:#475569;padding:5px 0;font-family:Arial,sans-serif;">${deletedDate}</td>
                <td style="font-size:12px;color:#64748b;padding:5px 0;padding-left:20px;font-family:Arial,sans-serif;">Processed By</td>
                <td style="font-size:12px;font-weight:600;color:#0f172a;padding:5px 0;font-family:Arial,sans-serif;">${deletedBy || 'IT Admin'}</td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- Exit Checklist -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border:1px solid #cbd5e1;">
          <tr><td style="background-color:#475569;padding:11px 16px;">
            <span style="font-size:12px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:0.5px;">&#128203; EXIT CHECKLIST &mdash; IT ACCESS</span>
          </td></tr>
          ${renderChecklist}
        </table>

        <!-- Laptop / Asset Status -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border:1px solid #e2e8f0;">
          <tr><td style="background-color:#64748b;padding:11px 16px;">
            <span style="font-size:12px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:0.5px;">&#128187; ASSET RECOVERY &mdash; LAPTOP STATUS</span>
          </td></tr>
          ${laptopStatusRow}
        </table>

        ${adminNotes}

        <!-- Footer note -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#f8fafc;border:1px solid #cbd5e1;">
          <tr><td style="padding:12px 16px;font-size:12px;color:#1e293b;font-family:Arial,sans-serif;">
            This notification was generated automatically by <strong style="color:#334155;">AssetOps</strong>.
            For questions: <a href="mailto:sysadmin@mindteck.com" style="color:#475569;font-weight:600;text-decoration:none;">sysadmin@mindteck.com</a>
          </td></tr>
        </table>

      </td>
    </tr>

    <!-- Footer bar -->
    <tr>
      <td style="background-color:#334155;padding:12px 20px;" align="center">
        <div style="font-size:11px;color:#aabbcc;font-family:Arial,sans-serif;line-height:1.8;">
          &copy; ${new Date().getFullYear()} Mindteck IT Team &bull; AssetOps System &mdash; Internal Use Only
        </div>
      </td>
    </tr>

  </table>
</td></tr></table>
</body>
</html>`;

  const mailOptions = {
    from:        FROM,
    to:          toList.join(', '),
    subject:     `EXIT Notification: ${emp_name} (${emp_id}) — ${deletedDate}`,
    html,
    attachments: [...logoAtts, ...photoAtts],
  };
  if (ccList.length > 0) mailOptions.cc = ccList.join(', ');

  await transporter.sendMail(mailOptions);
  console.log(`✅ Exit notification sent for ${emp_name} to ${toList.join(', ')}`);
};

// ══════════════════════════════════════════════════════════════════════════════
// LOCATION-GROUP FILTER HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const applyCreatorFilter = (conditions, params, idx, user) => {
  if (isSuperAdmin(user)) return idx;

  const locs = getUserLocations(user);
  if (!locs || locs.length === 0) {
    conditions.push('1 = 0');
    return idx;
  }

  conditions.push(`
    created_by_admin_id IN (
      SELECT id FROM users
      WHERE managed_location = ANY($${idx}::text[])
         OR managed_locations LIKE ANY(
              SELECT '%' || unnest($${idx}::text[]) || '%'
            )
    )
  `);
  params.push(locs);
  return idx + 1;
};

const buildCreatorClause = (user, startIdx) => {
  if (isSuperAdmin(user)) return { clause: '', clauseParams: [] };

  const locs = getUserLocations(user);
  if (!locs || locs.length === 0) {
    return { clause: 'AND 1 = 0', clauseParams: [] };
  }

  return {
    clause: `
      AND created_by_admin_id IN (
        SELECT id FROM users
        WHERE managed_location = ANY($${startIdx}::text[])
           OR managed_locations LIKE ANY(
                SELECT '%' || unnest($${startIdx}::text[]) || '%'
              )
      )
    `,
    clauseParams: [locs],
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/employees
// ══════════════════════════════════════════════════════════════════════════════
exports.getEmployees = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 100 } = req.query;
  const offset = (page - 1) * limit;
  const params = [], conditions = ['deleted_at IS NULL'];
  let idx = 1;
  if (status && status !== 'All') { conditions.push(`status = $${idx++}`); params.push(status); }
  if (search) {
    conditions.push(`(emp_id ILIKE $${idx} OR emp_name ILIKE $${idx} OR company_email ILIKE $${idx} OR designation ILIKE $${idx} OR service_line ILIKE $${idx} OR client ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  idx = applyCreatorFilter(conditions, params, idx, req.user);

  const where    = `WHERE ${conditions.join(' AND ')}`;
  const countRes = await query(`SELECT COUNT(*) FROM employees ${where}`, params);
  const total    = Number(countRes.rows[0].count);
  const result   = await query(
    `SELECT id, emp_id, emp_name, doj, level, designation, location,
      mobile_no, service_line, client, reporting_manager,
      suggested_email, personal_email, blood_group, dob,
      password_hint, company_email, photo_url, status, notes, cc_emails, portal_url,
      TO_CHAR(doj, 'YYYY-MM-DD') AS doj_fmt,
      TO_CHAR(dob, 'YYYY-MM-DD') AS dob_fmt,
      created_at
    FROM employees ${where}
    ORDER BY emp_name ASC
    LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );
  res.json({ success: true, count: result.rows.length, total, data: result.rows });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/employees/deleted
// ══════════════════════════════════════════════════════════════════════════════
exports.getDeletedEmployees = asyncHandler(async (req, res) => {
  const params = [];
  let idx = 1;
  const conditions = ['deleted_at IS NOT NULL'];

  idx = applyCreatorFilter(conditions, params, idx, req.user);

  const where = `WHERE ${conditions.join(' AND ')}`;

  const result = await query(
    `SELECT id, emp_id, emp_name, designation, company_email, personal_email,
      service_line, location, level, reporting_manager, mobile_no,
      blood_group, cc_emails, portal_url, doj, dob, notes, photo_url,
      TO_CHAR(doj,'YYYY-MM-DD') AS doj_fmt,
      TO_CHAR(dob,'YYYY-MM-DD') AS dob_fmt,
      TO_CHAR(deleted_at,'YYYY-MM-DD HH24:MI') AS deleted_at_fmt, status,
      exit_checklist,
      exit_checklist->>'laptop_status' AS laptop_status
    FROM employees ${where} ORDER BY deleted_at DESC`,
    params
  );
  res.json({ success: true, data: result.rows });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/employees/:id
// ══════════════════════════════════════════════════════════════════════════════
exports.getEmployee = asyncHandler(async (req, res) => {
  const { clause, clauseParams } = buildCreatorClause(req.user, 2);

  const result = await query(
    `SELECT *, TO_CHAR(doj,'YYYY-MM-DD') AS doj_fmt, TO_CHAR(dob,'YYYY-MM-DD') AS dob_fmt
    FROM employees WHERE emp_id = $1 AND deleted_at IS NULL ${clause}`,
    [req.params.id, ...clauseParams]
  );
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: `Employee ${req.params.id} not found` });
  res.json({ success: true, data: result.rows[0] });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/employees
// ══════════════════════════════════════════════════════════════════════════════
exports.createEmployee = asyncHandler(async (req, res) => {
  const {
    emp_id, emp_name, doj, level, designation, location,
    mobile_no, service_line, client, reporting_manager,
    suggested_email, personal_email, blood_group, dob,
    password_hint, company_email, company_email_password,
    photo_url, status, notes, cc_emails, portal_url,
  } = req.body;

  if (!emp_id || !emp_name)
    return res.status(400).json({ success: false, message: 'emp_id and emp_name are required' });

  const dup = await query(`SELECT emp_id FROM employees WHERE emp_id = $1`, [emp_id]);
  if (dup.rows.length)
    return res.status(409).json({ success: false, message: `Employee ID "${emp_id}" already exists` });

  const columnsRes      = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' ORDER BY ordinal_position`);
  const existingColumns = columnsRes.rows.map(c => c.column_name);

  const allFields = {
    emp_id, emp_name, doj: doj || null, level: level || null, designation: designation || null,
    location: location || null, mobile_no: mobile_no || null, service_line: service_line || null,
    client: client || null, reporting_manager: reporting_manager || null,
    suggested_email: suggested_email || null, personal_email: personal_email || null,
    blood_group: blood_group || null, dob: dob || null, password_hint: password_hint || null,
    company_email: company_email || null, company_email_password: company_email_password || null,
    photo_url: photo_url || null, status: status || 'Active', notes: notes || null,
    cc_emails: cc_emails || null, portal_url: portal_url || null,
    created_by_admin_id: req.user?.id || null,
  };

  const insertColumns = [], insertValues = [], placeholders = [];
  let paramCounter = 1;
  for (const [key, value] of Object.entries(allFields)) {
    if (existingColumns.includes(key)) {
      insertColumns.push(key); insertValues.push(value); placeholders.push(`$${paramCounter++}`);
    }
  }

  const result = await query(
    `INSERT INTO employees (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    insertValues
  );
  const newEmp = result.rows[0];
  await audit('EMPLOYEE_ADDED', `Employee ${emp_id} (${emp_name}) added`, req.user?.name || 'Admin');

  const empData = { ...req.body, doj: doj || null };

  if (company_email || personal_email) {
    sendWelcomeEmail(empData).catch(err => console.error('Welcome email failed:', err.message));
    if (company_email_password) {
      sendPasswordEmail(empData).catch(err => console.error('Password email failed:', err.message));
    }
  }

  res.status(201).json({ success: true, data: newEmp });
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/employees/:id
// ══════════════════════════════════════════════════════════════════════════════
exports.updateEmployee = asyncHandler(async (req, res) => {
  const empId   = req.params.id;
  const allowed = [
    'emp_name', 'doj', 'level', 'designation', 'location', 'mobile_no', 'service_line',
    'client', 'reporting_manager', 'suggested_email', 'personal_email', 'blood_group',
    'dob', 'password_hint', 'company_email', 'company_email_password', 'photo_url',
    'status', 'notes', 'cc_emails', 'portal_url',
  ];
  const updates = [], params = [];
  let idx = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = $${idx++}`);
      params.push(req.body[key] === '' ? null : req.body[key]);
    }
  }
  if (!updates.length)
    return res.status(400).json({ success: false, message: 'No valid fields to update' });

  let whereClause = `emp_id = $${idx} AND deleted_at IS NULL`;
  params.push(empId); idx++;

  if (!isSuperAdmin(req.user)) {
    const locs = getUserLocations(req.user);
    if (!locs || locs.length === 0) {
      return res.status(403).json({ success: false, message: 'No managed location assigned to your account' });
    }
    whereClause += `
      AND created_by_admin_id IN (
        SELECT id FROM users
        WHERE managed_location = ANY($${idx}::text[])
           OR managed_locations LIKE ANY(SELECT '%' || unnest($${idx}::text[]) || '%')
      )`;
    params.push(locs); idx++;
  }

  const result = await query(
    `UPDATE employees SET ${updates.join(', ')} WHERE ${whereClause} RETURNING *`,
    params
  );
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: `Employee ${empId} not found (or outside your location group)` });
  await audit('EMPLOYEE_UPDATED', `Employee ${empId} updated`, req.user?.name || 'Admin');
  res.json({ success: true, data: result.rows[0] });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/employees/:id
// ══════════════════════════════════════════════════════════════════════════════
exports.deleteEmployee = asyncHandler(async (req, res) => {
  const empId     = req.params.id;
  const checklist = req.body?.checklist || {};

  let scopeClause = '';
  let scopeParams = [empId];
  let paramIdx    = 2;

  if (!isSuperAdmin(req.user)) {
    const locs = getUserLocations(req.user);
    if (!locs || locs.length === 0) {
      return res.status(403).json({ success: false, message: 'No managed location assigned to your account' });
    }
    scopeClause = `
      AND created_by_admin_id IN (
        SELECT id FROM users
        WHERE managed_location = ANY($${paramIdx}::text[])
           OR managed_locations LIKE ANY(SELECT '%' || unnest($${paramIdx}::text[]) || '%')
      )`;
    scopeParams.push(locs); paramIdx++;
  }

  const empRes = await query(
    `SELECT emp_name, designation, service_line, company_email, personal_email,
      location, reporting_manager, doj, cc_emails, mobile_no, level, photo_url
    FROM employees WHERE emp_id = $1 AND deleted_at IS NULL ${scopeClause}`,
    scopeParams
  );
  if (!empRes.rows.length)
    return res.status(404).json({ success: false, message: `Employee ${empId} not found (or outside your location group)` });

  const empData   = { emp_id: empId, ...empRes.rows[0] };
  const deletedBy = req.user?.name || 'IT Admin';

  await query(
    `UPDATE employees SET deleted_at = NOW(), status = 'Inactive', exit_checklist = $2 WHERE emp_id = $1`,
    [empId, JSON.stringify(checklist)]
  );
  await query(`DELETE FROM license_assignments WHERE emp_id = $1`, [empId]).catch(() => {});
  await audit('EMPLOYEE_DELETED', `Employee ${empId} (${empData.emp_name}) deleted`, deletedBy);

  const rawCc = checklist.cc_emails_override || empData.cc_emails || '';
  const extraCc = rawCc
    .split(',')
    .map(e => e.trim())
    .filter(e =>
      e &&
      e.toLowerCase() !== (empData.company_email || '').toLowerCase() &&
      e.toLowerCase() !== (empData.personal_email || '').toLowerCase()
    );

  sendExitEmail(empData, deletedBy, checklist, extraCc).catch(err => console.error('Exit email failed:', err.message));
  res.json({ success: true, message: `${empId} deleted` });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUPPORT CONTACTS CRUD
// ══════════════════════════════════════════════════════════════════════════════

exports.getSupportContactsList = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, phone, email, role, sort_order, is_active FROM support_contacts WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC`
  );
  res.json({ success: true, data: result.rows });
});

exports.getAllSupportContacts = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, phone, email, role, sort_order, is_active FROM support_contacts ORDER BY sort_order ASC, id ASC`
  );
  res.json({ success: true, data: result.rows });
});

exports.createSupportContact = asyncHandler(async (req, res) => {
  const { name, phone, email, role, sort_order } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
  const result = await query(
    `INSERT INTO support_contacts (name, phone, email, role, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, phone || null, email || null, role || 'IT Support', sort_order || 0]
  );
  await audit('SUPPORT_CONTACT_ADDED', `Support contact ${name} added`, req.user?.name || 'Admin');
  res.status(201).json({ success: true, data: result.rows[0] });
});

exports.updateSupportContact = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, role, sort_order, is_active } = req.body;
  const result = await query(
    `UPDATE support_contacts SET name=$1, phone=$2, email=$3, role=$4, sort_order=$5, is_active=$6 WHERE id=$7 RETURNING *`,
    [name, phone || null, email || null, role || 'IT Support', sort_order || 0, is_active !== false, id]
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'Contact not found' });
  await audit('SUPPORT_CONTACT_UPDATED', `Support contact ${name} updated`, req.user?.name || 'Admin');
  res.json({ success: true, data: result.rows[0] });
});

exports.deleteSupportContact = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query(`DELETE FROM support_contacts WHERE id=$1`, [id]);
  await audit('SUPPORT_CONTACT_DELETED', `Support contact ${id} deleted`, req.user?.name || 'Admin');
  res.json({ success: true, message: 'Contact deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/employees/:id/laptop-status  (deleted employee record)
// ══════════════════════════════════════════════════════════════════════════════
exports.updateDeletedLaptopStatus = asyncHandler(async (req, res) => {
  const { laptop_status } = req.body;
  if (!laptop_status)
    return res.status(400).json({ success: false, message: 'laptop_status is required' });

  const param     = req.params.id;
  const isNumeric = /^\d+$/.test(param);

  let whereClause = isNumeric
    ? 'id = $2 AND deleted_at IS NOT NULL'
    : 'emp_id = $2 AND deleted_at IS NOT NULL';

  const params = [
    JSON.stringify({ laptop_status }),
    isNumeric ? Number(param) : param,
  ];
  let paramIdx = 3;

  if (!isSuperAdmin(req.user)) {
    const locs = getUserLocations(req.user);
    if (!locs || locs.length === 0)
      return res.status(403).json({ success: false, message: 'No managed location assigned' });

    whereClause += `
      AND created_by_admin_id IN (
        SELECT id FROM users
        WHERE managed_location = ANY($${paramIdx}::text[])
           OR managed_locations LIKE ANY(SELECT '%' || unnest($${paramIdx}::text[]) || '%')
      )`;
    params.push(locs);
    paramIdx++;
  }

  const result = await query(
    `UPDATE employees
     SET exit_checklist = COALESCE(exit_checklist, '{}'::jsonb) || $1::jsonb
     WHERE ${whereClause}
     RETURNING emp_id, exit_checklist->>'laptop_status' AS laptop_status`,
    params
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Employee not found' });

  await audit(
    'LAPTOP_STATUS_UPDATED',
    `Laptop status for ${param} updated to ${laptop_status}`,
    req.user?.name || 'Admin'
  );

  res.json({ success: true, data: result.rows[0] });
});