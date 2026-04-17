'use strict';

const si    = require('systeminformation');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { exec, execSync, spawnSync } = require('child_process');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// Just change SERVER_URL — everything else is automatic.
//
//  Internal HTTP  : 'http://172.16.16.101:5000'   ← no SSL at all
//  Internal HTTP  : 'http://192.168.1.12:5000'    ← no SSL at all
//  Production HTTPS: 'https://yourdomain.com'      ← valid Let's Encrypt cert
//  Self-signed    : set ALLOW_SELF_SIGNED = true below
// ─────────────────────────────────────────────────────────────────────────────
const SERVER_URL        = 'http://172.16.5.219';
const ALLOW_SELF_SIGNED = false;   // true only for self-signed/internal HTTPS cert
const INTERVAL_MINS     = 3;
const IDLE_THRESHOLD    = 5 * 60;  // seconds
const GOOGLE_API_KEY    = '';
const TASK_NAME         = 'MindteckAssetOpsAgent';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP / HTTPS — single smart request function, no axios dependency on SSL
// Uses Node's built-in http/https modules for agent calls (rock-solid)
// Falls back to axios only for external location APIs
// ─────────────────────────────────────────────────────────────────────────────
const http  = require('http');
const https = require('https');

const IS_HTTPS = SERVER_URL.toLowerCase().startsWith('https://');

// Dedicated agent for our server — controls SSL behaviour
const serverAgent = IS_HTTPS
  ? new https.Agent({ rejectUnauthorized: !ALLOW_SELF_SIGNED, keepAlive: true })
  : new http.Agent({ keepAlive: true });

// Simple JSON POST/GET using built-in modules — no axios SSL quirks
function serverRequest(method, urlPath, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const fullUrl  = new URL(urlPath, SERVER_URL);
    const postData = body ? JSON.stringify(body) : null;
    const options  = {
      hostname:  fullUrl.hostname,
      port:      fullUrl.port || (IS_HTTPS ? 443 : 80),
      path:      fullUrl.pathname + fullUrl.search,
      method:    method.toUpperCase(),
      agent:     serverAgent,
      headers:   {
        'Content-Type': 'application/json',
        'User-Agent':   'MindteckAgent/4.3',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    };

    const mod = IS_HTTPS ? https : http;
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch  { resolve({ status: res.statusCode, data: {} }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('Request timed out')); });
    if (postData) req.write(postData);
    req.end();
  });
}

// Download binary file using built-in modules (for software push)
function downloadFile(url, destPath, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(url);
    const isHttps = fullUrl.protocol === 'https:';
    const agent   = isHttps
      ? new https.Agent({ rejectUnauthorized: !ALLOW_SELF_SIGNED })
      : new http.Agent();

    const options = {
      hostname: fullUrl.hostname,
      port:     fullUrl.port || (isHttps ? 443 : 80),
      path:     fullUrl.pathname + fullUrl.search,
      method:   'GET',
      agent,
      headers:  { 'User-Agent': 'MindteckAgent/4.3' },
    };

    const mod = isHttps ? https : http;
    const req = mod.request(options, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath, timeoutMs)
          .then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      const total  = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const chunks = [];
      res.on('data', chunk => {
        chunks.push(chunk);
        received += chunk.length;
        if (total > 0) {
          const pct = Math.round((received / total) * 100);
          if (pct % 20 === 0) log(`📦 Download: ${pct}%`);
        }
      });
      res.on('end', () => {
        fs.writeFileSync(destPath, Buffer.concat(chunks));
        resolve({ sha256Header: res.headers['x-file-sha256'] || null });
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Download timed out')));
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// axios — only for external location APIs (ipapi, mozilla, google)
// ─────────────────────────────────────────────────────────────────────────────
const axios = require('axios');

// ─────────────────────────────────────────────────────────────────────────────
// PATHS & LOG
// ─────────────────────────────────────────────────────────────────────────────
const IS_PKG     = !!process.pkg;
const EXE_PATH   = process.execPath;
const EXE_DIR    = path.dirname(EXE_PATH);
const STATE_PATH = path.join(EXE_DIR, '.mindteck-state');
const LOG        = path.join(os.tmpdir(), 'mindteck-agent.log');

function log(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try {
      if (fs.existsSync(LOG) && fs.statSync(LOG).size > 2 * 1024 * 1024)
        fs.renameSync(LOG, LOG + '.bak');
    } catch (_) {}
    fs.appendFileSync(LOG, line);
    console.log(msg);
  } catch (_) {}
}

function describeNetError(e) {
  const c = e.code || '';
  if (c === 'CERT_HAS_EXPIRED')                return '❌ SSL cert EXPIRED — run: sudo certbot renew && sudo systemctl reload nginx';
  if (c === 'DEPTH_ZERO_SELF_SIGNED_CERT')     return '❌ Self-signed cert — set ALLOW_SELF_SIGNED=true in agent config';
  if (c === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return '❌ SSL cert chain broken — fix nginx ssl_certificate';
  if (c === 'ERR_TLS_CERT_ALTNAME_INVALID')    return '❌ Cert domain mismatch — check SERVER_URL matches your cert domain';
  if (c === 'HOSTNAME_MISMATCH')               return '❌ Cert hostname mismatch — SERVER_URL domain must match cert CN/SAN';
  if (c === 'ECONNREFUSED')                    return '❌ Connection refused — server not running or wrong port';
  if (c === 'ENOTFOUND')                       return '❌ Domain not found — check SERVER_URL';
  if (c === 'ETIMEDOUT')                       return '❌ Timed out — check firewall/VPN/network';
  return e.message;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--install'))   { installService(); process.exit(0); }
if (args.includes('--uninstall')) { uninstallService(); process.exit(0); }
if (args.includes('--status'))    { checkStatus(); process.exit(0); }

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
let STATE = {
  assetId: null, deviceKey: null, sessionStart: null,
  sessionMinutes: 0, totalOnlineMins: 0,
  activeMinutes: 0, totalActiveMins: 0,
  lastActiveTime: null, todayActiveDate: null, todayActiveMins: 0,
  disabled: false,
};

try {
  if (fs.existsSync(STATE_PATH))
    STATE = { ...STATE, ...JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) };
} catch (_) {}

if (!STATE.sessionStart) STATE.sessionStart = Date.now();
const todayStr = new Date().toISOString().split('T')[0];
if (STATE.todayActiveDate !== todayStr) { STATE.todayActiveDate = todayStr; STATE.todayActiveMins = 0; }

const saveState = () => { try { fs.writeFileSync(STATE_PATH, JSON.stringify(STATE)); } catch (_) {} };

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL / UNINSTALL
// ─────────────────────────────────────────────────────────────────────────────
function installService() {
  log('Installing Mindteck AssetOps Agent v4.3...');
  spawnSync('taskkill', ['/F', '/IM', path.basename(EXE_PATH)],             { windowsHide: true, stdio: 'ignore' });
  spawnSync('schtasks', ['/Delete', '/TN', TASK_NAME,                '/F'], { windowsHide: true, stdio: 'ignore' });
  spawnSync('schtasks', ['/Delete', '/TN', TASK_NAME + '_User',      '/F'], { windowsHide: true, stdio: 'ignore' });
  spawnSync('schtasks', ['/Delete', '/TN', TASK_NAME + '_Watchdog',  '/F'], { windowsHide: true, stdio: 'ignore' });

  const exe = `\\"${EXE_PATH}\\"`;

  const r1 = spawnSync('schtasks', [
    '/Create', '/TN', TASK_NAME, '/TR', exe,
    '/SC', 'ONSTART', '/RU', 'SYSTEM', '/RL', 'HIGHEST', '/DELAY', '0:00:30', '/F',
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  log(r1.status === 0 ? '✅ Boot task installed' : `⚠️ Boot task: ${r1.stderr?.trim()}`);

  const user = process.env.USERNAME || process.env.USER || '';
  if (user) {
    const r2 = spawnSync('schtasks', [
      '/Create', '/TN', TASK_NAME + '_User', '/TR', exe,
      '/SC', 'ONLOGON', '/RU', user, '/RL', 'HIGHEST', '/DELAY', '0:00:10', '/F',
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    log(r2.status === 0 ? `✅ Logon task (${user})` : `⚠️ Logon task: ${r2.stderr?.trim()}`);
  }

  const agentName = path.basename(EXE_PATH).replace('.exe', '');
  const watchdog  = `powershell -WindowStyle Hidden -NonInteractive -Command "if(-not(Get-Process -Name '${agentName}' -EA SilentlyContinue)){Start-Process ${exe} -WindowStyle Hidden}"`;
  const r3 = spawnSync('schtasks', [
    '/Create', '/TN', TASK_NAME + '_Watchdog', '/TR', watchdog,
    '/SC', 'MINUTE', '/MO', '3', '/RU', 'SYSTEM', '/RL', 'HIGHEST', '/F',
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  log(r3.status === 0 ? '✅ Watchdog (every 3 min)' : `⚠️ Watchdog: ${r3.stderr?.trim()}`);

  log('Starting agent now...');
  const { spawn } = require('child_process');
  spawn(EXE_PATH, [], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  log('✅ Install complete. Log: ' + LOG);
}

function uninstallService() {
  log('Uninstalling...');
  spawnSync('taskkill', ['/F', '/IM', path.basename(EXE_PATH)], { windowsHide: true, stdio: 'ignore' });
  for (const tn of [TASK_NAME, TASK_NAME + '_User', TASK_NAME + '_Watchdog'])
    spawnSync('schtasks', ['/Delete', '/TN', tn, '/F'], { windowsHide: true, stdio: 'ignore' });
  try { fs.unlinkSync(STATE_PATH); } catch (_) {}
  log('✅ Uninstall complete.');
}

function checkStatus() {
  const r = spawnSync('schtasks', ['/Query', '/TN', TASK_NAME, '/FO', 'LIST'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  console.log(r.stdout || 'Task not found');
  console.log('Log:', LOG);
  if (fs.existsSync(LOG))
    console.log('\nLast 30 lines:\n' + fs.readFileSync(LOG, 'utf8').split('\n').slice(-30).join('\n'));
}

// ─────────────────────────────────────────────────────────────────────────────
// IDLE
// ─────────────────────────────────────────────────────────────────────────────
function getIdleSeconds() {
  try {
    const script = [
      'Add-Type @"',
      'using System; using System.Runtime.InteropServices;',
      'public class IdleTime {',
      '  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO p);',
      '  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }',
      '  public static uint GetIdleSeconds() {',
      '    LASTINPUTINFO l = new LASTINPUTINFO(); l.cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(l);',
      '    GetLastInputInfo(ref l); return (uint)((Environment.TickCount - l.dwTime) / 1000); } }',
      '"@',
      '[IdleTime]::GetIdleSeconds()',
    ].join('\n');
    const f = path.join(os.tmpdir(), 'mtidle_' + Date.now() + '.ps1');
    fs.writeFileSync(f, script, 'utf8');
    const out = execSync(`powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${f}"`,
      { timeout: 8000, windowsHide: true }).toString().trim();
    try { fs.unlinkSync(f); } catch (_) {}
    const n = parseInt(out, 10);
    return isNaN(n) ? 0 : n;
  } catch (_) { return 0; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TIME
// ─────────────────────────────────────────────────────────────────────────────
function startActiveTracking() {
  setInterval(() => {
    try {
      const idle = getIdleSeconds();
      if (idle < IDLE_THRESHOLD) {
        STATE.activeMinutes++; STATE.totalActiveMins++;
        const today = new Date().toISOString().split('T')[0];
        if (STATE.todayActiveDate !== today) { STATE.todayActiveDate = today; STATE.todayActiveMins = 0; }
        STATE.todayActiveMins++;
        STATE.lastActiveTime = Date.now();
        log(`⌨️  Active (idle:${idle}s) today:${STATE.todayActiveMins}min`);
      } else {
        log(`💤 Idle ${Math.floor(idle / 60)}m`);
      }
      saveState();
    } catch (e) { log('Active tracker: ' + e.message); }
  }, 60 * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// BATTERY
// ─────────────────────────────────────────────────────────────────────────────
function runPs(script) {
  const f = path.join(os.tmpdir(), 'mtps_' + Date.now() + '.ps1');
  try {
    fs.writeFileSync(f, script, 'utf8');
    return execSync(`powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${f}"`,
      { timeout: 10000, windowsHide: true }).toString().trim();
  } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

function getBattery() {
  for (const cls of ['Get-CimInstance -ClassName Win32_Battery', 'Get-WmiObject -Class Win32_Battery']) {
    try {
      const out = runPs(`$b=${cls} -EA SilentlyContinue; if($b){Write-Output "$([int]$b.EstimatedChargeRemaining)|$(if($b.BatteryStatus-eq 2){'true'}else{'false'})"}else{Write-Output "none"}`);
      if (out && out !== 'none') {
        const [p, c] = out.split('|');
        const pct = parseInt(p, 10);
        if (!isNaN(pct) && pct >= 0 && pct <= 100) return { pct, charging: c === 'true' };
      }
    } catch (_) {}
  }
  return null;
}

async function getSysInfo() {
  try {
    const [load, mem, osI, nets, disk] = await Promise.all([
      si.currentLoad(), si.mem(), si.osInfo(), si.networkInterfaces(), si.fsSize(),
    ]);
    const net    = (nets || []).find(n => n.operstate === 'up' && !n.internal && n.ip4);
    const drv    = (disk || []).find(d => d.mount === 'C:' || d.mount === '/') || disk?.[0];
    const bat    = getBattery();
    let hasBat   = bat !== null;
    if (!hasBat) { try { hasBat = (await si.battery()).hasBattery || false; } catch (_) {} }
    return {
      hostname: os.hostname(), os_version: `${osI.distro} ${osI.release}`,
      cpu_usage: Math.round(load.currentLoad),
      ram_total_gb: Math.round(mem.total / 1e9 * 10) / 10,
      ram_used_gb:  Math.round((mem.total - mem.available) / 1e9 * 10) / 10,
      disk_total_gb: drv ? Math.round(drv.size / 1e9) : null,
      disk_used_gb:  drv ? Math.round(drv.used / 1e9) : null,
      battery_pct:      bat?.pct ?? null,
      battery_charging: bat?.charging ?? false,
      battery_has:      hasBat,
      ip_address:  net?.ip4 || null,
      mac_address: net?.mac || null,
    };
  } catch (e) { log('sysinfo: ' + e.message); return { hostname: os.hostname() }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION
// ─────────────────────────────────────────────────────────────────────────────
function tryGPS() {
  return new Promise(resolve => {
    const ps = 'Add-Type -AssemblyName System.Device; try{ $w=New-Object System.Device.Location.GeoCoordinateWatcher("High");$w.Start(); $t=(Get-Date).AddSeconds(9); while((Get-Date)-lt $t-and($w.Status-ne"Ready"-or $w.Position.Location.IsUnknown)){Start-Sleep -Ms 300} $l=$w.Position.Location;$w.Stop(); if($l-and -not $l.IsUnknown){Write-Output "$($l.Latitude)|$($l.Longitude)|$($l.HorizontalAccuracy)"}else{Write-Output "none"}}catch{Write-Output "err"}';
    exec(`powershell -NonInteractive -NoProfile -WindowStyle Hidden -Command "${ps}"`,
      { timeout: 15000, windowsHide: true }, (err, stdout) => {
        const out = (stdout || '').trim();
        if (!err && out && out !== 'none' && out !== 'err') {
          const [lat, lon, acc] = out.split('|').map(Number);
          if (!isNaN(lat) && !isNaN(lon) && lat !== 0) return resolve({ lat, lon, accuracy: acc || 10, method: 'gps' });
        }
        resolve(null);
      });
  });
}

async function tryWifi() {
  try {
    const raw = execSync('netsh wlan show networks mode=bssid', { timeout: 6000, windowsHide: true }).toString();
    const aps = [];
    raw.split('\n').forEach((line, i, lines) => {
      if (/BSSID\s+\d+/i.test(line)) {
        const mac = line.split(':').slice(1).join(':').trim();
        let sig = -70;
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const m = lines[j].match(/Signal\s*:\s*(\d+)/i);
          if (m) { sig = Math.round(parseInt(m[1], 10) / 2 - 100); break; }
        }
        if (mac && mac.length > 10) aps.push({ macAddress: mac, signalStrength: sig });
      }
    });
    if (!aps.length) return null;
    try {
      const r = await axios.post('https://location.services.mozilla.com/v1/geolocate?key=test',
        { wifiAccessPoints: aps.slice(0, 15) }, { timeout: 7000 });
      if (r.data?.location) return { lat: r.data.location.lat, lon: r.data.location.lng, accuracy: r.data.accuracy || 150, method: 'wifi' };
    } catch (_) {}
    if (GOOGLE_API_KEY) {
      const r = await axios.post(`https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_API_KEY}`,
        { wifiAccessPoints: aps.slice(0, 15) }, { timeout: 7000 });
      if (r.data?.location) return { lat: r.data.location.lat, lon: r.data.location.lng, accuracy: r.data.accuracy || 50, method: 'wifi_g' };
    }
  } catch (e) { log('wifi: ' + e.message); }
  return null;
}

async function tryIP() {
  for (const url of ['https://ipapi.co/json/', 'https://ip-api.com/json/?fields=lat,lon,city,country,regionName']) {
    try {
      const r = await axios.get(url, { timeout: 5000 });
      const d = r.data;
      const lat = d.latitude || d.lat, lon = d.longitude || d.lon;
      if (lat && lon) return { lat, lon, accuracy: 10000, method: 'ip', city: d.city, region: d.regionName || d.region, country: d.country_name || d.country };
    } catch (_) {}
  }
  return null;
}

async function getBestLocation() {
  const gps = await tryGPS();
  if (gps && gps.accuracy <= 300) { log(`GPS ±${gps.accuracy}m`); return gps; }
  const wifi = await tryWifi();
  if (wifi) { log(`WiFi ±${wifi.accuracy}m`); return wifi; }
  const ip = await tryIP();
  if (ip) { log(`IP: ${ip.city}`); return ip; }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────
async function register() {
  log(`Registering (${IS_HTTPS ? 'HTTPS' : 'HTTP'})...`);
  const sys = await getSysInfo();
  try {
    const res = await serverRequest('POST', '/api/agent/register', {
      hostname: sys.hostname, mac_address: sys.mac_address,
      ip_address: sys.ip_address, os_version: sys.os_version,
    });
    if (res.data?.success) {
      STATE.deviceKey = res.data.deviceKey;
      STATE.disabled  = false;
      STATE.assetId   = res.data.assetId || STATE.assetId;
      if (STATE.assetId) log(`✅ Registered as ${STATE.assetId}`);
      else               log('✅ Registered — waiting for asset assignment');
      saveState();
      return true;
    }
    if (res.data?.disabled) { STATE.disabled = true; saveState(); log('⛔ Disabled by admin.'); }
  } catch (e) { log('Register failed: ' + describeNetError(e)); }
  return false;
}

async function checkAssignment() {
  if (STATE.assetId) return;
  try {
    const sys = await getSysInfo();
    const res = await serverRequest('POST', '/api/agent/register', {
      hostname: sys.hostname, mac_address: sys.mac_address,
      ip_address: sys.ip_address, os_version: sys.os_version,
    });
    if (res.data?.success && res.data.assetId) {
      STATE.assetId   = res.data.assetId;
      STATE.deviceKey = res.data.deviceKey;
      STATE.disabled  = false;
      saveState();
      log(`✅ Assigned: ${STATE.assetId}`);
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────
let sessionStart = STATE.sessionStart || Date.now();
STATE.sessionStart = sessionStart;
saveState();

async function report() {
  if (STATE.disabled)   { log('⛔ Disabled — skip'); return; }
  if (!STATE.deviceKey) { log('No deviceKey — skip'); return; }
  if (!STATE.assetId)   await checkAssignment();

  const [location, system] = await Promise.all([getBestLocation(), getSysInfo()]);
  const sessionMins = Math.floor((Date.now() - sessionStart) / 60000);
  const idleSecs    = getIdleSeconds();
  STATE.sessionMinutes  = sessionMins;
  STATE.totalOnlineMins = sessionMins;
  saveState();

  const res = await serverRequest('POST', '/api/agent/report', {
    asset_id: STATE.assetId, device_key: STATE.deviceKey,
    timestamp: new Date().toISOString(), location, system,
    online: true,
    session_minutes: sessionMins, total_online_minutes: STATE.totalOnlineMins,
    active_minutes: STATE.activeMinutes, today_active_minutes: STATE.todayActiveMins,
    total_active_minutes: STATE.totalActiveMins,
    is_active: idleSecs < IDLE_THRESHOLD, idle_seconds: idleSecs,
  });

  if (res.data?.disabled) {
    STATE.disabled = true; saveState(); log('⛔ Remotely disabled by admin.'); return;
  }
  STATE.disabled = false;
  log(`✅ ${STATE.assetId || 'pending'} ${location?.method || 'no_loc'} bat:${system.battery_pct ?? 'none'}% cpu:${system.cpu_usage}% online:${sessionMins}min active:${STATE.todayActiveMins}min idle:${Math.floor(idleSecs / 60)}m`);
}

async function reportWithRetry(retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try { await report(); return; }
    catch (e) {
      log(`Report [${i}/${retries}]: ${describeNetError(e)}`);
      if (i < retries) await new Promise(r => setTimeout(r, 30_000));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFTWARE PUSH — silent install as SYSTEM, no admin password ever
// ─────────────────────────────────────────────────────────────────────────────
async function checkAndInstallSoftware() {
  if (!STATE.deviceKey || !STATE.assetId || STATE.disabled) return;
  try {
    log('📦 Checking for software tasks...');
    const res = await serverRequest('GET', `/api/agent/pending-tasks?device_key=${STATE.deviceKey}`);
    if (!res.data?.success || !res.data.tasks?.length) { log('📦 No tasks.'); return; }
    log(`📦 ${res.data.tasks.length} task(s).`);
    for (const task of res.data.tasks) await installSoftwareTask(task);
  } catch (e) { log('📦 Check error: ' + describeNetError(e)); }
}

async function installSoftwareTask(task) {
  const crypto   = require('crypto');
  const ext      = path.extname(task.filename).toLowerCase();
  const safeName = task.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const tmpFile  = path.join(os.tmpdir(), `mtpkg_${task.id}_${safeName}`);
  const taskName = `MindteckInstall_${task.id}`;

  log(`📦 Task: ${task.name} v${task.version || 'N/A'}`);
  try {
    // Download
    log(`📦 Downloading...`);
    const dl = await downloadFile(task.download_url, tmpFile);
    log(`📦 Downloaded ${(fs.statSync(tmpFile).size / 1024 / 1024).toFixed(1)}MB`);

    // SHA256 verify
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tmpFile)).digest('hex');
    if (sha256 !== task.sha256) throw new Error(`SHA256 mismatch — corrupted download`);
    log('📦 Integrity ✅');

    // Build command
    const silent = task.silent_args || '/S /silent /quiet';
    let cmd;
    if      (ext === '.msi') cmd = `msiexec.exe /i "${tmpFile}" /qn /norestart ${silent}`;
    else if (ext === '.exe') cmd = `cmd.exe /c ""${tmpFile}" ${silent}"`;
    else if (ext === '.zip') cmd = `powershell -NonInteractive -Command "Expand-Archive -Path '${tmpFile}' -DestinationPath 'C:\\Program Files\\${task.name.replace(/[^a-zA-Z0-9 ]/g,'')}' -Force"`;
    else if (ext === '.bat') cmd = `cmd.exe /c "${tmpFile}"`;
    else throw new Error(`Unsupported: ${ext}`);

    // Create SYSTEM task (bypasses UAC — no popup ever)
    log('📦 Installing as SYSTEM...');
    spawnSync('schtasks', ['/Delete', '/TN', taskName, '/F'], { windowsHide: true, stdio: 'ignore' });
    const cr = spawnSync('schtasks', [
      '/Create', '/F', '/TN', taskName, '/TR', cmd,
      '/SC', 'ONSTART', '/RU', 'SYSTEM', '/RL', 'HIGHEST',
    ], { windowsHide: true, stdio: ['ignore','pipe','pipe'], encoding: 'utf8' });
    if (cr.status !== 0) throw new Error(`Create task: ${cr.stderr?.trim()}`);

    const rr = spawnSync('schtasks', ['/Run', '/TN', taskName],
      { windowsHide: true, stdio: ['ignore','pipe','pipe'], encoding: 'utf8' });
    if (rr.status !== 0) throw new Error(`Run task: ${rr.stderr?.trim()}`);

    // Poll (CSV = locale-safe)
    let wasRunning = false, done = false;
    for (let i = 0; i < 72; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const q = spawnSync('schtasks', ['/Query','/TN',taskName,'/FO','CSV','/NH'],
        { windowsHide: true, stdio: ['ignore','pipe','pipe'], encoding: 'utf8' });
      const status = ((q.stdout||'').trim().split('","')[2]||'').replace(/"/g,'').trim().toLowerCase();
      log(`📦 Status [${i+1}]: "${status}"`);
      if (status.includes('running')) { wasRunning = true; continue; }
      if (wasRunning || i >= 6)       { done = true; break; }
    }

    log(done ? `📦 ✅ ${task.name} installed!` : `📦 ⚠️ May still be running`);
    await reportResult(task.id, 'done', null, `Installed ${new Date().toISOString()}`);
  } catch (e) {
    log(`📦 ❌ ${e.message}`);
    await reportResult(task.id, 'failed', e.message, null);
  } finally {
    spawnSync('schtasks', ['/Delete','/TN',taskName,'/F'], { windowsHide: true, stdio: 'ignore' });
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

async function reportResult(taskId, status, err, log_) {
  try {
    await serverRequest('POST', '/api/agent/task-result', {
      device_key: STATE.deviceKey, task_id: taskId,
      status, error_msg: err || null, result_log: log_ || null,
    });
    log(`📦 Reported #${taskId}: ${status}`);
  } catch (e) { log(`📦 Report result failed: ${e.message}`); }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  log(`=== Mindteck AssetOps Agent v4.3 (${IS_PKG ? 'EXE' : 'Node'}) ===`);
  log(`Server: ${SERVER_URL} | Mode: ${IS_HTTPS ? 'HTTPS' : 'HTTP'}`);
  if (IS_HTTPS) log(`SSL: rejectUnauthorized=${!ALLOW_SELF_SIGNED}`);

  if (!STATE.deviceKey) {
    const ok = await register();
    if (!ok) {
      log('Will retry in 2 min');
      setTimeout(async () => { await register(); await reportWithRetry(); await checkAndInstallSoftware(); }, 120_000);
    }
  } else {
    log(`Identity: ${STATE.assetId || 'pending'} disabled=${STATE.disabled}`);
  }

  startActiveTracking();
  await reportWithRetry();
  await checkAndInstallSoftware();

  setInterval(async () => {
    await reportWithRetry().catch(e => log('report: ' + describeNetError(e)));
    await checkAndInstallSoftware().catch(e => log('software: ' + e.message));
  }, INTERVAL_MINS * 60 * 1000);

  setInterval(() => {
    STATE.sessionMinutes  = Math.floor((Date.now() - sessionStart) / 60000);
    STATE.totalOnlineMins = STATE.sessionMinutes;
    saveState();
  }, 60 * 1000);
})();

process.on('uncaughtException',  e => log('uncaught: ' + e.message));
process.on('unhandledRejection', e => log('unhandled: ' + String(e)));