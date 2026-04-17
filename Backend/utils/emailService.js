const nodemailer   = require('nodemailer');
const fs           = require('fs');
const path         = require('path');
const { generateAgreement } = require('./generateAgreement');

// ── Logo file path (saved alongside this file) ────────────────────────────────
const LOGO_PATH = path.join(__dirname, 'mindteck_logo.jpg');

// Make sure logo file exists (write from base64 if needed)
try {
  if (!fs.existsSync(LOGO_PATH)) {
    const b64file = path.join(__dirname, 'logo_b64.txt');
    if (fs.existsSync(b64file)) {
      const raw = Buffer.from(fs.readFileSync(b64file, 'utf8').trim(), 'base64');
      fs.writeFileSync(LOGO_PATH, raw);
    }
  }
} catch (e) { console.error('Logo setup error:', e.message); }

// ── SMTP transporter ─────────────────────────────────────────────────────────
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

const getFrom = () =>
  process.env.MAIL_FROM || `AssetOps <${process.env.MAIL_USER}>`;

// ── Build CC list ─────────────────────────────────────────────────────────────
const buildCC = ({ performedByEmail = '', extraCCs = [] } = {}) => {
  const sysadmin = process.env.SYSADMIN_EMAIL || '';
  const list = [sysadmin, performedByEmail, ...extraCCs]
    .map(e => (e || '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
};

// ── Core send function ────────────────────────────────────────────────────────
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

// ── Build logo attachment ─────────────────────────────────────────────────────
const getLogoAttachment = () => {
  try {
    if (fs.existsSync(LOGO_PATH)) {
      return [{
        filename:    'mindteck_logo.jpg',
        path:        LOGO_PATH,
        cid:         'mindteck_logo',
        contentType: 'image/jpeg',
      }];
    }
  } catch (e) { console.error('Logo attachment error:', e.message); }
  return [];
};

// ── Build photo attachment from base64 ────────────────────────────────────────
const getPhotoAttachment = (photoBase64) => {
  if (!photoBase64 || !photoBase64.startsWith('data:image')) return [];
  try {
    const matches = photoBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return [];
    const [, mime, b64data] = matches;
    const ext = mime.split('/')[1] || 'jpg';
    return [{
      filename:    `employee_photo.${ext}`,
      content:     Buffer.from(b64data, 'base64'),
      cid:         'employee_photo',
      contentType: mime,
    }];
  } catch (e) { return []; }
};

// ── Shared styles ─────────────────────────────────────────────────────────────
const CSS = `
  body{margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif}
  .outer{max-width:640px;margin:28px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0}
  .logo-bar{background:#ffffff;padding:14px 28px;border-bottom:3px solid #1d5c3c;text-align:left}
  .logo-bar img{height:34px;width:auto;display:inline-block;vertical-align:middle}
  .hdr{padding:22px 28px}
  .hdr-title{color:#fff;font-size:22px;font-weight:700;margin:0 0 4px}
  .hdr-sub{color:rgba(255,255,255,.82);font-size:13px;margin:0}
  .body{padding:24px 28px}
  .greeting{font-size:16px;color:#1e293b;margin:0 0 8px;font-weight:700}
  .intro{font-size:14px;color:#475569;margin:0 0 20px;line-height:1.7}
  .sec-title{font-size:11px;font-weight:700;color:#1d5c3c;text-transform:uppercase;letter-spacing:.08em;
             margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #d1fae5}
  .dtable{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px}
  .dtable th{background:#1d5c3c;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;
             letter-spacing:.06em;padding:9px 14px;text-align:left;border:1px solid #1d5c3c}
  .dtable td{padding:9px 14px;color:#334155;border:1px solid #e2e8f0;vertical-align:top}
  .dtable tr:nth-child(even) td{background:#f8fafc}
  .dtable td.k{font-weight:600;color:#64748b;width:38%;background:#f8fafc!important}
  .dtable td.v{color:#1e293b;font-weight:600}
  .dtable td.vm{color:#1e293b;font-weight:700;font-family:monospace;font-size:15px}
  .badge-g{display:inline-block;background:#d1fae5;color:#065f46;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700}
  .badge-b{display:inline-block;background:#dbeafe;color:#1e40af;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700}
  .badge-a{display:inline-block;background:#fef3c7;color:#92400e;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700}
  .badge-r{display:inline-block;background:#fee2e2;color:#991b1b;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700}
  .htable{width:100%;border-collapse:collapse;margin-bottom:20px}
  .htable th{background:#1d5c3c;color:#fff;font-size:12px;font-weight:700;padding:9px 12px;text-align:center;border:1px solid #1d5c3c}
  .htable td{padding:9px 12px;color:#1e293b;border:1px solid #e2e8f0;text-align:center;font-size:13px}
  .htable tr:nth-child(even) td{background:#f8fafc}
  .note{background:#fffbea;border-left:4px solid #f59e0b;padding:12px 16px;font-size:13px;color:#92400e;line-height:1.7;margin-bottom:18px}
  .photo-wrap{float:right;margin:-4px 0 12px 20px;text-align:center}
  .photo-wrap img{width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #1d5c3c;display:block}
  .photo-wrap span{font-size:10px;color:#9ca3af;display:block;margin-top:4px}
  .accept-btn{display:block;text-align:center;margin:20px 0;padding:14px 20px;
              background:#f0fdf4;border:2px solid #16a34a;border-radius:12px}
  .accept-btn a{display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                padding:12px 32px;border-radius:8px;font-size:15px;font-weight:700}
  .accept-note{font-size:12px;color:#6b7280;margin-top:8px;display:block;text-align:center}
  .footer{background:#f8fafc;padding:14px 28px;font-size:12px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;clear:both}
  .footer a{color:#1d5c3c}
  .clearfix::after{content:"";display:table;clear:both}
`;

// ── Wrap template ─────────────────────────────────────────────────────────────
const wrap = (hdrColor, title, sub, body, acceptLink = '') => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div class="outer">
  <div class="logo-bar">
    <img src="cid:mindteck_logo" alt="Mindteck" height="34"/>
  </div>
  <div class="hdr" style="background:${hdrColor}">
    <p class="hdr-title">${title}</p>
    <p class="hdr-sub">${sub}</p>
  </div>
  <div class="body clearfix">
    ${body}
    ${acceptLink ? `
    <div class="accept-btn">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#14532d">⚡ Action Required</p>
      <p style="margin:0 0 14px;font-size:13px;color:#166534">Please confirm receipt of your laptop or report any damage.</p>
      <a href="${acceptLink}">✓ Confirm Receipt / Report Damage</a>
      <span class="accept-note">This link expires in 10 days &nbsp;|&nbsp; Any issues? <a href="mailto:${process.env.SYSADMIN_EMAIL||'sysadmin@mindteck.us'}">Contact IT</a></span>
    </div>` : ''}
  </div>
  <div class="footer">
    Automated notification from AssetOps &nbsp;·&nbsp; Mindteck IT Team &nbsp;·&nbsp;
    <a href="mailto:${process.env.SYSADMIN_EMAIL||'sysadmin@mindteck.us'}">${process.env.SYSADMIN_EMAIL||'sysadmin@mindteck.us'}</a>
  </div>
</div></body></html>`;

// ════════════════════════════════════════════════════════════════════════════
// 1. ALLOCATION EMAIL
// ════════════════════════════════════════════════════════════════════════════
exports.sendAllocationEmail = async (p) => {
  const accessories = (p.accessories || []).join(', ') || 'None';
  const cc = buildCC({ performedByEmail: p.allocatedByEmail, extraCCs: p.extraCCs });
 
  let agreementBuffer = null;
  try {
    agreementBuffer = await generateAgreement({
      empName: p.empName, empId: p.empId, department: p.department,
      position: p.position || p.designation || p.role || p.department || 'Employee',
      mobileNo: p.mobileNo || '', assetId: p.assetId, serial: p.serial,
      brand: p.brand, model: p.model, config: p.config || '',
      accessories: p.accessories || [], allocationDate: p.allocationDate,
      managerName: p.managerName || 'Vasudevan D K',
      managerEmail: p.managerEmail || 'Vasudevan.kannan@mindteck.com',
      contactPerson: p.contactPerson || 'Vasudevan D K',
      contactEmail: p.contactEmail || 'Vasudevan.kannan@mindteck.com',
    });
  } catch (e) { console.error('Agreement gen failed:', e.message); }
 
  const photoAttachments = getPhotoAttachment(p.photoUrl);
  const photoHTML = photoAttachments.length > 0
    ? `<div class="photo-wrap"><img src="cid:employee_photo" alt="${p.empName}"/><span>Employee Photo</span></div>`
    : '';
 
  const deliveryHTML = p.deliveryMethod === 'courier'
    ? `<p class="sec-title">Delivery Information</p>
       <table class="dtable">
         <tr><td class="k">Delivery Method</td><td class="v"><span class="badge-b">Courier</span></td></tr>
         <tr><td class="k">Delivery Address</td><td class="v" style="white-space:pre-line">${p.deliveryAddress || '—'}</td></tr>
       </table>`
    : `<p class="sec-title">Delivery Information</p>
       <table class="dtable">
         <tr><td class="k">Delivery Method</td><td class="v"><span class="badge-g">Hand Delivery</span></td></tr>
       </table>`;
 
  const deadlineDate = new Date(p.allocationDate || Date.now());
  deadlineDate.setDate(deadlineDate.getDate() + 10);
  const deadlineStr = deadlineDate.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
 
  // ✅ QR code section in email body
  const qrSection = p.qrCodeBuffer ? `
    <p class="sec-title">📱 Asset QR Code</p>
    <div style="text-align:center;padding:20px;background:#f8fafc;border-radius:12px;
                border:2px dashed #e2e8f0;margin-bottom:18px">
      <img src="cid:asset_qr" alt="Asset QR Code"
           style="width:180px;height:180px;display:block;margin:0 auto;
                  border:4px solid #1d3461;border-radius:8px;padding:4px;background:#fff"/>
      <div style="font-size:13px;font-weight:600;color:#1e293b;margin-top:12px">
        Scan to view your asset details
      </div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">
        Contains all laptop details, serial number, and allocation information
      </div>
      <a href="${p.qrCardUrl || '#'}" style="display:inline-block;margin-top:10px;font-size:11px;
         color:#1d5c3c;text-decoration:underline;font-family:monospace">${p.qrCardUrl || ''}</a>
    </div>` : '';
 
  const body = `
    ${photoHTML}
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">A laptop has been allocated to you. Please find the complete details below.
    The <strong>Employee Laptop Agreement</strong> is attached — please sign and return it to
    <a href="mailto:laptop.consent@mindteck.com">laptop.consent@mindteck.com</a>
    <strong>within 10 days (by ${deadlineStr})</strong>.</p>
 
    ${qrSection}
 
    <p class="sec-title">Employee Details</p>
    <table class="dtable">
      <tr><td class="k">Full Name</td><td class="v">${p.empName}</td></tr>
      <tr><td class="k">Employee ID</td><td class="v">${p.empId}</td></tr>
      <tr><td class="k">Department</td><td class="v">${p.department || '—'}</td></tr>
      <tr><td class="k">Mobile Number</td><td class="v">${p.mobileNo || '—'}</td></tr>
      <tr><td class="k">Work Email</td><td class="v">${p.empEmail}</td></tr>
      ${p.personalEmail ? `<tr><td class="k">Personal Email</td><td class="v">${p.personalEmail}</td></tr>` : ''}
      <tr><td class="k">Project / Client</td><td class="v">${p.project || '—'} / ${p.client || '—'}</td></tr>
    </table>
 
    <p class="sec-title">Laptop Details</p>
    <table class="dtable">
      <tr><td class="k">Asset Number</td><td class="vm">${p.assetId}</td></tr>
      <tr><td class="k">Brand / Model</td><td class="v">${p.brand} ${p.model}</td></tr>
      <tr><td class="k">Configuration</td><td class="v">${p.config || '—'}</td></tr>
      <tr><td class="k">Serial Number</td><td class="v" style="font-family:monospace">${p.serial}</td></tr>
      <tr><td class="k">Accessories</td><td class="v">${accessories}</td></tr>
      <tr><td class="k">Allocation Date</td><td class="v">${p.allocationDate}</td></tr>
      <tr><td class="k">Allocated By</td><td class="v">${p.allocatedBy}</td></tr>
      <tr><td class="k">Status</td><td class="v"><span class="badge-g">Active</span></td></tr>
    </table>
 
    ${deliveryHTML}
 
    <div class="note">
      <strong>⚠️ Important Notice:</strong>
      <ul style="margin:8px 0 0 20px;padding:0">
        <li>Please review and sign the attached <strong>Employee Laptop Agreement</strong></li>
        <li>Return to <strong>laptop.consent@mindteck.com</strong> within 10 days (by ${deadlineStr})</li>
        <li>If we don't receive your signed agreement by ${deadlineStr}, it will be deemed accepted</li>
        <li>For hardware issues, contact IT at <a href="mailto:${process.env.SYSADMIN_EMAIL || 'sysadmin@mindteck.us'}">${process.env.SYSADMIN_EMAIL || 'sysadmin@mindteck.us'}</a></li>
      </ul>
    </div>`;
 
  const toList = [p.empEmail];
  if (p.personalEmail && p.personalEmail !== p.empEmail) toList.push(p.personalEmail);
 
  const attachments = [...getLogoAttachment(), ...photoAttachments];
  if (agreementBuffer) {
    attachments.push({
      filename:    `Laptop_Agreement_${(p.empName || '').replace(/\s+/g,'_')}_${p.assetId}.docx`,
      content:     agreementBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
  // ✅ Attach QR code image
  if (p.qrCodeBuffer) {
    attachments.push({
      filename:    'asset_qr_code.png',
      content:     p.qrCodeBuffer,
      cid:         'asset_qr',
      contentType: 'image/png',
    });
  }
 
  await sendMail({
    to:          toList.join(', '),
    cc:          cc.join(', '),
    subject:     `[AssetOps] Laptop Allocated — ${p.assetId} | ${p.empName}`,
    html:        wrap('#2563eb', 'Laptop Allocated', 'AssetOps · Mindteck IT', body, p.acceptanceLink || ''),
    attachments,
  });
};

// ════════════════════════════════════════════════════════════════════════════
// 2. RECEIVE EMAIL
// ════════════════════════════════════════════════════════════════════════════
exports.sendReceiveEmail = async (p) => {
  const cc = buildCC({ performedByEmail: p.receivedByEmail, extraCCs: p.extraCCs });
  const condBadge = p.newStatus === 'Stock'
    ? '<span class="badge-g">Good — No Damage</span>'
    : p.newStatus === 'Repair'
      ? '<span class="badge-a">Needs Repair</span>'
      : '<span class="badge-r">Damaged</span>';
  const stsBadge = p.newStatus === 'Stock'
    ? '<span class="badge-g">Stock</span>'
    : p.newStatus === 'Repair'
      ? '<span class="badge-a">Repair</span>'
      : '<span class="badge-r">Scrap</span>';

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">Your laptop has been successfully returned and processed. Complete details below.</p>

    <p class="sec-title">Employee Details</p>
    <table class="dtable">
      <tr><td class="k">Full Name</td><td class="v">${p.empName}</td></tr>
      <tr><td class="k">Employee ID</td><td class="v">${p.empId||'—'}</td></tr>
      <tr><td class="k">Mobile Number</td><td class="v">${p.mobileNo||'—'}</td></tr>
      <tr><td class="k">Department</td><td class="v">${p.department||'—'}</td></tr>
    </table>

    <p class="sec-title">Return Details</p>
    <table class="dtable">
      <tr><td class="k">Asset Number</td><td class="vm">${p.assetId}</td></tr>
      <tr><td class="k">Brand / Model</td><td class="v">${p.brand||''} ${p.model||''}</td></tr>
      <tr><td class="k">Serial Number</td><td class="v" style="font-family:monospace">${p.serial||'—'}</td></tr>
      <tr><td class="k">Return Date</td><td class="v">${p.returnDate}</td></tr>
      <tr><td class="k">Condition</td><td class="v">${condBadge}</td></tr>
      <tr><td class="k">New Asset Status</td><td class="v">${stsBadge}</td></tr>
      <tr><td class="k">Processed By</td><td class="v">${p.receivedBy}</td></tr>
    </table>

    ${p.damageDescription ? `
    <p class="sec-title">Damage Description</p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;
                font-size:14px;color:#7c2d12;line-height:1.7">${p.damageDescription}</div>` : ''}`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Laptop Returned — ${p.assetId} | ${p.empName}`,
    html:        wrap('#059669', 'Laptop Returned', 'AssetOps · Mindteck IT', body),
    attachments: getLogoAttachment(),
  });
};

// ════════════════════════════════════════════════════════════════════════════
// 3. SWAP EMAIL
// ════════════════════════════════════════════════════════════════════════════
exports.sendSwapEmail = async (p) => {
  const cc = buildCC({ performedByEmail: p.swappedByEmail, extraCCs: p.extraCCs });
  const photoAttachments = getPhotoAttachment(p.photoUrl);
  const photoHTML = photoAttachments.length > 0
    ? `<div class="photo-wrap"><img src="cid:employee_photo" alt="${p.empName}"/><span>Employee Photo</span></div>`
    : '';
 
  // ✅ QR code for the NEW laptop
  const qrSection = p.qrCodeBuffer ? `
    <p class="sec-title">📱 New Laptop QR Code</p>
    <div style="text-align:center;padding:20px;background:#f8fafc;border-radius:12px;
                border:2px dashed #e2e8f0;margin-bottom:18px">
      <img src="cid:asset_qr" alt="Asset QR Code"
           style="width:160px;height:160px;display:block;margin:0 auto;
                  border:4px solid #1d3461;border-radius:8px;padding:4px;background:#fff"/>
      <div style="font-size:12px;color:#64748b;margin-top:10px">Scan to view your new asset details</div>
      <a href="${p.qrCardUrl || '#'}" style="display:inline-block;margin-top:6px;font-size:11px;
         color:#1d5c3c;text-decoration:underline;font-family:monospace">${p.qrCardUrl || ''}</a>
    </div>` : '';
 
  const body = `
    ${photoHTML}
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">Your laptop has been swapped. Complete details of the exchange are below.</p>
 
    ${qrSection}
 
    <p class="sec-title">Employee Details</p>
    <table class="dtable">
      <tr><td class="k">Full Name</td><td class="v">${p.empName}</td></tr>
      <tr><td class="k">Employee ID</td><td class="v">${p.empId||'—'}</td></tr>
      <tr><td class="k">Mobile Number</td><td class="v">${p.mobileNo||'—'}</td></tr>
      <tr><td class="k">Department</td><td class="v">${p.department||'—'}</td></tr>
      <tr><td class="k">Project</td><td class="v">${p.project||'—'}</td></tr>
    </table>
 
    <p class="sec-title">Swap Details</p>
    <table class="htable">
      <tr>
        <th>Field</th>
        <th style="background:#dc2626">Old Laptop (Returned)</th>
        <th style="background:#059669">New Laptop (Issued)</th>
      </tr>
      <tr>
        <td style="font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0">Asset No</td>
        <td style="color:#dc2626;font-weight:700;font-family:monospace">${p.oldAssetId}</td>
        <td style="color:#059669;font-weight:700;font-family:monospace">${p.newAssetId}</td>
      </tr>
      <tr>
        <td style="font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0">Brand / Model</td>
        <td>${p.oldBrand} ${p.oldModel}</td>
        <td>${p.newBrand} ${p.newModel}</td>
      </tr>
      <tr>
        <td style="font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0">Configuration</td>
        <td>—</td>
        <td>${p.newConfig||'—'}</td>
      </tr>
      <tr>
        <td style="font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0">Serial No</td>
        <td style="font-family:monospace">${p.oldSerial||'—'}</td>
        <td style="font-family:monospace">${p.newSerial||'—'}</td>
      </tr>
    </table>
 
    <table class="dtable">
      <tr><td class="k">Swap Reason</td><td class="v">${p.issueType}</td></tr>
      <tr><td class="k">Description</td><td class="v">${p.issueDescription||'—'}</td></tr>
      <tr><td class="k">Swap Date</td><td class="v">${p.swapDate}</td></tr>
      <tr><td class="k">Processed By</td><td class="v">${p.swappedBy}</td></tr>
    </table>`;
 
  const attachments = [...getLogoAttachment(), ...photoAttachments];
  // ✅ Attach QR code
  if (p.qrCodeBuffer) {
    attachments.push({
      filename:    'new_asset_qr_code.png',
      content:     p.qrCodeBuffer,
      cid:         'asset_qr',
      contentType: 'image/png',
    });
  }
 
  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Laptop Swapped — ${p.oldAssetId} → ${p.newAssetId} | ${p.empName}`,
    html:        wrap('#7c3aed', 'Laptop Swapped', 'AssetOps · Mindteck IT', body),
    attachments,
  });
};

// ════════════════════════════════════════════════════════════════════════════
// 4. ACCESSORIES REQUEST EMAIL
// ════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryRequestEmail = async (p) => {
  const cc = buildCC({ performedByEmail: p.requestedByEmail, extraCCs: p.extraCCs || [] });

  const itemsHTML = (p.items || []).map(i =>
    `<tr><td class="k">${i.item}</td><td class="v">${i.quantity||1} unit(s)</td></tr>`
  ).join('');

  const body = `
    <p class="greeting">Accessory Request — ${p.empName}</p>
    <p class="intro">The following accessory request has been raised and is pending IT approval.</p>

    <p class="sec-title">Employee Details</p>
    <table class="dtable">
      <tr><td class="k">Full Name</td><td class="v">${p.empName}</td></tr>
      <tr><td class="k">Employee ID</td><td class="v">${p.empId||'—'}</td></tr>
      <tr><td class="k">Department</td><td class="v">${p.department||'—'}</td></tr>
      <tr><td class="k">Mobile Number</td><td class="v">${p.mobileNo||'—'}</td></tr>
      <tr><td class="k">Project</td><td class="v">${p.project||'—'}</td></tr>
      <tr><td class="k">Current Asset</td><td class="vm">${p.assetId||'—'}</td></tr>
    </table>

    <p class="sec-title">Requested Items</p>
    <table class="dtable">
      <tr style="background:#1d5c3c"><th style="color:#fff;padding:9px 14px">Item</th><th style="color:#fff;padding:9px 14px">Quantity</th></tr>
      ${itemsHTML}
    </table>

    ${p.reason ? `<p class="sec-title">Reason / Justification</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;font-size:14px;color:#14532d;line-height:1.7">${p.reason}</div>` : ''}

    <p class="sec-title">Request Info</p>
    <table class="dtable">
      <tr><td class="k">Request Date</td><td class="v">${new Date().toLocaleDateString('en-IN')}</td></tr>
      <tr><td class="k">Raised By</td><td class="v">${p.requestedBy}</td></tr>
      <tr><td class="k">Status</td><td class="v"><span class="badge-a">Pending Approval</span></td></tr>
    </table>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Accessory Request — ${p.empName} | ${(p.items||[]).map(i=>i.item).join(', ')}`,
    html:        wrap('#f59e0b', 'Accessory Request', 'AssetOps · Mindteck IT', body),
    attachments: getLogoAttachment(),
  });
};

// ════════════════════════════════════════════════════════════════════════════
// 5. WELCOME EMAIL
// ════════════════════════════════════════════════════════════════════════════
exports.sendWelcomeEmail = async (p) => {
  const sysadmin = process.env.SYSADMIN_EMAIL || '';
  const body = `
    <p class="greeting">Welcome to AssetOps, ${p.name}!</p>
    <p class="intro">Your account has been created. Use the credentials below to log in.</p>

    <p class="sec-title">Your Login Credentials</p>
    <table class="dtable">
      <tr><td class="k">Login URL</td><td class="v"><a href="${process.env.FRONTEND_URL||'http://localhost:3000'}">${process.env.FRONTEND_URL||'http://localhost:3000'}</a></td></tr>
      <tr><td class="k">Email</td><td class="v">${p.email}</td></tr>
      <tr><td class="k">Password</td><td class="vm" style="font-size:16px;letter-spacing:.05em">${p.password}</td></tr>
      <tr><td class="k">Role</td><td class="v"><span class="badge-g">${p.role==='it_staff'?'IT Staff':p.role}</span></td></tr>
    </table>
    <div class="note">Please change your password after first login. Keep credentials confidential.</div>`;

  await sendMail({
    to:          p.email,
    cc:          sysadmin,
    subject:     `[AssetOps] Your account is ready — Welcome ${p.name}`,
    html:        wrap('#0f172a', 'AssetOps Account Created', 'Mindteck IT Asset Management', body),
    attachments: getLogoAttachment(),
  });
};

// ════════════════════════════════════════════════════════════════════════════
// 6. ACCESSORY ALLOCATED EMAIL  ← NEW
// ════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryAllocatedEmail = async (p) => {
  const cc = buildCC({ performedByEmail: p.allocatedByEmail, extraCCs: p.extraCCs || [] });

  const itemsHTML = (p.items || []).map(i =>
    `<tr><td class="k">${i.item}</td><td class="v">${i.quantity || 1} unit(s)</td></tr>`
  ).join('');

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">The following accessory has been allocated to you by the IT team.</p>

    <p class="sec-title">Employee Details</p>
    <table class="dtable">
      <tr><td class="k">Full Name</td><td class="v">${p.empName}</td></tr>
      <tr><td class="k">Employee ID</td><td class="v">${p.empId || '—'}</td></tr>
      <tr><td class="k">Department</td><td class="v">${p.department || '—'}</td></tr>
      <tr><td class="k">Mobile Number</td><td class="v">${p.mobileNo || '—'}</td></tr>
      ${p.assetId && p.assetId !== '—' ? `<tr><td class="k">Linked Asset</td><td class="vm">${p.assetId}</td></tr>` : ''}
    </table>

    <p class="sec-title">Allocated Items</p>
    <table class="dtable">
      <tr style="background:#1d5c3c">
        <th style="color:#fff;padding:9px 14px">Item</th>
        <th style="color:#fff;padding:9px 14px">Quantity</th>
      </tr>
      ${itemsHTML}
    </table>

    <p class="sec-title">Allocation Info</p>
    <table class="dtable">
      <tr><td class="k">Allocation Date</td><td class="v">${new Date().toLocaleDateString('en-IN')}</td></tr>
      <tr><td class="k">Allocated By</td><td class="v">${p.allocatedBy}</td></tr>
      <tr><td class="k">Status</td><td class="v"><span class="badge-g">Allocated ✓</span></td></tr>
    </table>

    ${p.notes ? `
    <p class="sec-title">Notes</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;
                font-size:14px;color:#14532d;line-height:1.7">${p.notes}</div>` : ''}

    <div class="note">
      <strong>Note:</strong> Please contact the IT team at
      <a href="mailto:${process.env.SYSADMIN_EMAIL || 'sysadmin@mindteck.us'}">${process.env.SYSADMIN_EMAIL || 'sysadmin@mindteck.us'}</a>
      if you have not received this item or have any issues.
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Accessory Allocated — ${(p.items || []).map(i => i.item).join(', ')} | ${p.empName}`,
    html:        wrap('#059669', 'Accessory Allocated', 'AssetOps · Mindteck IT', body),
    attachments: getLogoAttachment(),
  });
};

// ════════════════════════════════════════════════════════════════════════════
// 7. ACCESSORY RECEIVED EMAIL  ← NEW
// ════════════════════════════════════════════════════════════════════════════
exports.sendAccessoryReceivedEmail = async (p) => {
  const cc = buildCC({ performedByEmail: p.receivedByEmail, extraCCs: p.extraCCs || [] });

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">This is a confirmation that you have received the following accessory from the IT team.</p>

    <p class="sec-title">Employee Details</p>
    <table class="dtable">
      <tr><td class="k">Full Name</td><td class="v">${p.empName}</td></tr>
      <tr><td class="k">Employee ID</td><td class="v">${p.empId || '—'}</td></tr>
      <tr><td class="k">Department</td><td class="v">${p.department || '—'}</td></tr>
      <tr><td class="k">Mobile Number</td><td class="v">${p.mobileNo || '—'}</td></tr>
    </table>

    <p class="sec-title">Item Received</p>
    <table class="dtable">
      <tr><td class="k">Item Name</td><td class="v">${p.itemName}</td></tr>
      <tr><td class="k">Quantity</td><td class="v">${p.quantity || 1} unit(s)</td></tr>
      ${p.assetId && p.assetId !== '—' ? `<tr><td class="k">Linked Asset</td><td class="vm">${p.assetId}</td></tr>` : ''}
      <tr><td class="k">Received Date</td><td class="v">${new Date().toLocaleDateString('en-IN')}</td></tr>
      <tr><td class="k">Confirmed By</td><td class="v">${p.receivedBy}</td></tr>
      <tr><td class="k">Status</td><td class="v"><span class="badge-g">Received ✓</span></td></tr>
    </table>

    <div class="note">
      Please retain this email as confirmation of receipt. For any issues contact IT at
      <a href="mailto:${process.env.SYSADMIN_EMAIL || 'sysadmin@mindteck.us'}">${process.env.SYSADMIN_EMAIL || 'sysadmin@mindteck.us'}</a>.
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] Accessory Received — ${p.itemName} | ${p.empName}`,
    html:        wrap('#2563eb', 'Accessory Received', 'AssetOps · Mindteck IT', body),
    attachments: getLogoAttachment(),
  });
};

// ════════════════════════════════════════════════════════════════════════════
// 8. ACCEPTANCE REMINDER EMAIL  ← ADD THIS to emailService.js
// ════════════════════════════════════════════════════════════════════════════
exports.sendAcceptanceReminderEmail = async (p) => {
  // p = { empName, empEmail, assetId, brand, model, serial, allocationDate,
  //        acceptanceLink, daysOverdue, extraCCs }
  const sysadmin = process.env.SYSADMIN_EMAIL || 'sysadmin@mindteck.us';
  const cc = buildCC({ performedByEmail: '', extraCCs: [sysadmin, ...(p.extraCCs || [])] });

  const urgencyColor = p.daysOverdue > 20 ? '#dc2626' : p.daysOverdue > 10 ? '#f59e0b' : '#1d5c3c';
  const urgencyLabel = p.daysOverdue > 20 ? '🚨 Final Notice' : p.daysOverdue > 10 ? '⚠️ Second Reminder' : '📬 Reminder';

  const body = `
    <p class="greeting">Dear ${p.empName},</p>
    <p class="intro">
      This is a <strong>${urgencyLabel}</strong> regarding your laptop acceptance confirmation.
      Our records show that you have not yet confirmed receipt of the laptop allocated to you.
      ${p.daysOverdue > 0 ? `<br/><br/>Your acceptance was due <strong style="color:${urgencyColor}">${p.daysOverdue} day(s) ago</strong>.` : ''}
      Please complete your acceptance as soon as possible.
    </p>

    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <div style="font-size:14px;font-weight:700;color:#92400e;margin-bottom:8px">⏰ Action Required</div>
      <div style="font-size:13px;color:#78350f;line-height:1.7">
        Please click the button below to confirm receipt of your laptop or report any damage.<br/>
        If you have already returned the laptop or have questions, contact IT immediately.
      </div>
    </div>

    <p class="sec-title">Laptop Details</p>
    <table class="dtable">
      <tr><td class="k">Asset Number</td><td class="vm">${p.assetId}</td></tr>
      <tr><td class="k">Brand / Model</td><td class="v">${p.brand || ''} ${p.model || ''}</td></tr>
      <tr><td class="k">Serial Number</td><td class="v" style="font-family:monospace">${p.serial || '—'}</td></tr>
      <tr><td class="k">Allocation Date</td><td class="v">${p.allocationDate || '—'}</td></tr>
    </table>

    <div class="note">
      <strong>If you believe you received this reminder in error</strong> or have already returned the laptop,
      please contact the IT team immediately at
      <a href="mailto:${sysadmin}">${sysadmin}</a>
    </div>`;

  await sendMail({
    to:          p.empEmail,
    cc:          cc.join(', '),
    subject:     `[AssetOps] ${urgencyLabel} — Laptop Acceptance Pending | ${p.assetId}`,
    html:        wrap('#f59e0b', `${urgencyLabel}: Laptop Acceptance Pending`, 'AssetOps · Mindteck IT', body, p.acceptanceLink),
    attachments: getLogoAttachment(),
  });
};