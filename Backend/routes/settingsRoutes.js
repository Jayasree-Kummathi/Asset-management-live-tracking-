// routes/settingsRoutes.js
const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const nodemailer = require('nodemailer');
const { protect, authorize } = require('../middleware/auth'); // adjust path

const ENV_PATH = path.resolve(__dirname, '../.env');  // adjust to your .env location

// ── helpers ──────────────────────────────────────────────────────────────────

/** Read .env file and return key→value map */
function readEnv() {
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  const map = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

/** Write updated keys back into .env, preserving all other lines & comments */
function writeEnv(updates) {
  const raw   = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = raw.split('\n');
  const written = new Set();

  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq  = trimmed.indexOf('=');
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (key in updates) {
      written.add(key);
      const val = String(updates[key]);
      // quote values that contain spaces or special chars
      const needsQuotes = /[\s"'()[\]{}|&;<>]/.test(val);
      return `${key}=${needsQuotes ? `"${val}"` : val}`;
    }
    return line;
  });

  // Append any keys not already in the file
  for (const [key, val] of Object.entries(updates)) {
    if (!written.has(key)) {
      const needsQuotes = /[\s"'()[\]{}|&;<>]/.test(String(val));
      updatedLines.push(`${key}=${needsQuotes ? `"${val}"` : val}`);
    }
  }

  fs.writeFileSync(ENV_PATH, updatedLines.join('\n'), 'utf8');
}

// ── GET /api/settings/smtp ────────────────────────────────────────────────────
router.get(
  '/smtp',
  protect,
  authorize('admin', 'superadmin'),
  (req, res) => {
  try {
    const env = readEnv();
    res.json({
      host:     env.MAIL_HOST     || '',
      port:     Number(env.MAIL_PORT) || 587,
      secure:   env.MAIL_SECURE === 'true',
      user:     env.MAIL_USER     || '',
      pass:     env.MAIL_PASS     || '',
      from:     env.MAIL_FROM     || '',
      sysadmin: env.SYSADMIN_EMAIL || '',
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to read SMTP settings: ' + err.message });
  }
});

// ── POST /api/settings/smtp ───────────────────────────────────────────────────
router.post(
  '/smtp',
  protect,
  authorize('admin', 'superadmin'),
  (req, res) => {
  try {
    const { host, port, secure, user, pass, from, sysadmin } = req.body;

    if (!host || !port || !user || !pass) {
      return res.status(400).json({ message: 'host, port, user, and pass are required.' });
    }

    writeEnv({
      MAIL_HOST:      host,
      MAIL_PORT:      port,
      MAIL_SECURE:    secure ? 'true' : 'false',
      MAIL_USER:      user,
      MAIL_PASS:      pass,
      MAIL_FROM:      from || `AssetOps <${user}>`,
      SYSADMIN_EMAIL: sysadmin || '',
    });

    // Hot-reload into process.env so mailer picks it up without restart
    process.env.MAIL_HOST     = host;
    process.env.MAIL_PORT     = String(port);
    process.env.MAIL_SECURE   = secure ? 'true' : 'false';
    process.env.MAIL_USER     = user;
    process.env.MAIL_PASS     = pass;
    process.env.MAIL_FROM     = from || `AssetOps <${user}>`;
    process.env.SYSADMIN_EMAIL = sysadmin || '';

    res.json({ message: 'SMTP settings saved successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save SMTP settings: ' + err.message });
  }
});

// ── POST /api/settings/smtp/test ─────────────────────────────────────────────
router.post(
  '/smtp/test',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ message: 'Recipient email (to) is required.' });

  try {
    const env = readEnv();

    const transporter = nodemailer.createTransport({
      host:   env.MAIL_HOST,
      port:   Number(env.MAIL_PORT) || 587,
      secure: env.MAIL_SECURE === 'true',
      auth:   { user: env.MAIL_USER, pass: env.MAIL_PASS },
      tls:    { rejectUnauthorized: false },
    });

    await transporter.verify();

    await transporter.sendMail({
      from:    env.MAIL_FROM || env.MAIL_USER,
      to,
      subject: '✅ AssetOps — SMTP Test Email',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:#4f8ef7;margin-bottom:8px;">SMTP Configuration Test</h2>
          <p style="color:#374151;margin-bottom:16px;">
            This is a test email from <strong>AssetOps</strong>. If you received this,
            your SMTP settings are configured correctly!
          </p>
          <table style="width:100%;font-size:13px;color:#6b7280;border-collapse:collapse;">
            <tr><td style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-weight:600">Host</td><td style="padding:6px 0;border-bottom:1px solid #f3f4f6">${env.MAIL_HOST}</td></tr>
            <tr><td style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-weight:600">Port</td><td style="padding:6px 0;border-bottom:1px solid #f3f4f6">${env.MAIL_PORT}</td></tr>
            <tr><td style="padding:6px 0;font-weight:600">Sent at</td><td style="padding:6px 0">${new Date().toLocaleString()}</td></tr>
          </table>
          <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Sent by AssetOps — Mindteck Asset Management System</p>
        </div>
      `,
    });

    res.json({ message: `Test email sent to ${to}` });
  } catch (err) {
    res.status(500).json({ message: 'SMTP test failed: ' + err.message });
  }
});

module.exports = router;