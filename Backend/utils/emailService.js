'use strict';
const nodemailer   = require('nodemailer');
const fs           = require('fs');
const path         = require('path');
const { generateAgreement } = require('./generateAgreement');

// ── Logo ──────────────────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, 'mindteck_logo.jpg');
try {
  if (!fs.existsSync(LOGO_PATH)) {
    const b64file = path.join(__dirname, 'logo_b64.txt');
    if (fs.existsSync(b64file)) {
      const raw = Buffer.from(fs.readFileSync(b64file, 'utf8').trim(), 'base64');
      fs.writeFileSync(LOGO_PATH, raw);
    }
  }
} catch (e) { console.error('Logo setup error:', e.message); }

// ── SMTP ──────────────────────────────────────────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.office365.com',
    port: Number(process.env.MAIL_PORT) || 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });

const getFrom  = () => process.env.MAIL_FROM || `AssetOps <${process.env.MAIL_USER}>`;
const sysEmail = () => (process.env.SYSADMIN_EMAIL || '').trim();

const buildCC = ({ performedByEmail = '', extraCCs = [] } = {}) => {
  const list = [sysEmail(), performedByEmail, ...extraCCs]
    .map(e => (e || '').trim().toLowerCase())
    .filter(e => e && e.includes('@'));
  return [...new Set(list)];
};

const validateEmail = (email) => {
  if (!email || !String(email).includes('@')) {
    throw new Error(`Invalid or missing recipient email: "${email}"`);
  }
};

const sendMail = async (options) => {
  // console.log('MAIL_HOST:', process.env.MAIL_HOST);
  // console.log('MAIL_USER:', process.env.MAIL_USER);
  // console.log('MAIL_PASS:', process.env.MAIL_PASS ? 'SET' : 'NOT SET');
  // console.log('MAIL_PASS length:', process.env.MAIL_PASS.length);
  // console.log('MAIL_PASS raw:', JSON.stringify(process.env.MAIL_PASS));

  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.log('📧 [Skipped — MAIL_USER/PASS not configured]');
    console.log('   To:', options.to, '| CC:', options.cc);
    return;
  }
  const transporter = createTransporter();
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await transporter.verify();
      const info = await transporter.sendMail({ from: getFrom(), ...options });
      console.log(`📧 Sent → ${options.to} | ${info.messageId}`);
      return;
    } catch (err) {
      lastErr = err;
      console.error(`📧 Attempt ${attempt} FAILED:`, err.message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error(`Email delivery failed after 2 attempts: ${lastErr.message}`);
};

// ── Attachment helpers ────────────────────────────────────────────────────────
const LOGO_CID = 'company_logo';

const getLogoAttachment = () => {
  try {
    if (fs.existsSync(LOGO_PATH)) {
      return [{
        filename:    'logo.jpg',
        path:        LOGO_PATH,
        cid:         LOGO_CID,
        contentType: 'image/jpeg',
      }];
    }
  } catch (e) { console.error('Logo attachment error:', e.message); }
  return [];
};

const getPhotoAttachment = (photoBase64) => {
  if (!photoBase64?.startsWith('data:image')) return [];
  try {
    const m = photoBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) return [];
    const [, mime, b64] = m;
    return [{
      filename:    `employee_photo.${mime.split('/')[1] || 'jpg'}`,
      content:     Buffer.from(b64, 'base64'),
      cid:         'employee_photo',
      contentType: mime,
    }];
  } catch { return []; }
};

const buildPhotoAttachments = (photos = [], prefix = 'photo') => {
  const attachments = [], cids = [];
  if (!Array.isArray(photos)) return { attachments, cids };
  photos.forEach((src, i) => {
    if (!src?.startsWith('data:image')) return;
    try {
      const m = src.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!m) return;
      const [, mime, b64] = m;
      const cid = `${prefix}_${i + 1}`;
      attachments.push({
        filename:    `${prefix}_${i + 1}.${mime.split('/')[1] || 'jpg'}`,
        content:     Buffer.from(b64, 'base64'),
        cid,
        contentType: mime,
      });
      cids.push(cid);
    } catch (_) {}
  });
  return { attachments, cids };
};

// ── Outlook-safe CSS ──────────────────────────────────────────────────────────
// Rules:
//   - NO display:flex  → replaced with <table> layouts everywhere
//   - NO linear-gradient on block elements → solid bgcolor fallback on <td>
//   - NO box-shadow → removed (Outlook ignores)
//   - NO ::after pseudo → removed
//   - NO border-radius on <table> → Outlook ignores overflow:hidden on tables
//   - max-width on outer wrapper uses a wrapping 100%-wide table with a centred inner table
//   - All widths capped at 660px via table width="660"
const CSS = `
  *{box-sizing:border-box}
  body{margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}

  /* ── Logo bar ── */
  .logo-bar{background:#fff;border-bottom:3px solid #1d5c3c}
  .logo-tagline{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;font-weight:600}

  /* ── Header banner ── */
  .hdr{padding:28px 32px 24px}
  .hdr-icon{font-size:32px;margin-bottom:10px;display:block}
  .hdr-title{color:#fff;font-size:24px;font-weight:800;margin:0 0 4px}
  .hdr-sub{color:#d1fae5;font-size:13px;margin:0}

  /* ── Allocation ID badge ── */
  .alloc-badge{display:inline-block;background:#2a6f52;border:1px solid #3a8f6a;
               color:#fff;font-family:monospace;font-size:13px;font-weight:700;padding:5px 14px;
               border-radius:20px;margin-top:12px}

  /* ── Body ── */
  .body{padding:28px 32px}
  .greeting{font-size:17px;color:#1e293b;margin:0 0 6px;font-weight:700}
  .intro{font-size:14px;color:#475569;margin:0 0 24px;line-height:1.75}

  /* ── Section title ── */
  .sec{margin-bottom:20px}
  .sec-title{font-size:10px;font-weight:800;color:#1d5c3c;text-transform:uppercase;
             letter-spacing:.1em;margin:0 0 10px;border-bottom:2px solid #d1fae5;padding-bottom:4px}

  /* ── Info table ── */
  .tbl{width:100%;border-collapse:collapse;margin-bottom:0;font-size:13.5px}
  .tbl td,.tbl th{padding:10px 14px;border:1px solid #e8edf2;vertical-align:middle}
  .tbl th{background:#f8fafc;font-size:10.5px;font-weight:700;color:#64748b;
          text-transform:uppercase;width:38%;border-right:2px solid #e2e8f0}
  .tbl td{color:#1e293b;font-weight:600}
  .tbl tr:nth-child(even) td{background:#fafcff}
  .tbl td.mono{font-family:monospace;font-size:14px;color:#1d3461;font-weight:700}
  .tbl td.green{color:#059669;font-weight:700}
  .tbl td.red{color:#dc2626;font-weight:700}

  /* ── Swap comparison ── */
  .cmp-outer{width:100%;border-collapse:collapse;margin-bottom:0}
  .cmp-outer td{width:50%;vertical-align:top;padding:0}
  .cmp-outer td:first-child{padding-right:6px}
  .cmp-outer td:last-child{padding-left:6px}
  .cmp-card{border:1px solid #e2e8f0;width:100%;border-collapse:collapse}
  .cmp-hdr{padding:10px 14px;font-size:11px;font-weight:800;text-transform:uppercase}
  .cmp-row{padding:8px 12px;border-bottom:1px solid #f1f5f9}
  .cmp-row:last-child{border-bottom:none}
  .cmp-label{font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-bottom:2px}
  .cmp-val{color:#1e293b;font-weight:700;font-size:13px}
  .cmp-val.mono{font-family:monospace;font-size:13px;color:#1d3461}

  /* ── Badges ── */
  .badge{display:inline-block;padding:3px 11px;border-radius:20px;font-size:11px;font-weight:700}
  .badge-green{background:#d1fae5;color:#065f46}
  .badge-blue{background:#dbeafe;color:#1e40af}
  .badge-amber{background:#fef3c7;color:#92400e}
  .badge-red{background:#fee2e2;color:#991b1b}
  .badge-purple{background:#ede9fe;color:#5b21b6}

  /* ── Employee card ── */
  .emp-row{padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:20px}
  .emp-avatar{width:60px;height:60px;border-radius:50%;object-fit:cover;border:3px solid #1d5c3c}
  .emp-avatar-placeholder{width:60px;height:60px;border-radius:50%;background:#1d5c3c;
                           color:#fff;font-size:22px;font-weight:700;text-align:center;
                           line-height:60px}
  .emp-info-name{font-size:16px;font-weight:700;color:#1e293b}
  .emp-info-sub{font-size:12px;color:#64748b;margin-top:2px}

  /* ── Photos grid ── */
  .photos-section{background:#fffbea;border:1px solid #fde68a;padding:14px 16px;margin-bottom:20px}
  .photos-label{font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:10px}
  .photos-grid img{width:120px;height:90px;object-fit:cover;border:2px solid #e2e8f0;
                   display:inline-block;margin:0 4px 4px 0}

  /* ── Action button ── */
  .action-box{background:#f0fdf4;border:2px solid #16a34a;padding:20px 24px;margin:20px 0;text-align:center}
  .action-box-title{font-size:15px;font-weight:800;color:#14532d;margin-bottom:6px}
  .action-box-sub{font-size:13px;color:#166534;margin-bottom:16px;line-height:1.6}
  .action-btn{display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
              padding:13px 36px;font-size:15px;font-weight:700}
  .action-note{font-size:11px;color:#6b7280;margin-top:12px}

  /* ── Notice box ── */
  .notice{background:#fffbea;border-left:4px solid #f59e0b;padding:14px 18px;
          font-size:13px;color:#92400e;line-height:1.8;margin-bottom:20px}
  .notice ul{margin:8px 0 0 18px;padding:0}
  .notice li{margin-bottom:4px}

  /* ── Status summary bar ── */
  .status-bar{width:100%;border-collapse:collapse;margin-bottom:20px}
  .status-bar td{width:33%;padding:4px}
  .status-item{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;text-align:center}
  .status-item-label{font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin-bottom:4px}
  .status-item-val{font-size:15px;font-weight:800;color:#1e293b}

  /* ── Divider ── */
  .divider{height:1px;background:#e2e8f0;margin:20px 0}

  /* ── Footer ── */
  .footer{background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;
          text-align:center;border-top:1px solid #e2e8f0}
  .footer a{color:#1d5c3c;text-decoration:none}
  .footer-brand{font-weight:700;color:#475569;margin-bottom:4px}
`;

// ── Layout wrapper ─────────────────────────────────────────────────────────────
// Outlook-safe:
//   - Outer 100%-wide table centres the 660px inner table (replaces max-width on a div)
//   - bgcolor="" attribute on header <td> is the Outlook fallback for CSS gradient
//   - Logo bar uses nested table (no flex)
//   - No box-shadow on wrapper
const wrap = (hdrCssGradient, hdrBgColor, icon, title, sub, allocId, body, acceptLink = '') => {
  const sys = sysEmail();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;">

<!-- Outer wrapper table — centres content in all clients -->
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#f0f4f8;padding:24px 0;">
  <tr>
    <td align="center" valign="top">

      <!-- Inner content table — fixed 660px, collapses on mobile -->
      <table width="660" cellpadding="0" cellspacing="0" border="0"
             style="width:660px;max-width:100%;background:#ffffff;border:1px solid #e2e8f0;"
             class="wrap">

        <!-- Logo bar -->
        <tr>
          <td style="background:#ffffff;border-bottom:3px solid #1d5c3c;padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:16px 32px;vertical-align:middle;">
                  <img src="cid:${LOGO_CID}" alt="Logo" height="36"
                       style="height:36px;width:auto;display:block;"/>
                </td>
                <td style="padding:16px 32px;vertical-align:middle;text-align:right;">
                  <span style="font-size:10px;color:#94a3b8;text-transform:uppercase;
                               letter-spacing:.1em;font-weight:600;">IT Asset Management</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Header banner -->
        <tr>
          <td bgcolor="${hdrBgColor}"
              style="background:${hdrCssGradient};padding:28px 32px 24px;">
            <span style="font-size:32px;margin-bottom:10px;display:block;">${icon}</span>
            <p style="color:#fff;font-size:24px;font-weight:800;margin:0 0 4px;">${title}</p>
            <p style="color:#d1fae5;font-size:13px;margin:0;">${sub}</p>
            ${allocId
              ? `<div style="display:inline-block;background:#2a6f52;border:1px solid #3a8f6a;
                            color:#fff;font-family:monospace;font-size:13px;font-weight:700;
                            padding:5px 14px;border-radius:20px;margin-top:12px;">${allocId}</div>`
              : ''}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            ${body}
            ${acceptLink ? `
            <div style="background:#f0fdf4;border:2px solid #16a34a;padding:20px 24px;
                        margin:20px 0;text-align:center;">
              <div style="font-size:15px;font-weight:800;color:#14532d;margin-bottom:6px;">
                &#9889; Action Required
              </div>
              <div style="font-size:13px;color:#166534;margin-bottom:16px;line-height:1.6;">
                Please confirm receipt of your laptop or report any damage within
                <strong>10 days</strong>.
              </div>
              <a href="${acceptLink}"
                 style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                        padding:13px 36px;font-size:15px;font-weight:700;">
                &#10003; Confirm Receipt / Report Damage
              </a>
              <div style="font-size:11px;color:#6b7280;margin-top:12px;">
                Link expires in 10 days &nbsp;&middot;&nbsp;
                <a href="mailto:${sys}" style="color:#1d5c3c;">${sys}</a> for help
              </div>
            </div>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;
                     text-align:center;border-top:1px solid #e2e8f0;">
            <div style="font-weight:700;color:#475569;margin-bottom:4px;">
              Mindteck IT Asset Management &mdash; AssetOps
            </div>
            ${sys ? `<a href="mailto:${sys}" style="color:#1d5c3c;text-decoration:none;">${sys}</a>` : ''}
          </td>
        </tr>

      </table><!-- /inner 660px table -->

    </td>
  </tr>
</table><!-- /outer wrapper -->

</body>
</html>`;
};

// ── Helper: employee card ─────────────────────────────────────────────────────
const empCard = (name, id, dept, mobile, email, hasPhoto) =>
`<div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:20px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td width="76" style="vertical-align:middle;padding:0;">
        ${hasPhoto
          ? `<img src="cid:employee_photo" alt="${name}" width="60" height="60"
                  style="width:60px;height:60px;border-radius:50%;object-fit:cover;
                         border:3px solid #1d5c3c;display:block;"/>`
          : `<div style="width:60px;height:60px;border-radius:50%;background:#1d5c3c;
                         color:#fff;font-size:22px;font-weight:700;text-align:center;
                         line-height:60px;">${(name || '?')[0].toUpperCase()}</div>`
        }
      </td>
      <td style="vertical-align:middle;padding:0 0 0 16px;">
        <div style="font-size:16px;font-weight:700;color:#1e293b;">${name}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">
          ${[id, dept, mobile, email].filter(Boolean).join(' &middot; ')}
        </div>
      </td>
    </tr>
  </table>
</div>`;

// ── Helper: photo grid section ────────────────────────────────────────────────
const photoGrid = (cids, label, warning = '') => {
  if (!cids.length) return '';
  const imgs = cids.map(cid =>
    `<img src="cid:${cid}" alt="${label}" width="120" height="90"
          style="width:120px;height:90px;object-fit:cover;border:2px solid #e2e8f0;
                 display:inline-block;margin:0 4px 4px 0;"/>`
  ).join('');
  return `<div style="background:#fffbea;border:1px solid #fde68a;padding:14px 16px;margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:10px;">
      &#128247; ${label}
    </div>
    ${warning ? `<div style="font-size:12px;color:#92400e;margin-bottom:8px;">${warning}</div>` : ''}
    <div>${imgs}</div>
  </div>`;
};

// ── Swap comparison table ─────────────────────────────────────────────────────
const swapCompareTable = (p) =>
`<table cellpadding="0" cellspacing="0" border="0" width="100%"
       style="border-collapse:collapse;width:100%;">
  <tr>
    <td width="50%" style="vertical-align:top;padding-right:6px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"
             style="border:1px solid #e2e8f0;border-collapse:collapse;width:100%;">
        <tr>
          <td style="background:#fee2e2;padding:10px 14px;font-size:11px;
                     font-weight:800;text-transform:uppercase;color:#991b1b;">
            &#8617; Returned Laptop
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Asset No</div>
            <div style="color:#dc2626;font-weight:700;font-family:monospace;font-size:13px;">${p.oldAssetId}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Brand / Model</div>
            <div style="color:#1e293b;font-weight:700;font-size:13px;">${p.oldBrand} ${p.oldModel}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;">
            <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Serial</div>
            <div style="color:#1d3461;font-weight:700;font-family:monospace;font-size:13px;">${p.oldSerial || '&mdash;'}</div>
          </td>
        </tr>
      </table>
    </td>
    <td width="50%" style="vertical-align:top;padding-left:6px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"
             style="border:1px solid #e2e8f0;border-collapse:collapse;width:100%;">
        <tr>
          <td style="background:#d1fae5;padding:10px 14px;font-size:11px;
                     font-weight:800;text-transform:uppercase;color:#065f46;">
            &#10003; New Laptop Issued
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Asset No</div>
            <div style="color:#059669;font-weight:700;font-family:monospace;font-size:13px;">${p.newAssetId}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Brand / Model</div>
            <div style="color:#1e293b;font-weight:700;font-size:13px;">${p.newBrand} ${p.newModel}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;">
            <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-bottom:2px;">Serial</div>
            <div style="color:#1d3461;font-weight:700;font-family:monospace;font-size:13px;">${p.newSerial || '&mdash;'}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

// ── Status summary bar ────────────────────────────────────────────────────────
// Each item: { label, value }
// Rendered as a 3-column table — no flex, safe in Outlook
const statusBar = (items) =>
`<table cellpadding="0" cellspacing="0" border="0" width="100%"
       style="border-collapse:collapse;width:100%;margin-bottom:20px;">
  <tr>
    ${items.map(item => `
    <td style="width:33%;padding:4px;vertical-align:top;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;text-align:center;">
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;
                    font-weight:600;margin-bottom:4px;">${item.label}</div>
        <div style="font-size:15px;font-weight:800;color:#1e293b;">${item.value}</div>
      </div>
    </td>`).join('')}
  </tr>
</table>`;

// ── Header colour map ─────────────────────────────────────────────────────────
// [ cssGradient ,  outlookSolidBgColor ]
// Outlook reads bgcolor="" attribute on the <td>; modern clients get the CSS gradient.
const HDR = {
  allocate:  ['linear-gradient(135deg,#1d3461,#1d5c3c)', '#1d3461'],
  receive:   ['linear-gradient(135deg,#16a34a,#15803d)',  '#16a34a'],  // light green
  swap:      ['linear-gradient(135deg,#7c3aed,#5b21b6)',  '#7c3aed'],
  accessory: ['linear-gradient(135deg,#d97706,#b45309)',  '#d97706'],
  welcome:   ['linear-gradient(135deg,#0f172a,#1d3461)',  '#0f172a'],
  reminder:  ['linear-gradient(135deg,#d97706,#b45309)',  '#d97706'],
  blue:      ['linear-gradient(135deg,#2563eb,#1d4ed8)',  '#2563eb'],
  green:     ['linear-gradient(135deg,#059669,#047857)',  '#059669'],
};


// ═══════════════════════════════════════════════════════════════════════════════
// 1. ALLOCATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAllocationEmail = async (p) => {
  validateEmail(p.empEmail);

  const accessories = (p.accessories || []).join(', ') || 'None';
  const cc          = buildCC({ performedByEmail: p.allocatedByEmail, extraCCs: p.extraCCs });
  const photoAtts   = getPhotoAttachment(p.photoUrl);
  const hasPhoto    = photoAtts.length > 0;

  let agreementBuffer = null;
  try {
    agreementBuffer = await generateAgreement({
      empName: p.empName, empId: p.empId, department: p.department,
      position: p.department || 'Employee', mobileNo: p.mobileNo || '',
      assetId: p.assetId, serial: p.serial, brand: p.brand, model: p.model,
      config: p.config || '', accessories: p.accessories || [],
      allocationDate: p.allocationDate,
      managerName:  'Vasudevan Kannan',
      managerEmail: 'vasudevan.kannan@mindteck.com',
      contactPerson: 'Vasudevan Kannan',
      contactEmail:  'vasudevan.kannan@mindteck.com',
    });
  } catch (e) {
    console.error('⚠️  Agreement generation failed — email will send WITHOUT attachment:', e.message);
  }

  const { attachments: condAtts, cids: condCids } = buildPhotoAttachments(
    Array.isArray(p.damagePhotosArray) ? p.damagePhotosArray : [], 'cond'
  );
  if (!condCids.length) {
    try {
      const legacy = JSON.parse(p.damagePhotos || '[]');
      if (Array.isArray(legacy) && legacy.length) {
        const fb = buildPhotoAttachments(legacy, 'cond');
        condAtts.push(...fb.attachments);
        condCids.push(...fb.cids);
      }
    } catch (_) {}
  }

  const allocMs      = new Date(p.allocationDate || Date.now()).getTime();
  const deadlineDate = new Date(allocMs + 10 * 24 * 60 * 60 * 1000);
  const deadlineStr  = deadlineDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const body = `
    ${empCard(p.empName, p.empId, p.department, p.mobileNo, p.empEmail, hasPhoto)}

    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">
      A laptop has been issued to you by the Mindteck IT team. All details are listed below.
      The <strong>Employee Laptop Agreement</strong>${agreementBuffer ? ' is attached' : ' will be sent separately'} &mdash; please sign and return it to
      <a href="mailto:vasudevan.kannan@mindteck.com">vasudevan.kannan@mindteck.com</a>
      by <strong>${deadlineStr}</strong>.
    </p>

    <div class="sec">
      <div class="sec-title">&#128187; Laptop Details</div>
      <table class="tbl">
        <tr><th>Asset Number</th><td class="mono">${p.assetId}</td></tr>
        <tr><th>Brand / Model</th><td>${p.brand} ${p.model}</td></tr>
        <tr><th>Configuration</th><td>${p.config || '&mdash;'}</td></tr>
        <tr><th>Serial Number</th><td class="mono">${p.serial}</td></tr>
        <tr><th>Accessories</th><td>${accessories}</td></tr>
        <tr><th>Warranty End</th><td>${p.warrantyEnd || '&mdash;'}</td></tr>
      </table>
    </div>

    <div class="sec">
      <div class="sec-title">&#128203; Allocation Details</div>
      <table class="tbl">
        <tr><th>Allocation ID</th><td class="mono">${p.allocationId || '&mdash;'}</td></tr>
        <tr><th>Allocation Date</th><td>${p.allocationDate}</td></tr>
        <tr><th>Project / Client</th><td>${p.project || '&mdash;'} / ${p.client || '&mdash;'}</td></tr>
        <tr><th>Prepared By</th><td>${p.preparedBy || p.allocatedBy || '&mdash;'}</td></tr>
        <tr><th>Delivery Method</th><td>
          ${p.deliveryMethod === 'courier'
            ? `<span class="badge badge-blue">Courier</span>${p.deliveryAddress
                ? `<div style="margin-top:4px;font-size:12px;color:#475569;">${p.deliveryAddress}</div>`
                : ''}`
            : `<span class="badge badge-green">Hand Delivery</span>`
          }
        </td></tr>
        <tr><th>Status</th><td><span class="badge badge-green">Active</span></td></tr>
      </table>
    </div>

    ${condCids.length
      ? photoGrid(condCids, 'Laptop Condition at Allocation',
          '&#9888;&#65039; Pre-existing condition documented before issuance.')
      : ''
    }

    <div class="notice">
      <strong>&#9888;&#65039; Important:</strong>
      <ul>
        <li>Review and sign the attached <strong>Employee Laptop Agreement</strong></li>
        <li>Return signed copy to <strong>vasudevan.kannan@mindteck.com</strong> by <strong>${deadlineStr}</strong></li>
        <li>Non-response by ${deadlineStr} will be treated as acceptance</li>
        <li>Hardware issues? Contact <a href="mailto:${sysEmail()}">${sysEmail()}</a></li>
      </ul>
    </div>`;

  const toList = [p.empEmail];
  if (p.personalEmail && p.personalEmail !== p.empEmail) toList.push(p.personalEmail);

  const attachments = [...getLogoAttachment(), ...photoAtts, ...condAtts];
  if (agreementBuffer) {
    attachments.push({
      filename:    `Laptop_Agreement_${(p.empName || '').replace(/\s+/g, '_')}_${p.assetId}.docx`,
      content:     agreementBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
  // QR attachment removed — p.qrCodeBuffer is always null now

  await sendMail({
    to:          toList.join(', '),
    cc:          cc.join(', '),
    subject:     `[AssetOps] Laptop Allocated — ${p.assetId} | ${p.empName}`,
    html:        wrap(...HDR.allocate, '&#128187;', 'Laptop Allocated', 'AssetOps · Mindteck IT', p.allocationId, body, p.acceptanceLink || ''),
    attachments,
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 2. RECEIVE / RETURN EMAIL  — light green background
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendReceiveEmail = async (p) => {
  validateEmail(p.empEmail);

  const cc = buildCC({ performedByEmail: p.receivedByEmail, extraCCs: p.extraCCs });

  const { attachments: retAtts, cids: retCids } = buildPhotoAttachments(
    Array.isArray(p.damagePhotos) ? p.damagePhotos : [], 'ret'
  );

  const condLabel = p.newStatus === 'Stock'  ? 'Good — No Damage'
                  : p.newStatus === 'Repair' ? 'Needs Repair'
                  :                            'Damaged / Scrap';
  const condBadge = p.newStatus === 'Stock'  ? 'badge-green'
                  : p.newStatus === 'Repair' ? 'badge-amber'
                  :                            'badge-red';
  const stsBadge  = p.newStatus === 'Stock'  ? 'badge-green'
                  : p.newStatus === 'Repair' ? 'badge-amber'
                  :                            'badge-red';

  // ── Light green body background wrapper ──────────────────────────────────
  // Wraps the whole email body area in #f0fdf4 (Tailwind green-50)
  // Uses an inner table so it works in Outlook without display:block tricks
  const receiveBody = `
    <!-- Light green body background -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%"
           style="border-collapse:collapse;width:100%;background:#f0fdf4;
                  border:1px solid #bbf7d0;border-radius:6px;margin-bottom:0;">
      <tr>
        <td style="padding:24px;">

          <p style="font-size:17px;color:#1e293b;margin:0 0 6px;font-weight:700;">
            Dear ${p.empName},
          </p>
          <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.75;">
            Your laptop has been successfully returned and processed by the IT team.
            Please find the complete return summary below.
          </p>

          ${statusBar([
            { label: 'Return Date', value: `<span style="font-size:13px;">${p.returnDate}</span>` },
            { label: 'Condition',   value: `<span class="badge ${condBadge}" style="font-size:11px;">${condLabel}</span>` },
            { label: 'Asset Status',value: `<span class="badge ${stsBadge}"  style="font-size:11px;">${p.newStatus}</span>` },
          ])}

          <!-- Employee -->
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:800;color:#15803d;text-transform:uppercase;
                        letter-spacing:.1em;margin:0 0 10px;border-bottom:2px solid #86efac;
                        padding-bottom:4px;">
              &#128100; Employee
            </div>
            <table class="tbl" width="100%" cellpadding="0" cellspacing="0">
              <tr><th>Full Name</th>   <td>${p.empName}</td></tr>
              <tr><th>Employee ID</th> <td>${p.empId || '&mdash;'}</td></tr>
              <tr><th>Department</th>  <td>${p.department || '&mdash;'}</td></tr>
              <tr><th>Mobile</th>      <td>${p.mobileNo || '&mdash;'}</td></tr>
            </table>
          </div>

          <!-- Returned Laptop -->
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:800;color:#15803d;text-transform:uppercase;
                        letter-spacing:.1em;margin:0 0 10px;border-bottom:2px solid #86efac;
                        padding-bottom:4px;">
              &#128187; Returned Laptop
            </div>
            <table class="tbl" width="100%" cellpadding="0" cellspacing="0">
              <tr><th>Asset Number</th>  <td class="mono">${p.assetId}</td></tr>
              <tr><th>Brand / Model</th> <td>${p.brand || ''} ${p.model || ''}</td></tr>
              <tr><th>Serial Number</th> <td class="mono">${p.serial || '&mdash;'}</td></tr>
              <tr><th>Processed By</th>  <td>${p.receivedBy}</td></tr>
            </table>
          </div>

          ${p.damageDescription ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:800;color:#15803d;text-transform:uppercase;
                        letter-spacing:.1em;margin:0 0 10px;border-bottom:2px solid #86efac;
                        padding-bottom:4px;">
              &#9888;&#65039; Damage / Issue Notes
            </div>
            <div style="background:#fff7ed;border:1px solid #fed7aa;padding:14px 18px;
                        font-size:14px;color:#7c2d12;line-height:1.8;">
              ${p.damageDescription}
            </div>
          </div>` : ''}

          ${retCids.length ? photoGrid(retCids, 'Laptop Condition at Return') : ''}

          <div style="background:#dcfce7;border-left:4px solid #16a34a;padding:14px 18px;
                      font-size:13px;color:#14532d;line-height:1.8;">
            This email confirms the successful return of the above laptop.
            Please retain it for your records. For any discrepancies contact
            <a href="mailto:${sysEmail()}" style="color:#15803d;">${sysEmail()}</a>.
          </div>

        </td>
      </tr>
    </table>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Laptop Returned — ${p.assetId} | ${p.empName}`,
    html:        wrap(...HDR.receive, '&#128229;', 'Laptop Returned', 'AssetOps · Mindteck IT', '', receiveBody),
    attachments: [...getLogoAttachment(), ...retAtts],
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 3. SWAP EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendSwapEmail = async (p) => {
  validateEmail(p.empEmail);

  const cc        = buildCC({ performedByEmail: p.swappedByEmail, extraCCs: p.extraCCs });
  const photoAtts = getPhotoAttachment(p.photoUrl);
  const hasPhoto  = photoAtts.length > 0;

  const { attachments: issueAtts, cids: issueCids } = buildPhotoAttachments(
    Array.isArray(p.issueImages) ? p.issueImages : [], 'issue'
  );

  const body = `
    ${empCard(p.empName, p.empId, p.department, p.mobileNo, p.empEmail, hasPhoto)}

    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">
      Your laptop has been swapped by the IT team. The details of both the returned and newly
      issued laptops are shown below.
    </p>

    <div class="sec">
      <div class="sec-title">&#128260; Swap Summary</div>
      ${swapCompareTable(p)}
    </div>

    <div class="sec" style="margin-top:16px;">
      <div class="sec-title">&#128203; Swap Details</div>
      <table class="tbl">
        <tr><th>New Config</th>    <td>${p.newConfig || '&mdash;'}</td></tr>
        <tr><th>Swap Reason</th>   <td>${p.issueType || '&mdash;'}</td></tr>
        <tr><th>Description</th>   <td>${p.issueDescription || '&mdash;'}</td></tr>
        <tr><th>Swap Date</th>     <td>${p.swapDate}</td></tr>
        <tr><th>Processed By</th>  <td>${p.swappedBy}</td></tr>
        ${p.preparedBy ? `<tr><th>Prepared By</th><td>${p.preparedBy}</td></tr>` : ''}
        <tr><th>Project</th>       <td>${p.project || '&mdash;'}</td></tr>
      </table>
    </div>

    ${issueCids.length ? photoGrid(issueCids, 'Issue / Damage Photos (Old Laptop)') : ''}

    <div class="notice">
      Your new laptop is ready. For any hardware issues contact
      <a href="mailto:${sysEmail()}">${sysEmail()}</a>.
    </div>`;

  // QR attachment removed — p.qrCodeBuffer is always null now
  const attachments = [...getLogoAttachment(), ...photoAtts, ...issueAtts];

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Laptop Swapped — ${p.oldAssetId} → ${p.newAssetId} | ${p.empName}`,
    html:        wrap(...HDR.swap, '&#128260;', 'Laptop Swapped', 'AssetOps · Mindteck IT', p.newAllocationId, body),
    attachments,
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 4. ACCESSORIES REQUEST EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryRequestEmail = async (p) => {
  validateEmail(p.empEmail);

  const cc    = buildCC({ performedByEmail: p.requestedByEmail, extraCCs: p.extraCCs || [] });
  const items = Array.isArray(p.items) ? p.items : [];
  const rows  = items.map(i => `<tr><th>${i.item || '—'}</th><td>${i.quantity || 1} unit(s)</td></tr>`).join('');

  const body = `
    <p class="greeting">Accessory Request &mdash; ${p.empName}</p>
    <p class="intro">The following accessory request has been raised and is pending IT approval.</p>

    <div class="sec">
      <div class="sec-title">&#128100; Employee</div>
      <table class="tbl">
        <tr><th>Name</th>         <td>${p.empName}</td></tr>
        <tr><th>Employee ID</th>  <td>${p.empId || '&mdash;'}</td></tr>
        <tr><th>Department</th>   <td>${p.department || '&mdash;'}</td></tr>
        <tr><th>Mobile</th>       <td>${p.mobileNo || '&mdash;'}</td></tr>
        <tr><th>Project</th>      <td>${p.project || '&mdash;'}</td></tr>
        ${p.assetId ? `<tr><th>Current Asset</th><td class="mono">${p.assetId}</td></tr>` : ''}
      </table>
    </div>

    <div class="sec">
      <div class="sec-title">&#128230; Requested Items</div>
      <table class="tbl">${rows || '<tr><td>No items listed</td></tr>'}</table>
    </div>

    ${p.reason ? `
    <div class="sec">
      <div class="sec-title">&#128221; Reason</div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px 18px;
                  font-size:14px;color:#14532d;line-height:1.8;">${p.reason}</div>
    </div>` : ''}

    <div class="sec">
      <div class="sec-title">&#8505;&#65039; Request Info</div>
      <table class="tbl">
        <tr><th>Date</th>       <td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><th>Raised By</th>  <td>${p.requestedBy}</td></tr>
        <tr><th>Status</th>     <td><span class="badge badge-amber">Pending Approval</span></td></tr>
      </table>
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Accessory Request — ${p.empName} | ${items.map(i => i.item).filter(Boolean).join(', ') || 'Items'}`,
    html:        wrap(...HDR.accessory, '&#128230;', 'Accessory Request', 'AssetOps · Mindteck IT', '', body),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 5. WELCOME EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendWelcomeEmail = async (p) => {
  validateEmail(p.email);

  const body = `
    <p class="greeting">Welcome, ${p.name}!</p>
    <p class="intro">Your AssetOps account has been created. Use the credentials below to log in.</p>

    <div class="sec">
      <div class="sec-title">&#128273; Login Credentials</div>
      <table class="tbl">
        <tr><th>Login URL</th>  <td><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">${process.env.FRONTEND_URL || 'http://localhost:3000'}</a></td></tr>
        <tr><th>Email</th>      <td>${p.email}</td></tr>
        <tr><th>Password</th>   <td class="mono" style="font-size:16px;">${p.password}</td></tr>
        <tr><th>Role</th>       <td><span class="badge badge-green">${p.role === 'it_staff' ? 'IT Staff' : p.role}</span></td></tr>
      </table>
    </div>

    <div class="notice">Please change your password immediately after first login. Keep credentials confidential.</div>`;

  await sendMail({
    to:          p.email,
    cc:          sysEmail() || undefined,
    subject:     `[AssetOps] Your account is ready — Welcome ${p.name}`,
    html:        wrap(...HDR.welcome, '&#127881;', 'AssetOps Account Created', 'Mindteck IT Asset Management', '', body),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 6. ACCESSORY ALLOCATED EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryAllocatedEmail = async (p) => {
  validateEmail(p.empEmail);

  const cc    = buildCC({ performedByEmail: p.allocatedByEmail, extraCCs: p.extraCCs || [] });
  const items = Array.isArray(p.items) ? p.items : [];
  const rows  = items.map(i => `<tr><th>${i.item || '—'}</th><td>${i.quantity || 1} unit(s)</td></tr>`).join('');

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">The following accessory has been allocated to you by the IT team.</p>

    <div class="sec">
      <div class="sec-title">&#128230; Allocated Items</div>
      <table class="tbl">${rows || '<tr><td>No items listed</td></tr>'}</table>
    </div>

    <div class="sec">
      <div class="sec-title">&#128203; Allocation Info</div>
      <table class="tbl">
        <tr><th>Employee</th>    <td>${p.empName} (${p.empId || '&mdash;'})</td></tr>
        <tr><th>Department</th>  <td>${p.department || '&mdash;'}</td></tr>
        ${p.assetId && p.assetId !== '—' ? `<tr><th>Linked Asset</th><td class="mono">${p.assetId}</td></tr>` : ''}
        <tr><th>Date</th>        <td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><th>Allocated By</th><td>${p.allocatedBy}</td></tr>
        <tr><th>Status</th>      <td><span class="badge badge-green">Allocated &#10003;</span></td></tr>
      </table>
    </div>

    ${p.notes ? `
    <div class="sec">
      <div class="sec-title">&#128221; Notes</div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px 18px;
                  font-size:14px;color:#14532d;line-height:1.8;">${p.notes}</div>
    </div>` : ''}

    <div class="notice">
      If you have not received this item or have any issues, contact
      <a href="mailto:${sysEmail()}">${sysEmail()}</a>.
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Accessory Allocated — ${items.map(i => i.item).filter(Boolean).join(', ') || 'Items'} | ${p.empName}`,
    html:        wrap(...HDR.green, '&#128230;', 'Accessory Allocated', 'AssetOps · Mindteck IT', '', body),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 7. ACCESSORY RECEIVED EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryReceivedEmail = async (p) => {
  validateEmail(p.empEmail);

  const cc = buildCC({ performedByEmail: p.receivedByEmail, extraCCs: p.extraCCs || [] });

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">This confirms that you have received the following accessory from the IT team.</p>

    <div class="sec">
      <div class="sec-title">&#9989; Item Received</div>
      <table class="tbl">
        <tr><th>Item Name</th>    <td>${p.itemName}</td></tr>
        <tr><th>Quantity</th>     <td>${p.quantity || 1} unit(s)</td></tr>
        ${p.assetId && p.assetId !== '—' ? `<tr><th>Linked Asset</th><td class="mono">${p.assetId}</td></tr>` : ''}
        <tr><th>Employee</th>     <td>${p.empName} (${p.empId || '&mdash;'})</td></tr>
        <tr><th>Received Date</th><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><th>Confirmed By</th> <td>${p.receivedBy}</td></tr>
        <tr><th>Status</th>       <td><span class="badge badge-green">Received &#10003;</span></td></tr>
      </table>
    </div>

    <div class="notice">
      Please retain this email as receipt confirmation.
      For any issues contact <a href="mailto:${sysEmail()}">${sysEmail()}</a>.
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Accessory Received — ${p.itemName} | ${p.empName}`,
    html:        wrap(...HDR.blue, '&#9989;', 'Accessory Received', 'AssetOps · Mindteck IT', '', body),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 8. ACCEPTANCE REMINDER EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAcceptanceReminderEmail = async (p) => {
  validateEmail(p.empEmail);

  const sys = sysEmail();
  const cc  = buildCC({ performedByEmail: '', extraCCs: [sys, ...(p.extraCCs || [])] });

  const urgencyColor = p.daysOverdue > 20 ? '#dc2626' : p.daysOverdue > 10 ? '#f59e0b' : '#1d5c3c';
  const urgencyLabel = p.daysOverdue > 20 ? '&#128680; Final Notice'
                     : p.daysOverdue > 10 ? '&#9888;&#65039; Second Reminder'
                     :                      '&#128236; Reminder';

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">
      This is a <strong>${urgencyLabel}</strong> &mdash; you have not yet confirmed receipt of the
      laptop allocated to you.
      ${p.daysOverdue > 0
        ? `Your acceptance was due <strong style="color:${urgencyColor};">${p.daysOverdue} day(s) ago</strong>.`
        : ''}
    </p>

    <div style="background:#fef3c7;border:2px solid #f59e0b;padding:18px 22px;margin-bottom:20px;">
      <div style="font-size:14px;font-weight:800;color:#92400e;margin-bottom:8px;">&#9200; Action Required</div>
      <div style="font-size:13px;color:#78350f;line-height:1.75;">
        Please confirm receipt or report any damage immediately.<br/>
        If you have already returned the laptop, contact IT right away.
      </div>
    </div>

    <div class="sec">
      <div class="sec-title">&#128187; Laptop on Record</div>
      <table class="tbl">
        <tr><th>Asset Number</th>   <td class="mono">${p.assetId}</td></tr>
        <tr><th>Brand / Model</th>  <td>${p.brand || ''} ${p.model || ''}</td></tr>
        <tr><th>Serial Number</th>  <td class="mono">${p.serial || '&mdash;'}</td></tr>
        <tr><th>Allocation Date</th><td>${p.allocationDate || '&mdash;'}</td></tr>
      </table>
    </div>

    <div class="notice">
      Questions? Contact IT at <a href="mailto:${sys}">${sys}</a>.
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] ${urgencyLabel.replace(/&#\d+;/g, '')} — Laptop Acceptance Pending | ${p.assetId}`,
    html:        wrap(...HDR.reminder, '&#9200;', 'Acceptance Pending', 'AssetOps · Mindteck IT', '', body, p.acceptanceLink || ''),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 9. AUDIT EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAuditEmail = async ({
  empName, empEmail, empId, department,
  assetId, brand, model, config, serial, processor, ram, storage,
  accessories, project, client, allocationDate,
  sentBy, sentByEmail, confirmLink, itEmail,
}) => {
  validateEmail(empEmail);

  const formattedDate = allocationDate
    ? new Date(allocationDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

  const accList = Array.isArray(accessories) && accessories.length
    ? accessories.map(a => `<li style="margin:3px 0;color:#444;">${a}</li>`).join('')
    : '<li style="color:#999;font-style:italic;">None recorded</li>';

  const row = (label, value, mono = false) => `
    <tr style="border-bottom:1px solid #edf2ff;">
      <td style="padding:9px 18px;font-size:11.5px;font-weight:600;color:#888;
                 text-transform:uppercase;letter-spacing:.05em;width:38%;
                 white-space:nowrap;">${label}</td>
      <td style="padding:9px 18px;font-size:13px;
                 ${mono
                   ? "font-family:'Courier New',monospace;font-weight:700;color:#1a56db;"
                   : 'color:#222;font-weight:500;'
                 }">${value || '—'}</td>
    </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <title>Asset Audit Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f9;font-family:'Segoe UI',Arial,sans-serif;">

<!-- Outer centering table -->
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#f0f4f9;padding:36px 0;">
  <tr>
    <td align="center" valign="top">

      <!-- Inner 620px content table -->
      <table width="620" cellpadding="0" cellspacing="0" border="0"
             style="width:620px;max-width:100%;background:#ffffff;border:1px solid #dde8ff;">

        <!-- Header -->
        <tr>
          <td bgcolor="#1a56db"
              style="background:linear-gradient(135deg,#1a56db 0%,#4f8ef7 100%);
                     padding:30px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;">
                  <div style="font-size:10.5px;font-weight:700;color:rgba(255,255,255,.65);
                              text-transform:uppercase;letter-spacing:2.5px;margin-bottom:8px;">
                    IT Asset Management &middot; Periodic Audit
                  </div>
                  <div style="font-size:22px;font-weight:800;color:#ffffff;line-height:1.2;">
                    Please confirm your asset
                  </div>
                  <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:6px;">
                    Asset ID: <strong style="color:#fff;">${assetId}</strong>
                  </div>
                </td>
                <td align="right" valign="top" style="padding-left:16px;">
                  <div style="background:rgba(255,255,255,.18);padding:9px 16px;font-size:22px;">
                    &#128203;
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Logo bar -->
        <tr>
          <td style="padding:14px 36px;border-bottom:1px solid #eef2f7;background:#fff;">
            <img src="cid:${LOGO_CID}" alt="Logo" height="32"
                 style="height:32px;width:auto;display:block;"/>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 36px 0;">
            <p style="margin:0 0 10px;font-size:15.5px;color:#1a1a2e;font-weight:700;">
              Hi ${empName},
            </p>
            <p style="margin:0;font-size:14px;color:#555;line-height:1.7;">
              As part of our routine asset audit, we need you to confirm that the laptop
              and accessories listed below are currently <strong>in your possession</strong>
              and in <strong>good working condition</strong>.
            </p>
            <p style="margin:14px 0 0;font-size:13.5px;color:#444;line-height:1.65;">
              &#9989; &nbsp;<strong>Everything is fine?</strong> Click the confirmation button below.<br/>
              &#9888;&#65039; &nbsp;<strong>Issue or discrepancy?</strong> Reply directly to this email &mdash; our IT team will follow up.
            </p>
          </td>
        </tr>

        <!-- Asset Details -->
        <tr>
          <td style="padding:22px 36px 0;">
            <div style="border:1px solid #dde8ff;">
              <div style="background:#e8f0fe;padding:11px 18px;font-size:10.5px;
                          font-weight:700;color:#1a56db;text-transform:uppercase;
                          letter-spacing:1.5px;">
                &#128187; &nbsp;Allocated Asset Details
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f8faff;">
                ${row('Asset ID',        assetId,                     true)}
                ${row('Brand / Model',   `${brand || ''} ${model || ''}`)}
                ${row('Serial Number',   serial,                      true)}
                ${row('Configuration',   config)}
                ${row('Processor',       processor)}
                ${row('RAM',             ram)}
                ${row('Storage',         storage)}
                ${row('Allocation Date', formattedDate)}
                ${row('Project',         project)}
                ${row('Client',          client)}
                ${row('Department',      department)}
              </table>
            </div>
          </td>
        </tr>

        <!-- Accessories -->
        <tr>
          <td style="padding:16px 36px 0;">
            <div style="border:1px solid #dde8ff;">
              <div style="background:#e8f0fe;padding:11px 18px;font-size:10.5px;
                          font-weight:700;color:#1a56db;text-transform:uppercase;
                          letter-spacing:1.5px;">
                &#128230; &nbsp;Accessories
              </div>
              <div style="background:#f8faff;padding:4px 0;">
                <ul style="margin:8px 18px 12px 36px;padding:0;font-size:13px;line-height:1.8;">
                  ${accList}
                </ul>
              </div>
            </div>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:30px 36px 0;text-align:center;">
            ${confirmLink
              ? `<a href="${confirmLink}"
                   style="display:inline-block;background:#16a34a;color:#ffffff;
                          font-size:15px;font-weight:700;padding:15px 44px;
                          text-decoration:none;letter-spacing:0.3px;">
                   &#10003; &nbsp; Yes &mdash; Asset is with me &amp; in good condition
                 </a>
                 <p style="margin:12px 0 0;font-size:12px;color:#aaa;">
                   Clicking this button confirms you have the device and it is working fine.
                 </p>`
              : `<div style="background:#f0f0f0;padding:16px;font-size:13px;color:#666;">
                   No confirmation link available &mdash; please reply to this email.
                 </div>`
            }
          </td>
        </tr>

        <!-- Warning Notice -->
        <tr>
          <td style="padding:22px 36px 0;">
            <div style="background:#fffbea;border-left:4px solid #f59e0b;padding:14px 18px;">
              <p style="margin:0;font-size:12.5px;color:#92400e;line-height:1.65;">
                &#9888;&#65039; <strong>Important:</strong> If the asset is no longer with you,
                has been damaged, lost, or transferred to someone else, please
                <strong>reply to this email immediately</strong> so our IT team
                can update the records accordingly.
              </p>
            </div>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:24px 36px 0;">
            <hr style="border:none;border-top:1px solid #eef2f7;margin:0;"/>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 36px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:12.5px;color:#777;">
              Sent by &nbsp;<strong style="color:#333;">${sentBy}</strong>
              ${sentByEmail
                ? ` &nbsp;&middot;&nbsp; <a href="mailto:${sentByEmail}"
                      style="color:#1a56db;text-decoration:none;">${sentByEmail}</a>`
                : ''
              }
            </p>
            <p style="margin:4px 0 0;font-size:11.5px;color:#bbb;">
              Automated periodic audit email &mdash; Mindteck IT Asset Management System.<br/>
              Employee: <strong>${empId}</strong>
              ${department ? ` &nbsp;&middot;&nbsp; Dept: <strong>${department}</strong>` : ''}
            </p>
          </td>
        </tr>

      </table><!-- /inner 620px table -->

    </td>
  </tr>
</table><!-- /outer wrapper -->

</body>
</html>`;

  await sendMail({
    to:          empEmail,
    replyTo:     itEmail || sysEmail() || process.env.MAIL_USER,
    subject:     `[AssetOps] Asset Audit — Please confirm your laptop | ${assetId}`,
    html,
    attachments: getLogoAttachment(),
  });

  console.log(`📧 Audit email sent → ${empEmail} for asset ${assetId}`);
};