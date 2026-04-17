'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Backend/utils/generateQR.js
// Generates a QR code as base64 PNG — no file needed, embed directly in email
//
// Install: npm install qrcode
// ─────────────────────────────────────────────────────────────────────────────

const QRCode = require('qrcode');

/**
 * Generate QR code as base64 data URL
 * @param {string} text  — URL to encode
 * @returns {Promise<string>} — "data:image/png;base64,..."
 */
async function generateQRCode(text) {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      type:    'image/png',
      quality: 0.92,
      margin:  1,
      width:   260,
      color: {
        dark:  '#1d3461',  // Mindteck dark blue
        light: '#ffffff',
      },
    });
    return dataUrl; // "data:image/png;base64,iVBOR..."
  } catch (err) {
    console.error('QR generation failed:', err.message);
    return null;
  }
}

/**
 * Generate QR code as Buffer (for email attachment)
 * @param {string} text
 * @returns {Promise<Buffer|null>}
 */
async function generateQRBuffer(text) {
  try {
    return await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'M',
      type:    'png',
      quality: 0.92,
      margin:  1,
      width:   260,
      color: { dark: '#1d3461', light: '#ffffff' },
    });
  } catch (err) {
    console.error('QR buffer failed:', err.message);
    return null;
  }
}

module.exports = { generateQRCode, generateQRBuffer };