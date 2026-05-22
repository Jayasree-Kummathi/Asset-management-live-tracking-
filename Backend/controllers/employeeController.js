'use strict';
// Backend/controllers/employeeController.js

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const nodemailer   = require('nodemailer');
const fs           = require('fs');
const path         = require('path');

const FROM     = process.env.MAIL_FROM || `Mindteck IT Team <${process.env.MAIL_USER}>`;
const HR_EMAIL = process.env.HR_EMAIL;
const HELPDESK_URL = 'https://helpdesk.mindteck.com/open.php';

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
];
    for (const [col, def] of toAdd) {
      if (!columnNames.includes(col)) {
        await query(`ALTER TABLE employees ADD COLUMN ${col} ${def};`);
        console.log(`✅ Added ${col} column`);
      }
    }
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
          ('Hari Patnaik',  '9916675460', 'sysadmin@mindteck.us',  'IT Head',    1),
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
      { name: 'Hari Patnaik', phone: '9916675460', email: 'sysadmin@mindteck.us', role: 'IT Head' },
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
  const initial = (empName || 'M')[0].toUpperCase();
  if (photoUrl && photoUrl.trim()) {
    const url = photoUrl.trim();
    const src = url.startsWith('data:image') ? 'cid:emp_photo' : url;
    return `<img src="${src}" alt="${empName}" width="${size}" height="${size}"
      style="width:${size}px;height:${size}px;border-radius:${size/2}px;border:3px solid #ffffff;display:block;">`;
  }
  return `<table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
    <tr><td width="${size}" height="${size}" align="center" valign="middle"
      style="width:${size}px;height:${size}px;background-color:#475569;border-radius:${size/2}px;
      border:3px solid #ffffff;font-size:${Math.round(size*0.38)}px;font-weight:900;
      color:#ffffff;font-family:Arial,sans-serif;">${initial}</td></tr>
  </table>`;
};

// ── Security tips HTML ────────────────────────────────────────────────────────
const buildSecurityTipsHtml = () => {
  const tips = [
    { icon: '&#128274;', text: 'Lock your computer when stepping away' },
    { icon: '&#128273;', text: 'Use strong, hard-to-guess passwords' },
    { icon: '&#128187;', text: 'Never install unauthorised software without IT approval' },
    { icon: '&#9993;',   text: 'Be cautious of suspicious emails &amp; links &mdash; report to IT' },
    { icon: '&#11015;',  text: 'Do not download attachments from untrusted sources' },
    { icon: '&#128737;', text: 'Do not store personal software or license keys on work laptops' },
  ];

  const rows = [];
  for (let i = 0; i < tips.length; i += 3) {
    const trio = tips.slice(i, i + 3);

    const cells = trio.map(t => `
      <td width="33%" valign="top" style="padding:10px 6px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr valign="middle">
            <td width="44" height="44" align="center" valign="middle"
              style="width:44px;height:44px;min-width:44px;background-color:#e8f5ee;
              border-radius:22px;font-size:20px;line-height:44px;
              font-family:Arial,sans-serif;text-align:center;">
              ${t.icon}
            </td>
            <td style="padding-left:8px;font-size:11px;color:#374151;
              font-family:Arial,sans-serif;line-height:1.45;vertical-align:middle;">
              ${t.text}
            </td>
          </tr>
        </table>
      </td>`).join('');

    let padded = cells;
    for (let j = trio.length; j < 3; j++) padded += '<td width="33%">&nbsp;</td>';
    rows.push(`<tr valign="top">${padded}</tr>`);
  }
  return rows.join('');
};

// ── Support contacts HTML ─────────────────────────────────────────────────────
const buildSupportContactsHtml = (contacts) =>
  contacts.slice(0, 4).map(c => `
    <tr><td style="padding:6px 0;border-bottom:1px solid #e8edf2;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr valign="middle">
        <td width="32" height="32" align="center" valign="middle"
          style="width:32px;height:32px;background-color:#e8f5ee;border-radius:16px;font-size:16px;font-family:Arial,sans-serif;">&#128100;</td>
        <td style="padding-left:10px;" valign="middle">
          <div style="font-size:12px;font-weight:700;color:#1a202c;font-family:Arial,sans-serif;">${c.name}</div>
          <div style="font-size:11px;color:#718096;font-family:Arial,sans-serif;">${c.role || 'IT Support'}</div>
        </td>
        <td align="right" style="padding-right:4px;" valign="middle">
          <div style="font-size:12px;font-weight:600;color:#1B5E3F;font-family:Arial,sans-serif;">${c.phone || ''}</div>
        </td>
      </tr></table>
    </td></tr>`).join('');

// ── EXIT DOOR ICON — FIX: Running man on RIGHT side (exiting away from door) ──
// Door is on the LEFT, running man is on the RIGHT — he is clearly leaving/exiting
const buildExitDoorIconHtml = () => `
<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 16px auto;">
<tr><td align="center" valign="middle">

  <!-- EXIT sign label -->
  <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom:8px;">
    <tr>
      <td width="64" height="18" align="center" valign="middle"
        style="width:64px;height:18px;background-color:#ffffff;border-radius:3px;
        font-size:10px;font-weight:900;color:#64748b;font-family:Arial,sans-serif;
        letter-spacing:3px;text-align:center;line-height:18px;">
        EXIT
      </td>
    </tr>
  </table>

  <!-- Door frame (LEFT) + Running man (RIGHT) side by side -->
  <!-- Man is on the RIGHT running away = he is exiting the building -->
  <table cellpadding="0" cellspacing="0" border="0" align="center">
    <tr valign="bottom">

      <!-- Door frame: left post | interior | right post — appears on LEFT -->
      <td valign="bottom">
        <table cellpadding="0" cellspacing="0" border="0">
          <!-- Top bar -->
          <tr>
            <td colspan="3" height="5"
              style="height:5px;background-color:#ffffff;border-radius:2px 2px 0 0;font-size:1px;">&nbsp;</td>
          </tr>
          <!-- Posts + interior -->
          <tr valign="top">
            <td width="5" height="48"
              style="width:5px;height:48px;background-color:#ffffff;font-size:1px;">&nbsp;</td>
            <td width="32" height="48"
              style="width:32px;height:48px;background-color:rgba(255,255,255,0.12);font-size:1px;">&nbsp;</td>
            <td width="5" height="48"
              style="width:5px;height:48px;background-color:#ffffff;font-size:1px;">&nbsp;</td>
          </tr>
          <!-- Floor bar -->
          <tr>
            <td colspan="3" height="5"
              style="height:5px;background-color:#ffffff;border-radius:0 0 2px 2px;font-size:1px;">&nbsp;</td>
          </tr>
        </table>
      </td>

      <!-- Running man: NOW on the RIGHT side — running away from/out of the door ✅ -->
      <td valign="bottom" align="center"
        style="font-size:38px;font-family:Arial,sans-serif;line-height:1;
        padding-left:4px;padding-bottom:6px;color:#ffffff;">
        &#x1F3C3;
      </td>

    </tr>
  </table>

</td></tr>
</table>`;


// ══════════════════════════════════════════════════════════════════════════════
// BUILD WELCOME EMAIL HTML
// ══════════════════════════════════════════════════════════════════════════════
const buildWelcomeEmailHtml = async (emp, showPassword) => {
  const {
    emp_name, emp_id, company_email, personal_email,
    designation, service_line, location, doj,
    reporting_manager, portal_url, photo_url,
    company_email_password,
  } = emp;

  const firstName = (emp_name || '').split(' ')[0] || 'Employee';

  const loginUrl = (portal_url && portal_url.trim()) ? portal_url.trim() : HELPDESK_URL;
  const logoAtts = getLogoAttachment();
  const hasLogo  = logoAtts.length > 0;

  const dojFormatted = doj
    ? new Date(doj).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const dojShort = doj
    ? new Date(doj).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const supportContacts     = await getSupportContacts();
  const primaryContact      = supportContacts.find(c => c.email) || supportContacts[0];
  const supportEmail        = primaryContact?.email || 'sysadmin@mindteck.us';
  const supportContactsHtml = buildSupportContactsHtml(supportContacts);
  const securityTipsHtml    = buildSecurityTipsHtml();

  const passwordBlock = showPassword && company_email_password
    ? `<tr>
        <td colspan="2" style="padding:0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a3d20;border-top:2px solid #065f33;">
            <tr><td style="padding:14px 16px 12px;">
              <div style="font-size:10px;font-weight:800;color:#6ee7a7;font-family:Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">
                &#128274;&nbsp;&nbsp;YOUR PASSWORD
              </div>
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background-color:#ffffff;border-radius:6px;padding:12px 24px;">
                  <span style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:900;color:#0a3d20;letter-spacing:3px;">
                    ${company_email_password}
                  </span>
                </td>
              </tr></table>
              <div style="margin-top:10px;font-size:11px;color:#a7f3d0;font-family:Arial,sans-serif;">
                &#9888;&nbsp; Change this immediately on first login
              </div>
            </td></tr>
          </table>
        </td>
      </tr>`
    : showPassword === false && company_email_password
      ? `<tr>
          <td colspan="2" style="padding:10px 16px;background-color:#fef9c3;border-top:1px solid #fde047;">
            <table cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
              <td style="font-size:16px;font-family:Arial,sans-serif;">&#128274;</td>
              <td style="padding-left:10px;font-size:12px;color:#92400e;font-family:Arial,sans-serif;">
                <strong>Password:</strong> Sent confidentially to the employee only.
              </td>
            </tr></table>
          </td>
        </tr>`
      : '';

  const profileRows = [
    ['Employee ID',       `<strong style="color:#1B5E3F;font-size:12px;">${emp_id}</strong>`],
    ['Full Name',         `<strong style="color:#0f172a;font-size:12px;">${emp_name || 'N/A'}</strong>`],
    ['Designation',       `<span style="color:#0f172a;">${designation || 'N/A'}</span>`],
    ['Service Line',      `<span style="color:#0f172a;">${service_line || 'N/A'}</span>`],
    ['Location',          `<span style="color:#0f172a;">${location || 'N/A'}</span>`],
    ['Reporting Manager', `<span style="color:#0f172a;">${reporting_manager || 'N/A'}</span>`],
    ['Date of Joining',   `<strong style="color:#1B5E3F;font-size:12px;">${dojFormatted}</strong>`],
  ].map(([label, value], i) => `
    <tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f7faf8'};">
      <td style="padding:8px 12px;font-size:11px;color:#6b7280;font-family:Arial,sans-serif;border-bottom:1px solid #edf0f2;width:44%;">${label}</td>
      <td style="padding:8px 12px;font-size:11px;font-family:Arial,sans-serif;border-bottom:1px solid #edf0f2;">${value}</td>
    </tr>`).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Welcome to Mindteck</title>
<!--[if mso]><style type="text/css">table{border-collapse:collapse;}.outlook-fix{width:620px !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6">
<tr><td align="center" style="padding:20px 12px;">
  <table class="outlook-fix" width="620" cellpadding="0" cellspacing="0" border="0"
    style="max-width:620px;width:100%;background-color:#ffffff;border-radius:12px;">

    <!-- HEADER -->
    <tr>
      <td style="padding:18px 24px;background-color:#ffffff;border-bottom:3px solid #1B5E3F;border-radius:12px 12px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
          <td valign="middle">
            ${hasLogo
              ? `<img src="cid:mindteck_logo" alt="Mindteck" height="44" style="display:block;height:44px;border:0;">`
              : `<table cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
                   <td width="40" height="40" align="center" valign="middle"
                     style="width:40px;height:40px;background-color:#1B5E3F;border-radius:20px;font-size:19px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;">M</td>
                   <td style="padding-left:10px;" valign="middle">
                     <div style="font-size:20px;font-weight:900;color:#1B5E3F;font-family:Arial,sans-serif;line-height:1.1;">Mindteck</div>
                     <div style="font-size:9px;color:#888888;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">INFORMATION TECHNOLOGY</div>
                   </td>
                 </tr></table>`}
          </td>
          <td align="right" valign="middle">
            <table cellpadding="0" cellspacing="0" border="0" align="right"><tr>
              <td style="background-color:#1B5E3F;border-radius:8px;padding:8px 16px;" align="right">
                <div style="font-size:12px;color:rgba(255,255,255,0.85);font-family:Arial,sans-serif;">&#128197; ${dojShort}</div>
                <div style="font-size:12px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;margin-top:3px;">${designation || 'Team Member'}</div>
              </td>
            </tr></table>
          </td>
        </tr></table>
      </td>
    </tr>

    <!-- BODY -->
    <tr><td style="padding:28px 28px 8px;">
      <div style="font-size:22px;font-weight:800;color:#1a202c;font-family:Arial,sans-serif;margin-bottom:10px;">
        &#127881; Dear ${firstName},
      </div>
      <div style="font-size:13px;color:#4a5568;line-height:1.75;font-family:Arial,sans-serif;margin-bottom:24px;">
        Welcome to <strong style="color:#1B5E3F;">Mindteck Family</strong>! &#127775; We're happy to have you on board.<br>
        Your IT access has been set up. Here are your credentials and important details.
      </div>

      <!-- Profile + Credentials -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;"><tr valign="top">
        <td width="48%" valign="top" style="padding-right:10px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #d1d5db;border-radius:10px;">
            <tr><td style="padding:11px 14px;background-color:#1B5E3F;border-radius:10px 10px 0 0;border-bottom:1px solid #155a38;">
              <table cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
                <td style="font-size:16px;font-family:Arial,sans-serif;padding-right:8px;">&#128100;</td>
                <td style="font-size:11px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:0.8px;text-transform:uppercase;">Employee Profile</td>
              </tr></table>
            </td></tr>
            ${profileRows}
          </table>
        </td>
        <td width="52%" valign="top" style="padding-left:10px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid #065f33;border-radius:10px;">
            <tr><td colspan="2" style="padding:11px 14px;background-color:#1B5E3F;border-radius:10px 10px 0 0;border-bottom:2px solid #065f33;">
              <table cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
                <td style="font-size:16px;font-family:Arial,sans-serif;padding-right:8px;">&#128274;</td>
                <td style="font-size:11px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:0.8px;text-transform:uppercase;">Login Credentials</td>
              </tr></table>
            </td></tr>
            <tr style="background-color:#ffffff;">
              <td style="padding:9px 12px;font-size:11px;color:#6b7280;font-family:Arial,sans-serif;border-bottom:1px solid #edf0f2;width:38%;">&#127760; Portal URL</td>
              <td style="padding:9px 12px;font-size:11px;border-bottom:1px solid #edf0f2;font-family:Arial,sans-serif;">
                <a href="${loginUrl}" style="color:#2563eb;text-decoration:none;font-weight:600;">${loginUrl}</a>
              </td>
            </tr>
            <tr style="background-color:#f7faf8;">
              <td style="padding:9px 12px;font-size:11px;color:#6b7280;font-family:Arial,sans-serif;border-bottom:1px solid #edf0f2;">&#128100; Username</td>
              <td style="padding:9px 12px;font-size:11px;font-weight:700;color:#0f172a;font-family:'Courier New',Courier,monospace;border-bottom:1px solid #edf0f2;">
                ${company_email || personal_email || 'See IT team'}
              </td>
            </tr>
            ${passwordBlock}
            ${!showPassword || !company_email_password ? `
            <tr><td colspan="2" style="padding:10px 12px;background-color:#fffbeb;border-top:1px solid #fef3c7;">
              <table cellpadding="0" cellspacing="0" border="0"><tr valign="top">
                <td style="font-size:16px;font-family:Arial,sans-serif;width:22px;">&#9888;</td>
                <td style="padding-left:8px;font-size:11px;color:#92400e;font-family:Arial,sans-serif;line-height:1.5;">
                  <strong>Important:</strong> Please change your password immediately on first login.
                </td>
              </tr></table>
            </td></tr>` : ''}
          </table>
        </td>
      </tr></table>

      <!-- IT Security Tips -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:13px 18px;background-color:#f8fafb;border-bottom:1px solid #e2e8f0;border-radius:10px 10px 0 0;">
          <table cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
            <td style="font-size:18px;font-family:Arial,sans-serif;padding-right:8px;">&#128737;</td>
            <td style="font-size:11px;font-weight:700;color:#374151;font-family:Arial,sans-serif;letter-spacing:0.8px;text-transform:uppercase;">IT Security Tips</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 8px 12px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">${securityTipsHtml}</table>
        </td></tr>
      </table>

      <!-- Need Help -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border:1px solid #c6e6d1;border-radius:10px;">
        <tr><td style="padding:13px 18px;background-color:#f0fdf4;border-bottom:1px solid #c6e6d1;border-radius:10px 10px 0 0;">
          <table cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
            <td style="font-size:18px;font-family:Arial,sans-serif;padding-right:8px;">&#127911;</td>
            <td style="font-size:11px;font-weight:700;color:#166534;font-family:Arial,sans-serif;letter-spacing:0.8px;text-transform:uppercase;">Need Help?</td>
          </tr></table>
          <div style="font-size:12px;color:#374151;font-family:Arial,sans-serif;margin-top:4px;">
            For any IT support or assistance, please use our Helpdesk portal or contact the IT team below.
          </div>
        </td></tr>
        <tr><td style="padding:16px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="top">
            <td width="28%" valign="top" style="padding-right:12px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td align="center" style="background-color:#1B5E3F;border-radius:8px;padding:12px 10px;">
                  <a href="${HELPDESK_URL}" style="color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;font-family:Arial,sans-serif;">&#128279; Open Helpdesk Portal</a>
                </td>
              </tr></table>
            </td>
            <td width="30%" valign="top" style="padding:0 12px;border-left:1px solid #e2e8f0;">
              <div style="margin-bottom:10px;">
                <div style="font-size:11px;color:#718096;font-family:Arial,sans-serif;">&#9993; Email</div>
                <div style="font-size:12px;font-weight:600;font-family:Arial,sans-serif;margin-top:2px;">
                  <a href="mailto:${supportEmail}" style="color:#1B5E3F;text-decoration:none;">${supportEmail}</a>
                </div>
              </div>
              <div>
                <div style="font-size:11px;color:#718096;font-family:Arial,sans-serif;">&#128222; Landline</div>
                <div style="font-size:12px;font-weight:600;color:#1a202c;font-family:Arial,sans-serif;margin-top:2px;">41548000 / Ext: 8091, 8092</div>
              </div>
            </td>
            <td width="42%" valign="top" style="padding-left:12px;border-left:1px solid #e2e8f0;">
              <div style="font-size:11px;font-weight:700;color:#374151;font-family:Arial,sans-serif;letter-spacing:0.5px;margin-bottom:6px;">&#128101; Support Contacts</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">${supportContactsHtml}</table>
            </td>
          </tr></table>
        </td></tr>
      </table>

      <!-- Sign-off -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;background-color:#f0fdf4;border:1px solid #c6e6d1;border-radius:10px;">
        <tr><td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
            <td width="56" style="font-size:38px;font-family:Arial,sans-serif;padding-right:16px;">&#128077;</td>
            <td valign="middle">
              <div style="font-size:14px;font-weight:700;color:#1B5E3F;font-family:Arial,sans-serif;margin-bottom:4px;">Wishing you all the very best in your new role! &#127881;</div>
              <div style="font-size:12px;color:#4a5568;font-family:Arial,sans-serif;">We look forward to working with you and growing together. &#127775;</div>
            </td>
            <td width="56" align="right" style="font-size:38px;font-family:Arial,sans-serif;">&#127775;</td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>

    <!-- FOOTER -->
    <tr><td style="background-color:#1B5E3F;padding:14px 24px;border-radius:0 0 12px 12px;" align="center">
      <div style="font-size:11px;color:rgba(255,255,255,0.8);font-family:Arial,sans-serif;line-height:1.8;">
        This is an automated message from <strong style="color:#ffffff;">Mindteck IT Team</strong> &bull; AssetOps System<br>
        &copy; ${new Date().getFullYear()} Mindteck &bull; All rights reserved
      </div>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
};


// ══════════════════════════════════════════════════════════════════════════════
// SEND WELCOME EMAIL
// ══════════════════════════════════════════════════════════════════════════════
const sendWelcomeEmail = async (emp) => {
  const { emp_name, company_email, personal_email, cc_emails } = emp;
  const firstName = (emp_name || '').split(' ')[0] || 'Employee';
  const toList    = [company_email, personal_email].filter(Boolean);
  if (!toList.length) return;

  let ccList = [];
  if (cc_emails) ccList = cc_emails.split(',').map(e => e.trim()).filter(Boolean);

  const logoAtts  = getLogoAttachment();
  const photoAtts = getEmpPhotoAttachment(emp.photo_url);

  const htmlWithPassword = await buildWelcomeEmailHtml(emp, true);
  await transporter.sendMail({
    from: FROM, to: toList.join(', '),
    subject: `Welcome to Mindteck, ${firstName}! — Your IT Access & Credentials`,
    html: htmlWithPassword, attachments: [...logoAtts, ...photoAtts],
  });
  console.log(`✅ Welcome email (with credentials) sent to ${emp_name}: ${toList.join(', ')}`);

  if (ccList.length > 0) {
    const htmlNoPwd = await buildWelcomeEmailHtml(emp, false);
    await transporter.sendMail({
      from: FROM, to: ccList.join(', '),
      subject: `Welcome to Mindteck, ${firstName}! — New Employee Onboarding Notification`,
      html: htmlNoPwd, attachments: [...logoAtts, ...photoAtts],
    });
    console.log(`✅ Welcome notification (without password) sent to CC: ${ccList.join(', ')}`);
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// EXIT EMAIL — GREY/SLATE theme + Running man on RIGHT (exiting) — FIXED
// ══════════════════════════════════════════════════════════════════════════════
const sendExitEmail = async (emp, deletedBy, checklist = {}) => {
  const {
    emp_id,
    emp_name,
    designation,
    service_line,
    company_email,
    personal_email,
    location,
    reporting_manager,
    doj,
    cc_emails,
    photo_url,
  } = emp;

  const logoAtts = getLogoAttachment();
  const photoAtts = getEmpPhotoAttachment(photo_url);

  const ccEmails = (cc_emails || '')
    .split(',')
    .map(e => e.trim())
    .filter(e => e && e !== company_email && e !== personal_email);

  let toList = [];
  let ccList = [];

  if (HR_EMAIL && HR_EMAIL.trim()) {
    toList = [HR_EMAIL.trim()];
    ccList = ccEmails.filter(e => e !== HR_EMAIL.trim());
  } else if (ccEmails.length > 0) {
    toList = [ccEmails[0]];
    ccList = ccEmails.slice(1);
    console.log(`ℹ️ No HR_EMAIL — sending exit email to first CC: ${toList[0]}`);
  } else {
    console.log(`ℹ️ No recipients configured for exit email — skipping for ${emp_name}`);
    return;
  }

  console.log(`📧 Exit email TO: ${toList.join(', ')} | CC: ${ccList.join(', ') || 'none'}`);

  const deletedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dojFormatted = doj
    ? new Date(doj).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  const laptopStatusKey = checklist.laptop_status || '';
  const laptopInfo = LAPTOP_STATUS_MAP[laptopStatusKey] || null;

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
            &#128231; <strong>Asset note for email:</strong>&nbsp;${laptopInfo.emailText}
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
    { key: 'licenses_revoked', label: 'Software licenses revoked and reassigned' },
    { key: 'vpn_revoked', label: 'VPN and remote access credentials revoked' },
    { key: 'ad_removed', label: 'Removed from Active Directory / Azure AD' },
  ];

  const renderChecklist = checklistItems
    .map(item => {
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
    })
    .join('');

  const adminNotes = checklist.notes
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
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
<!--[if mso]><style type="text/css">table{border-collapse:collapse;}.outlook-fix{width:620px !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
<tr><td align="center" style="padding:24px 16px;">
  <table class="outlook-fix" width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;" role="presentation">

    <!-- Logo bar -->
    <tr>
      <td style="background-color:#ffffff;border-radius:12px 12px 0 0;border-bottom:3px solid #cbd5e1;padding:16px 24px;" align="center">
        ${logoAtts.length > 0
          ? `<img src="cid:mindteck_logo" alt="Mindteck" height="44" style="display:block;height:44px;border:0;">`
          : `<table cellpadding="0" cellspacing="0" border="0" align="center" role="presentation"><tr valign="middle">
              <td width="36" height="36" align="center" valign="middle"
                style="width:36px;height:36px;background-color:#475569;border-radius:18px;font-size:17px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;">M</td>
              <td style="padding-left:10px;" valign="middle">
                <div style="font-size:20px;font-weight:900;color:#334155;font-family:Arial,sans-serif;">Mindteck</div>
                <div style="font-size:9px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Information Technology</div>
              </td>
            </tr></table>`}
      </td>
    </tr>

    <!-- Hero banner without icon -->
    <tr>
      <td style="background-color:#475569;padding:34px 24px 30px;" align="center">
        <div style="font-size:22px;font-weight:800;color:#ffffff;font-family:Arial,sans-serif;margin-bottom:8px;letter-spacing:-0.3px;">
          Employee Exit Notification
        </div>
        <div style="font-size:13px;color:rgba(255,255,255,0.80);font-family:Arial,sans-serif;margin-bottom:12px;">
          Automated notification from AssetOps &bull; ${deletedDate}
        </div>
        <div style="width:72px;height:2px;background:#cbd5e1;margin:0 auto;border-radius:2px;"></div>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="background-color:#ffffff;padding:24px;border-radius:0 0 12px 12px;">

        <!-- Alert strip -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;" role="presentation">
          <tr><td style="padding:14px 16px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation"><tr valign="middle">
              <td width="60" valign="middle" style="padding-right:14px;">${photoHtml}</td>
              <td style="font-size:13px;color:#1e293b;font-family:Arial,sans-serif;font-weight:600;" valign="middle">
                Employee <strong style="color:#334155;">${emp_name}</strong> (${emp_id}) has been removed from the system on
                <strong style="color:#334155;">${deletedDate}</strong> by ${deletedBy || 'IT Admin'}.
              </td>
            </tr></table>
          </td></tr>
        </table>

        <!-- Employee details -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border:1px solid #cbd5e1;border-radius:10px;" role="presentation">
          <tr><td style="background-color:#475569;padding:11px 16px;border-radius:10px 10px 0 0;">
            <span style="font-size:12px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:0.5px;">
              &#128100;&nbsp; EXITED EMPLOYEE DETAILS
            </span>
          </td></tr>
          <tr><td style="padding:14px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
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
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border:1px solid #cbd5e1;border-radius:10px;" role="presentation">
          <tr><td style="background-color:#475569;padding:11px 16px;border-radius:10px 10px 0 0;">
            <span style="font-size:12px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:0.5px;">
              &#128203;&nbsp; EXIT CHECKLIST &mdash; IT ACCESS
            </span>
          </td></tr>
          ${renderChecklist}
        </table>

        <!-- Laptop / Asset Status -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;" role="presentation">
          <tr><td style="background-color:#64748b;padding:11px 16px;border-radius:10px 10px 0 0;">
            <span style="font-size:12px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:0.5px;">
              &#128187;&nbsp; ASSET RECOVERY &mdash; LAPTOP STATUS
            </span>
          </td></tr>
          ${laptopStatusRow}
        </table>

        ${adminNotes}

        <!-- Footer note -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;" role="presentation">
          <tr><td style="padding:12px 16px;font-size:12px;color:#1e293b;font-family:Arial,sans-serif;">
            This notification was generated automatically by <strong style="color:#334155;">AssetOps</strong>.
            For questions: <a href="mailto:sysadmin@mindteck.com" style="color:#475569;font-weight:600;text-decoration:none;">sysadmin@mindteck.com</a>
          </td></tr>
        </table>

      </td>
    </tr>

    <!-- Footer bar -->
    <tr>
      <td style="background-color:#334155;padding:12px 20px;border-radius:0 0 12px 12px;" align="center">
        <div style="font-size:11px;color:rgba(255,255,255,0.75);font-family:Arial,sans-serif;line-height:1.8;">
          &copy; ${new Date().getFullYear()} Mindteck IT Team &bull; AssetOps System &mdash; Internal Use Only
        </div>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  const mailOptions = {
    from: FROM,
    to: toList.join(', '),
    subject: `EXIT Notification: ${emp_name} (${emp_id}) — ${deletedDate}`,
    html,
    attachments: [...logoAtts, ...photoAtts],
  };

  if (ccList.length > 0) mailOptions.cc = ccList.join(', ');

  await transporter.sendMail(mailOptions);
  console.log(`✅ Exit notification sent for ${emp_name} to ${toList.join(', ')}`);
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees/deleted
// ─────────────────────────────────────────────────────────────────────────────
exports.getDeletedEmployees = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, emp_id, emp_name, designation, company_email, personal_email,
       service_line, location, level, reporting_manager, mobile_no,
       blood_group, cc_emails, portal_url, doj, dob, notes, photo_url,
       TO_CHAR(doj,'YYYY-MM-DD') AS doj_fmt,
       TO_CHAR(dob,'YYYY-MM-DD') AS dob_fmt,
       TO_CHAR(deleted_at,'YYYY-MM-DD HH24:MI') AS deleted_at_fmt, status,
       exit_checklist,
       exit_checklist->>'laptop_status' AS laptop_status
     FROM employees WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
  );
  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getEmployee = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT *, TO_CHAR(doj,'YYYY-MM-DD') AS doj_fmt, TO_CHAR(dob,'YYYY-MM-DD') AS dob_fmt
     FROM employees WHERE emp_id = $1 AND deleted_at IS NULL`,
    [req.params.id]
  );
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: `Employee ${req.params.id} not found` });
  res.json({ success: true, data: result.rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/employees
// ─────────────────────────────────────────────────────────────────────────────
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

  if (company_email || personal_email) {
    const empData = { ...req.body, doj: doj || null };
    sendWelcomeEmail(empData).catch(err => console.error('Welcome email failed:', err.message));
  }

  res.status(201).json({ success: true, data: newEmp });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/employees/:id
// ─────────────────────────────────────────────────────────────────────────────
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
  params.push(empId);
  const result = await query(
    `UPDATE employees SET ${updates.join(', ')} WHERE emp_id = $${idx} AND deleted_at IS NULL RETURNING *`,
    params
  );
  if (!result.rows.length)
    return res.status(404).json({ success: false, message: `Employee ${empId} not found` });
  await audit('EMPLOYEE_UPDATED', `Employee ${empId} updated`, req.user?.name || 'Admin');
  res.json({ success: true, data: result.rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/employees/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteEmployee = asyncHandler(async (req, res) => {
  const empId     = req.params.id;
  const checklist = req.body?.checklist || {};

  const empRes = await query(
    `SELECT emp_name, designation, service_line, company_email, personal_email,
       location, reporting_manager, doj, cc_emails, mobile_no, level, photo_url
     FROM employees WHERE emp_id = $1 AND deleted_at IS NULL`,
    [empId]
  );
  if (!empRes.rows.length)
    return res.status(404).json({ success: false, message: `Employee ${empId} not found` });

  const empData   = { emp_id: empId, ...empRes.rows[0] };
  const deletedBy = req.user?.name || 'IT Admin';

  await query(
  `UPDATE employees SET deleted_at = NOW(), status = 'Inactive', exit_checklist = $2 WHERE emp_id = $1`,
  [empId, JSON.stringify(checklist)]
);
  await query(`DELETE FROM license_assignments WHERE emp_id = $1`, [empId]).catch(() => {});
  await audit('EMPLOYEE_DELETED', `Employee ${empId} (${empData.emp_name}) deleted`, deletedBy);

  if (checklist.cc_emails_override) {
    empData.cc_emails = checklist.cc_emails_override;
  } else {
    const storedCc = (empData.cc_emails || '').split(',').map(e => e.trim()).filter(Boolean);
    empData.cc_emails = storedCc.filter(e => e !== empData.company_email && e !== empData.personal_email).join(', ');
  }

  sendExitEmail(empData, deletedBy, checklist).catch(err => console.error('Exit email failed:', err.message));
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

exports.updateDeletedLaptopStatus = asyncHandler(async (req, res) => {
  const { laptop_status } = req.body;
  if (!laptop_status) 
    return res.status(400).json({ success: false, message: 'laptop_status is required' });

  const result = await query(
    `UPDATE employees
     SET exit_checklist = COALESCE(exit_checklist, '{}'::jsonb) || $1::jsonb
     WHERE emp_id = $2 AND deleted_at IS NOT NULL
     RETURNING emp_id, exit_checklist->>'laptop_status' AS laptop_status`,
    [JSON.stringify({ laptop_status }), req.params.id]
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'Deleted employee not found' });

  await audit(
    'LAPTOP_STATUS_UPDATED',
    `Laptop status for ${req.params.id} updated to ${laptop_status}`,
    req.user?.name || 'Admin'
  );

  res.json({ success: true, data: result.rows[0] });
});