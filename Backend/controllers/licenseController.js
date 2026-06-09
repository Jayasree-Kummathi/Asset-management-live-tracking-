'use strict';
// Backend/controllers/licenseController.js

const { query }    = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const nodemailer   = require('nodemailer');
const ExcelJS      = require('exceljs');
const { isSuperAdmin, getUserLocations } = require('../utils/locationFilter');

// ── Build the creator-group sub-query clause for employee scoping ─────────────
// Returns a SQL fragment that restricts to employees whose creating admin
// shares any of the current user's managed locations.
const buildEmpCreatorClause = (user, paramIdx) => {
  if (isSuperAdmin(user)) return { clause: '', clauseParams: [], nextIdx: paramIdx };
  const locs = getUserLocations(user);
  if (!locs || locs.length === 0) return { clause: 'AND 1 = 0', clauseParams: [], nextIdx: paramIdx };
  const clause = `
    AND e.emp_id IN (
      SELECT emp_id FROM employees
      WHERE created_by_admin_id IN (
        SELECT id FROM users
        WHERE managed_location = ANY($${paramIdx}::text[])
           OR managed_locations LIKE ANY(SELECT '%' || unnest($${paramIdx}::text[]) || '%')
      )
      AND deleted_at IS NULL
    )
  `;
  return { clause, clauseParams: [locs], nextIdx: paramIdx + 1 };
};

const FROM = process.env.MAIL_FROM || `AssetOps <${process.env.MAIL_USER}>`;

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST, port: Number(process.env.MAIL_PORT) || 587,
  secure: false, auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

// ── Local audit helper ─────────────────────────────────────────────────────────
const audit = async (action, category, detail, performedBy) => {
  try {
    await query(
      `INSERT INTO audit_logs (action, category, detail, performed_by, created_at)
       VALUES ($1,$2,$3,$4,NOW())`,
      [action, category, detail, performedBy || 'System']
    );
  } catch (err) { console.error('Audit log error:', err.message); }
};

// ── Bootstrap tables ───────────────────────────────────────────────────────────
const bootstrapTables = async () => {
  try {
    await query(`
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
      CREATE INDEX IF NOT EXISTS idx_la_license   ON license_assignments(license_id);
      CREATE INDEX IF NOT EXISTS idx_la_emp_id    ON license_assignments(emp_id);
      CREATE INDEX IF NOT EXISTS idx_la_emp_email ON license_assignments(emp_email);
    `);

    // Add optional columns if missing
    const cols = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'licenses'`);
    const lcols = cols.rows.map(c => c.column_name);
    if (!lcols.includes('is_custom'))   await query(`ALTER TABLE licenses ADD COLUMN is_custom BOOLEAN DEFAULT false`);
    if (!lcols.includes('created_by'))  await query(`ALTER TABLE licenses ADD COLUMN created_by VARCHAR(100)`);

    const acols = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'license_assignments'`);
    if (!acols.rows.map(c => c.column_name).includes('assigned_by'))
      await query(`ALTER TABLE license_assignments ADD COLUMN assigned_by VARCHAR(100)`);

    console.log('✅ License tables ready');
  } catch (err) { console.error('⚠️ License table setup failed:', err.message); }
};
bootstrapTables();

// ── Email helper ───────────────────────────────────────────────────────────────
const sendLicenseEmail = async ({ to, empName, licenseNames, action }) => {
  const isRevoked = action === 'revoked';
  const subject   = isRevoked ? '🔑 License Access Revoked' : '✅ Software Licenses Assigned — Welcome!';
  const listHtml  = licenseNames.map(n => `<li style="padding:4px 0;">${n}</li>`).join('');
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#F3F4F6;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
  <h2 style="color:${isRevoked ? '#DC2626' : '#065F46'};">${subject}</h2>
  <p>Hi <strong>${empName}</strong>,</p>
  <p>${isRevoked ? 'The following license(s) have been revoked:' : 'The following licenses have been assigned to you:'}</p>
  <ul style="background:#F9FAFB;border-radius:8px;padding:16px 20px 16px 36px;border:1px solid #E5E7EB;">${listHtml}</ul>
  <p style="color:#9CA3AF;font-size:12px;">This is an automated message from AssetOps.</p>
</div></body></html>`;
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (e) { console.error(`License email failed for ${to}:`, e.message); }
};

// ── Helper: check if assigned_by column exists ────────────────────────────────
const hasAssignedByCol = async () => {
  const r = await query(`SELECT column_name FROM information_schema.columns
    WHERE table_name='license_assignments' AND column_name='assigned_by'`);
  return r.rows.length > 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/licenses
// Licenses are global (not location-scoped).
// Assignments are scoped — only show assignments for employees in your locations.
// ─────────────────────────────────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const licRes = await query(`SELECT * FROM licenses ORDER BY name ASC`);

  let assRes;
  if (isSuperAdmin(req.user)) {
    assRes = await query(`SELECT * FROM license_assignments ORDER BY assigned_at DESC`);
  } else {
    // Show assignments only for employees visible to this admin's location group
    const { clause, clauseParams } = buildEmpCreatorClause(req.user, 1);
    if (clause === 'AND 1 = 0') {
      assRes = { rows: [] };
    } else {
      assRes = await query(
        `SELECT la.*
         FROM license_assignments la
         INNER JOIN employees e ON e.emp_id = la.emp_id
         WHERE 1=1 ${clause}
         ORDER BY la.assigned_at DESC`,
        clauseParams
      );
    }
  }

  const data = licRes.rows.map(l => ({
    ...l,
    assignments: assRes.rows.filter(a => a.license_id === l.id),
  }));

  res.json({ success: true, data });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/licenses/employees
// Returns employees scoped to the user's managed locations
// ─────────────────────────────────────────────────────────────────────────────
exports.getEmployees = asyncHandler(async (req, res) => {
  const conditions = [`e.deleted_at IS NULL`, `e.status = 'Active'`];
  const params     = [];

  if (!isSuperAdmin(req.user)) {
    // Filter by creator-group: employees created by admins in the same location group
    const { clause, clauseParams } = buildEmpCreatorClause(req.user, params.length + 1);
    if (clause === 'AND 1 = 0') {
      return res.json({ success: true, data: [] });
    }
    if (clause) {
      // Strip leading "AND" so it works inside conditions array
      conditions.push(`e.emp_id IN (
        SELECT emp_id FROM employees
        WHERE created_by_admin_id IN (
          SELECT id FROM users
          WHERE managed_location = ANY($${params.length + 1}::text[])
             OR managed_locations LIKE ANY(SELECT '%' || unnest($${params.length + 1}::text[]) || '%')
        )
        AND deleted_at IS NULL
      )`);
      params.push(...clauseParams);
    }
  }

  const result = await query(
    `SELECT e.emp_id, e.emp_name, e.company_email AS emp_email,
            e.service_line AS department, e.designation, e.status, e.location
     FROM employees e
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.emp_name ASC`,
    params
  );

  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/licenses
// ─────────────────────────────────────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const { name, category, icon, color, total_seats, license_key,
          expiry_date, vendor, cost, notes, auto_assign, is_custom } = req.body;

  if (!name) return res.status(400).json({ success: false, message: 'name is required' });

  const cols = (await query(`SELECT column_name FROM information_schema.columns WHERE table_name='licenses'`))
    .rows.map(c => c.column_name);

  const fields = ['name','category','icon','color','total_seats','license_key',
                  'expiry_date','vendor','cost','notes','auto_assign'];
  const values = [name, category||null, icon||'🔑', color||'#6366f1',
                  Number(total_seats)||0, license_key||null, expiry_date||null,
                  vendor||null, cost||null, notes||null, !!auto_assign];

  if (cols.includes('is_custom'))  { fields.push('is_custom');  values.push(!!is_custom); }
  if (cols.includes('created_by')) { fields.push('created_by'); values.push(req.user?.name||'Admin'); }

  const placeholders = values.map((_,i) => `$${i+1}`).join(',');
  const result = await query(
    `INSERT INTO licenses (${fields.join(',')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  const license = result.rows[0];

  await audit('LICENSE_CREATED','license',`License "${name}" created`,req.user?.name||'Admin');

  if (auto_assign) {
    try {
      const emps = await query(`SELECT emp_id,emp_name,company_email AS emp_email,service_line AS department
        FROM employees WHERE deleted_at IS NULL AND status='Active'`);
      const useAssignedBy = await hasAssignedByCol();
      for (const emp of emps.rows) {
        if (useAssignedBy) {
          await query(
            `INSERT INTO license_assignments (license_id,emp_id,emp_name,emp_email,department,assigned_by)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
            [license.id,emp.emp_id,emp.emp_name,emp.emp_email,emp.department,req.user?.name||'System']
          );
        } else {
          await query(
            `INSERT INTO license_assignments (license_id,emp_id,emp_name,emp_email,department)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [license.id,emp.emp_id,emp.emp_name,emp.emp_email,emp.department]
          );
        }
      }
      await audit('LICENSE_AUTO_ASSIGN','license',`"${name}" auto-assigned to ${emps.rows.length} employees`,req.user?.name||'Admin');
    } catch (e) { console.error('Auto-assign failed:', e.message); }
  }

  res.status(201).json({ success: true, data: license });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/licenses/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const { name, category, icon, color, total_seats, license_key,
          expiry_date, vendor, cost, notes, auto_assign } = req.body;

  const old = await query(`SELECT name FROM licenses WHERE id=$1`, [req.params.id]);
  if (!old.rows.length) return res.status(404).json({ success: false, message: 'License not found' });

  const result = await query(
    `UPDATE licenses SET name=$1,category=$2,icon=$3,color=$4,total_seats=$5,license_key=$6,
       expiry_date=$7,vendor=$8,cost=$9,notes=$10,auto_assign=$11,updated_at=NOW()
     WHERE id=$12 RETURNING *`,
    [name,category||null,icon||'🔑',color||'#6366f1',Number(total_seats)||0,
     license_key||null,expiry_date||null,vendor||null,cost||null,notes||null,!!auto_assign,req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ success: false, message: 'License not found' });

  await audit('LICENSE_UPDATED','license',`License "${name}" updated`,req.user?.name||'Admin');
  res.json({ success: true, data: result.rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/licenses/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const lic = await query(`SELECT name FROM licenses WHERE id=$1`, [req.params.id]);
  await query(`DELETE FROM licenses WHERE id=$1`, [req.params.id]);
  await audit('LICENSE_DELETED','license',`License "${lic.rows[0]?.name||'?'}" deleted`,req.user?.name||'Admin');
  res.json({ success: true, message: 'License deleted' });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/licenses/:id/assign
// ─────────────────────────────────────────────────────────────────────────────
exports.assign = asyncHandler(async (req, res) => {
  const { emp_id, emp_name, emp_email, department } = req.body;
  const licenseId = req.params.id;

  if (!emp_id || !emp_name)
    return res.status(400).json({ success: false, message: 'emp_id and emp_name required' });

  const lic = await query(`SELECT * FROM licenses WHERE id=$1`, [licenseId]);
  if (!lic.rows.length) return res.status(404).json({ success: false, message: 'License not found' });
  const license = lic.rows[0];

  if (license.total_seats > 0) {
    const used = await query(`SELECT COUNT(*) FROM license_assignments WHERE license_id=$1`, [licenseId]);
    if (Number(used.rows[0].count) >= license.total_seats)
      return res.status(400).json({ success: false, message: 'All seats are taken' });
  }

  const useAssignedBy = await hasAssignedByCol();
  let result;
  if (useAssignedBy) {
    result = await query(
      `INSERT INTO license_assignments (license_id,emp_id,emp_name,emp_email,department,assigned_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (license_id,emp_id) DO UPDATE SET emp_name=$3,emp_email=$4,department=$5,assigned_by=$6
       RETURNING *`,
      [licenseId,emp_id,emp_name,emp_email||null,department||null,req.user?.name||'Admin']
    );
  } else {
    result = await query(
      `INSERT INTO license_assignments (license_id,emp_id,emp_name,emp_email,department)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (license_id,emp_id) DO UPDATE SET emp_name=$3,emp_email=$4,department=$5
       RETURNING *`,
      [licenseId,emp_id,emp_name,emp_email||null,department||null]
    );
  }

  await audit('LICENSE_ASSIGNED','license',`"${license.name}" assigned to ${emp_name} (${emp_id})`,req.user?.name||'Admin');
  if (emp_email) await sendLicenseEmail({ to: emp_email, empName: emp_name, licenseNames: [license.name], action: 'assigned' });

  res.status(201).json({ success: true, data: result.rows[0] });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/licenses/assignments/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.revokeAssignment = asyncHandler(async (req, res) => {
  const asgRes = await query(
    `SELECT la.*,l.name as license_name FROM license_assignments la
     JOIN licenses l ON l.id=la.license_id WHERE la.id=$1`,
    [req.params.id]
  );
  if (!asgRes.rows.length) return res.status(404).json({ success: false, message: 'Assignment not found' });

  const a = asgRes.rows[0];
  await query(`DELETE FROM license_assignments WHERE id=$1`, [req.params.id]);
  await audit('LICENSE_REVOKED','license',`"${a.license_name}" revoked from ${a.emp_name} (${a.emp_id})`,req.user?.name||'Admin');
  if (a.emp_email) await sendLicenseEmail({ to: a.emp_email, empName: a.emp_name, licenseNames: [a.license_name], action: 'revoked' });

  res.json({ success: true, message: 'Assignment revoked' });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/licenses/home-stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getHomeStats = asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT l.id,l.name,l.icon,l.color,l.category,l.total_seats,
           COUNT(la.id) AS assigned_count
    FROM licenses l
    LEFT JOIN license_assignments la ON la.license_id=l.id
    GROUP BY l.id ORDER BY l.name ASC
  `);
  const licenses     = result.rows;
  const totalSeats   = licenses.reduce((s,l) => s + (parseInt(l.total_seats)||0), 0);
  const totalAssigned = licenses.reduce((s,l) => s + (parseInt(l.assigned_count)||0), 0);
  res.json({ success: true, data: {
    licenses,
    summary: { total_licenses: licenses.length, total_seats: totalSeats,
               total_assigned: totalAssigned, total_remaining: Math.max(0, totalSeats-totalAssigned) }
  }});
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/licenses/report/data
// ─────────────────────────────────────────────────────────────────────────────
exports.getReportData = asyncHandler(async (req, res) => {
  const licenses = await query(`
    SELECT l.*, COUNT(la.id) as assigned_count FROM licenses l
    LEFT JOIN license_assignments la ON l.id=la.license_id
    GROUP BY l.id ORDER BY l.name ASC`);
  const assignments = await query(`
    SELECT la.emp_id,la.emp_name,la.emp_email,la.department,la.assigned_at,la.assigned_by,
           l.name as license_name,l.category,l.expiry_date,l.is_custom
    FROM license_assignments la JOIN licenses l ON la.license_id=l.id
    ORDER BY la.assigned_at DESC`);
  const stats = {
    total_licenses: licenses.rows.length,
    total_assignments: assignments.rows.length,
    unique_employees: new Set(assignments.rows.map(a => a.emp_id)).size,
    expiring_soon: licenses.rows.filter(l => l.expiry_date &&
      new Date(l.expiry_date) > new Date() &&
      new Date(l.expiry_date) - new Date() <= 30*24*60*60*1000).length,
    expired: licenses.rows.filter(l => l.expiry_date && new Date(l.expiry_date) <= new Date()).length,
    custom_licenses: licenses.rows.filter(l => l.is_custom).length,
    auto_assign_licenses: licenses.rows.filter(l => l.auto_assign).length,
    total_cost: licenses.rows.reduce((s,l) => s + (parseFloat(l.cost)||0), 0),
  };
  const deptStats = await query(`
    SELECT COALESCE(department,'Unknown') as department,
           COUNT(DISTINCT emp_id) as employee_count, COUNT(*) as assignment_count
    FROM license_assignments GROUP BY department ORDER BY assignment_count DESC`);
  res.json({ success: true, data: { licenses: licenses.rows, assignments: assignments.rows, stats, department_stats: deptStats.rows } });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/licenses/custom
// ─────────────────────────────────────────────────────────────────────────────
exports.getCustomLicenses = asyncHandler(async (req, res) => {
  const result = await query(`SELECT * FROM licenses WHERE is_custom=true ORDER BY created_at DESC`);
  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/licenses/report/excel
// ─────────────────────────────────────────────────────────────────────────────
exports.exportExcelReport = asyncHandler(async (req, res) => {
  const { format = 'summary' } = req.query;
  const workbook = new ExcelJS.Workbook();

  const GREEN = 'FF1B5E3F';
  const WHITE = 'FFFFFFFF';

  const licenses = await query(`
    SELECT l.*, COUNT(la.id) as assigned_count FROM licenses l
    LEFT JOIN license_assignments la ON l.id=la.license_id
    GROUP BY l.id ORDER BY l.name ASC`);

  const assignments = await query(`
    SELECT la.emp_id,la.emp_name,la.emp_email,la.department,la.assigned_at,la.assigned_by,
           l.name as license_name,l.category,l.expiry_date,l.is_custom
    FROM license_assignments la JOIN licenses l ON la.license_id=l.id
    ORDER BY la.assigned_at DESC`);

  const styleHeader = (sheet) => {
    sheet.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:GREEN} };
    sheet.getRow(1).font = { color:{argb:WHITE}, bold:true };
  };

  const summarySheet = workbook.addWorksheet('License Summary');
  summarySheet.columns = [
    {header:'License ID',key:'id',width:10},{header:'License Name',key:'name',width:25},
    {header:'Category',key:'category',width:15},{header:'Vendor',key:'vendor',width:15},
    {header:'Total Seats',key:'total_seats',width:12},{header:'Assigned',key:'assigned',width:12},
    {header:'Available',key:'available',width:12},{header:'Expiry Date',key:'expiry_date',width:12},
    {header:'Status',key:'status',width:10},{header:'Cost',key:'cost',width:12},
    {header:'Custom',key:'is_custom',width:10},{header:'Auto-Assign',key:'auto_assign',width:12},
  ];
  styleHeader(summarySheet);
  for (const l of licenses.rows) {
    const assigned  = parseInt(l.assigned_count)||0;
    const total     = l.total_seats||0;
    summarySheet.addRow({
      id:l.id, name:l.name, category:l.category||'—', vendor:l.vendor||'—',
      total_seats: total===0?'Unlimited':total, assigned,
      available: total===0?'Unlimited':total-assigned,
      expiry_date: l.expiry_date?new Date(l.expiry_date).toLocaleDateString():'—',
      status: l.expiry_date&&new Date(l.expiry_date)<new Date()?'Expired':'Active',
      cost:l.cost||'—', is_custom:l.is_custom?'Yes':'No', auto_assign:l.auto_assign?'Yes':'No',
    });
  }

  const detailSheet = workbook.addWorksheet('Employee Allocations');
  detailSheet.columns = [
    {header:'Employee ID',key:'emp_id',width:12},{header:'Employee Name',key:'emp_name',width:25},
    {header:'Email',key:'emp_email',width:25},{header:'Department',key:'department',width:15},
    {header:'License Name',key:'license_name',width:25},{header:'Category',key:'category',width:15},
    {header:'Assigned Date',key:'assigned_at',width:15},{header:'Assigned By',key:'assigned_by',width:20},
    {header:'License Expiry',key:'expiry_date',width:12},
  ];
  styleHeader(detailSheet);
  for (const a of assignments.rows) {
    detailSheet.addRow({
      emp_id:a.emp_id, emp_name:a.emp_name, emp_email:a.emp_email||'—',
      department:a.department||'—', license_name:a.license_name, category:a.category||'—',
      assigned_at:a.assigned_at?new Date(a.assigned_at).toLocaleDateString():'—',
      assigned_by:a.assigned_by||'System',
      expiry_date:a.expiry_date?new Date(a.expiry_date).toLocaleDateString():'—',
    });
  }

  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',`attachment; filename=license-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-ASSIGN on new employee join (called from employeeController)
// ─────────────────────────────────────────────────────────────────────────────
exports.autoAssignLicenses = async (emp_id, emp_name, emp_email, department, assignedBy = 'System') => {
  try {
    const autoLicenses = await query(`SELECT * FROM licenses WHERE auto_assign=true`);
    if (!autoLicenses.rows.length) return;

    const useAssignedBy = await hasAssignedByCol();
    const assigned = [];

    for (const lic of autoLicenses.rows) {
      if (lic.total_seats > 0) {
        const used = await query(`SELECT COUNT(*) FROM license_assignments WHERE license_id=$1`, [lic.id]);
        if (Number(used.rows[0].count) >= lic.total_seats) continue;
      }
      try {
        if (useAssignedBy) {
          await query(
            `INSERT INTO license_assignments (license_id,emp_id,emp_name,emp_email,department,assigned_by)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
            [lic.id,emp_id,emp_name,emp_email||null,department||null,assignedBy]
          );
        } else {
          await query(
            `INSERT INTO license_assignments (license_id,emp_id,emp_name,emp_email,department)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [lic.id,emp_id,emp_name,emp_email||null,department||null]
          );
        }
        assigned.push(lic.name);
      } catch (_) {}
    }

    if (assigned.length > 0 && emp_email) {
      await audit('LICENSE_AUTO_ASSIGN','license',
        `${assigned.length} licenses auto-assigned to ${emp_name} (${emp_id})`, assignedBy);
      await sendLicenseEmail({ to: emp_email, empName: emp_name, licenseNames: assigned, action: 'assigned' });
    }
  } catch (err) { console.error('Auto-assign licenses error:', err.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// CRON: License expiry alerts
// ─────────────────────────────────────────────────────────────────────────────
exports.runExpiryJob = async () => {
  try {
    const expiring = await query(`
      SELECT *, (expiry_date - CURRENT_DATE) AS days_left FROM licenses
      WHERE expiry_date IS NOT NULL AND (expiry_date - CURRENT_DATE) IN (30,14,7,3,1)`);
    for (const lic of expiring.rows) {
      await audit('LICENSE_EXPIRY_ALERT','license',`"${lic.name}" expires in ${lic.days_left} days`,'System');
      if (process.env.MAIL_USER) {
        await transporter.sendMail({
          from: FROM, to: process.env.MAIL_USER,
          subject: `⏰ License Expiry Alert — ${lic.name} (${lic.days_left} days)`,
          html: `<p>License <strong>${lic.name}</strong> expires on <strong>${lic.expiry_date}</strong> (${lic.days_left} days left).</p>`,
        });
      }
    }
  } catch (err) { console.error('License expiry job error:', err.message); }
};

exports.syncExistingEmployees = async () => {
  try {
    const employees = await query(`SELECT emp_id,emp_name,company_email AS emp_email,
      service_line AS department FROM employees WHERE deleted_at IS NULL AND status='Active'`);
    await audit('LICENSE_SYNC','license',`Synced ${employees.rows.length} employees to license system`,'System');
    return { success: true, count: employees.rows.length };
  } catch (err) { return { success: false, error: err.message }; }
};