'use strict';
// Backend/controllers/licenseController.js
// Full license management: CRUD, assignments, auto-assign on employee join

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const nodemailer   = require('nodemailer');
const ExcelJS = require('exceljs');

const FROM = process.env.MAIL_FROM || `AssetOps <${process.env.MAIL_USER}>`;

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST, port: Number(process.env.MAIL_PORT) || 587,
  secure: false, auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

// ── Local audit function (works even if auditController is missing) ──
const audit = async (action, category, detail, performedBy) => {
  try {
    // Check if audit_logs table exists, create if not
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        detail TEXT,
        performed_by VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await query(
      `INSERT INTO audit_logs (action, category, detail, performed_by, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [action, category, detail, performedBy || 'System']
    );
    console.log(`✅ Audit: ${action} - ${detail}`);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

// ── Bootstrap tables on startup ───────────────────────────────────────────────
const bootstrapTables = async () => {
  try {
    await query(`
      -- Licenses catalog
      CREATE TABLE IF NOT EXISTS licenses (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(200) NOT NULL,
        category    VARCHAR(100),
        icon        VARCHAR(20)  DEFAULT '🔑',
        color       VARCHAR(20)  DEFAULT '#6366f1',
        total_seats INTEGER      DEFAULT 0,
        license_key TEXT,
        expiry_date DATE,
        vendor      VARCHAR(200),
        cost        NUMERIC(10,2),
        notes       TEXT,
        auto_assign BOOLEAN      DEFAULT false,
        created_at  TIMESTAMPTZ  DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  DEFAULT NOW()
      );

      -- License assignments
      CREATE TABLE IF NOT EXISTS license_assignments (
        id          SERIAL PRIMARY KEY,
        license_id  INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
        emp_id      VARCHAR(100) NOT NULL,
        emp_name    VARCHAR(200) NOT NULL,
        emp_email   VARCHAR(200),
        department  VARCHAR(100),
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(license_id, emp_id)
      );

      CREATE INDEX IF NOT EXISTS idx_la_license ON license_assignments(license_id);
      CREATE INDEX IF NOT EXISTS idx_la_emp_id ON license_assignments(emp_id);
      CREATE INDEX IF NOT EXISTS idx_la_emp_email ON license_assignments(emp_email);
    `);
    console.log('✅ License tables ready');
    
    // Add missing columns for existing tables
    await addMissingColumns();
    
  } catch (err) {
    console.error('⚠️ License table setup failed:', err.message);
  }
};

// Function to add missing columns
const addMissingColumns = async () => {
  try {
    // Check and add is_custom column to licenses
    const checkCustom = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'licenses' AND column_name = 'is_custom'
    `);
    
    if (checkCustom.rows.length === 0) {
      await query(`ALTER TABLE licenses ADD COLUMN is_custom BOOLEAN DEFAULT false`);
      console.log('✅ Added is_custom column to licenses table');
    }
    
    // Check and add created_by column to licenses
    const checkCreatedBy = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'licenses' AND column_name = 'created_by'
    `);
    
    if (checkCreatedBy.rows.length === 0) {
      await query(`ALTER TABLE licenses ADD COLUMN created_by VARCHAR(100)`);
      console.log('✅ Added created_by column to licenses table');
    }
    
    // Check and add assigned_by column to license_assignments
    const checkAssignedBy = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'license_assignments' AND column_name = 'assigned_by'
    `);
    
    if (checkAssignedBy.rows.length === 0) {
      await query(`ALTER TABLE license_assignments ADD COLUMN assigned_by VARCHAR(100)`);
      console.log('✅ Added assigned_by column to license_assignments table');
    }
    
  } catch (err) {
    console.warn('⚠️ Adding columns warning:', err.message);
  }
};

bootstrapTables();

// ── Helper: send license assignment email ─────────────────────────────────────
const sendLicenseEmail = async ({ to, empName, licenseNames, action }) => {
  const isRevoked = action === 'revoked';
  const subject = isRevoked
    ? `🔑 License Access Revoked`
    : `✅ Software Licenses Assigned — Welcome!`;

  const listHtml = licenseNames.map(n => `<li style="padding:4px 0;">${n}</li>`).join('');

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;
  box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
  <div style="background:${isRevoked ? '#FEF2F2' : '#ECFDF5'};padding:28px 32px;
    border-bottom:1px solid #E5E7EB;">
    <h1 style="margin:0;font-size:20px;color:${isRevoked ? '#DC2626' : '#065F46'};">
      ${isRevoked ? '🔒 License Access Revoked' : '✅ Software Licenses Assigned'}
    </h1>
    <p style="margin:6px 0 0;color:#6B7280;font-size:13px;">AssetOps License Management</p>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#111827;font-size:15px;">Hi <strong>${empName}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      ${isRevoked
        ? 'The following license(s) have been revoked from your account:'
        : 'The following software licenses have been assigned to you. You can now access these tools:'}
    </p>
    <ul style="background:#F9FAFB;border-radius:8px;padding:16px 20px 16px 36px;
      border:1px solid #E5E7EB;color:#111827;font-size:14px;line-height:1.8;">
      ${listHtml}
    </ul>
    ${!isRevoked ? `<p style="color:#6B7280;font-size:13px;margin-top:16px;">
      Contact IT support if you need login credentials or setup assistance.
    </p>` : ''}
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
      This is an automated message from AssetOps. Do not reply to this email.
    </p>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;text-align:center;">
    <p style="color:#9CA3AF;font-size:11px;margin:0;">
      &copy; ${new Date().getFullYear()} AssetOps · License Management System
    </p>
  </div>
</div>
</body></html>`;

  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`✅ License email sent to ${to}`);
  } catch (e) {
    console.error(`❌ License email failed for ${to}:`, e.message);
  }
};

// ── Helper: get licenses with assignments ─────────────────────────────────────
const getLicensesWithAssignments = async () => {
  const licRes = await query(`SELECT * FROM licenses ORDER BY name ASC`);
  const assRes = await query(`SELECT * FROM license_assignments ORDER BY assigned_at DESC`);

  return licRes.rows.map(l => ({
    ...l,
    assignments: assRes.rows.filter(a => a.license_id === l.id),
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/licenses
// ─────────────────────────────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const data = await getLicensesWithAssignments();
  res.json({ success: true, data });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/licenses/employees
// ─────────────────────────────────────────────────────────────────────────────
exports.getEmployees = asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT 
      e.emp_id,
      e.emp_name,
      e.company_email AS emp_email,
      e.service_line AS department,
      e.designation,
      e.status,
      e.location
    FROM employees e
    WHERE e.deleted_at IS NULL
      AND e.status = 'Active'
    ORDER BY e.emp_name ASC
  `);
  
  console.log(`📋 Found ${result.rows.length} active employees for license management`);
  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route POST /api/licenses
// ─────────────────────────────────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { name, category, icon, color, total_seats, license_key,
          expiry_date, vendor, cost, notes, auto_assign, is_custom } = req.body;

  if (!name) return res.status(400).json({ success: false, message: 'name is required' });

  // Check available columns dynamically
  const columnsRes = await query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'licenses'
  `);
  const existingColumns = columnsRes.rows.map(c => c.column_name);
  
  // Build insert query dynamically based on existing columns
  const insertFields = ['name', 'category', 'icon', 'color', 'total_seats', 
                         'license_key', 'expiry_date', 'vendor', 'cost', 
                         'notes', 'auto_assign'];
  const insertValues = [name, category || null, icon || '🔑', color || '#6366f1',
                        Number(total_seats) || 0, license_key || null, expiry_date || null,
                        vendor || null, cost || null, notes || null, !!auto_assign];
  
  // Add is_custom if column exists
  if (existingColumns.includes('is_custom')) {
    insertFields.push('is_custom');
    insertValues.push(!!is_custom);
  }
  
  // Add created_by if column exists
  if (existingColumns.includes('created_by')) {
    insertFields.push('created_by');
    insertValues.push(req.user?.name || 'Admin');
  }
  
  const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
  
  const result = await query(
    `INSERT INTO licenses (${insertFields.join(', ')}) 
     VALUES (${placeholders}) 
     RETURNING *`,
    insertValues
  );

  const license = result.rows[0];

  // AUDIT: Log license creation
  await audit(
    'LICENSE_CREATED',
    'license',
    `License "${name}" created with ${total_seats || 'unlimited'} seats${is_custom ? ' (Custom License)' : ''}`,
    req.user?.name || 'Admin'
  );

  // If auto_assign — assign to all current active employees
  if (auto_assign) {
    try {
      const emps = await query(`
        SELECT emp_id, emp_name, company_email AS emp_email, service_line AS department
        FROM employees 
        WHERE deleted_at IS NULL AND status = 'Active'
      `);
      let assignedCount = 0;
      
      // Check if assigned_by column exists in license_assignments
      const assignColumns = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'license_assignments'
      `);
      const assignColumnNames = assignColumns.rows.map(c => c.column_name);
      const hasAssignedBy = assignColumnNames.includes('assigned_by');
      
      for (const emp of emps.rows) {
        if (hasAssignedBy) {
          await query(
            `INSERT INTO license_assignments (license_id, emp_id, emp_name, emp_email, department, assigned_by)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
            [license.id, emp.emp_id, emp.emp_name, emp.emp_email, emp.department, req.user?.name || 'System']
          );
        } else {
          await query(
            `INSERT INTO license_assignments (license_id, emp_id, emp_name, emp_email, department)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [license.id, emp.emp_id, emp.emp_name, emp.emp_email, emp.department]
          );
        }
        assignedCount++;
      }
      
      await audit(
        'LICENSE_AUTO_ASSIGN',
        'license',
        `License "${name}" auto-assigned to ${assignedCount} employees`,
        req.user?.name || 'Admin'
      );
      
      console.log(`✅ Auto-assigned "${name}" to ${emps.rows.length} employees`);
    } catch (e) { console.error('Auto-assign failed:', e.message); }
  }

  res.status(201).json({ success: true, data: license });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route PUT /api/licenses/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const { name, category, icon, color, total_seats, license_key,
          expiry_date, vendor, cost, notes, auto_assign } = req.body;

  // Get old license data for audit
  const oldLicense = await query(`SELECT * FROM licenses WHERE id=$1`, [req.params.id]);
  if (!oldLicense.rows.length) {
    return res.status(404).json({ success: false, message: 'License not found' });
  }

  const result = await query(
    `UPDATE licenses SET
       name=$1, category=$2, icon=$3, color=$4, total_seats=$5, license_key=$6,
       expiry_date=$7, vendor=$8, cost=$9, notes=$10, auto_assign=$11, updated_at=NOW()
     WHERE id=$12 RETURNING *`,
    [name, category || null, icon || '🔑', color || '#6366f1',
     Number(total_seats) || 0, license_key || null, expiry_date || null,
     vendor || null, cost || null, notes || null, !!auto_assign, req.params.id]
  );

  if (!result.rows.length)
    return res.status(404).json({ success: false, message: 'License not found' });

  // AUDIT: Log license update
  await audit(
    'LICENSE_UPDATED',
    'license',
    `License "${name}" updated (was: "${oldLicense.rows[0].name}")`,
    req.user?.name || 'Admin'
  );

  res.json({ success: true, data: result.rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route DELETE /api/licenses/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  // Get license data before deletion
  const license = await query(`SELECT name FROM licenses WHERE id=$1`, [req.params.id]);
  const licenseName = license.rows[0]?.name || 'Unknown';
  
  await query(`DELETE FROM licenses WHERE id=$1`, [req.params.id]);
  
  // AUDIT: Log license deletion
  await audit(
    'LICENSE_DELETED',
    'license',
    `License "${licenseName}" deleted`,
    req.user?.name || 'Admin'
  );
  
  res.json({ success: true, message: 'License deleted' });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route POST /api/licenses/:id/assign
// ─────────────────────────────────────────────────────────────────────────────
exports.assign = asyncHandler(async (req, res) => {
  const { emp_id, emp_name, emp_email, department } = req.body;
  const licenseId = req.params.id;

  if (!emp_id || !emp_name)
    return res.status(400).json({ success: false, message: 'emp_id and emp_name required' });

  // Check seat limit
  const lic = await query(`SELECT * FROM licenses WHERE id=$1`, [licenseId]);
  if (!lic.rows.length) return res.status(404).json({ success: false, message: 'License not found' });

  const license = lic.rows[0];
  if (license.total_seats > 0) {
    const used = await query(
      `SELECT COUNT(*) FROM license_assignments WHERE license_id=$1`, [licenseId]
    );
    if (Number(used.rows[0].count) >= license.total_seats) {
      return res.status(400).json({ success: false, message: 'All seats are taken' });
    }
  }

  // Check if assigned_by column exists
  const assignColumns = await query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'license_assignments'
  `);
  const hasAssignedBy = assignColumns.rows.map(c => c.column_name).includes('assigned_by');
  
  let result;
  if (hasAssignedBy) {
    result = await query(
      `INSERT INTO license_assignments (license_id, emp_id, emp_name, emp_email, department, assigned_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (license_id, emp_id) DO UPDATE
         SET emp_name=$3, emp_email=$4, department=$5, assigned_by=$6
       RETURNING *`,
      [licenseId, emp_id, emp_name, emp_email || null, department || null, req.user?.name || 'Admin']
    );
  } else {
    result = await query(
      `INSERT INTO license_assignments (license_id, emp_id, emp_name, emp_email, department)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (license_id, emp_id) DO UPDATE
         SET emp_name=$3, emp_email=$4, department=$5
       RETURNING *`,
      [licenseId, emp_id, emp_name, emp_email || null, department || null]
    );
  }

  // AUDIT: Log license assignment
  await audit(
    'LICENSE_ASSIGNED',
    'license',
    `License "${license.name}" assigned to ${emp_name} (${emp_id})`,
    req.user?.name || 'Admin'
  );

  // Send assignment email
  if (emp_email) {
    await sendLicenseEmail({
      to: emp_email, empName: emp_name,
      licenseNames: [license.name], action: 'assigned',
    });
  }

  res.status(201).json({ success: true, data: result.rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route DELETE /api/licenses/assignments/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.revokeAssignment = asyncHandler(async (req, res) => {
  const asgRes = await query(
    `SELECT la.*, l.name as license_name
     FROM license_assignments la JOIN licenses l ON l.id = la.license_id
     WHERE la.id=$1`,
    [req.params.id]
  );
  if (!asgRes.rows.length)
    return res.status(404).json({ success: false, message: 'Assignment not found' });

  const a = asgRes.rows[0];
  await query(`DELETE FROM license_assignments WHERE id=$1`, [req.params.id]);

  // AUDIT: Log license revocation
  await audit(
    'LICENSE_REVOKED',
    'license',
    `License "${a.license_name}" revoked from ${a.emp_name} (${a.emp_id})`,
    req.user?.name || 'Admin'
  );

  if (a.emp_email) {
    await sendLicenseEmail({
      to: a.emp_email, empName: a.emp_name,
      licenseNames: [a.license_name], action: 'revoked',
    });
  }

  res.json({ success: true, message: 'Assignment revoked' });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/licenses/report/excel
// Export Excel report of all licenses and assignments
// ─────────────────────────────────────────────────────────────────────────────
exports.exportExcelReport = asyncHandler(async (req, res) => {
  const { format = 'summary' } = req.query;
  
  const workbook = new ExcelJS.Workbook();
  
  // Get licenses with assignment counts
  const licenses = await query(`
    SELECT l.*, COUNT(la.id) as assigned_count
    FROM licenses l
    LEFT JOIN license_assignments la ON l.id = la.license_id
    GROUP BY l.id
    ORDER BY l.name ASC
  `);
  
  // Get all assignments
  const assignments = await query(`
    SELECT 
      la.emp_id, la.emp_name, la.emp_email, la.department,
      la.assigned_at, la.assigned_by,
      l.name as license_name, l.category, l.expiry_date, l.is_custom
    FROM license_assignments la
    JOIN licenses l ON la.license_id = l.id
    ORDER BY la.assigned_at DESC
  `);
  
  if (format === 'summary') {
    // SUMMARY SHEET
    const summarySheet = workbook.addWorksheet('License Summary');
    
    summarySheet.columns = [
      { header: 'License ID', key: 'id', width: 10 },
      { header: 'License Name', key: 'name', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Vendor', key: 'vendor', width: 15 },
      { header: 'Total Seats', key: 'total_seats', width: 12 },
      { header: 'Assigned Seats', key: 'assigned', width: 12 },
      { header: 'Available Seats', key: 'available', width: 12 },
      { header: 'Expiry Date', key: 'expiry_date', width: 12 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Monthly Cost (₹)', key: 'cost', width: 15 },
      { header: 'Custom License', key: 'is_custom', width: 12 },
      { header: 'Auto-Assign', key: 'auto_assign', width: 12 }
    ];
    
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B5E3F' }
    };
    summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    
    for (const license of licenses.rows) {
      const assigned = parseInt(license.assigned_count) || 0;
      const total = license.total_seats || 0;
      const available = total === 0 ? 'Unlimited' : total - assigned;
      const status = license.expiry_date && license.expiry_date < new Date() ? 'Expired' : 'Active';
      
      summarySheet.addRow({
        id: license.id,
        name: license.name,
        category: license.category || '—',
        vendor: license.vendor || '—',
        total_seats: total === 0 ? 'Unlimited' : total,
        assigned: assigned,
        available: available,
        expiry_date: license.expiry_date ? new Date(license.expiry_date).toLocaleDateString() : '—',
        status: status,
        cost: license.cost || '—',
        is_custom: license.is_custom ? 'Yes' : 'No',
        auto_assign: license.auto_assign ? 'Yes' : 'No'
      });
    }
    
    // DETAILED SHEET
    const detailedSheet = workbook.addWorksheet('Employee Allocations');
    
    detailedSheet.columns = [
      { header: 'Employee ID', key: 'emp_id', width: 12 },
      { header: 'Employee Name', key: 'emp_name', width: 25 },
      { header: 'Email', key: 'emp_email', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'License Name', key: 'license_name', width: 25 },
      { header: 'License Category', key: 'category', width: 15 },
      { header: 'Assigned Date', key: 'assigned_at', width: 15 },
      { header: 'Assigned By', key: 'assigned_by', width: 20 },
      { header: 'License Expiry', key: 'expiry_date', width: 12 }
    ];
    
    detailedSheet.getRow(1).font = { bold: true };
    detailedSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B5E3F' }
    };
    detailedSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    
    for (const assignment of assignments.rows) {
      detailedSheet.addRow({
        emp_id: assignment.emp_id,
        emp_name: assignment.emp_name,
        emp_email: assignment.emp_email || '—',
        department: assignment.department || '—',
        license_name: assignment.license_name,
        category: assignment.category || '—',
        assigned_at: assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : '—',
        assigned_by: assignment.assigned_by || 'System',
        expiry_date: assignment.expiry_date ? new Date(assignment.expiry_date).toLocaleDateString() : '—'
      });
    }
    
    // STATISTICS SHEET
    const statsSheet = workbook.addWorksheet('Statistics');
    
    const totalLicenses = licenses.rows.length;
    const totalAssignments = assignments.rows.length;
    const uniqueEmployees = new Set(assignments.rows.map(a => a.emp_id)).size;
    const expiringLicenses = licenses.rows.filter(l => l.expiry_date && 
      new Date(l.expiry_date) > new Date() && 
      new Date(l.expiry_date) - new Date() <= 30 * 24 * 60 * 60 * 1000
    ).length;
    const customLicenses = licenses.rows.filter(l => l.is_custom).length;
    
    statsSheet.getRow(1).font = { bold: true };
    statsSheet.addRow(['Metric', 'Value']);
    statsSheet.addRow(['Total Licenses', totalLicenses]);
    statsSheet.addRow(['Total Assignments', totalAssignments]);
    statsSheet.addRow(['Employees with Licenses', uniqueEmployees]);
    statsSheet.addRow(['Licenses Expiring in 30 Days', expiringLicenses]);
    statsSheet.addRow(['Custom Licenses', customLicenses]);
    statsSheet.addRow(['Auto-Assign Enabled', licenses.rows.filter(l => l.auto_assign).length]);
    
  } else {
    // DETAILED REPORT
    const sheet = workbook.addWorksheet('License Report');
    
    sheet.columns = [
      { header: 'License ID', key: 'license_id', width: 10 },
      { header: 'License Name', key: 'license_name', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Custom License', key: 'is_custom', width: 12 },
      { header: 'Total Seats', key: 'total_seats', width: 12 },
      { header: 'Assigned Count', key: 'assigned_count', width: 12 },
      { header: 'Employee ID', key: 'emp_id', width: 12 },
      { header: 'Employee Name', key: 'emp_name', width: 25 },
      { header: 'Employee Email', key: 'emp_email', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Assigned Date', key: 'assigned_at', width: 15 },
      { header: 'Assigned By', key: 'assigned_by', width: 20 },
      { header: 'License Expiry', key: 'expiry_date', width: 12 }
    ];
    
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B5E3F' }
    };
    sheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    
    for (const license of licenses.rows) {
      const licenseAssignments = assignments.rows.filter(a => a.license_name === license.name);
      
      if (licenseAssignments.length === 0) {
        sheet.addRow({
          license_id: license.id,
          license_name: license.name,
          category: license.category || '—',
          is_custom: license.is_custom ? 'Yes' : 'No',
          total_seats: license.total_seats === 0 ? 'Unlimited' : license.total_seats,
          assigned_count: license.assigned_count || 0,
          emp_id: '—',
          emp_name: 'No assignments',
          emp_email: '—',
          department: '—',
          assigned_at: '—',
          assigned_by: '—',
          expiry_date: license.expiry_date ? new Date(license.expiry_date).toLocaleDateString() : '—'
        });
      } else {
        for (const assignment of licenseAssignments) {
          sheet.addRow({
            license_id: license.id,
            license_name: license.name,
            category: license.category || '—',
            is_custom: license.is_custom ? 'Yes' : 'No',
            total_seats: license.total_seats === 0 ? 'Unlimited' : license.total_seats,
            assigned_count: license.assigned_count || 0,
            emp_id: assignment.emp_id,
            emp_name: assignment.emp_name,
            emp_email: assignment.emp_email || '—',
            department: assignment.department || '—',
            assigned_at: assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : '—',
            assigned_by: assignment.assigned_by || 'System',
            expiry_date: license.expiry_date ? new Date(license.expiry_date).toLocaleDateString() : '—'
          });
        }
      }
    }
  }
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=license-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  
  await workbook.xlsx.write(res);
  res.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/licenses/report/data
// Get JSON report data
// ─────────────────────────────────────────────────────────────────────────────
exports.getReportData = asyncHandler(async (req, res) => {
  const licenses = await query(`
    SELECT l.*, COUNT(la.id) as assigned_count
    FROM licenses l
    LEFT JOIN license_assignments la ON l.id = la.license_id
    GROUP BY l.id
    ORDER BY l.name ASC
  `);
  
  const assignments = await query(`
    SELECT 
      la.emp_id, la.emp_name, la.emp_email, la.department,
      la.assigned_at, la.assigned_by,
      l.name as license_name, l.category, l.expiry_date, l.is_custom
    FROM license_assignments la
    JOIN licenses l ON la.license_id = l.id
    ORDER BY la.assigned_at DESC
  `);
  
  const stats = {
    total_licenses: licenses.rows.length,
    total_assignments: assignments.rows.length,
    unique_employees: new Set(assignments.rows.map(a => a.emp_id)).size,
    expiring_soon: licenses.rows.filter(l => l.expiry_date && 
      new Date(l.expiry_date) > new Date() && 
      new Date(l.expiry_date) - new Date() <= 30 * 24 * 60 * 60 * 1000
    ).length,
    expired: licenses.rows.filter(l => l.expiry_date && new Date(l.expiry_date) <= new Date()).length,
    custom_licenses: licenses.rows.filter(l => l.is_custom).length,
    auto_assign_licenses: licenses.rows.filter(l => l.auto_assign).length,
    total_cost: licenses.rows.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0)
  };
  
  // Group by department
  const departmentStats = await query(`
    SELECT 
      COALESCE(department, 'Unknown') as department,
      COUNT(DISTINCT emp_id) as employee_count,
      COUNT(*) as assignment_count
    FROM license_assignments
    GROUP BY department
    ORDER BY assignment_count DESC
  `);
  
  res.json({
    success: true,
    data: {
      licenses: licenses.rows,
      assignments: assignments.rows,
      stats: stats,
      department_stats: departmentStats.rows
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/licenses/custom
// Get all custom licenses
// ─────────────────────────────────────────────────────────────────────────────
exports.getCustomLicenses = asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT * FROM licenses 
    WHERE is_custom = true 
    ORDER BY created_at DESC
  `);
  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-ASSIGN on new employee join
// ─────────────────────────────────────────────────────────────────────────────
exports.autoAssignLicenses = async (emp_id, emp_name, emp_email, department, assignedBy = 'System') => {
  try {
    const autoLicenses = await query(
      `SELECT * FROM licenses WHERE auto_assign = true`
    );
    if (!autoLicenses.rows.length) return;

    const assigned = [];
    for (const lic of autoLicenses.rows) {
      if (lic.total_seats > 0) {
        const used = await query(
          `SELECT COUNT(*) FROM license_assignments WHERE license_id=$1`, [lic.id]
        );
        if (Number(used.rows[0].count) >= lic.total_seats) continue;
      }
      try {
        await query(
          `INSERT INTO license_assignments (license_id, emp_id, emp_name, emp_email, department, assigned_by)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [lic.id, emp_id, emp_name, emp_email || null, department || null, assignedBy]
        );
        assigned.push(lic.name);
      } catch (_) {}
    }

    if (assigned.length > 0 && emp_email) {
      await audit(
        'LICENSE_AUTO_ASSIGN',
        'license',
        `${assigned.length} licenses auto-assigned to ${emp_name} (${emp_id})`,
        assignedBy
      );
      
      await sendLicenseEmail({
        to: emp_email, empName: emp_name,
        licenseNames: assigned, action: 'assigned',
      });
      console.log(`✅ Auto-assigned ${assigned.length} licenses to ${emp_name}`);
    }
  } catch (err) {
    console.error('Auto-assign licenses error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CRON: License expiry alerts (run daily)
// ─────────────────────────────────────────────────────────────────────────────
exports.runExpiryJob = async () => {
  console.log('🔑 [Licenses] Running expiry check…');
  try {
    const expiring = await query(`
      SELECT *, (expiry_date - CURRENT_DATE) AS days_left
      FROM licenses
      WHERE expiry_date IS NOT NULL
        AND (expiry_date - CURRENT_DATE) IN (30, 14, 7, 3, 1)
    `);
    for (const lic of expiring.rows) {
      console.log(`⏰ License "${lic.name}" expiring in ${lic.days_left} days`);
      
      await audit(
        'LICENSE_EXPIRY_ALERT',
        'license',
        `License "${lic.name}" expires in ${lic.days_left} days`,
        'System'
      );
      
      if (process.env.MAIL_USER) {
        await transporter.sendMail({
          from: FROM,
          to: process.env.MAIL_USER,
          subject: `⏰ License Expiry Alert — ${lic.name} (${lic.days_left} days)`,
          html: `<p>License <strong>${lic.name}</strong> expires on <strong>${lic.expiry_date}</strong> (${lic.days_left} days left).</p><p>Please renew to avoid service disruption.</p>`,
        });
      }
    }
    console.log(`🔑 [Licenses] Done. Checked ${expiring.rows.length} expiring licenses.`);
  } catch (err) {
    console.error('🔑 [Licenses] Job error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper function to sync all existing employees
// ─────────────────────────────────────────────────────────────────────────────
exports.syncExistingEmployees = async () => {
  console.log('🔄 Syncing existing employees to license system...');
  try {
    const employees = await query(`
      SELECT emp_id, emp_name, company_email AS emp_email, service_line AS department
      FROM employees
      WHERE deleted_at IS NULL AND status = 'Active'
    `);
    
    console.log(`📋 Found ${employees.rows.length} active employees to sync`);
    
    await audit(
      'LICENSE_SYNC',
      'license',
      `Synced ${employees.rows.length} employees to license system`,
      'System'
    );
    
    return { success: true, count: employees.rows.length };
  } catch (err) {
    console.error('Sync failed:', err.message);
    return { success: false, error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route GET /api/licenses/home-stats
// Dashboard: home license counts with seat usage per license
// ─────────────────────────────────────────────────────────────────────────────
exports.getHomeStats = asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT 
      l.id,
      l.name,
      l.icon,
      l.color,
      l.category,
      l.total_seats,
      COUNT(la.id) AS assigned_count
    FROM licenses l
    LEFT JOIN license_assignments la ON la.license_id = l.id
    GROUP BY l.id
    ORDER BY l.name ASC
  `);

  const licenses = result.rows;
  const totalSeats     = licenses.reduce((s, l) => s + (parseInt(l.total_seats) || 0), 0);
  const totalAssigned  = licenses.reduce((s, l) => s + (parseInt(l.assigned_count) || 0), 0);

  res.json({
    success: true,
    data: {
      licenses,
      summary: {
        total_licenses: licenses.length,
        total_seats:    totalSeats,
        total_assigned: totalAssigned,
        total_remaining: Math.max(0, totalSeats - totalAssigned),
      }
    }
  });
});