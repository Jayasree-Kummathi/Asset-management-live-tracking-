require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const seed = async () => {
  const client = await pool.connect();

  try {
    console.log('\n🌱 Seeding PostgreSQL database...\n');
    await client.query('BEGIN');

    // ── Clear tables (in FK-safe order) ────────────────────────────────────
    await client.query('TRUNCATE audit_logs, scraps, repairs, allocations, assets, users RESTART IDENTITY CASCADE');
    console.log('🗑️  Cleared existing data');

    // ── Users ──────────────────────────────────────────────────────────────
    const salt = await bcrypt.genSalt(10);
    const users = [
      { name: 'Admin User',    email: 'admin@company.com',   password: await bcrypt.hash('admin123',   salt), role: 'admin'   },
      { name: 'Asset Manager', email: 'manager@company.com', password: await bcrypt.hash('manager123', salt), role: 'manager' },
      { name: 'Viewer User',   email: 'viewer@company.com',  password: await bcrypt.hash('viewer123',  salt), role: 'viewer'  },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)`,
        [u.name, u.email, u.password, u.role]
      );
    }
    console.log(`✅ Created ${users.length} users`);

    // ── Assets ─────────────────────────────────────────────────────────────
    const assets = [
      ['LTB-270', 'DX45',  'Dell',   'Latitude 5540', 'i7 / 16GB / 512GB SSD', 'Intel i7-1355U', '16GB DDR5', '512GB NVMe SSD', '2023-01-15', '2023-01-15', '2026-01-15', 'Dell India',   'Bengaluru',  null,                   'Allocated'],
      ['LTB-271', 'DX56',  'Dell',   'Latitude 5540', 'i5 / 8GB / 256GB SSD',  'Intel i5-1335U', '8GB DDR5',  '256GB NVMe SSD', '2023-02-10', '2023-02-10', '2026-02-10', 'Dell India',   'Bengaluru',  null,                   'Allocated'],
      ['LTB-272', 'DX57',  'HP',     'EliteBook 840', 'i7 / 16GB / 512GB SSD', 'Intel i7-1355U', '16GB DDR5', '512GB NVMe SSD', '2022-11-01', '2022-11-01', '2025-11-01', 'HP India',     'Bengaluru',  'Fan noise issue',      'Repair'   ],
      ['LTB-273', 'DX78',  'Lenovo', 'ThinkPad L14',  'i5 / 16GB / 512GB SSD', 'Intel i5-1345U', '16GB DDR5', '512GB NVMe SSD', '2023-05-20', '2023-05-20', '2026-05-20', 'Lenovo India', 'Bengaluru',  null,                   'Stock'    ],
      ['LTB-274', 'DX89',  'Dell',   'Latitude 5540', 'i7 / 32GB / 1TB SSD',   'Intel i7-1355U', '32GB DDR5', '1TB NVMe SSD',   '2023-08-15', '2023-08-15', '2026-08-15', 'Dell India',   'Mumbai',     null,                   'Stock'    ],
      ['LTB-275', 'DX90',  'HP',     'ProBook 450',   'i5 / 8GB / 256GB SSD',  'Intel i5-1235U', '8GB DDR4',  '256GB SSD',      '2023-09-01', '2023-09-01', '2026-09-01', 'HP India',     'Hyderabad',  null,                   'Stock'    ],
      ['LTB-250', 'DX23',  'Dell',   'Latitude 5520', 'i5 / 8GB / 256GB SSD',  'Intel i5-1135G7','8GB DDR4',  '256GB SSD',      '2020-01-05', '2020-01-05', '2023-01-05', 'Dell India',   'Bengaluru',  'Motherboard failure',  'Scrap'    ],
    ];

    for (const a of assets) {
      await client.query(
        `INSERT INTO assets
           (asset_id, serial, brand, model, config, processor, ram, storage,
            purchase_date, warranty_start, warranty_end, vendor, location, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        a
      );
    }
    console.log(`✅ Created ${assets.length} assets`);

    // ── Allocations ────────────────────────────────────────────────────────
    const allocations = [
      ['ALO-001', 'LTB-270', '1001', 'Ram Magadi',    'ram.magadi@company.com',    'Engineering', 'NetApp', 'Storage Migration', '2024-01-12', '{Laptop Bag,Dell Mouse,Charger}', 'Active'],
      ['ALO-002', 'LTB-271', '1002', 'Sonal Sharma',  'sonal.sharma@company.com',  'QA',          'SAP',    'ERP Testing',       '2024-02-02', '{Charger}',                      'Active'],
    ];

    for (const al of allocations) {
      await client.query(
        `INSERT INTO allocations
           (allocation_id, asset_id, emp_id, emp_name, emp_email,
            department, client, project, allocation_date, accessories, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        al
      );
    }
    console.log(`✅ Created ${allocations.length} allocations`);

    // ── Repairs ────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO repairs
         (repair_id, asset_id, issue, vendor, repair_date, estimated_return, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['REP-001', 'LTB-272', 'Fan making loud noise, overheating',
       'Dell Authorized Service', '2024-03-01', '2024-03-15', 'In Repair']
    );
    console.log('✅ Created 1 repair record');

    // ── Scraps ─────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO scraps (scrap_id, asset_id, scrap_date, reason, approved_by)
       VALUES ($1,$2,$3,$4,$5)`,
      ['SCR-001', 'LTB-250', '2024-03-02',
       'Motherboard failure — beyond economical repair', 'Admin User']
    );
    console.log('✅ Created 1 scrap record');

    // ── Audit Logs ─────────────────────────────────────────────────────────
    const logs = [
      ['ASSET_ADDED',           'asset',    'LTB-270 added to inventory',                     'LTB-270'],
      ['ASSET_ALLOCATED',       'allocate', 'LTB-270 allocated to Ram Magadi (1001)',          'LTB-270'],
      ['ASSET_ADDED',           'asset',    'LTB-271 added to inventory',                     'LTB-271'],
      ['ASSET_ALLOCATED',       'allocate', 'LTB-271 allocated to Sonal Sharma (1002)',        'LTB-271'],
      ['ASSET_SENT_TO_REPAIR',  'repair',   'LTB-272 sent to repair — Fan noise',             'LTB-272'],
      ['ASSET_SCRAPPED',        'scrap',    'LTB-250 scrapped — Motherboard failure',          'LTB-250'],
    ];

    for (const l of logs) {
      await client.query(
        `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
         VALUES ($1,$2,$3,$4,'Admin User')`,
        l
      );
    }
    console.log(`✅ Created ${logs.length} audit log entries`);

    await client.query('COMMIT');

    console.log('\n✨ Seed completed successfully!\n');
    console.log('─────────────────────────────────────');
    console.log('🔑 Login Credentials:');
    console.log('   Admin:   admin@company.com   / admin123');
    console.log('   Manager: manager@company.com / manager123');
    console.log('   Viewer:  viewer@company.com  / viewer123');
    console.log('─────────────────────────────────────\n');

    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
};

seed();
