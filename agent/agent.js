'use strict';

const si    = require('systeminformation');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { exec, execSync, spawnSync } = require('child_process');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SERVER_URL        = 'http://172.16.5.219';
const ALLOW_SELF_SIGNED = false;
const INTERVAL_MINS     = 3;
const IDLE_THRESHOLD    = 5 * 60;
const GOOGLE_API_KEY    = '';
const TASK_NAME         = 'MindteckAssetOpsAgent';
const AGENT_VERSION     = '5.3';

// ─────────────────────────────────────────────────────────────────────────────
// MODE DETECTION
// ─────────────────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const IS_USER_MODE = args.includes('--user-session');

function detectIsSystem() {
  try {
    const out = execSync(
      'powershell -NonInteractive -NoProfile -Command "[System.Security.Principal.WindowsIdentity]::GetCurrent().Name"',
      { windowsHide: true, timeout: 5000 }
    ).toString().trim().toLowerCase();
    return out.includes('system');
  } catch (_) { return false; }
}
const IS_SYSTEM = !IS_USER_MODE && detectIsSystem();
const MODE      = IS_USER_MODE ? 'USER' : IS_SYSTEM ? 'SYSTEM' : 'NORMAL';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP / HTTPS
// ─────────────────────────────────────────────────────────────────────────────
const http  = require('http');
const https = require('https');

const IS_HTTPS    = SERVER_URL.toLowerCase().startsWith('https://');
const serverAgent = IS_HTTPS
  ? new https.Agent({ rejectUnauthorized: !ALLOW_SELF_SIGNED, keepAlive: true })
  : new http.Agent({ keepAlive: true });

function serverRequest(method, urlPath, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const fullUrl  = new URL(urlPath, SERVER_URL);
    const postData = body ? JSON.stringify(body) : null;
    const options  = {
      hostname: fullUrl.hostname,
      port:     fullUrl.port || (IS_HTTPS ? 443 : 80),
      path:     fullUrl.pathname + fullUrl.search,
      method:   method.toUpperCase(),
      agent:    serverAgent,
      headers:  {
        'Content-Type': 'application/json',
        'User-Agent':   `MindteckAgent/${AGENT_VERSION}`,
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
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timed out')));
    if (postData) req.write(postData);
    req.end();
  });
}

function downloadFile(url, destPath, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(url);
    const isHttps = fullUrl.protocol === 'https:';
    const dlAgent = isHttps
      ? new https.Agent({ rejectUnauthorized: !ALLOW_SELF_SIGNED })
      : new http.Agent();
    const options = {
      hostname: fullUrl.hostname,
      port:     fullUrl.port || (isHttps ? 443 : 80),
      path:     fullUrl.pathname + fullUrl.search,
      method:   'GET', agent: dlAgent,
      headers:  { 'User-Agent': `MindteckAgent/${AGENT_VERSION}` },
    };
    const mod = isHttps ? https : http;
    const req = mod.request(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302)
        return downloadFile(res.headers.location, destPath, timeoutMs).then(resolve).catch(reject);
      if (res.statusCode !== 200)
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const chunks = [];
      res.on('data', chunk => {
        chunks.push(chunk); received += chunk.length;
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

const axios = require('axios');

// ─────────────────────────────────────────────────────────────────────────────
// PATHS & LOG
// ─────────────────────────────────────────────────────────────────────────────
const IS_PKG      = !!process.pkg;
const EXE_PATH    = process.execPath;
const INSTALL_DIR = 'C:\\MindteckAgent';
const STATE_PATH  = path.join(INSTALL_DIR, '.mindteck-state');

const LOG = IS_USER_MODE
  ? path.join(os.tmpdir(), 'mindteck-agent-user.log')
  : path.join(os.tmpdir(), 'mindteck-agent.log');

function log(msg) {
  try {
    const line = `[${new Date().toISOString()}] [${MODE}] ${msg}\n`;
    try {
      if (fs.existsSync(LOG) && fs.statSync(LOG).size > 2 * 1024 * 1024)
        fs.renameSync(LOG, LOG + '.bak');
    } catch (_) {}
    fs.appendFileSync(LOG, line);
    console.log(`[${MODE}] ${msg}`);
  } catch (_) {}
}

function describeNetError(e) {
  const c = e.code || '';
  if (c === 'ECONNREFUSED') return '❌ Connection refused';
  if (c === 'ENOTFOUND')    return '❌ Domain not found';
  if (c === 'ETIMEDOUT')    return '❌ Timed out';
  if (c === 'EHOSTUNREACH') return '❌ Host unreachable';
  return e.message;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE INSTANCE LOCK — separate per mode so SYSTEM and USER don't conflict
// ─────────────────────────────────────────────────────────────────────────────
const LOCK_FILE = IS_USER_MODE
  ? path.join(os.tmpdir(), 'mindteck-user.lock')
  : path.join(os.tmpdir(), 'mindteck-system.lock');

function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
      if (pid && pid !== process.pid) {
        try {
          process.kill(pid, 0); // alive?
          log(`⚠️  Already running PID=${pid} — exiting duplicate`);
          process.exit(0);
        } catch (_) { log(`🔁 Stale lock PID=${pid} — taking over`); }
      }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    process.on('exit',    () => { try { fs.unlinkSync(LOCK_FILE); } catch (_) {} });
    process.on('SIGINT',  () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));
    log(`🔒 Lock acquired PID=${process.pid}`);
  } catch (e) { log('Lock error: ' + e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
if (args.includes('--install'))   { installService(); process.exit(0); }
if (args.includes('--uninstall')) { uninstallService(); process.exit(0); }
if (args.includes('--status'))    { checkStatus(); process.exit(0); }

acquireLock();

// ─────────────────────────────────────────────────────────────────────────────
// STATE — shared file between SYSTEM and USER
// ─────────────────────────────────────────────────────────────────────────────
let STATE = {
  assetId: null, deviceKey: null, sessionStart: null,
  sessionMinutes: 0, totalOnlineMins: 0,
  activeMinutes: 0, totalActiveMins: 0,
  lastActiveTime: null, todayActiveDate: null, todayActiveMins: 0,
  disabled: false,
};

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH))
      STATE = { ...STATE, ...JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) };
  } catch (_) {}
}

loadState();

if (!STATE.sessionStart) STATE.sessionStart = Date.now();
const todayStr = new Date().toISOString().split('T')[0];
if (STATE.todayActiveDate !== todayStr) { STATE.todayActiveDate = todayStr; STATE.todayActiveMins = 0; }

// Merge-write: prevents one mode from wiping the other's fields
const saveState = () => {
  try {
    let existing = {};
    try { if (fs.existsSync(STATE_PATH)) existing = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (_) {}
    fs.writeFileSync(STATE_PATH, JSON.stringify({ ...existing, ...STATE }));
  } catch (_) {}
};

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL / UNINSTALL
// ─────────────────────────────────────────────────────────────────────────────
function installService() {
  log(`Installing Mindteck AssetOps Agent v${AGENT_VERSION}...`);
  spawnSync('taskkill', ['/F', '/IM', path.basename(EXE_PATH)], { windowsHide: true, stdio: 'ignore' });
  for (const tn of [TASK_NAME, TASK_NAME + '_User', TASK_NAME + '_Watchdog'])
    spawnSync('schtasks', ['/Delete', '/TN', tn, '/F'], { windowsHide: true, stdio: 'ignore' });
  for (const hive of ['HKCU', 'HKLM'])
    spawnSync('reg', ['delete', `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`, '/v', 'MindteckAgent', '/f'],
      { windowsHide: true, stdio: 'ignore' });
  ['mindteck-system.lock','mindteck-user.lock'].forEach(f => {
    try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch (_) {}
  });
  log('🧹 Cleaned old entries');

  // SYSTEM boot task
  const r1 = spawnSync('powershell', ['-NonInteractive', '-NoProfile', '-Command',
    `$a=New-ScheduledTaskAction -Execute '${EXE_PATH}';` +
    `$t=New-ScheduledTaskTrigger -AtStartup; $t.Delay='PT30S';` +
    `$s=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;` +
    `$p=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest -LogonType ServiceAccount;` +
    `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $a -Trigger $t -Settings $s -Principal $p -Force`,
  ], { windowsHide: true, stdio: ['ignore','pipe','pipe'], encoding: 'utf8' });
  log(r1.status === 0 ? '✅ SYSTEM boot task' : `⚠️ Boot task: ${r1.stderr?.trim()}`);

  // User logon task
  const user = process.env.USERNAME || process.env.USER || '';
  if (user) {
    const r2 = spawnSync('powershell', ['-NonInteractive', '-NoProfile', '-Command',
      `$a=New-ScheduledTaskAction -Execute '${EXE_PATH}' -Argument '--user-session';` +
      `$t=New-ScheduledTaskTrigger -AtLogOn; $t.Delay='PT15S';` +
      `$s=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;` +
      `$p=New-ScheduledTaskPrincipal -UserId '${user}' -RunLevel Highest -LogonType Interactive;` +
      `Register-ScheduledTask -TaskName '${TASK_NAME}_User' -Action $a -Trigger $t -Settings $s -Principal $p -Force`,
    ], { windowsHide: true, stdio: ['ignore','pipe','pipe'], encoding: 'utf8' });
    log(r2.status === 0 ? `✅ User logon task (${user})` : `⚠️ Logon: ${r2.stderr?.trim()}`);
  }

  // Watchdog
  const agentName = path.basename(EXE_PATH).replace('.exe', '');
  const r3 = spawnSync('powershell', ['-NonInteractive', '-NoProfile', '-Command',
    `$a=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-WindowStyle Hidden -NonInteractive -Command "if(-not(Get-Process -Name ${agentName} -EA SilentlyContinue)){Start-Process ''${EXE_PATH}'' -WindowStyle Hidden}"';` +
    `$t=New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 3) -Once -At (Get-Date);` +
    `$s=New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;` +
    `$p=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest -LogonType ServiceAccount;` +
    `Register-ScheduledTask -TaskName '${TASK_NAME}_Watchdog' -Action $a -Trigger $t -Settings $s -Principal $p -Force`,
  ], { windowsHide: true, stdio: ['ignore','pipe','pipe'], encoding: 'utf8' });
  log(r3.status === 0 ? '✅ Watchdog task' : `⚠️ Watchdog: ${r3.stderr?.trim()}`);

  spawnSync('schtasks', ['/Run', '/TN', TASK_NAME], { windowsHide: true, stdio: 'ignore' });
  log(`✅ Install complete. Log: ${LOG}`);
}

function uninstallService() {
  log('Uninstalling...');
  spawnSync('taskkill', ['/F', '/IM', path.basename(EXE_PATH)], { windowsHide: true, stdio: 'ignore' });
  for (const tn of [TASK_NAME, TASK_NAME + '_User', TASK_NAME + '_Watchdog'])
    spawnSync('schtasks', ['/Delete', '/TN', tn, '/F'], { windowsHide: true, stdio: 'ignore' });
  for (const hive of ['HKCU', 'HKLM'])
    spawnSync('reg', ['delete', `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`, '/v', 'MindteckAgent', '/f'],
      { windowsHide: true, stdio: 'ignore' });
  try { fs.unlinkSync(STATE_PATH); } catch (_) {}
  try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
  log('✅ Uninstall complete.');
}

function checkStatus() {
  for (const tn of [TASK_NAME, TASK_NAME + '_User', TASK_NAME + '_Watchdog']) {
    const r = spawnSync('schtasks', ['/Query', '/TN', tn, '/FO', 'LIST'],
      { windowsHide: true, stdio: ['ignore','pipe','pipe'], encoding: 'utf8' });
    console.log(r.stdout || `${tn}: not found`);
  }
  console.log('SYSTEM log:', path.join(os.tmpdir(), 'mindteck-agent.log'));
  console.log('User log:',   path.join(os.tmpdir(), 'mindteck-agent-user.log'));
}

// ─────────────────────────────────────────────────────────────────────────────
// IDLE DETECTION — User session only
// FIX: Uses PS1 file approach — no quoting issues
// ─────────────────────────────────────────────────────────────────────────────
const PS_IDLE_SCRIPT = [
  'Add-Type @"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public class IdleTime {',
  '  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO p);',
  '  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }',
  '  public static uint GetIdleSeconds() {',
  '    LASTINPUTINFO l = new LASTINPUTINFO();',
  '    l.cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(l);',
  '    GetLastInputInfo(ref l);',
  '    return (uint)((Environment.TickCount - l.dwTime) / 1000);',
  '  }',
  '}',
  '"@',
  '[IdleTime]::GetIdleSeconds()',
].join('\n');

function getIdleSeconds() {
  if (IS_SYSTEM) return 0; // SYSTEM has no desktop
  try {
    const f = path.join(os.tmpdir(), `mtidle_${Date.now()}.ps1`);
    fs.writeFileSync(f, PS_IDLE_SCRIPT, 'utf8');
    const out = execSync(
      `powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${f}"`,
      { timeout: 8000, windowsHide: true }
    ).toString().trim();
    try { fs.unlinkSync(f); } catch (_) {}
    const n = parseInt(out, 10);
    return isNaN(n) ? 0 : n;
  } catch (_) { return 0; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TIME TRACKING — User mode only
// ─────────────────────────────────────────────────────────────────────────────
function startActiveTracking() {
  if (IS_SYSTEM) {
    log('⚙️  SYSTEM mode — idle tracking skipped');
    return;
  }
  log('⌨️  Starting active/idle tracking');

  setInterval(async () => {
    try {
      loadState(); // get fresh assetId/deviceKey from SYSTEM
      const idle  = getIdleSeconds();
      const today = new Date().toISOString().split('T')[0];
      if (STATE.todayActiveDate !== today) { STATE.todayActiveDate = today; STATE.todayActiveMins = 0; }

      if (idle < IDLE_THRESHOLD) {
        STATE.activeMinutes++;
        STATE.totalActiveMins++;
        STATE.todayActiveMins++;
        STATE.lastActiveTime = Date.now();
        log(`⌨️  Active idle:${idle}s today:${STATE.todayActiveMins}min`);
      } else {
        log(`💤 Idle ${Math.floor(idle / 60)}m ${idle % 60}s`);
      }
      saveState();

      if (STATE.deviceKey && STATE.assetId) {
        await postActivity(idle);
      } else {
        log('⌨️  Waiting for SYSTEM to register...');
      }
    } catch (e) { log('Tracker error: ' + e.message); }
  }, 60 * 1000);
}

async function postActivity(idleSecs) {
  try {
    await serverRequest('POST', '/api/agent/activity', {
      asset_id:             STATE.assetId,
      device_key:           STATE.deviceKey,
      timestamp:            new Date().toISOString(),
      is_active:            idleSecs < IDLE_THRESHOLD,
      idle_seconds:         idleSecs,
      today_active_minutes: STATE.todayActiveMins,
      total_active_minutes: STATE.totalActiveMins,
      active_minutes:       STATE.activeMinutes,
    });
    log(`⌨️  Activity posted today:${STATE.todayActiveMins}min`);
  } catch (e) { log('Activity post failed: ' + describeNetError(e)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// BATTERY — uses PS1 file (fixes the quoting error in old inline command)
// ─────────────────────────────────────────────────────────────────────────────
function runPs(script) {
  const f = path.join(os.tmpdir(), `mtps_${Date.now()}.ps1`);
  try {
    fs.writeFileSync(f, script, 'utf8');
    return execSync(
      `powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${f}"`,
      { timeout: 10000, windowsHide: true }
    ).toString().trim();
  } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

function getBattery() {
  for (const cls of ['Get-CimInstance -ClassName Win32_Battery', 'Get-WmiObject -Class Win32_Battery']) {
    try {
      const out = runPs([
        `$b = ${cls} -ErrorAction SilentlyContinue`,
        `if ($b) {`,
        `  $pct = [int]$b.EstimatedChargeRemaining`,
        `  $chg = if ($b.BatteryStatus -eq 2) { 'true' } else { 'false' }`,
        `  Write-Output "$pct|$chg"`,
        `} else {`,
        `  Write-Output 'none'`,
        `}`,
      ].join('\n'));
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
    const net = (nets || []).find(n => n.operstate === 'up' && !n.internal && n.ip4);
    const drv = (disk || []).find(d => d.mount === 'C:' || d.mount === '/') || disk?.[0];
    const bat = getBattery();
    let hasBat = bat !== null;
    if (!hasBat) { try { hasBat = (await si.battery()).hasBattery || false; } catch (_) {} }
    return {
      hostname:         os.hostname(),
      os_version:       `${osI.distro} ${osI.release}`,
      cpu_usage:        Math.round(load.currentLoad),
      ram_total_gb:     Math.round(mem.total / 1e9 * 10) / 10,
      ram_used_gb:      Math.round((mem.total - mem.available) / 1e9 * 10) / 10,
      disk_total_gb:    drv ? Math.round(drv.size / 1e9) : null,
      disk_used_gb:     drv ? Math.round(drv.used / 1e9) : null,
      battery_pct:      bat?.pct ?? null,
      battery_charging: bat?.charging ?? false,
      battery_has:      hasBat,
      ip_address:       net?.ip4 || null,
      mac_address:      net?.mac || null,
    };
  } catch (e) { log('sysinfo: ' + e.message); return { hostname: os.hostname() }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION
// ─────────────────────────────────────────────────────────────────────────────
function tryGPS() {
  return new Promise(resolve => {
    const ps = [
      'Add-Type -AssemblyName System.Device;',
      'try{',
      '$w=New-Object System.Device.Location.GeoCoordinateWatcher("High"); $w.Start();',
      '$t=(Get-Date).AddSeconds(9);',
      'while((Get-Date)-lt $t -and ($w.Status-ne"Ready" -or $w.Position.Location.IsUnknown)){Start-Sleep -Ms 300}',
      '$l=$w.Position.Location; $w.Stop();',
      'if($l -and -not $l.IsUnknown){Write-Output "$($l.Latitude)|$($l.Longitude)|$($l.HorizontalAccuracy)"}',
      'else{Write-Output "none"}',
      '}catch{Write-Output "err"}',
    ].join(' ');
    exec(`powershell -NonInteractive -NoProfile -WindowStyle Hidden -Command "${ps}"`,
      { timeout: 15000, windowsHide: true },
      (err, stdout) => {
        const out = (stdout || '').trim();
        if (!err && out && out !== 'none' && out !== 'err') {
          const [lat, lon, acc] = out.split('|').map(Number);
          if (!isNaN(lat) && !isNaN(lon) && lat !== 0)
            return resolve({ lat, lon, accuracy: acc || 10, method: 'gps' });
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
      if (r.data?.location)
        return { lat: r.data.location.lat, lon: r.data.location.lng, accuracy: r.data.accuracy || 150, method: 'wifi' };
    } catch (_) {}
    if (GOOGLE_API_KEY) {
      const r = await axios.post(`https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_API_KEY}`,
        { wifiAccessPoints: aps.slice(0, 15) }, { timeout: 7000 });
      if (r.data?.location)
        return { lat: r.data.location.lat, lon: r.data.location.lng, accuracy: r.data.accuracy || 50, method: 'wifi_g' };
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
      if (lat && lon)
        return { lat, lon, accuracy: 10000, method: 'ip', city: d.city, region: d.regionName || d.region, country: d.country_name || d.country };
    } catch (_) {}
  }
  return null;
}

async function getBestLocation() {
  const gps = await tryGPS();
  if (gps && gps.accuracy <= 300) { log(`📍 GPS ±${gps.accuracy}m`); return gps; }
  const wifi = await tryWifi();
  if (wifi) { log(`📍 WiFi ±${wifi.accuracy}m`); return wifi; }
  const ip = await tryIP();
  if (ip) { log(`📍 IP: ${ip.city}`); return ip; }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION — SYSTEM only
// ─────────────────────────────────────────────────────────────────────────────
async function register() {
  log('Registering...');
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
      log(STATE.assetId ? `✅ Registered as ${STATE.assetId}` : '✅ Registered — awaiting assignment');
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
      STATE.assetId = res.data.assetId;
      STATE.deviceKey = res.data.deviceKey;
      STATE.disabled = false;
      saveState();
      log(`✅ Assigned: ${STATE.assetId}`);
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT — SYSTEM only, reads USER active minutes from shared state
// ─────────────────────────────────────────────────────────────────────────────
let sessionStart = STATE.sessionStart || Date.now();
STATE.sessionStart = sessionStart;
saveState();

async function report() {
  if (STATE.disabled)   { log('⛔ Disabled'); return; }
  if (!STATE.deviceKey) { log('No deviceKey'); return; }
  if (!STATE.assetId)   await checkAssignment();

  loadState(); // pick up active mins from USER mode

  const [location, system] = await Promise.all([getBestLocation(), getSysInfo()]);
  const sessionMins = Math.floor((Date.now() - sessionStart) / 60000);

  STATE.sessionMinutes  = sessionMins;
  STATE.totalOnlineMins = sessionMins;
  saveState();

  // is_active: true if user was active in last 6 min
  const isActive = STATE.todayActiveMins > 0 &&
    (Date.now() - (STATE.lastActiveTime || 0)) < 6 * 60 * 1000;

  const res = await serverRequest('POST', '/api/agent/report', {
    asset_id:   STATE.assetId,   device_key:  STATE.deviceKey,
    timestamp:  new Date().toISOString(),
    location,   system,          online: true,
    agent_mode: MODE,
    session_minutes:      sessionMins,
    total_online_minutes: STATE.totalOnlineMins,
    active_minutes:       STATE.activeMinutes,
    today_active_minutes: STATE.todayActiveMins,
    total_active_minutes: STATE.totalActiveMins,
    is_active:    isActive,
    idle_seconds: 0,
  });

  if (res.data?.disabled) { STATE.disabled = true; saveState(); log('⛔ Remotely disabled.'); return; }
  STATE.disabled = false;
  log(`✅ ${STATE.assetId || 'pending'} ${location?.method || 'no_loc'} bat:${system.battery_pct ?? 'none'}% cpu:${system.cpu_usage}% online:${sessionMins}min active:${STATE.todayActiveMins}min`);
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
// SELF-HEALING USER SESSION — SYSTEM detects logged-in user and ensures
// the user-mode task is registered for THAT user and running.
// No manual intervention needed on already-deployed machines.
// ─────────────────────────────────────────────────────────────────────────────
async function healUserSession() {
  if (IS_USER_MODE) return;

  try {
    // 1. Get currently logged-in interactive user
    const whoOut = spawnSync('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      `(Get-WmiObject Win32_ComputerSystem).UserName -replace '.*\\\\',''`
    ], { windowsHide: true, encoding: 'utf8', timeout: 5000 });

    const currentUser = (whoOut.stdout || '').trim();
    if (!currentUser) { log('👤 No interactive user logged in'); return; }

    // 2. Check if user-mode process is already running in a non-SYSTEM session
    const procOut = spawnSync('powershell', [
      '-NonInteractive', '-NoProfile', '-Command',
      `(Get-WmiObject Win32_Process | Where-Object { $_.Name -eq '${path.basename(EXE_PATH)}' -and $_.SessionId -ne 0 } | Measure-Object).Count`
    ], { windowsHide: true, encoding: 'utf8', timeout: 8000 });

    const runningCount = parseInt((procOut.stdout || '0').trim(), 10);
    if (runningCount > 0) {
      log(`👤 User session already running for ${currentUser}`);
      return;
    }

    log(`👤 User session missing for ${currentUser} — healing...`);

    // 3. Re-register the logon task for the CURRENT logged-in user
    const r = spawnSync('powershell', ['-NonInteractive', '-NoProfile', '-Command',
      `$a=New-ScheduledTaskAction -Execute '${EXE_PATH}' -Argument '--user-session';` +
      `$t=New-ScheduledTaskTrigger -AtLogOn -User '${currentUser}'; $t.Delay='PT15S';` +
      `$s=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 ` +
      `-RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;` +
      `$p=New-ScheduledTaskPrincipal -UserId '${currentUser}' -RunLevel Highest -LogonType Interactive;` +
      `Register-ScheduledTask -TaskName '${TASK_NAME}_User' -Action $a -Trigger $t -Settings $s -Principal $p -Force`
    ], { windowsHide: true, encoding: 'utf8', timeout: 15000 });

    if (r.status === 0) {
      log(`👤 Logon task updated for ${currentUser}`);
    } else {
      log(`👤 Task update warning: ${(r.stderr || '').trim()}`);
    }

    // 4. Launch it RIGHT NOW without waiting for next logon
    spawnSync('schtasks', ['/Run', '/TN', `${TASK_NAME}_User`],
      { windowsHide: true, stdio: 'ignore' });

    log(`👤 User session launched for ${currentUser}`);

  } catch (e) {
    log('healUserSession error: ' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFTWARE PUSH — SYSTEM only
// ─────────────────────────────────────────────────────────────────────────────
async function checkAndInstallSoftware() {
  if (IS_USER_MODE) return;
  if (!STATE.deviceKey || !STATE.assetId || STATE.disabled) return;
  try {
    log('📦 Checking for software tasks...');
    const res = await serverRequest('GET', `/api/agent/pending-tasks?device_key=${STATE.deviceKey}`);
    if (!res.data?.success || !res.data.tasks?.length) { log('📦 No pending tasks.'); return; }
    log(`📦 ${res.data.tasks.length} task(s) found.`);
    for (const task of res.data.tasks) await installSoftwareTask(task);
  } catch (e) { log('📦 Check error: ' + describeNetError(e)); }
}

async function installSoftwareTask(task) {
  const crypto   = require('crypto');
  const ext      = path.extname(task.filename).toLowerCase();
  const safeName = task.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const tmpFile  = path.join(os.tmpdir(), `mtpkg_${task.id}_${safeName}`);

  log(`📦 Task: ${task.name} v${task.version || 'N/A'}`);
  try {
    log('📦 Downloading...');
    await downloadFile(task.download_url, tmpFile);
    log(`📦 Downloaded ${(fs.statSync(tmpFile).size / 1024 / 1024).toFixed(1)} MB`);

    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tmpFile)).digest('hex');
    if (sha256 !== task.sha256) throw new Error('SHA256 mismatch — corrupted download');
    log('📦 Integrity ✅');

    const silent      = (task.silent_args || '/S /silent /quiet').split(' ').filter(Boolean);
    const installOpts = {
      windowsHide: true,
      stdio:       ['ignore', 'pipe', 'pipe'],
      encoding:    'utf8',
      timeout:     5 * 60 * 1000,
    };

    log('📦 Installing directly as SYSTEM...');
    let result;

    if (ext === '.msi') {
      result = spawnSync('msiexec.exe', ['/i', tmpFile, '/qn', '/norestart', ...silent], installOpts);
    } else if (ext === '.exe') {
      result = spawnSync(tmpFile, silent, installOpts);
    } else if (ext === '.zip') {
      const destDir = `C:\\Program Files\\${task.name.replace(/[^a-zA-Z0-9 ]/g, '')}`;
      result = spawnSync('powershell', [
        '-NonInteractive', '-NoProfile', '-Command',
        `Expand-Archive -Path '${tmpFile}' -DestinationPath '${destDir}' -Force`,
      ], installOpts);
    } else if (ext === '.bat') {
      result = spawnSync('cmd.exe', ['/c', tmpFile], installOpts);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const exitCode = result.status;
    const stderr   = (result.stderr || '').trim();

    if (exitCode === null) throw new Error('Installer timed out');
    if (exitCode !== 0 && exitCode !== 3010)
      throw new Error(`Exit code ${exitCode}${stderr ? ': ' + stderr.slice(0, 200) : ''}`);

    const msg = exitCode === 3010
      ? `📦 ✅ ${task.name} installed (reboot required)`
      : `📦 ✅ ${task.name} installed successfully!`;
    log(msg);
    await reportResult(task.id, 'done', null, `Installed at ${new Date().toISOString()} exit:${exitCode}`);

  } catch (e) {
    log(`📦 ❌ ${e.message}`);
    await reportResult(task.id, 'failed', e.message, null);
  } finally {
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
  log(`=== Mindteck AssetOps Agent v${AGENT_VERSION} (${IS_PKG ? 'EXE' : 'Node'}) ===`);
  log(`Mode: ${MODE} | Server: ${SERVER_URL} | ${IS_HTTPS ? 'HTTPS' : 'HTTP'}`);

  if (IS_USER_MODE) {
    log('👤 User session — activity tracking only');
    await new Promise(r => setTimeout(r, 5000));
    loadState();
    startActiveTracking();

  } else {
    log('⚙️  SYSTEM mode — full agent');
    if (!STATE.deviceKey) {
      const ok = await register();
      if (!ok) {
        log('Registration failed — retrying in 2 min');
        setTimeout(async () => {
          await register();
          await reportWithRetry();
          await checkAndInstallSoftware();
          await healUserSession();                    // ← heal after late registration
        }, 120_000);
      }
    } else {
      log(`Identity: ${STATE.assetId || 'pending'} disabled=${STATE.disabled}`);
    }

    startActiveTracking(); // no-op in SYSTEM

    await reportWithRetry();
    await checkAndInstallSoftware();
    await healUserSession();                          // ← heal on every startup

    setInterval(async () => {
      await reportWithRetry().catch(e => log('report: ' + describeNetError(e)));
      await checkAndInstallSoftware().catch(e => log('software: ' + e.message));
      await healUserSession().catch(e => log('healUser: ' + e.message)); // ← heal every 3 min
    }, INTERVAL_MINS * 60 * 1000);
  }

  setInterval(() => {
    STATE.sessionMinutes  = Math.floor((Date.now() - sessionStart) / 60000);
    STATE.totalOnlineMins = STATE.sessionMinutes;
    saveState();
  }, 60 * 1000);

})();

process.on('uncaughtException',  e => log('uncaught: '  + e.message));
process.on('unhandledRejection', e => log('unhandled: ' + String(e)));