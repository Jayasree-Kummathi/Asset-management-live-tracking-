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
const sysEmail = () => process.env.SYSADMIN_EMAIL;

const buildCC = ({ performedByEmail = '', extraCCs = [] } = {}) => {
  const list = [sysEmail(), performedByEmail, ...extraCCs]
    .map(e => (e || '').trim().toLowerCase()).filter(Boolean);
  return [...new Set(list)];
};

const sendMail = async (options) => {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.log('📧 [Skipped — MAIL_USER/PASS not configured]');
    console.log('   To:', options.to, '| CC:', options.cc);
    return;
  }
  const transporter = createTransporter();
  try {
    await transporter.verify();
    const info = await transporter.sendMail({ from: getFrom(), ...options });
    console.log(`📧 Sent → ${options.to} | ${info.messageId}`);
  } catch (err) {
    console.error('📧 FAILED:', err.message);
  }
};

// ── Attachment helpers ────────────────────────────────────────────────────────
const getLogoAttachment = () => {
  try {
    if (fs.existsSync(LOGO_PATH)) {
      return [{ filename: 'mindteck_logo.jpg', path: LOGO_PATH, cid: 'mindteck_logo', contentType: 'image/jpeg' }];
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
    return [{ filename: `employee_photo.${mime.split('/')[1]||'jpg'}`, content: Buffer.from(b64, 'base64'), cid: 'employee_photo', contentType: mime }];
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
      attachments.push({ filename: `${prefix}_${i+1}.${mime.split('/')[1]||'jpg'}`, content: Buffer.from(b64,'base64'), cid, contentType: mime });
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

  /* ── Comparison table (swap) ── */
  .cmp-wrap{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:0}
  .cmp-card{border-radius:10px;overflow:hidden;border:1px solid #e2e8f0}
  .cmp-hdr{padding:10px 14px;font-size:11px;font-weight:800;text-transform:uppercase;
           letter-spacing:.08em;display:flex;align-items:center;gap:6px}
  .cmp-body td{padding:8px 12px;font-size:13px;border-bottom:1px solid #f1f5f9;display:flex;
               flex-direction:column}
  .cmp-label{font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;
             letter-spacing:.05em;margin-bottom:2px}
  .cmp-val{color:#1e293b;font-weight:700}
  .cmp-val.mono{font-family:monospace;font-size:13px;color:#1d3461}

  /* ── Badges ── */
  .badge{display:inline-block;padding:3px 11px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.03em}
  .badge-green{background:#d1fae5;color:#065f46}
  .badge-blue{background:#dbeafe;color:#1e40af}
  .badge-amber{background:#fef3c7;color:#92400e}
  .badge-red{background:#fee2e2;color:#991b1b}
  .badge-purple{background:#ede9fe;color:#5b21b6}

  /* ── Employee photo ── */
  .emp-row{display:flex;align-items:center;gap:16px;padding:14px 16px;
           background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:20px}
  .emp-avatar{width:60px;height:60px;border-radius:50%;object-fit:cover;
              border:3px solid #1d5c3c;flex-shrink:0}
  .emp-avatar-placeholder{width:60px;height:60px;border-radius:50%;background:#1d5c3c;
                           display:flex;align-items:center;justify-content:center;
                           color:#fff;font-size:22px;font-weight:700;flex-shrink:0}
  .emp-info-name{font-size:16px;font-weight:700;color:#1e293b}
  .emp-info-sub{font-size:12px;color:#64748b;margin-top:2px}

  /* ── QR section ── */
  .qr-section{text-align:center;padding:20px;background:linear-gradient(135deg,#f0fdf4,#eff6ff);
              border-radius:12px;border:2px dashed #d1fae5;margin-bottom:20px}
  .qr-section img{width:170px;height:170px;border:4px solid #1d3461;border-radius:10px;
                  padding:5px;background:#fff;display:block;margin:0 auto}
  .qr-label{font-size:13px;font-weight:700;color:#1e293b;margin-top:12px}
  .qr-sub{font-size:12px;color:#64748b;margin-top:4px}
  .qr-link{display:inline-block;margin-top:8px;font-size:11px;color:#1d5c3c;
           text-decoration:underline;font-family:monospace;word-break:break-all}

  /* ── Photos grid ── */
  .photos-section{background:#fffbea;border:1px solid #fde68a;border-radius:10px;
                  padding:14px 16px;margin-bottom:20px}
  .photos-label{font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;
                letter-spacing:.06em;margin-bottom:10px;display:flex;align-items:center;gap:6px}
  .photos-grid{display:flex;flex-wrap:wrap;gap:8px}
  .photos-grid img{width:120px;height:90px;object-fit:cover;border-radius:8px;
                   border:2px solid #e2e8f0;display:inline-block}

  /* ── Action button ── */
  .action-box{background:#f0fdf4;border:2px solid #16a34a;border-radius:14px;
              padding:20px 24px;margin:20px 0;text-align:center}
  .action-box-title{font-size:15px;font-weight:800;color:#14532d;margin-bottom:6px}
  .action-box-sub{font-size:13px;color:#166534;margin-bottom:16px;line-height:1.6}
  .action-btn{display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);
              color:#fff;text-decoration:none;padding:13px 36px;border-radius:10px;
              font-size:15px;font-weight:700;letter-spacing:.02em;
              box-shadow:0 4px 12px rgba(22,163,74,.3)}
  .action-note{font-size:11px;color:#6b7280;margin-top:12px}

  /* ── Notice box ── */
  .notice{background:#fffbea;border-left:4px solid #f59e0b;padding:14px 18px;
          font-size:13px;color:#92400e;line-height:1.8;border-radius:0 8px 8px 0;margin-bottom:20px}
  .notice ul{margin:8px 0 0 18px;padding:0}
  .notice li{margin-bottom:4px}

  /* ── Status summary bar ── */
  .status-bar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px}
  .status-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
               padding:12px;text-align:center}
  .status-item-label{font-size:10px;color:#94a3b8;text-transform:uppercase;
                     letter-spacing:.07em;font-weight:600;margin-bottom:4px}
  .status-item-val{font-size:15px;font-weight:800;color:#1e293b}

  /* ── Divider ── */
  .divider{height:1px;background:linear-gradient(to right,transparent,#e2e8f0,transparent);
           margin:20px 0}

  /* ── Footer ── */
  .footer{background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;
          text-align:center;border-top:1px solid #e2e8f0}
  .footer a{color:#1d5c3c;text-decoration:none}
  .footer-brand{font-weight:700;color:#475569;margin-bottom:4px}
`;

// ── Layout wrapper ─────────────────────────────────────────────────────────────
const wrap = (hdrColor, icon, title, sub, allocId, body, acceptLink = '') =>
`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title><style>${CSS}</style></head><body>
<div class="wrap">
  <div class="logo-bar">
    <img src="cid:mindteck_logo" alt="Mindteck"/>
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
      <div class="action-box-title">⚡ Action Required</div>
      <div class="action-box-sub">Please confirm receipt of your laptop or report any damage within <strong>10 days</strong>.</div>
      <a class="action-btn" href="${acceptLink}">✓ Confirm Receipt / Report Damage</a>
      <div class="action-note">Link expires in 10 days &nbsp;·&nbsp;
        <a href="mailto:${sysEmail()}">Contact IT</a> for help</div>
    </div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-brand">Mindteck IT Asset Management — AssetOps</div>
    <a href="mailto:${sysEmail()}">${sysEmail()}</a>
  </div>
</div></body></html>`;

// ── Helper: employee card (with optional photo) ───────────────────────────────
const empCard = (name, id, dept, mobile, email, hasPhoto) =>
`<div class="emp-row">
  ${hasPhoto
    ? `<img class="emp-avatar" src="cid:employee_photo" alt="${name}"/>`
    : `<div class="emp-avatar-placeholder">${(name||'?')[0].toUpperCase()}</div>`
  }
  <div>
    <div class="emp-info-name">${name}</div>
    <div class="emp-info-sub">${[id, dept, mobile, email].filter(Boolean).join(' · ')}</div>
  </div>
</div>`;

// ── Helper: photo grid section ────────────────────────────────────────────────
const photoGrid = (cids, label, warning = '') => {
  if (!cids.length) return '';
  const imgs = cids.map(cid =>
    `<img src="cid:${cid}" alt="${label}"/>`
  ).join('');
  return `<div class="photos-section">
    <div class="photos-label">📷 ${label}</div>
    ${warning ? `<div style="font-size:12px;color:#92400e;margin-bottom:8px">${warning}</div>` : ''}
    <div class="photos-grid">${imgs}</div>
  </div>`;
};

// ── Helper: QR section ────────────────────────────────────────────────────────
const qrSection = (qrUrl) =>
`<div class="qr-section">
  <img src="cid:asset_qr" alt="Asset QR Code"/>
  <div class="qr-label">Scan to view your asset details</div>
  <div class="qr-sub">Shows laptop info, serial number &amp; allocation details</div>
  <a class="qr-link" href="${qrUrl}">${qrUrl}</a>
</div>`;


// ═══════════════════════════════════════════════════════════════════════════════
// 1. ALLOCATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAllocationEmail = async (p) => {
  const accessories  = (p.accessories || []).join(', ') || 'None';
  const cc           = buildCC({ performedByEmail: p.allocatedByEmail, extraCCs: p.extraCCs });
  const photoAtts    = getPhotoAttachment(p.photoUrl);
  const hasPhoto     = photoAtts.length > 0;

  // Agreement PDF
  let agreementBuffer = null;
  try {
    agreementBuffer = await generateAgreement({
      empName: p.empName, empId: p.empId, department: p.department,
      position: p.department || 'Employee', mobileNo: p.mobileNo || '',
      assetId: p.assetId, serial: p.serial, brand: p.brand, model: p.model,
      config: p.config || '', accessories: p.accessories || [],
      allocationDate: p.allocationDate,
      managerName:  'Vasudevan D K',
      managerEmail: 'Vasudevan.kannan@mindteck.com',
      contactPerson: 'Vasudevan D K',
      contactEmail:  'Vasudevan.kannan@mindteck.com',
    });
  } catch (e) { console.error('Agreement gen failed:', e.message); }

  // Damage / condition photos
  const { attachments: condAtts, cids: condCids } = buildPhotoAttachments(
    Array.isArray(p.damagePhotosArray) ? p.damagePhotosArray : [], 'cond'
  );
  // Fallback: legacy JSON string
  if (!condCids.length) {
    try {
      const legacy = JSON.parse(p.damagePhotos || '[]');
      if (legacy.length) {
        const fb = buildPhotoAttachments(legacy, 'cond');
        condAtts.push(...fb.attachments);
        condCids.push(...fb.cids);
      }
    } catch (_) {}
  }

  const deadlineDate = new Date(p.allocationDate || Date.now());
  deadlineDate.setDate(deadlineDate.getDate() + 10);
  const deadlineStr  = deadlineDate.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });

  const body = `
    ${empCard(p.empName, p.empId, p.department, p.mobileNo, p.empEmail, hasPhoto)}

    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">
      A laptop has been issued to you by the Mindteck IT team. All details are listed below.
      The <strong>Employee Laptop Agreement</strong> is attached — please sign and return it to
      <a href="mailto:laptop.consent@mindteck.com">laptop.consent@mindteck.com</a>
      by <strong>${deadlineStr}</strong>.
    </p>

    ${p.qrCodeBuffer ? qrSection(p.qrCardUrl || '') : ''}

    <div class="sec">
      <div class="sec-title">💻 Laptop Details</div>
      <table class="tbl">
        <tr><th>Asset Number</th><td class="mono">${p.assetId}</td></tr>
        <tr><th>Brand / Model</th><td>${p.brand} ${p.model}</td></tr>
        <tr><th>Configuration</th><td>${p.config || '—'}</td></tr>
        <tr><th>Serial Number</th><td class="mono">${p.serial}</td></tr>
        <tr><th>Accessories</th><td>${accessories}</td></tr>
        <tr><th>Warranty End</th><td>${p.warrantyEnd || '—'}</td></tr>
      </table>
    </div>

    <div class="sec">
      <div class="sec-title">📋 Allocation Details</div>
      <table class="tbl">
        <tr><th>Allocation ID</th><td class="mono">${p.allocationId || '—'}</td></tr>
        <tr><th>Allocation Date</th><td>${p.allocationDate}</td></tr>
        <tr><th>Project / Client</th><td>${p.project || '—'} / ${p.client || '—'}</td></tr>
        <tr><th>Prepared By</th><td>${p.preparedBy || p.allocatedBy || '—'}</td></tr>
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
          '⚠️ Pre-existing condition documented before issuance.')
      : ''
    }

    <div class="notice">
      <strong>⚠️ Important:</strong>
      <ul>
        <li>Review and sign the attached <strong>Employee Laptop Agreement</strong></li>
        <li>Return signed copy to <strong>laptop.consent@mindteck.com</strong> by <strong>${deadlineStr}</strong></li>
        <li>Non-response by ${deadlineStr} will be treated as acceptance</li>
        <li>Hardware issues? Contact <a href="mailto:${sysEmail()}">${sysEmail()}</a></li>
      </ul>
    </div>`;

  const toList     = [p.empEmail];
  if (p.personalEmail && p.personalEmail !== p.empEmail) toList.push(p.personalEmail);

  const attachments = [...getLogoAttachment(), ...photoAtts, ...condAtts];
  if (agreementBuffer) {
    attachments.push({
      filename:    `Laptop_Agreement_${(p.empName||'').replace(/\s+/g,'_')}_${p.assetId}.docx`,
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
    html:        wrap(
      'linear-gradient(135deg,#1d3461,#1d5c3c)',
      '💻', 'Laptop Allocated', 'AssetOps · Mindteck IT',
      p.allocationId, body, p.acceptanceLink || ''
    ),
    attachments,
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 2. RECEIVE / RETURN EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendReceiveEmail = async (p) => {
  const cc = buildCC({ performedByEmail: p.receivedByEmail, extraCCs: p.extraCCs });

  // Return condition photos (passed as array)
  const { attachments: retAtts, cids: retCids } = buildPhotoAttachments(
    Array.isArray(p.damagePhotos) ? p.damagePhotos : [], 'ret'
  );

  const condLabel  = p.newStatus === 'Stock'  ? 'Good — No Damage'
                   : p.newStatus === 'Repair' ? 'Needs Repair'
                   :                            'Damaged / Scrap';
  const condBadge  = p.newStatus === 'Stock'  ? 'badge-green'
                   : p.newStatus === 'Repair' ? 'badge-amber'
                   :                            'badge-red';
  const stsBadge   = p.newStatus === 'Stock'  ? 'badge-green'
                   : p.newStatus === 'Repair' ? 'badge-amber'
                   :                            'badge-red';

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">
      Your laptop has been successfully returned and processed by the IT team. 
      Please find the complete return summary below.
    </p>

    <div class="status-bar">
      <div class="status-item">
        <div class="status-item-label">Return Date</div>
        <div class="status-item-val" style="font-size:13px">${p.returnDate}</div>
      </div>
      <div class="status-item">
        <div class="status-item-label">Condition</div>
        <div class="status-item-val"><span class="badge ${condBadge}" style="font-size:11px">${condLabel}</span></div>
      </div>
      <div class="status-item">
        <div class="status-item-label">Asset Status</div>
        <div class="status-item-val"><span class="badge ${stsBadge}" style="font-size:11px">${p.newStatus}</span></div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-title">👤 Employee</div>
      <table class="tbl">
        <tr><th>Full Name</th><td>${p.empName}</td></tr>
        <tr><th>Employee ID</th><td>${p.empId || '—'}</td></tr>
        <tr><th>Department</th><td>${p.department || '—'}</td></tr>
        <tr><th>Mobile</th><td>${p.mobileNo || '—'}</td></tr>
      </table>
    </div>

    <div class="sec">
      <div class="sec-title">💻 Returned Laptop</div>
      <table class="tbl">
        <tr><th>Asset Number</th><td class="mono">${p.assetId}</td></tr>
        <tr><th>Brand / Model</th><td>${p.brand || ''} ${p.model || ''}</td></tr>
        <tr><th>Serial Number</th><td class="mono">${p.serial || '—'}</td></tr>
        <tr><th>Processed By</th><td>${p.receivedBy}</td></tr>
      </table>
    </div>

    ${p.damageDescription ? `
    <div class="sec">
      <div class="sec-title">⚠️ Damage / Issue Notes</div>
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
    html:        wrap(
      'linear-gradient(135deg,#059669,#047857)',
      '📥', 'Laptop Returned', 'AssetOps · Mindteck IT',
      '', body
    ),
    attachments: [...getLogoAttachment(), ...retAtts],
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 3. SWAP EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendSwapEmail = async (p) => {
  const cc         = buildCC({ performedByEmail: p.swappedByEmail, extraCCs: p.extraCCs });
  const photoAtts  = getPhotoAttachment(p.photoUrl);
  const hasPhoto   = photoAtts.length > 0;

  // Issue / damage photos from swap
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
      <div class="sec-title">🔄 Swap Summary</div>
      <div class="cmp-wrap">
        <!-- Old laptop -->
        <div class="cmp-card">
          <div class="cmp-hdr" style="background:#fee2e2;color:#991b1b">
            ↩ Returned Laptop
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 12px;border-bottom:1px solid #fee2e2">
              <div class="cmp-label">Asset No</div>
              <div class="cmp-val mono" style="color:#dc2626">${p.oldAssetId}</div>
            </td></tr>
            <tr><td style="padding:8px 12px;border-bottom:1px solid #fee2e2">
              <div class="cmp-label">Brand / Model</div>
              <div class="cmp-val">${p.oldBrand} ${p.oldModel}</div>
            </td></tr>
            <tr><td style="padding:8px 12px">
              <div class="cmp-label">Serial</div>
              <div class="cmp-val mono">${p.oldSerial || '—'}</div>
            </td></tr>
          </table>
        </div>
        <!-- New laptop -->
        <div class="cmp-card">
          <div class="cmp-hdr" style="background:#d1fae5;color:#065f46">
            ✓ New Laptop Issued
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 12px;border-bottom:1px solid #d1fae5">
              <div class="cmp-label">Asset No</div>
              <div class="cmp-val mono" style="color:#059669">${p.newAssetId}</div>
            </td></tr>
            <tr><td style="padding:8px 12px;border-bottom:1px solid #d1fae5">
              <div class="cmp-label">Brand / Model</div>
              <div class="cmp-val">${p.newBrand} ${p.newModel}</div>
            </td></tr>
            <tr><td style="padding:8px 12px">
              <div class="cmp-label">Serial</div>
              <div class="cmp-val mono">${p.newSerial || '—'}</div>
            </td></tr>
          </table>
        </div>
      </div>
    </div>

    <div class="sec" style="margin-top:16px">
      <div class="sec-title">📋 Swap Details</div>
      <table class="tbl">
        <tr><th>New Config</th><td>${p.newConfig || '—'}</td></tr>
        <tr><th>Swap Reason</th><td>${p.issueType || '—'}</td></tr>
        <tr><th>Description</th><td>${p.issueDescription || '—'}</td></tr>
        <tr><th>Swap Date</th><td>${p.swapDate}</td></tr>
        <tr><th>Processed By</th><td>${p.swappedBy}</td></tr>
        ${p.preparedBy ? `<tr><th>Prepared By</th><td>${p.preparedBy}</td></tr>` : ''}
        <tr><th>Project</th><td>${p.project || '—'}</td></tr>
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
    html:        wrap(
      'linear-gradient(135deg,#7c3aed,#5b21b6)',
      '🔄', 'Laptop Swapped', 'AssetOps · Mindteck IT',
      p.newAllocationId, body
    ),
    attachments,
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 4. ACCESSORIES REQUEST EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryRequestEmail = async (p) => {
  const cc = buildCC({ performedByEmail: p.requestedByEmail, extraCCs: p.extraCCs || [] });
  const rows = (p.items || []).map(i =>
    `<tr><th>${i.item}</th><td>${i.quantity || 1} unit(s)</td></tr>`
  ).join('');

  const body = `
    <p class="greeting">Accessory Request — ${p.empName}</p>
    <p class="intro">The following accessory request has been raised and is pending IT approval.</p>

    <div class="sec">
      <div class="sec-title">👤 Employee</div>
      <table class="tbl">
        <tr><th>Name</th><td>${p.empName}</td></tr>
        <tr><th>Employee ID</th><td>${p.empId || '—'}</td></tr>
        <tr><th>Department</th><td>${p.department || '—'}</td></tr>
        <tr><th>Mobile</th><td>${p.mobileNo || '—'}</td></tr>
        <tr><th>Project</th><td>${p.project || '—'}</td></tr>
        ${p.assetId ? `<tr><th>Current Asset</th><td class="mono">${p.assetId}</td></tr>` : ''}
      </table>
    </div>

    <div class="sec">
      <div class="sec-title">📦 Requested Items</div>
      <table class="tbl">${rows}</table>
    </div>

    ${p.reason ? `
    <div class="sec">
      <div class="sec-title">📝 Reason</div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                  padding:14px 18px;font-size:14px;color:#14532d;line-height:1.8">
        ${p.reason}
      </div>
    </div>` : ''}

    <div class="sec">
      <div class="sec-title">ℹ️ Request Info</div>
      <table class="tbl">
        <tr><th>Date</th><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><th>Raised By</th><td>${p.requestedBy}</td></tr>
        <tr><th>Status</th><td><span class="badge badge-amber">Pending Approval</span></td></tr>
      </table>
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Accessory Request — ${p.empName} | ${(p.items||[]).map(i=>i.item).join(', ')}`,
    html:        wrap('linear-gradient(135deg,#d97706,#b45309)', '📦', 'Accessory Request', 'AssetOps · Mindteck IT', '', body),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 5. WELCOME EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendWelcomeEmail = async (p) => {
  const body = `
    <p class="greeting">Welcome, ${p.name}!</p>
    <p class="intro">Your AssetOps account has been created. Use the credentials below to log in.</p>

    <div class="sec">
      <div class="sec-title">🔑 Login Credentials</div>
      <table class="tbl">
        <tr><th>Login URL</th><td><a href="${process.env.FRONTEND_URL||'http://localhost:3000'}">${process.env.FRONTEND_URL||'http://localhost:3000'}</a></td></tr>
        <tr><th>Email</th><td>${p.email}</td></tr>
        <tr><th>Password</th><td class="mono" style="font-size:16px;letter-spacing:.05em">${p.password}</td></tr>
        <tr><th>Role</th><td><span class="badge badge-green">${p.role==='it_staff'?'IT Staff':p.role}</span></td></tr>
      </table>
    </div>

    <div class="notice">Please change your password immediately after first login. Keep credentials confidential.</div>`;

  await sendMail({
    to:          p.email,
    cc:          sysEmail(),
    subject:     `[AssetOps] Your account is ready — Welcome ${p.name}`,
    html:        wrap('linear-gradient(135deg,#0f172a,#1d3461)', '🎉', 'AssetOps Account Created', 'Mindteck IT Asset Management', '', body),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 6. ACCESSORY ALLOCATED EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryAllocatedEmail = async (p) => {
  const cc   = buildCC({ performedByEmail: p.allocatedByEmail, extraCCs: p.extraCCs || [] });
  const rows = (p.items || []).map(i =>
    `<tr><th>${i.item}</th><td>${i.quantity || 1} unit(s)</td></tr>`
  ).join('');

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">The following accessory has been allocated to you by the IT team.</p>

    <div class="sec">
      <div class="sec-title">📦 Allocated Items</div>
      <table class="tbl">${rows}</table>
    </div>

    <div class="sec">
      <div class="sec-title">📋 Allocation Info</div>
      <table class="tbl">
        <tr><th>Employee</th><td>${p.empName} (${p.empId || '—'})</td></tr>
        <tr><th>Department</th><td>${p.department || '—'}</td></tr>
        ${p.assetId && p.assetId !== '—' ? `<tr><th>Linked Asset</th><td class="mono">${p.assetId}</td></tr>` : ''}
        <tr><th>Date</th><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><th>Allocated By</th><td>${p.allocatedBy}</td></tr>
        <tr><th>Status</th><td><span class="badge badge-green">Allocated ✓</span></td></tr>
      </table>
    </div>

    ${p.notes ? `
    <div class="sec">
      <div class="sec-title">📝 Notes</div>
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
    subject:     `[AssetOps] Accessory Allocated — ${(p.items||[]).map(i=>i.item).join(', ')} | ${p.empName}`,
    html:        wrap('linear-gradient(135deg,#059669,#047857)', '📦', 'Accessory Allocated', 'AssetOps · Mindteck IT', '', body),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 7. ACCESSORY RECEIVED EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryReceivedEmail = async (p) => {
  const cc = buildCC({ performedByEmail: p.receivedByEmail, extraCCs: p.extraCCs || [] });

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">This confirms that you have received the following accessory from the IT team.</p>

    <div class="sec">
      <div class="sec-title">✅ Item Received</div>
      <table class="tbl">
        <tr><th>Item Name</th><td>${p.itemName}</td></tr>
        <tr><th>Quantity</th><td>${p.quantity || 1} unit(s)</td></tr>
        ${p.assetId && p.assetId !== '—' ? `<tr><th>Linked Asset</th><td class="mono">${p.assetId}</td></tr>` : ''}
        <tr><th>Employee</th><td>${p.empName} (${p.empId || '—'})</td></tr>
        <tr><th>Received Date</th><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><th>Confirmed By</th><td>${p.receivedBy}</td></tr>
        <tr><th>Status</th><td><span class="badge badge-green">Received ✓</span></td></tr>
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
    html:        wrap('linear-gradient(135deg,#2563eb,#1d4ed8)', '✅', 'Accessory Received', 'AssetOps · Mindteck IT', '', body),
    attachments: getLogoAttachment(),
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
// 8. ACCEPTANCE REMINDER EMAIL
// ═══════════════════════════════════════════════════════════════════════════════
exports.sendAcceptanceReminderEmail = async (p) => {
  const sys = sysEmail();
  const cc  = buildCC({ performedByEmail: '', extraCCs: [sys, ...(p.extraCCs || [])] });

  const urgencyColor = p.daysOverdue > 20 ? '#dc2626' : p.daysOverdue > 10 ? '#f59e0b' : '#1d5c3c';
  const urgencyLabel = p.daysOverdue > 20 ? '🚨 Final Notice'
                     : p.daysOverdue > 10 ? '⚠️ Second Reminder'
                     :                      '📬 Reminder';

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">
      This is a <strong>${urgencyLabel}</strong> — you have not yet confirmed receipt of the
      laptop allocated to you.
      ${p.daysOverdue > 0 ? `Your acceptance was due <strong style="color:${urgencyColor}">${p.daysOverdue} day(s) ago</strong>.` : ''}
    </p>

    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:12px;
                padding:18px 22px;margin-bottom:20px">
      <div style="font-size:14px;font-weight:800;color:#92400e;margin-bottom:8px">⏰ Action Required</div>
      <div style="font-size:13px;color:#78350f;line-height:1.75">
        Please confirm receipt or report any damage immediately.<br/>
        If you have already returned the laptop, contact IT right away.
      </div>
    </div>

    <div class="sec">
      <div class="sec-title">💻 Laptop on Record</div>
      <table class="tbl">
        <tr><th>Asset Number</th><td class="mono">${p.assetId}</td></tr>
        <tr><th>Brand / Model</th><td>${p.brand || ''} ${p.model || ''}</td></tr>
        <tr><th>Serial Number</th><td class="mono">${p.serial || '—'}</td></tr>
        <tr><th>Allocation Date</th><td>${p.allocationDate || '—'}</td></tr>
      </table>
    </div>

    <div class="notice">
      Questions? Contact IT at <a href="mailto:${sys}">${sys}</a>.
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] ${urgencyLabel} — Laptop Acceptance Pending | ${p.assetId}`,
    html:        wrap('linear-gradient(135deg,#d97706,#b45309)', '⏰', `${urgencyLabel}: Acceptance Pending`, 'AssetOps · Mindteck IT', '', body, p.acceptanceLink),
    attachments: getLogoAttachment(),
  });
};