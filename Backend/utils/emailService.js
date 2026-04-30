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
    host:       process.env.MAIL_HOST || 'smtp.office365.com',
    port:       Number(process.env.MAIL_PORT) || 587,
    secure:     false,
    requireTLS: true,
    tls:        { ciphers: 'SSLv3', rejectUnauthorized: false },
    auth:       { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    connectionTimeout: 15000,
    greetingTimeout:   10000,
  });

const getFrom  = () => process.env.MAIL_FROM || `AssetOps <${process.env.MAIL_USER}>`;

// FIX 2: sysEmail() now safely returns empty string instead of undefined
const sysEmail = () => (process.env.SYSADMIN_EMAIL || '').trim();

// FIX 2: buildCC filters out falsy/empty values so 'undefined' never appears in CC
const buildCC = ({ performedByEmail = '', extraCCs = [] } = {}) => {
  const list = [sysEmail(), performedByEmail, ...extraCCs]
    .map(e => (e || '').trim().toLowerCase())
    .filter(e => e && e.includes('@')); // must look like an email
  return [...new Set(list)];
};

// FIX 9: validate recipient before sending
const validateEmail = (email) => {
  if (!email || !String(email).includes('@')) {
    throw new Error(`Invalid or missing recipient email: "${email}"`);
  }
};

// FIX 3: sendMail now throws on failure so callers can handle it
const sendMail = async (options) => {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.log('📧 [Skipped — MAIL_USER/PASS not configured]');
    console.log('   To:', options.to, '| CC:', options.cc);
    return;
  }
  const transporter = createTransporter();
  // FIX: retry once on failure
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await transporter.verify();
      const info = await transporter.sendMail({ from: getFrom(), ...options });
      console.log(`📧 Sent → ${options.to} | ${info.messageId}`);
      return; // success
    } catch (err) {
      lastErr = err;
      console.error(`📧 Attempt ${attempt} FAILED:`, err.message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  // FIX 3: throw after all retries exhausted so caller knows
  throw new Error(`Email delivery failed after 2 attempts: ${lastErr.message}`);
};

// ── Attachment helpers ────────────────────────────────────────────────────────
// FIX 4: CID is now consistently 'company_logo' everywhere
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

/**
 * Convert base64 array → nodemailer inline attachments with unique CIDs
 */
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

// ── Shared CSS ────────────────────────────────────────────────────────────────
const CSS = `
  *{box-sizing:border-box}
  body{margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:660px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;
        box-shadow:0 4px 24px rgba(0,0,0,.10);border:1px solid #e2e8f0}

  /* ── Logo bar ── */
  .logo-bar{background:#fff;padding:16px 32px;border-bottom:3px solid #1d5c3c;
            display:flex;align-items:center;justify-content:space-between}
  .logo-bar img{height:36px;width:auto}
  .logo-tagline{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;font-weight:600}

  /* ── Header banner ── */
  .hdr{padding:28px 32px 24px;position:relative;overflow:hidden}
  .hdr::after{content:'';position:absolute;right:-30px;top:-30px;width:160px;height:160px;
              border-radius:50%;background:rgba(255,255,255,.08)}
  .hdr-icon{font-size:32px;margin-bottom:10px;display:block}
  .hdr-title{color:#fff;font-size:24px;font-weight:800;margin:0 0 4px;letter-spacing:-.3px}
  .hdr-sub{color:rgba(255,255,255,.78);font-size:13px;margin:0}

  /* ── Allocation ID badge ── */
  .alloc-badge{display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);
               color:#fff;font-family:monospace;font-size:13px;font-weight:700;padding:5px 14px;
               border-radius:20px;margin-top:12px;letter-spacing:.05em}

  /* ── Body ── */
  .body{padding:28px 32px}
  .greeting{font-size:17px;color:#1e293b;margin:0 0 6px;font-weight:700}
  .intro{font-size:14px;color:#475569;margin:0 0 24px;line-height:1.75}

  /* ── Section title ── */
  .sec{margin-bottom:20px}
  .sec-title{font-size:10px;font-weight:800;color:#1d5c3c;text-transform:uppercase;
             letter-spacing:.1em;margin:0 0 10px;display:flex;align-items:center;gap:6px}
  .sec-title::after{content:'';flex:1;height:2px;background:linear-gradient(to right,#d1fae5,transparent)}

  /* ── Info table ── */
  .tbl{width:100%;border-collapse:collapse;margin-bottom:0;font-size:13.5px;border-radius:10px;overflow:hidden}
  .tbl tr:first-child td,.tbl tr:first-child th{border-top:none}
  .tbl td,.tbl th{padding:10px 14px;border:1px solid #e8edf2;vertical-align:middle}
  .tbl th{background:#f8fafc;font-size:10.5px;font-weight:700;color:#64748b;
          text-transform:uppercase;letter-spacing:.06em;width:38%;border-right:2px solid #e2e8f0}
  .tbl td{color:#1e293b;font-weight:600}
  .tbl tr:nth-child(even) td{background:#fafcff}
  .tbl td.mono{font-family:monospace;font-size:14px;color:#1d3461;font-weight:700;letter-spacing:.03em}
  .tbl td.green{color:#059669;font-weight:700}
  .tbl td.red{color:#dc2626;font-weight:700}

  /* FIX 1: Swap comparison — replaced CSS grid with table layout (email-client safe) */
  .cmp-outer{width:100%;border-collapse:collapse;margin-bottom:0}
  .cmp-outer td{width:50%;vertical-align:top;padding:0}
  .cmp-outer td:first-child{padding-right:6px}
  .cmp-outer td:last-child{padding-left:6px}
  .cmp-card{border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;width:100%}
  .cmp-hdr{padding:10px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
  .cmp-row{padding:8px 12px;border-bottom:1px solid #f1f5f9}
  .cmp-row:last-child{border-bottom:none}
  .cmp-label{font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;
             letter-spacing:.05em;margin-bottom:2px}
  .cmp-val{color:#1e293b;font-weight:700;font-size:13px}
  .cmp-val.mono{font-family:monospace;font-size:13px;color:#1d3461}

  /* ── Badges ── */
  .badge{display:inline-block;padding:3px 11px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.03em}
  .badge-green{background:#d1fae5;color:#065f46}
  .badge-blue{background:#dbeafe;color:#1e40af}
  .badge-amber{background:#fef3c7;color:#92400e}
  .badge-red{background:#fee2e2;color:#991b1b}
  .badge-purple{background:#ede9fe;color:#5b21b6}

  /* ── Employee photo ── */
  .emp-row{padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:20px}
  .emp-inner{display:flex;align-items:center}
  .emp-avatar{width:60px;height:60px;border-radius:50%;object-fit:cover;
              border:3px solid #1d5c3c;margin-right:16px}
  .emp-avatar-placeholder{width:60px;height:60px;border-radius:50%;background:#1d5c3c;
                           color:#fff;font-size:22px;font-weight:700;text-align:center;
                           line-height:60px;margin-right:16px}
  .emp-info-name{font-size:16px;font-weight:700;color:#1e293b}
  .emp-info-sub{font-size:12px;color:#64748b;margin-top:2px}

  /* ── QR section ── */
  .qr-section{text-align:center;padding:20px;background:linear-gradient(135deg,#f0fdf4,#eff6ff);
              border-radius:12px;border:2px dashed #d1fae5;margin-bottom:20px}
  .qr-section img{width:170px;height:170px;border:4px solid #1d3461;border-radius:10px;
                  padding:5px;background:#fff}
  .qr-label{font-size:13px;font-weight:700;color:#1e293b;margin-top:12px}
  .qr-sub{font-size:12px;color:#64748b;margin-top:4px}
  .qr-link{display:inline-block;margin-top:8px;font-size:11px;color:#1d5c3c;
           text-decoration:underline;font-family:monospace;word-break:break-all}

  /* ── Photos grid ── */
  .photos-section{background:#fffbea;border:1px solid #fde68a;border-radius:10px;
                  padding:14px 16px;margin-bottom:20px}
  .photos-label{font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;
                letter-spacing:.06em;margin-bottom:10px}
  .photos-grid img{width:120px;height:90px;object-fit:cover;border-radius:8px;
                   border:2px solid #e2e8f0;display:inline-block;margin:0 4px 4px 0}

  /* ── Action button ── */
  .action-box{background:#f0fdf4;border:2px solid #16a34a;border-radius:14px;
              padding:20px 24px;margin:20px 0;text-align:center}
  .action-box-title{font-size:15px;font-weight:800;color:#14532d;margin-bottom:6px}
  .action-box-sub{font-size:13px;color:#166534;margin-bottom:16px;line-height:1.6}
  .action-btn{display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
              padding:13px 36px;border-radius:10px;font-size:15px;font-weight:700;
              letter-spacing:.02em}
  .action-note{font-size:11px;color:#6b7280;margin-top:12px}

  /* ── Notice box ── */
  .notice{background:#fffbea;border-left:4px solid #f59e0b;padding:14px 18px;
          font-size:13px;color:#92400e;line-height:1.8;border-radius:0 8px 8px 0;margin-bottom:20px}
  .notice ul{margin:8px 0 0 18px;padding:0}
  .notice li{margin-bottom:4px}

  /* ── Status summary bar — table-based (email safe) ── */
  .status-bar{width:100%;border-collapse:collapse;margin-bottom:20px}
  .status-bar td{width:33%;padding:12px 6px;text-align:center;vertical-align:middle}
  .status-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .status-item-label{font-size:10px;color:#94a3b8;text-transform:uppercase;
                     letter-spacing:.07em;font-weight:600;margin-bottom:4px}
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
// FIX 4: uses LOGO_CID constant instead of hardcoded 'Grasko_logo'
const wrap = (hdrColor, icon, title, sub, allocId, body, acceptLink = '') => {
  const sys = sysEmail();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title><style>${CSS}</style></head><body>
<div class="wrap">
  <div class="logo-bar">
    <img src="cid:${LOGO_CID}" alt="Logo"/>
    <span class="logo-tagline">IT Asset Management</span>
  </div>
  <div class="hdr" style="background:${hdrColor}">
    <span class="hdr-icon">${icon}</span>
    <p class="hdr-title">${title}</p>
    <p class="hdr-sub">${sub}</p>
    ${allocId ? `<div class="alloc-badge">${allocId}</div>` : ''}
  </div>
  <div class="body">
    ${body}
    ${acceptLink ? `
    <div class="action-box">
      <div class="action-box-title">&#9889; Action Required</div>
      <div class="action-box-sub">Please confirm receipt of your laptop or report any damage within <strong>10 days</strong>.</div>
      <a class="action-btn" href="${acceptLink}">&#10003; Confirm Receipt / Report Damage</a>
      <div class="action-note">Link expires in 10 days &nbsp;&middot;&nbsp;
        <a href="mailto:${sys}">Contact IT</a> for help</div>
    </div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-brand">Grasko IT Asset Management &mdash; AssetOps</div>
    ${sys ? `<a href="mailto:${sys}">${sys}</a>` : ''}
  </div>
</div></body></html>`;
};

// ── Helper: employee card (email-client safe — no flexbox) ────────────────────
const empCard = (name, id, dept, mobile, email, hasPhoto) =>
`<div class="emp-row">
  <table style="border-collapse:collapse;width:100%"><tr>
    <td style="width:76px;vertical-align:middle;padding:0">
      ${hasPhoto
        ? `<img class="emp-avatar" src="cid:employee_photo" alt="${name}" width="60" height="60"/>`
        : `<div class="emp-avatar-placeholder">${(name || '?')[0].toUpperCase()}</div>`
      }
    </td>
    <td style="vertical-align:middle;padding:0">
      <div class="emp-info-name">${name}</div>
      <div class="emp-info-sub">${[id, dept, mobile, email].filter(Boolean).join(' &middot; ')}</div>
    </td>
  </tr></table>
</div>`;

// ── Helper: photo grid section ────────────────────────────────────────────────
const photoGrid = (cids, label, warning = '') => {
  if (!cids.length) return '';
  const imgs = cids.map(cid => `<img src="cid:${cid}" alt="${label}" width="120" height="90"/>`).join('');
  return `<div class="photos-section">
    <div class="photos-label">&#128247; ${label}</div>
    ${warning ? `<div style="font-size:12px;color:#92400e;margin-bottom:8px">${warning}</div>` : ''}
    <div class="photos-grid">${imgs}</div>
  </div>`;
};

// ── Helper: QR section ────────────────────────────────────────────────────────
const qrSection = (qrUrl) =>
`<div class="qr-section">
  <img src="cid:asset_qr" alt="Asset QR Code" width="170" height="170"/>
  <div class="qr-label">Scan to view your asset details</div>
  <div class="qr-sub">Shows laptop info, serial number &amp; allocation details</div>
  ${qrUrl ? `<a class="qr-link" href="${qrUrl}">${qrUrl}</a>` : ''}
</div>`;

// FIX 1: Swap comparison table — uses HTML table instead of CSS grid (email-client safe)
const swapCompareTable = (p) =>
`<table class="cmp-outer"><tr>
  <td>
    <table class="cmp-card">
      <tr><td><div class="cmp-hdr" style="background:#fee2e2;color:#991b1b">&#8617; Returned Laptop</div></td></tr>
      <tr><td><div class="cmp-row"><div class="cmp-label">Asset No</div><div class="cmp-val mono" style="color:#dc2626">${p.oldAssetId}</div></div></td></tr>
      <tr><td><div class="cmp-row"><div class="cmp-label">Brand / Model</div><div class="cmp-val">${p.oldBrand} ${p.oldModel}</div></div></td></tr>
      <tr><td><div class="cmp-row"><div class="cmp-label">Serial</div><div class="cmp-val mono">${p.oldSerial || '&mdash;'}</div></div></td></tr>
    </table>
  </td>
  <td>
    <table class="cmp-card">
      <tr><td><div class="cmp-hdr" style="background:#d1fae5;color:#065f46">&#10003; New Laptop Issued</div></td></tr>
      <tr><td><div class="cmp-row"><div class="cmp-label">Asset No</div><div class="cmp-val mono" style="color:#059669">${p.newAssetId}</div></div></td></tr>
      <tr><td><div class="cmp-row"><div class="cmp-label">Brand / Model</div><div class="cmp-val">${p.newBrand} ${p.newModel}</div></div></td></tr>
      <tr><td><div class="cmp-row"><div class="cmp-label">Serial</div><div class="cmp-val mono">${p.newSerial || '&mdash;'}</div></div></td></tr>
    </table>
  </td>
</tr></table>`;

// FIX: Status summary bar using table (not CSS grid)
const statusBar = (items) =>
`<table class="status-bar"><tr>
  ${items.map(item => `
  <td>
    <div class="status-item">
      <div class="status-item-label">${item.label}</div>
      <div class="status-item-val">${item.value}</div>
    </div>
  </td>`).join('')}
</tr></table>`;


// ═══════════════════════════════════════════════════════════════════════════════
// 1. ALLOCATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAllocationEmail = async (p) => {
  // FIX 9: validate required email
  validateEmail(p.empEmail);

  const accessories = (p.accessories || []).join(', ') || 'None';
  const cc          = buildCC({ performedByEmail: p.allocatedByEmail, extraCCs: p.extraCCs });
  const photoAtts   = getPhotoAttachment(p.photoUrl);
  const hasPhoto    = photoAtts.length > 0;

  // FIX 7: Agreement generation — warn but continue without attachment
  let agreementBuffer = null;
  try {
    agreementBuffer = await generateAgreement({
      empName: p.empName, empId: p.empId, department: p.department,
      position: p.department || 'Employee', mobileNo: p.mobileNo || '',
      assetId: p.assetId, serial: p.serial, brand: p.brand, model: p.model,
      config: p.config || '', accessories: p.accessories || [],
      allocationDate: p.allocationDate,
      managerName:  'Prem Kumar N',
      managerEmail: 'prem@kanrad.com',
      contactPerson: 'Prem Kumar N',
      contactEmail:  'prem@kanrad.com',
    });
  } catch (e) {
    console.error('⚠️  Agreement generation failed — email will send WITHOUT attachment:', e.message);
  }

  // Damage / condition photos
  const { attachments: condAtts, cids: condCids } = buildPhotoAttachments(
    Array.isArray(p.damagePhotosArray) ? p.damagePhotosArray : [], 'cond'
  );
  // Fallback: legacy JSON string
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

  // FIX 8: use UTC to avoid midnight/timezone deadline shift
  const allocMs      = new Date(p.allocationDate || Date.now()).getTime();
  const deadlineDate = new Date(allocMs + 10 * 24 * 60 * 60 * 1000);
  const deadlineStr  = deadlineDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const body = `
    ${empCard(p.empName, p.empId, p.department, p.mobileNo, p.empEmail, hasPhoto)}

    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">
      A laptop has been issued to you by the Grasko IT team. All details are listed below.
      The <strong>Employee Laptop Agreement</strong>${agreementBuffer ? ' is attached' : ' will be sent separately'} &mdash; please sign and return it to
      <a href="mailto:prem@kanrad.com">prem@kanrad.com</a>
      by <strong>${deadlineStr}</strong>.
    </p>

    ${p.qrCodeBuffer ? qrSection(p.qrCardUrl || '') : ''}

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
            ? `<span class="badge badge-blue">Courier</span>${p.deliveryAddress ? `<div style="margin-top:4px;font-size:12px;color:#475569">${p.deliveryAddress}</div>` : ''}`
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
        <li>Return signed copy to <strong>prem@kanrad.com</strong> by <strong>${deadlineStr}</strong></li>
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
  if (p.qrCodeBuffer) {
    attachments.push({ filename: 'asset_qr.png', content: p.qrCodeBuffer, cid: 'asset_qr', contentType: 'image/png' });
  }

  await sendMail({
    to:          toList.join(', '),
    cc:          cc.join(', '),
    subject:     `[AssetOps] Laptop Allocated — ${p.assetId} | ${p.empName}`,
    html:        wrap('linear-gradient(135deg,#1d3461,#1d5c3c)', '&#128187;', 'Laptop Allocated', 'AssetOps · Grasko IT', p.allocationId, body, p.acceptanceLink || ''),
    attachments,
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 2. RECEIVE / RETURN EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendReceiveEmail = async (p) => {
  // FIX 9: validate required email
  validateEmail(p.empEmail);

  const cc = buildCC({ performedByEmail: p.receivedByEmail, extraCCs: p.extraCCs });

  // Return condition photos
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

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">
      Your laptop has been successfully returned and processed by the IT team.
      Please find the complete return summary below.
    </p>

    ${statusBar([
      { label: 'Return Date', value: `<span style="font-size:13px">${p.returnDate}</span>` },
      { label: 'Condition',   value: `<span class="badge ${condBadge}" style="font-size:11px">${condLabel}</span>` },
      { label: 'Asset Status',value: `<span class="badge ${stsBadge}" style="font-size:11px">${p.newStatus}</span>` },
    ])}

    <div class="sec">
      <div class="sec-title">&#128100; Employee</div>
      <table class="tbl">
        <tr><th>Full Name</th><td>${p.empName}</td></tr>
        <tr><th>Employee ID</th><td>${p.empId || '&mdash;'}</td></tr>
        <tr><th>Department</th><td>${p.department || '&mdash;'}</td></tr>
        <tr><th>Mobile</th><td>${p.mobileNo || '&mdash;'}</td></tr>
      </table>
    </div>

    <div class="sec">
      <div class="sec-title">&#128187; Returned Laptop</div>
      <table class="tbl">
        <tr><th>Asset Number</th><td class="mono">${p.assetId}</td></tr>
        <tr><th>Brand / Model</th><td>${p.brand || ''} ${p.model || ''}</td></tr>
        <tr><th>Serial Number</th><td class="mono">${p.serial || '&mdash;'}</td></tr>
        <tr><th>Processed By</th><td>${p.receivedBy}</td></tr>
      </table>
    </div>

    ${p.damageDescription ? `
    <div class="sec">
      <div class="sec-title">&#9888;&#65039; Damage / Issue Notes</div>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;
                  padding:14px 18px;font-size:14px;color:#7c2d12;line-height:1.8">
        ${p.damageDescription}
      </div>
    </div>` : ''}

    ${retCids.length ? photoGrid(retCids, 'Laptop Condition at Return') : ''}

    <div class="notice">
      This email confirms the successful return of the above laptop.
      Please retain it for your records. For any discrepancies contact
      <a href="mailto:${sysEmail()}">${sysEmail()}</a>.
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Laptop Returned — ${p.assetId} | ${p.empName}`,
    html:        wrap('linear-gradient(135deg,#059669,#047857)', '&#128229;', 'Laptop Returned', 'AssetOps · Grasko IT', '', body),
    attachments: [...getLogoAttachment(), ...retAtts],
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 3. SWAP EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendSwapEmail = async (p) => {
  // FIX 9: validate required email
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
      Your laptop has been swapped by the IT team. The details of both the returned and newly issued
      laptops are shown below.
    </p>

    ${p.qrCodeBuffer ? qrSection(p.qrCardUrl || '') : ''}

    <div class="sec">
      <div class="sec-title">&#128260; Swap Summary</div>
      ${swapCompareTable(p)}
    </div>

    <div class="sec" style="margin-top:16px">
      <div class="sec-title">&#128203; Swap Details</div>
      <table class="tbl">
        <tr><th>New Config</th><td>${p.newConfig || '&mdash;'}</td></tr>
        <tr><th>Swap Reason</th><td>${p.issueType || '&mdash;'}</td></tr>
        <tr><th>Description</th><td>${p.issueDescription || '&mdash;'}</td></tr>
        <tr><th>Swap Date</th><td>${p.swapDate}</td></tr>
        <tr><th>Processed By</th><td>${p.swappedBy}</td></tr>
        ${p.preparedBy ? `<tr><th>Prepared By</th><td>${p.preparedBy}</td></tr>` : ''}
        <tr><th>Project</th><td>${p.project || '&mdash;'}</td></tr>
      </table>
    </div>

    ${issueCids.length ? photoGrid(issueCids, 'Issue / Damage Photos (Old Laptop)') : ''}

    <div class="notice">
      Your new laptop is ready. For any hardware issues contact
      <a href="mailto:${sysEmail()}">${sysEmail()}</a>.
    </div>`;

  const attachments = [...getLogoAttachment(), ...photoAtts, ...issueAtts];
  if (p.qrCodeBuffer) {
    attachments.push({ filename: 'new_asset_qr.png', content: p.qrCodeBuffer, cid: 'asset_qr', contentType: 'image/png' });
  }

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Laptop Swapped — ${p.oldAssetId} → ${p.newAssetId} | ${p.empName}`,
    html:        wrap('linear-gradient(135deg,#7c3aed,#5b21b6)', '&#128260;', 'Laptop Swapped', 'AssetOps · Grasko IT', p.newAllocationId, body),
    attachments,
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 4. ACCESSORIES REQUEST EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryRequestEmail = async (p) => {
  validateEmail(p.empEmail);

  const cc = buildCC({ performedByEmail: p.requestedByEmail, extraCCs: p.extraCCs || [] });

  // FIX 6: safe guard against undefined items
  const items = Array.isArray(p.items) ? p.items : [];
  const rows  = items.map(i => `<tr><th>${i.item || '—'}</th><td>${i.quantity || 1} unit(s)</td></tr>`).join('');

  const body = `
    <p class="greeting">Accessory Request &mdash; ${p.empName}</p>
    <p class="intro">The following accessory request has been raised and is pending IT approval.</p>

    <div class="sec">
      <div class="sec-title">&#128100; Employee</div>
      <table class="tbl">
        <tr><th>Name</th><td>${p.empName}</td></tr>
        <tr><th>Employee ID</th><td>${p.empId || '&mdash;'}</td></tr>
        <tr><th>Department</th><td>${p.department || '&mdash;'}</td></tr>
        <tr><th>Mobile</th><td>${p.mobileNo || '&mdash;'}</td></tr>
        <tr><th>Project</th><td>${p.project || '&mdash;'}</td></tr>
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
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                  padding:14px 18px;font-size:14px;color:#14532d;line-height:1.8">
        ${p.reason}
      </div>
    </div>` : ''}

    <div class="sec">
      <div class="sec-title">&#8505;&#65039; Request Info</div>
      <table class="tbl">
        <tr><th>Date</th><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><th>Raised By</th><td>${p.requestedBy}</td></tr>
        <tr><th>Status</th><td><span class="badge badge-amber">Pending Approval</span></td></tr>
      </table>
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Accessory Request — ${p.empName} | ${items.map(i => i.item).filter(Boolean).join(', ') || 'Items'}`,
    html:        wrap('linear-gradient(135deg,#d97706,#b45309)', '&#128230;', 'Accessory Request', 'AssetOps · Grasko IT', '', body),
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
        <tr><th>Login URL</th><td><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">${process.env.FRONTEND_URL || 'http://localhost:3000'}</a></td></tr>
        <tr><th>Email</th><td>${p.email}</td></tr>
        <tr><th>Password</th><td class="mono" style="font-size:16px;letter-spacing:.05em">${p.password}</td></tr>
        <tr><th>Role</th><td><span class="badge badge-green">${p.role === 'it_staff' ? 'IT Staff' : p.role}</span></td></tr>
      </table>
    </div>

    <div class="notice">Please change your password immediately after first login. Keep credentials confidential.</div>`;

  await sendMail({
    to:          p.email,
    cc:          sysEmail() || undefined,
    subject:     `[AssetOps] Your account is ready — Welcome ${p.name}`,
    html:        wrap('linear-gradient(135deg,#0f172a,#1d3461)', '&#127881;', 'AssetOps Account Created', 'Grasko IT Asset Management', '', body),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 6. ACCESSORY ALLOCATED EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryAllocatedEmail = async (p) => {
  validateEmail(p.empEmail);

  const cc    = buildCC({ performedByEmail: p.allocatedByEmail, extraCCs: p.extraCCs || [] });
  // FIX 6: safe guard
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
        <tr><th>Employee</th><td>${p.empName} (${p.empId || '&mdash;'})</td></tr>
        <tr><th>Department</th><td>${p.department || '&mdash;'}</td></tr>
        ${p.assetId && p.assetId !== '—' ? `<tr><th>Linked Asset</th><td class="mono">${p.assetId}</td></tr>` : ''}
        <tr><th>Date</th><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><th>Allocated By</th><td>${p.allocatedBy}</td></tr>
        <tr><th>Status</th><td><span class="badge badge-green">Allocated &#10003;</span></td></tr>
      </table>
    </div>

    ${p.notes ? `
    <div class="sec">
      <div class="sec-title">&#128221; Notes</div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                  padding:14px 18px;font-size:14px;color:#14532d;line-height:1.8">${p.notes}</div>
    </div>` : ''}

    <div class="notice">
      If you have not received this item or have any issues, contact
      <a href="mailto:${sysEmail()}">${sysEmail()}</a>.
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Accessory Allocated — ${items.map(i => i.item).filter(Boolean).join(', ') || 'Items'} | ${p.empName}`,
    html:        wrap('linear-gradient(135deg,#059669,#047857)', '&#128230;', 'Accessory Allocated', 'AssetOps · Grasko IT', '', body),
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
        <tr><th>Item Name</th><td>${p.itemName}</td></tr>
        <tr><th>Quantity</th><td>${p.quantity || 1} unit(s)</td></tr>
        ${p.assetId && p.assetId !== '—' ? `<tr><th>Linked Asset</th><td class="mono">${p.assetId}</td></tr>` : ''}
        <tr><th>Employee</th><td>${p.empName} (${p.empId || '&mdash;'})</td></tr>
        <tr><th>Received Date</th><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><th>Confirmed By</th><td>${p.receivedBy}</td></tr>
        <tr><th>Status</th><td><span class="badge badge-green">Received &#10003;</span></td></tr>
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
    html:        wrap('linear-gradient(135deg,#2563eb,#1d4ed8)', '&#9989;', 'Accessory Received', 'AssetOps · Grasko IT', '', body),
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
      ${p.daysOverdue > 0 ? `Your acceptance was due <strong style="color:${urgencyColor}">${p.daysOverdue} day(s) ago</strong>.` : ''}
    </p>

    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:12px;
                padding:18px 22px;margin-bottom:20px">
      <div style="font-size:14px;font-weight:800;color:#92400e;margin-bottom:8px">&#9200; Action Required</div>
      <div style="font-size:13px;color:#78350f;line-height:1.75">
        Please confirm receipt or report any damage immediately.<br/>
        If you have already returned the laptop, contact IT right away.
      </div>
    </div>

    <div class="sec">
      <div class="sec-title">&#128187; Laptop on Record</div>
      <table class="tbl">
        <tr><th>Asset Number</th><td class="mono">${p.assetId}</td></tr>
        <tr><th>Brand / Model</th><td>${p.brand || ''} ${p.model || ''}</td></tr>
        <tr><th>Serial Number</th><td class="mono">${p.serial || '&mdash;'}</td></tr>
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
    html:        wrap('linear-gradient(135deg,#d97706,#b45309)', '&#9200;', 'Acceptance Pending', 'AssetOps · Grasko IT', '', body, p.acceptanceLink || ''),
    attachments: getLogoAttachment(),
  });
};