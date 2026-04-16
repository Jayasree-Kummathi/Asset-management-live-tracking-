require('dotenv').config();
const { pool } = require('../config/db');

const createTables = async () => {
  const client = await pool.connect();

  try {
    console.log('\n📦 Running migrations...\n');

    await client.query('BEGIN');

    // ── Users ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(100)  NOT NULL,
        email        VARCHAR(150)  NOT NULL UNIQUE,
        password     VARCHAR(255)  NOT NULL,
        role         VARCHAR(20)   NOT NULL DEFAULT 'viewer'
                     CHECK (role IN ('admin', 'manager', 'viewer')),
        is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✅ Table: users');

    // ── Assets ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id             SERIAL PRIMARY KEY,
        asset_id       VARCHAR(30)   NOT NULL UNIQUE,
        serial         VARCHAR(100)  NOT NULL UNIQUE,
        brand          VARCHAR(100)  NOT NULL,
        model          VARCHAR(150)  NOT NULL,
        config         VARCHAR(200),
        processor      VARCHAR(150),
        ram            VARCHAR(50),
        storage        VARCHAR(50),
        purchase_date  DATE,
        warranty_start DATE,
        warranty_end   DATE,
        vendor         VARCHAR(150),
        location       VARCHAR(150),
        notes          TEXT,
        status         VARCHAR(20)   NOT NULL DEFAULT 'Stock'
                       CHECK (status IN ('Stock', 'Allocated', 'Repair', 'Scrap')),
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✅ Table: assets');

    // ── Allocations ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS allocations (
        id               SERIAL PRIMARY KEY,
        allocation_id    VARCHAR(20)   NOT NULL UNIQUE,
        asset_id         VARCHAR(30)   NOT NULL REFERENCES assets(asset_id),
        emp_id           VARCHAR(50)   NOT NULL,
        emp_name         VARCHAR(150)  NOT NULL,
        emp_email        VARCHAR(150),
        department       VARCHAR(100),
        client           VARCHAR(150),
        project          VARCHAR(150),
        allocation_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
        return_date      DATE,
        accessories      TEXT[],
        status           VARCHAR(20)   NOT NULL DEFAULT 'Active'
                         CHECK (status IN ('Active', 'Returned', 'Swapped')),
        notes            TEXT,
        created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✅ Table: allocations');

    // ── Repairs ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS repairs (
        id               SERIAL PRIMARY KEY,
        repair_id        VARCHAR(20)   NOT NULL UNIQUE,
        asset_id         VARCHAR(30)   NOT NULL REFERENCES assets(asset_id),
        issue            TEXT          NOT NULL,
        vendor           VARCHAR(150),
        repair_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
        estimated_return DATE,
        actual_return    DATE,
        cost             NUMERIC(10,2) DEFAULT 0,
        status           VARCHAR(20)   NOT NULL DEFAULT 'In Repair'
                         CHECK (status IN ('In Repair', 'Completed', 'Unrepairable')),
        notes            TEXT,
        created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✅ Table: repairs');

    // ── Scraps ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS scraps (
        id           SERIAL PRIMARY KEY,
        scrap_id     VARCHAR(20)   NOT NULL UNIQUE,
        asset_id     VARCHAR(30)   NOT NULL REFERENCES assets(asset_id),
        scrap_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
        reason       TEXT          NOT NULL,
        approved_by  VARCHAR(100),
        notes        TEXT,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✅ Table: scraps');

    // ── Audit Logs ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           SERIAL PRIMARY KEY,
        action       VARCHAR(60)   NOT NULL,
        category     VARCHAR(30)   NOT NULL,
        detail       TEXT          NOT NULL,
        asset_id     VARCHAR(30),
        performed_by VARCHAR(100)  DEFAULT 'Admin',
        meta         JSONB,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  ✅ Table: audit_logs');

    // ── Indexes ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_status      ON assets(status);
      CREATE INDEX IF NOT EXISTS idx_assets_asset_id    ON assets(asset_id);
      CREATE INDEX IF NOT EXISTS idx_alloc_status       ON allocations(status);
      CREATE INDEX IF NOT EXISTS idx_alloc_asset_id     ON allocations(asset_id);
      CREATE INDEX IF NOT EXISTS idx_alloc_emp_id       ON allocations(emp_id);
      CREATE INDEX IF NOT EXISTS idx_repairs_status     ON repairs(status);
      CREATE INDEX IF NOT EXISTS idx_audit_category     ON audit_logs(category);
      CREATE INDEX IF NOT EXISTS idx_audit_asset_id     ON audit_logs(asset_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created_at   ON audit_logs(created_at DESC);
    `);
    console.log('  ✅ Indexes created');

    // ── Auto-update updated_at trigger ────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    const triggerTables = ['users', 'assets', 'allocations', 'repairs'];
    for (const table of triggerTables) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    }
    console.log('  ✅ Triggers: auto-update updated_at');

    await client.query('COMMIT');
    console.log('\n✨ All migrations completed successfully!\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

createTables().catch(() => process.exit(1));
