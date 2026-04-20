'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Backend/controllers/agentController.js
// Save as: Backend/controllers/agentController.js
// ─────────────────────────────────────────────────────────────────────────────

const crypto       = require('crypto');
const { query }    = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/register
// Called by agent EXE on first run and on every restart
// ─────────────────────────────────────────────────────────────────────────────
exports.registerDevice = asyncHandler(async (req, res) => {
  const { hostname, mac_address, ip_address, os_version } = req.body;

  if (!mac_address) {
    return res.status(400).json({ success: false, message: 'mac_address required' });
  }

  const mac = mac_address.toLowerCase().trim();

  // Check if already registered
  const existing = await query(
    `SELECT id, asset_id, device_key, is_enabled
     FROM agent_registrations WHERE mac_address = $1`,
    [mac]
  );

  if (existing.rows.length) {
    const row = existing.rows[0];

    // Reject if disabled
    if (row.is_enabled === false) {
      console.log(`📡 [Agent] Registration rejected — agent disabled (${hostname})`);
      return res.json({ success: false, message: 'Agent disabled by administrator', disabled: true });
    }

    let assetId = row.asset_id;
    if (!assetId) {
      assetId = await autoFindAsset(hostname, mac, ip_address);
      if (assetId) {
        await query(
          `UPDATE agent_registrations SET asset_id = $1 WHERE mac_address = $2`,
          [assetId, mac]
        );
        console.log(`📡 [Agent] Auto-linked ${mac} → ${assetId}`);
      }
    }

    await query(
      `UPDATE agent_registrations
       SET hostname = $1, ip_address = $2, last_seen = NOW()
       WHERE mac_address = $3`,
      [hostname || null, ip_address || null, mac]
    );

    console.log(`📡 [Agent] Re-registered: ${assetId || 'pending'} (${hostname})`);
    return res.json({ success: true, assetId, deviceKey: row.device_key, isNew: false });
  }

  // New registration
  const assetId   = await autoFindAsset(hostname, mac, ip_address);
  const deviceKey = crypto.randomBytes(24).toString('hex');

  await query(
    `INSERT INTO agent_registrations
       (asset_id, mac_address, hostname, ip_address, os_version, device_key,
        registered_at, last_seen, is_enabled)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW(),TRUE)`,
    [assetId, mac, hostname || null, ip_address || null, os_version || null, deviceKey]
  );

  query(
    `INSERT INTO audit_logs (action, category, detail, asset_id, performed_by)
     VALUES ('AGENT_REGISTERED','tracking',$1,$2,'Agent')`,
    [`Agent registered: ${hostname} (${mac}) → ${assetId || 'pending'}`, assetId]
  ).catch(() => {});

  console.log(`📡 [Agent] New: ${hostname} / ${mac} → ${assetId || 'PENDING'}`);
  res.json({
    success:   true,
    assetId,
    deviceKey,
    isNew:     true,
    message:   assetId
      ? `Registered as ${assetId}`
      : 'Registered — assign asset from dashboard',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SMART autoFindAsset — tries 5 strategies to match hostname → asset
// ─────────────────────────────────────────────────────────────────────────────
async function autoFindAsset(hostname, mac, ip_address) {
  if (!hostname && !ip_address) return null;
  const h = (hostname || '').trim();
  const H = h.toUpperCase();

  // Strategy 1: Exact hostname match in assets table
  if (h) {
    const r = await query(
      `SELECT asset_id FROM assets
       WHERE UPPER(hostname) = $1 AND status IN ('Allocated','Stock','Active') LIMIT 1`,
      [H]
    );
    if (r.rows.length) { console.log(`[AutoMatch] S1 hostname → ${r.rows[0].asset_id}`); return r.rows[0].asset_id; }
  }

  // Strategy 2: Extract emp_id from hostname parts (IBE2745-LTB → IBE2745)
  if (h) {
    const parts = H.split(/[-_.\s]+/).filter(p => p.length >= 3 && !/^LTB$/i.test(p) && !/^DESKTOP$/i.test(p));
    for (const part of parts) {
      const r1 = await query(
        `SELECT al.asset_id FROM allocations al
         WHERE UPPER(al.emp_id) = $1 AND al.status = 'Active' LIMIT 1`,
        [part]
      );
      if (r1.rows.length) { console.log(`[AutoMatch] S2 exact emp_id "${part}" → ${r1.rows[0].asset_id}`); return r1.rows[0].asset_id; }

      const r2 = await query(
        `SELECT al.asset_id FROM allocations al
         WHERE UPPER(al.emp_id) LIKE $1 AND al.status = 'Active' LIMIT 1`,
        [`%${part}%`]
      );
      if (r2.rows.length) { console.log(`[AutoMatch] S2 partial emp_id "${part}" → ${r2.rows[0].asset_id}`); return r2.rows[0].asset_id; }
    }
  }

  // Strategy 3: Direct asset_id match (hostname = LTB-638)
  if (h) {
    const r = await query(
      `SELECT asset_id FROM assets WHERE UPPER(asset_id) = $1 LIMIT 1`,
      [H]
    );
    if (r.rows.length) { console.log(`[AutoMatch] S3 asset_id → ${r.rows[0].asset_id}`); return r.rows[0].asset_id; }
  }

  // Strategy 4: Manual hostname_asset_map table
  if (h) {
    try {
      const r = await query(
        `SELECT asset_id FROM hostname_asset_map WHERE UPPER(hostname) = $1 LIMIT 1`,
        [H]
      );
      if (r.rows.length) { console.log(`[AutoMatch] S4 manual map → ${r.rows[0].asset_id}`); return r.rows[0].asset_id; }
    } catch (_) {}
  }

  // Strategy 5: IP address match from last known location
  if (ip_address) {
    const r = await query(
      `SELECT asset_id FROM asset_locations WHERE ip_address = $1 LIMIT 1`,
      [ip_address]
    );
    if (r.rows.length) { console.log(`[AutoMatch] S5 IP → ${r.rows[0].asset_id}`); return r.rows[0].asset_id; }
  }

  console.log(`[AutoMatch] No match for hostname="${hostname}"`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/report
// Agent sends location + system info every 3 minutes
// ─────────────────────────────────────────────────────────────────────────────
exports.receiveReport = asyncHandler(async (req, res) => {
  const {
    asset_id, device_key, timestamp,
    location, system, online,
    session_minutes, total_online_minutes,
    active_minutes, today_active_minutes, total_active_minutes,
    is_active, idle_seconds,
  } = req.body;

  if (!device_key) return res.status(400).json({ success: false, message: 'device_key required' });

  // Verify device key + check if disabled
  const regCheck = await query(
    `SELECT id, asset_id, is_enabled FROM agent_registrations WHERE device_key = $1`,
    [device_key]
  );
  if (!regCheck.rows.length) {
    return res.status(401).json({ success: false, message: 'Invalid device_key' });
  }

  const reg = regCheck.rows[0];

  // Reject disabled agents
  if (reg.is_enabled === false) {
    console.log(`📡 [Agent] Report rejected — agent #${reg.id} is disabled`);
    return res.json({ success: false, message: 'Agent disabled by administrator', disabled: true });
  }

  // Update last_seen
  query(
    `UPDATE agent_registrations SET last_seen = NOW(), ip_address = $1 WHERE id = $2`,
    [system?.ip_address || null, reg.id]
  ).catch(() => {});

  // Resolve asset ID
  let resolvedAssetId = reg.asset_id || asset_id;
  if (!resolvedAssetId && system?.hostname) {
    resolvedAssetId = await autoFindAsset(system.hostname, system.mac_address, system.ip_address);
    if (resolvedAssetId) {
      await query(
        `UPDATE agent_registrations SET asset_id = $1 WHERE id = $2`,
        [resolvedAssetId, reg.id]
      );
    }
  }

  if (!resolvedAssetId) {
    return res.json({ success: true, message: 'Report accepted — pending asset assignment' });
  }

  const assetUpper = resolvedAssetId.toUpperCase();
  const reportedAt = timestamp ? new Date(timestamp) : new Date();

  // Upsert current location + system state
  await query(
    `INSERT INTO asset_locations (
       asset_id, lat, lon, accuracy, location_method,
       hostname, os_version, cpu_usage,
       ram_total_gb, ram_used_gb, disk_total_gb, disk_used_gb,
       battery_pct, battery_charging, battery_has,
       ip_address, mac_address, city, region, country,
       online, reported_at, session_minutes, total_online_minutes,
       active_minutes, today_active_minutes, total_active_minutes,
       is_active, idle_seconds
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       $21,$22,$23,$24,$25,$26,$27,$28,$29
     )
     ON CONFLICT (asset_id) DO UPDATE SET
       lat                  = EXCLUDED.lat,
       lon                  = EXCLUDED.lon,
       accuracy             = EXCLUDED.accuracy,
       location_method      = EXCLUDED.location_method,
       hostname             = EXCLUDED.hostname,
       os_version           = EXCLUDED.os_version,
       cpu_usage            = EXCLUDED.cpu_usage,
       ram_total_gb         = EXCLUDED.ram_total_gb,
       ram_used_gb          = EXCLUDED.ram_used_gb,
       disk_total_gb        = EXCLUDED.disk_total_gb,
       disk_used_gb         = EXCLUDED.disk_used_gb,
       battery_pct          = EXCLUDED.battery_pct,
       battery_charging     = EXCLUDED.battery_charging,
       battery_has          = EXCLUDED.battery_has,
       ip_address           = EXCLUDED.ip_address,
       mac_address          = EXCLUDED.mac_address,
       city                 = EXCLUDED.city,
       region               = EXCLUDED.region,
       country              = EXCLUDED.country,
       online               = EXCLUDED.online,
       reported_at          = EXCLUDED.reported_at,
       session_minutes      = EXCLUDED.session_minutes,
       total_online_minutes = EXCLUDED.total_online_minutes,
       active_minutes       = EXCLUDED.active_minutes,
       today_active_minutes = EXCLUDED.today_active_minutes,
       total_active_minutes = EXCLUDED.total_active_minutes,
       is_active            = EXCLUDED.is_active,
       idle_seconds         = EXCLUDED.idle_seconds`,
    [
      assetUpper,
      location?.lat      ?? null, location?.lon      ?? null,
      location?.accuracy ?? null, location?.method   ?? null,
      system?.hostname   ?? null, system?.os_version ?? null,
      system?.cpu_usage  ?? null,
      system?.ram_total_gb ?? null, system?.ram_used_gb  ?? null,
      system?.disk_total_gb ?? null, system?.disk_used_gb ?? null,
      system?.battery_pct  ?? null, system?.battery_charging ?? false,
      system?.battery_has  ?? false,
      system?.ip_address   ?? null, system?.mac_address  ?? null,
      location?.city   ?? null, location?.region ?? null, location?.country ?? null,
      true,
      reportedAt.toISOString(),
      session_minutes       ?? 0, total_online_minutes  ?? 0,
      active_minutes        ?? 0, today_active_minutes  ?? 0,
      total_active_minutes  ?? 0,
      is_active             ?? false, idle_seconds ?? 0,
    ]
  );

  // Location history (only if we have valid coords)
  if (location?.lat && location?.lon) {
    query(
      `INSERT INTO asset_location_history
         (asset_id, lat, lon, accuracy, location_method, battery_pct, cpu_usage, reported_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        assetUpper,
        location.lat, location.lon,
        location.accuracy ?? null, location.method ?? null,
        system?.battery_pct ?? null, system?.cpu_usage ?? null,
        reportedAt.toISOString(),
      ]
    ).catch(() => {});
  }

  const today = new Date().toISOString().split('T')[0];

  // Daily online minutes
  query(
    `INSERT INTO asset_online_daily (asset_id, date, online_minutes)
     VALUES ($1,$2,$3)
     ON CONFLICT (asset_id, date) DO UPDATE
       SET online_minutes = GREATEST(asset_online_daily.online_minutes, EXCLUDED.online_minutes)`,
    [assetUpper, today, session_minutes ?? 0]
  ).catch(() => {});

  // Daily active minutes
  query(
    `INSERT INTO asset_active_daily (asset_id, date, active_minutes)
     VALUES ($1,$2,$3)
     ON CONFLICT (asset_id, date) DO UPDATE
       SET active_minutes = GREATEST(asset_active_daily.active_minutes, EXCLUDED.active_minutes)`,
    [assetUpper, today, today_active_minutes ?? 0]
  ).catch(() => {});

  const activeLabel = is_active
    ? `⌨️  active`
    : `💤 idle ${Math.floor((idle_seconds || 0) / 60)}m`;

  console.log(
    `📍 [${assetUpper}] ${location?.method || 'no_loc'} ` +
    `bat:${system?.battery_pct ?? 'none'}% cpu:${system?.cpu_usage}% ` +
    `online:${session_minutes}min active:${today_active_minutes}min ${activeLabel}`
  );

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/locations
// Returns all tracked laptops with computed hours + efficiency
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllLocations = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT
       l.*,
       a.brand, a.model, a.config, a.serial,
       a.status AS asset_status,
       al.emp_name, al.emp_id, al.emp_email, al.department, al.project,
       EXTRACT(EPOCH FROM (NOW() - l.reported_at))  AS seconds_ago,
       COALESCE(od.online_minutes,  0)              AS today_online_minutes,
       COALESCE(ow.week_minutes,    0)              AS week_online_minutes,
       COALESCE(l.total_online_minutes, 0)          AS lifetime_online_minutes,
       COALESCE(ad.active_minutes, l.today_active_minutes, 0) AS today_active_minutes,
       COALESCE(aw.week_active,    0)              AS week_active_minutes
     FROM asset_locations l
     LEFT JOIN assets a   ON a.asset_id = l.asset_id
     LEFT JOIN allocations al
       ON al.asset_id = l.asset_id AND al.status = 'Active'
     LEFT JOIN asset_online_daily od
       ON od.asset_id = l.asset_id AND od.date = CURRENT_DATE
     LEFT JOIN (
       SELECT asset_id, SUM(online_minutes) AS week_minutes
       FROM asset_online_daily
       WHERE date >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY asset_id
     ) ow ON ow.asset_id = l.asset_id
     LEFT JOIN asset_active_daily ad
       ON ad.asset_id = l.asset_id AND ad.date = CURRENT_DATE
     LEFT JOIN (
       SELECT asset_id, SUM(active_minutes) AS week_active
       FROM asset_active_daily
       WHERE date >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY asset_id
     ) aw ON aw.asset_id = l.asset_id
     ORDER BY l.reported_at DESC`
  );

  const data = result.rows.map(r => ({
    ...r,
    is_online:             Number(r.seconds_ago) < 480, // 8 min threshold (3min interval + buffer)
    no_location:           !r.lat || Number(r.lat) === 0 || !r.lon || Number(r.lon) === 0,
    today_online_hours:    +(Number(r.today_online_minutes)    / 60).toFixed(1),
    week_online_hours:     +(Number(r.week_online_minutes)     / 60).toFixed(1),
    lifetime_online_hours: +(Number(r.lifetime_online_minutes) / 60).toFixed(1),
    today_active_hours:    +(Number(r.today_active_minutes)    / 60).toFixed(1),
    week_active_hours:     +(Number(r.week_active_minutes)     / 60).toFixed(1),
    efficiency_pct: r.today_online_minutes > 0
      ? Math.min(100, Math.round(
          (Number(r.today_active_minutes) / Number(r.today_online_minutes)) * 100
        ))
      : 0,
  }));

  const tracked         = data.length;
  const totalTodayMins  = data.reduce((s, r) => s + Number(r.today_online_minutes), 0);
  const totalWeekMins   = data.reduce((s, r) => s + Number(r.week_online_minutes),  0);
  const totalActiveMins = data.reduce((s, r) => s + Number(r.today_active_minutes), 0);

  res.json({
    success:         true,
    data,
    avgTodayHours:   tracked ? +((totalTodayMins  / tracked) / 60).toFixed(1) : 0,
    avgWeekHours:    tracked ? +((totalWeekMins   / tracked) / 60).toFixed(1) : 0,
    avgActiveHours:  tracked ? +((totalActiveMins / tracked) / 60).toFixed(1) : 0,
    fleetEfficiency: totalTodayMins > 0
      ? Math.round((totalActiveMins / totalTodayMins) * 100)
      : 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/locations/:assetId/history
// ─────────────────────────────────────────────────────────────────────────────
exports.getLocationHistory = asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  const hours = Math.min(parseInt(req.query.hours) || 24, 168);
  const result = await query(
    `SELECT lat, lon, accuracy, location_method, battery_pct, cpu_usage, reported_at
     FROM asset_location_history
     WHERE asset_id = $1
       AND reported_at > NOW() - ($2 || ' hours')::INTERVAL
     ORDER BY reported_at DESC LIMIT 288`,
    [assetId.toUpperCase(), hours]
  );
  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/registrations
// ─────────────────────────────────────────────────────────────────────────────
exports.getRegistrations = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ar.id, ar.asset_id, ar.mac_address, ar.hostname,
            ar.ip_address, ar.os_version, ar.registered_at, ar.last_seen,
            ar.is_enabled, ar.disabled_at, ar.disabled_by, ar.disable_note,
            a.brand, a.model,
            al.emp_name, al.emp_id
     FROM agent_registrations ar
     LEFT JOIN assets a      ON a.asset_id = ar.asset_id
     LEFT JOIN allocations al ON al.asset_id = ar.asset_id AND al.status = 'Active'
     ORDER BY ar.registered_at DESC`
  );
  res.json({ success: true, data: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/agent/registrations/:id/assign
// ─────────────────────────────────────────────────────────────────────────────
exports.assignAsset = asyncHandler(async (req, res) => {
  const { asset_id } = req.body;
  if (!asset_id) return res.status(400).json({ success: false, message: 'asset_id required' });
  await query(
    `UPDATE agent_registrations SET asset_id = $1 WHERE id = $2`,
    [asset_id.toUpperCase(), req.params.id]
  );
  res.json({ success: true, message: `${asset_id} assigned. Agent picks it up in ~3 min.` });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/agent/registrations/:id/toggle
// Body: { enabled: true/false, note: "reason" }
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleAgent = asyncHandler(async (req, res) => {
  const { enabled, note } = req.body;
  const { id }            = req.params;

  if (enabled === undefined) {
    return res.status(400).json({ success: false, message: '"enabled" field required (true/false)' });
  }

  if (enabled) {
    await query(
      `UPDATE agent_registrations
       SET is_enabled = TRUE, disabled_at = NULL, disabled_by = NULL, disable_note = NULL
       WHERE id = $1`,
      [id]
    );
    console.log(`📡 [Admin] Agent #${id} ENABLED by ${req.user?.name}`);
  } else {
    await query(
      `UPDATE agent_registrations
       SET is_enabled = FALSE, disabled_at = NOW(), disabled_by = $1, disable_note = $2
       WHERE id = $3`,
      [req.user?.name || 'Admin', note || null, id]
    );
    console.log(`📡 [Admin] Agent #${id} DISABLED by ${req.user?.name} — ${note}`);
  }

  // Non-blocking audit log
  query(
    `INSERT INTO audit_logs (action, category, detail, performed_by)
     VALUES ($1,'tracking',$2,$3)`,
    [
      enabled ? 'AGENT_ENABLED' : 'AGENT_DISABLED',
      `Agent #${id} ${enabled ? 'enabled' : 'disabled'}: ${note || ''}`,
      req.user?.name || 'Admin',
    ]
  ).catch(() => {});

  res.json({ success: true, message: `Agent ${enabled ? 'enabled' : 'disabled'} successfully.` });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/generate-token
// Creates a 24h one-time install token
// ─────────────────────────────────────────────────────────────────────────────
exports.generateInstallToken = asyncHandler(async (req, res) => {
  const token     = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO agent_install_tokens (token, created_by, expires_at)
     VALUES ($1, $2, $3)`,
    [token, req.user?.name || 'Admin', expiresAt.toISOString()]
  );

  console.log(`📡 [Admin] Install token generated by ${req.user?.name}: ${token}`);

  const proto   = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host    = req.headers['x-forwarded-host']  || req.headers.host || '172.16.16.101:5000';
  const baseUrl = process.env.SERVER_URL || `${proto}://${host}`;
  res.json({
    success:    true,
    token,
    expiresAt,
    installUrl: `${baseUrl}/api/agent/verify-token?t=${token}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/verify-token?t=TOKEN&mac=MAC
// Called by agent during --token install (no JWT)
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyInstallToken = asyncHandler(async (req, res) => {
  const { t: token, mac } = req.query;
  if (!token) return res.json({ valid: false, message: 'No token provided' });

  const r = await query(
    `SELECT * FROM agent_install_tokens
     WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
    [token]
  );

  if (!r.rows.length) {
    return res.json({ valid: false, message: 'Token invalid or expired' });
  }

  // Mark used — one-time only
  await query(
    `UPDATE agent_install_tokens
     SET used = TRUE, used_at = NOW(), used_by_mac = $1
     WHERE token = $2`,
    [mac || null, token]
  );

  res.json({ valid: true, message: 'Token accepted — agent authorized to install' });
});

exports.receiveActivity = asyncHandler(async (req, res) => {
  const {
    device_key, asset_id,
    is_active, idle_seconds,
    today_active_minutes, total_active_minutes, active_minutes,
  } = req.body;
 
  if (!device_key)
    return res.status(400).json({ success: false, message: 'device_key required' });
 
  // Verify device
  const reg = await query(
    `SELECT asset_id, is_enabled FROM agent_registrations WHERE device_key = $1`,
    [device_key]
  );
  if (!reg.rows.length)
    return res.status(401).json({ success: false, message: 'Invalid device_key' });
  if (!reg.rows[0].is_enabled)
    return res.json({ success: false, disabled: true });
 
  const resolvedAssetId = (reg.rows[0].asset_id || asset_id || '').toUpperCase();
  if (!resolvedAssetId)
    return res.json({ success: true, message: 'No asset assigned yet' });
 
  const today = new Date().toISOString().split('T')[0];
 
  // Update active minutes + is_active in asset_locations (the live tracking table)
  await query(
    `UPDATE asset_locations
     SET is_active            = $1,
         idle_seconds         = $2,
         today_active_minutes = GREATEST(COALESCE(today_active_minutes, 0), $3),
         total_active_minutes = GREATEST(COALESCE(total_active_minutes, 0), $4),
         active_minutes       = GREATEST(COALESCE(active_minutes, 0), $5)
     WHERE asset_id = $6`,
    [
      is_active            ?? false,
      idle_seconds         ?? 0,
      today_active_minutes ?? 0,
      total_active_minutes ?? 0,
      active_minutes       ?? 0,
      resolvedAssetId,
    ]
  );
 
  // Upsert daily active record — only increases, never decreases
  await query(
    `INSERT INTO asset_active_daily (asset_id, date, active_minutes)
     VALUES ($1, $2, $3)
     ON CONFLICT (asset_id, date) DO UPDATE
       SET active_minutes = GREATEST(asset_active_daily.active_minutes, EXCLUDED.active_minutes)`,
    [resolvedAssetId, today, today_active_minutes ?? 0]
  );
 
  const label = is_active ? '⌨️  active' : `💤 idle ${Math.floor((idle_seconds || 0) / 60)}m`;
  console.log(`⌨️  [Activity] ${resolvedAssetId} ${label} today:${today_active_minutes}min`);
 
  res.json({ success: true });
});
 