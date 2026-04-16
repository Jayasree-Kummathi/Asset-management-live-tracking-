-- ════════════════════════════════════════════
-- Run this in pgAdmin → mindteck_asset database
-- ════════════════════════════════════════════

-- 1. Device registry (one row per physical laptop, keyed by MAC)
CREATE TABLE IF NOT EXISTS agent_registrations (
  id            SERIAL        PRIMARY KEY,
  asset_id      VARCHAR(30)   REFERENCES assets(asset_id) ON DELETE SET NULL,
  mac_address   VARCHAR(30)   UNIQUE NOT NULL,
  hostname      VARCHAR(120),
  ip_address    VARCHAR(45),
  os_version    VARCHAR(100),
  device_key    VARCHAR(64)   NOT NULL,
  registered_at TIMESTAMPTZ   DEFAULT NOW(),
  last_seen     TIMESTAMPTZ   DEFAULT NOW()
);

-- 2. Latest snapshot per asset (upserted on each report)
CREATE TABLE IF NOT EXISTS asset_locations (
  asset_id              VARCHAR(30)  PRIMARY KEY REFERENCES assets(asset_id),
  lat                   DECIMAL(10,7),
  lon                   DECIMAL(10,7),
  accuracy              DECIMAL(10,2),
  location_method       VARCHAR(20),
  hostname              VARCHAR(120),
  os_version            VARCHAR(100),
  cpu_usage             INTEGER,
  ram_total_gb          DECIMAL(5,2),
  ram_used_gb           DECIMAL(5,2),
  disk_total_gb         INTEGER,
  disk_used_gb          INTEGER,
  battery_pct           INTEGER,
  battery_charging      BOOLEAN DEFAULT false,
  battery_has           BOOLEAN DEFAULT true,
  ip_address            VARCHAR(45),
  mac_address           VARCHAR(30),
  city                  VARCHAR(100),
  region                VARCHAR(100),
  country               VARCHAR(100),
  online                BOOLEAN DEFAULT true,
  session_minutes       INTEGER DEFAULT 0,
  total_online_minutes  INTEGER DEFAULT 0,
  reported_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Location history trail (append-only)
CREATE TABLE IF NOT EXISTS asset_location_history (
  id              SERIAL       PRIMARY KEY,
  asset_id        VARCHAR(30)  REFERENCES assets(asset_id),
  lat             DECIMAL(10,7),
  lon             DECIMAL(10,7),
  accuracy        DECIMAL(10,2),
  location_method VARCHAR(20),
  battery_pct     INTEGER,
  cpu_usage       INTEGER,
  reported_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loc_hist
  ON asset_location_history(asset_id, reported_at DESC);

-- 4. Daily online minutes (one row per asset per day)
CREATE TABLE IF NOT EXISTS asset_online_daily (
  asset_id       VARCHAR(30)  REFERENCES assets(asset_id),
  date           DATE         NOT NULL,
  online_minutes INTEGER      DEFAULT 0,
  PRIMARY KEY (asset_id, date)
);

-- 5. Add hostname column to assets if missing
ALTER TABLE assets ADD COLUMN IF NOT EXISTS hostname VARCHAR(120);

-- Verify all tables:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema='public' AND table_name LIKE 'asset_%' OR table_name = 'agent_registrations';
