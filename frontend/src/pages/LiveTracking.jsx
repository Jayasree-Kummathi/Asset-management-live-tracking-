import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Wifi, WifiOff, Battery, BatteryCharging,
  Clock, RefreshCw, Search, X, Navigation,
  Monitor, AlertTriangle, Activity, BarChart2, Eye,
  TrendingUp, Zap, Download, Layers,
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const apiFetch = async (path) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

const METHOD = {
  gps:    { label: 'GPS',  icon: '🛰️', color: '#22c55e' },
  wifi:   { label: 'WiFi', icon: '📶', color: '#6366f1' },
  wifi_g: { label: 'WiFi', icon: '📶', color: '#6366f1' },
  ip:     { label: 'IP',   icon: '🌐', color: '#f59e0b' },
};

function fmtHours(h) {
  if (!h || h === 0) return '0h';
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${parseFloat(h).toFixed(1)}h`;
}

function timeAgo(sec) {
  if (sec == null) return '—';
  if (sec < 60)    return 'Just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// ── Guard: ensure lat/lon are real numbers, not NaN/null/0 ───────────────────
function isValidLatLng(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  return (
    lat != null && lon != null &&
    !isNaN(la) && !isNaN(lo) &&
    la !== 0 && lo !== 0 &&
    Math.abs(la) <= 90 && Math.abs(lo) <= 180
  );
}

const AVATAR_COLORS = [
  { bg: '#e0e7ff', color: '#3730a3' },
  { bg: '#d1fae5', color: '#065f46' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#fce7f3', color: '#9d174d' },
  { bg: '#e0f2fe', color: '#075985' },
  { bg: '#f3e8ff', color: '#6b21a8' },
  { bg: '#fff1f2', color: '#9f1239' },
];
function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV(locations) {
  const headers = ['Asset ID','Employee','Dept','Status','Active','Online','Week','Efficiency%','Battery%','CPU%','City','Last Seen'];
  const rows = locations.map(l => [
    l.asset_id, l.emp_name || 'Unallocated', l.department || '',
    l.is_online ? 'Online' : 'Offline',
    fmtHours(l.today_active_hours || 0),
    fmtHours(l.today_online_hours || 0),
    fmtHours(l.week_online_hours || 0),
    l.efficiency_pct || 0,
    l.battery_pct != null ? l.battery_pct : '',
    l.cpu_usage != null ? l.cpu_usage : '',
    l.city || '', timeAgo(l.seconds_ago),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `live-tracking-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

// ── History Modal ─────────────────────────────────────────────────────────────
function HistoryModal({ assetId, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/agent/locations/${assetId}/history?hours=24`)
      .then(r => setHistory(r.success ? r.data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [assetId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Clock size={15} style={{ marginRight: 8, verticalAlign: 'middle' }}/>
            Location Trail — {assetId} (Last 24h)
          </h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Loading…</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No history in last 24 hours</div>
          ) : (
            <div style={{ maxHeight: 440, overflowY: 'auto' }}>
              <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                {history.length} records — newest first
              </div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                    {['Time','Coordinates','Method','Accuracy','Battery','CPU'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => {
                    const m = METHOD[h.location_method] || { icon: '📍', label: h.location_method || '—' };
                    const batColor = h.battery_pct > 50 ? 'var(--green)' : h.battery_pct > 20 ? 'var(--amber)' : 'var(--red)';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(h.reported_at).toLocaleTimeString()}<br/>
                          <span style={{ fontSize: 10 }}>{new Date(h.reported_at).toLocaleDateString()}</span>
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {isValidLatLng(h.lat, h.lon) ? (
                            <a href={`https://www.google.com/maps?q=${h.lat},${h.lon}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                              {Number(h.lat).toFixed(5)}, {Number(h.lon).toFixed(5)}
                            </a>
                          ) : <span style={{ color: 'var(--text-muted)' }}>No location</span>}
                        </td>
                        <td style={{ padding: '6px 10px', fontSize: 11 }}>{m.icon} {m.label}</td>
                        <td style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{h.accuracy ? `±${Math.round(h.accuracy)}m` : '—'}</td>
                        <td style={{ padding: '6px 10px', fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700, color: batColor }}>
                          {h.battery_pct != null ? `${h.battery_pct}%` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'var(--mono)' }}>
                          {h.cpu_usage != null ? `${h.cpu_usage}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────
function AnalyticsPanel({ locations, avgTodayH, avgWeekH, avgActiveH, fleetEff }) {
  const sorted = [...locations].sort((a, b) => (b.today_active_hours || 0) - (a.today_active_hours || 0));
  const maxActive = Math.max(...locations.map(l => l.today_online_hours || 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Fleet Overview</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
            <circle cx="36" cy="36" r="28" fill="none" stroke="var(--border)" strokeWidth="6"/>
            <circle cx="36" cy="36" r="28" fill="none"
              stroke={fleetEff >= 70 ? '#22c55e' : fleetEff >= 40 ? '#f59e0b' : '#ef4444'}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${(fleetEff / 100) * 175.9} 175.9`}
              strokeDashoffset="44"
              transform="rotate(-90 36 36)"
            />
            <text x="36" y="37" textAnchor="middle" dominantBaseline="central"
              style={{ fontSize: 14, fontWeight: 700, fill: 'var(--text)', fontFamily: 'var(--mono)' }}>
              {fleetEff}%
            </text>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Fleet efficiency</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Avg online: <strong style={{ color: 'var(--text)' }}>{fmtHours(avgTodayH)}</strong></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Avg active: <strong style={{ color: '#22c55e' }}>{fmtHours(avgActiveH)}</strong></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg week: <strong style={{ color: 'var(--accent)' }}>{fmtHours(avgWeekH)}</strong></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Active Hours Ranking</div>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</div>
        ) : sorted.map((loc, i) => {
          const ac = avatarColor(loc.emp_name || loc.asset_id);
          const activeH = loc.today_active_hours || 0;
          const onlineH = loc.today_online_hours || 0;
          const eff = loc.efficiency_pct || 0;
          const effColor = eff >= 75 ? '#22c55e' : eff >= 50 ? '#f59e0b' : '#ef4444';
          return (
            <div key={loc.asset_id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: loc.is_active ? '#22c55e' : loc.is_online ? '#6366f1' : '#6b7280', flexShrink: 0 }}/>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: ac.bg, color: ac.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {getInitials(loc.emp_name || loc.asset_id)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {loc.emp_name || loc.asset_id}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{loc.department || loc.asset_id}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--mono)' }}>{fmtHours(activeH)}</div>
                  <div style={{ fontSize: 10, color: effColor }}>{eff}% eff</div>
                </div>
              </div>
              <div style={{ position: 'relative', height: 6, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(onlineH / maxActive) * 100}%`, background: 'rgba(99,102,241,0.25)', borderRadius: 4 }}/>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(activeH / maxActive) * 100}%`, background: loc.is_active ? '#22c55e' : '#6366f1', borderRadius: 4, transition: 'width .5s ease' }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                <span>⌨️ {fmtHours(activeH)}</span>
                <span>💻 {fmtHours(onlineH)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Status Breakdown</div>
        {[
          { label: 'Active (typing/clicking)', val: locations.filter(l => l.is_active).length,                           color: '#22c55e' },
          { label: 'Online (idle)',             val: locations.filter(l => l.is_online && !l.is_active).length,           color: '#6366f1' },
          { label: 'Offline',                  val: locations.filter(l => !l.is_online).length,                          color: '#6b7280' },
          { label: 'No location',              val: locations.filter(l => !isValidLatLng(l.lat, l.lon)).length,          color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--mono)' }}>{s.val} / {locations.length}</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: locations.length ? `${(s.val / locations.length) * 100}%` : '0%', background: s.color, borderRadius: 4, transition: 'width .5s' }}/>
            </div>
          </div>
        ))}
      </div>

      {locations.filter(l => l.battery_pct != null && l.battery_pct < 20 && l.is_online).length > 0 && (
        <div className="card" style={{ padding: '14px 16px', borderLeft: '3px solid #ef4444' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>🔋 Low Battery Alerts</div>
          {locations.filter(l => l.battery_pct != null && l.battery_pct < 20 && l.is_online).map(l => (
            <div key={l.asset_id} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>{l.emp_name || l.asset_id}</span>
              <span style={{ color: '#ef4444', fontWeight: 700, fontFamily: 'var(--mono)' }}>{l.battery_pct}%</span>
            </div>
          ))}
        </div>
      )}

      {locations.length > 0 && (
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Insights</div>
          {(() => {
            const insights = [];
            const topEmp = sorted[0];
            if (topEmp && (topEmp.today_active_hours || 0) > 0)
              insights.push({ color: '#22c55e', text: `${topEmp.emp_name || topEmp.asset_id} leads with ${fmtHours(topEmp.today_active_hours)} active today.` });
            const lowEff = locations.filter(l => (l.efficiency_pct || 0) < 50 && l.is_online);
            if (lowEff.length > 0)
              insights.push({ color: '#f59e0b', text: `${lowEff.length} laptop${lowEff.length > 1 ? 's' : ''} below 50% efficiency.` });
            if (fleetEff >= 70)
              insights.push({ color: '#6366f1', text: `Fleet efficiency ${fleetEff}% — above the 70% benchmark.` });
            const offlineCount = locations.filter(l => !l.is_online).length;
            if (offlineCount > 0)
              insights.push({ color: '#6b7280', text: `${offlineCount} laptop${offlineCount > 1 ? 's are' : ' is'} offline.` });
            if (insights.length === 0)
              insights.push({ color: '#6b7280', text: 'Tracking active. Check back after 30+ minutes for insights.' });
            return insights.map((ins, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 10px', borderLeft: `3px solid ${ins.color}`, background: 'var(--surface2)', borderRadius: '0 6px 6px 0', marginBottom: 6, lineHeight: 1.5 }}>
                {ins.text}
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function LiveTracking() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/dashboard');
  }, [user, navigate]);

  const [locations,   setLocations]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('All');
  const [selected,    setSelected]    = useState(null);
  const [historyId,   setHistoryId]   = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown,   setCountdown]   = useState(300);
  const [mapReady,    setMapReady]    = useState(false);
  const [avgTodayH,   setAvgTodayH]  = useState(0);
  const [avgWeekH,    setAvgWeekH]   = useState(0);
  const [avgActiveH,  setAvgActiveH] = useState(0);
  const [fleetEff,    setFleetEff]   = useState(0);
  const [activeTab,   setActiveTab]  = useState('map');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [sortBy,      setSortBy]     = useState('active');

  const mapRef    = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef({});

  // ── Init Leaflet map ─────────────────────────────────────────────────────────
  const initMap = useCallback(() => {
    if (mapObjRef.current || !mapRef.current || !window.L) return;
    const L   = window.L;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    mapObjRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (window.L) { initMap(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = initMap;
    document.head.appendChild(s);
  }, [initMap]);

  // Invalidate map size when tab or expand changes
  useEffect(() => {
    if (!mapObjRef.current) return;
    setTimeout(() => mapObjRef.current.invalidateSize(), 50);
  }, [activeTab, mapExpanded]);

  // ── Fetch locations ──────────────────────────────────────────────────────────
  const fetchLocations = useCallback(async () => {
    try {
      const res = await apiFetch('/agent/locations');
      if (res.success) {
        setLocations(res.data || []);
        setAvgTodayH(res.avgTodayHours   || 0);
        setAvgWeekH(res.avgWeekHours     || 0);
        setAvgActiveH(res.avgActiveHours || 0);
        setFleetEff(res.fleetEfficiency  || 0);
        setLastRefresh(new Date());
        setCountdown(300);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchLocations();
    const t = setInterval(fetchLocations, 180000);
    return () => clearInterval(t);
  }, [fetchLocations]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [lastRefresh]);

  // ── Map markers — FIXED: skip assets without valid coords ────────────────────
  useEffect(() => {
    if (!mapReady || !window.L || !mapObjRef.current) return;
    const L   = window.L;
    const map = mapObjRef.current;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    locations.forEach(loc => {
      // CRITICAL: skip if lat/lon are invalid — prevents NaN crash
      if (!isValidLatLng(loc.lat, loc.lon)) return;

      const online   = loc.is_online;
      const bat      = loc.battery_pct;
      const pinColor = loc.is_active ? '#22c55e' : online ? '#6366f1' : '#6b7280';
      const batColor = bat > 50 ? '#22c55e' : bat > 20 ? '#f59e0b' : '#ef4444';
      const mInfo    = METHOD[loc.location_method] || { icon: '📍' };

      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:44px;height:56px">
          <div style="width:40px;height:40px;border-radius:50% 50% 50% 0;background:${pinColor};border:2.5px solid #fff;transform:rotate(-45deg);position:absolute;top:0;left:2px;box-shadow:0 3px 14px rgba(0,0,0,.5)"></div>
          <div style="position:absolute;top:5px;left:0;width:44px;text-align:center;font-size:8px;font-weight:900;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7)">${loc.asset_id.replace('LTB-', '#')}</div>
          ${loc.is_active ? '<div style="position:absolute;top:-4px;right:0;width:10px;height:10px;border-radius:50%;background:#22c55e;border:1.5px solid #fff"></div>' : ''}
          ${bat != null ? `<div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:9px;height:9px;border-radius:50%;background:${batColor};border:1.5px solid #fff"></div>` : ''}
        </div>`,
        iconSize: [44, 56], iconAnchor: [22, 56], popupAnchor: [0, -58],
      });

      const popup = `<div style="font-family:system-ui;font-size:12px;min-width:200px">
        <div style="font-weight:800;color:#6366f1;font-size:14px;margin-bottom:4px">${loc.asset_id}</div>
        ${loc.brand ? `<div style="color:#64748b;font-size:11px">${loc.brand} ${loc.model}</div>` : ''}
        <div style="margin:6px 0;padding:6px 8px;background:${loc.is_active?'rgba(34,197,94,.1)':loc.is_online?'rgba(99,102,241,.1)':'rgba(107,114,128,.1)'};border-radius:6px">
          <div style="font-weight:700;color:${loc.is_active?'#16a34a':loc.is_online?'#4f46e5':'#4b5563'}">
            ${loc.is_active ? '⌨️ Actively working' : loc.is_online ? '💤 Online / Idle' : '○ Offline'}
          </div>
          ${loc.is_online && !loc.is_active ? `<div style="color:#64748b;font-size:11px">Idle ${Math.floor((loc.idle_seconds||0)/60)}m</div>` : ''}
        </div>
        ${loc.emp_name
          ? `<div style="margin:4px 0;font-weight:600">👤 ${loc.emp_name}</div>
             <div style="color:#64748b;font-size:11px">${loc.department || ''} ${loc.emp_id ? '· ' + loc.emp_id : ''}</div>`
          : '<div style="color:#f59e0b;font-size:11px;margin:4px 0">⚠ No employee allocated</div>'
        }
        <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:4px">
          <div style="background:#f8fafc;border-radius:4px;padding:4px 6px;font-size:11px"><div style="color:#64748b">Active</div><div style="font-weight:700;color:#16a34a">${fmtHours(loc.today_active_hours||0)}</div></div>
          <div style="background:#f8fafc;border-radius:4px;padding:4px 6px;font-size:11px"><div style="color:#64748b">Online</div><div style="font-weight:700">${fmtHours(loc.today_online_hours||0)}</div></div>
          <div style="background:#f8fafc;border-radius:4px;padding:4px 6px;font-size:11px"><div style="color:#64748b">Efficiency</div><div style="font-weight:700;color:${(loc.efficiency_pct||0)>=70?'#16a34a':(loc.efficiency_pct||0)>=40?'#d97706':'#dc2626'}">${loc.efficiency_pct||0}%</div></div>
          <div style="background:#f8fafc;border-radius:4px;padding:4px 6px;font-size:11px"><div style="color:#64748b">Battery</div><div style="font-weight:700">${bat!=null?bat+'%':'—'}</div></div>
        </div>
        ${loc.city ? `<div style="color:#64748b;font-size:11px;margin-top:6px">📍 ${loc.city}${loc.country?', '+loc.country:''}</div>` : ''}
        <div style="font-size:11px;color:#94a3b8;margin-top:3px">${mInfo.icon} · ${timeAgo(loc.seconds_ago)}</div>
      </div>`;

      const marker = L.marker([Number(loc.lat), Number(loc.lon)], { icon })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 260 });
      marker.on('click', () => setSelected(loc.asset_id));
      markersRef.current[loc.asset_id] = marker;
    });
  }, [locations, mapReady]);

  // ── Fly to selected — FIXED: guard NaN/null before flyTo ────────────────────
  useEffect(() => {
    if (!selected || !mapObjRef.current) return;
    const loc = locations.find(l => l.asset_id === selected);
    if (!loc) return;
    // Guard: only flyTo if coordinates are valid numbers
    if (!isValidLatLng(loc.lat, loc.lon)) return;
    try {
      mapObjRef.current.flyTo([Number(loc.lat), Number(loc.lon)], 15, { duration: 1 });
      setTimeout(() => markersRef.current[selected]?.openPopup(), 1100);
    } catch (e) {
      console.warn('flyTo error:', e.message);
    }
  }, [selected, locations]);

  // ── Filter + sort ────────────────────────────────────────────────────────────
  const filtered = locations.filter(l => {
    const ms = !search || [l.asset_id, l.emp_name, l.emp_id, l.brand, l.city, l.hostname]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const mf = filter === 'All'
      || (filter === 'Online'  && l.is_online)
      || (filter === 'Offline' && !l.is_online)
      || (filter === 'Active'  && l.is_active)
      || (filter === 'No GPS'  && !isValidLatLng(l.lat, l.lon));
    return ms && mf;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sortBy === 'active')  return (b.today_active_hours||0) - (a.today_active_hours||0);
    if (sortBy === 'online')  return (b.today_online_hours||0) - (a.today_online_hours||0);
    if (sortBy === 'week')    return (b.week_online_hours||0) - (a.week_online_hours||0);
    if (sortBy === 'name')    return (a.emp_name||a.asset_id).localeCompare(b.emp_name||b.asset_id);
    if (sortBy === 'battery') return (b.battery_pct||0) - (a.battery_pct||0);
    return 0;
  });

  const onlineCount  = locations.filter(l => l.is_online).length;
  const offlineCount = locations.filter(l => !l.is_online).length;
  const activeCount  = locations.filter(l => l.is_active).length;
  const noGPSCount   = locations.filter(l => !isValidLatLng(l.lat, l.lon)).length;
  const lowBatCount  = locations.filter(l => l.battery_pct != null && l.battery_pct < 20 && l.is_online).length;
  const totalTodayH  = +(locations.reduce((s, l) => s + (l.today_online_hours || 0), 0)).toFixed(1);

  if (!user || user.role !== 'admin') return null;

  const SortTh = ({ col, label }) => (
    <th onClick={() => setSortBy(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label} {sortBy === col ? '↓' : ''}
    </th>
  );

  return (
    <div className="fade-in">

      {/* ── Header ── */}
      <div className="page-header page-header-row" style={{ marginBottom: 16 }}>
        <div>
          <h1>Live Laptop Tracking</h1>
          <p>Real-time location · Active time · GPS / WiFi / IP · Updates every 3 min</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lowBatCount > 0 && (
            <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,.1)', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
              🔋 {lowBatCount} low battery
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
            <div>Updated {lastRefresh.toLocaleTimeString()}</div>
            <div style={{ color: countdown < 60 ? 'var(--amber)' : 'inherit' }}>
              Next in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(locations)}><Download size={13}/> Export</button>
          <button className="btn btn-secondary btn-sm" onClick={fetchLocations}><RefreshCw size={13}/> Refresh</button>
        </div>
      </div>

      {/* ── Stats row 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
        {[
          { label: 'Tracked',    val: locations.length, color: 'var(--accent)',      icon: Monitor },
          { label: 'Online now', val: onlineCount,      color: 'var(--green)',       icon: Wifi    },
          { label: 'Active now', val: activeCount,      color: '#22c55e',            icon: Zap     },
          { label: 'Offline',    val: offlineCount,     color: 'var(--text-muted)',  icon: WifiOff },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon size={16} color={s.color} style={{ flexShrink: 0 }}/>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Stats row 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'No location',     val: noGPSCount,          color: 'var(--amber)',                                                                        icon: AlertTriangle },
          { label: 'Total today',     val: `${totalTodayH}h`,   color: 'var(--green)',                                                                        icon: Clock        },
          { label: 'Avg online/day',  val: `${avgTodayH}h`,     color: 'var(--accent)',                                                                       icon: TrendingUp   },
          { label: 'Avg active/day',  val: `${avgActiveH}h`,    color: '#22c55e',                                                                             icon: Zap          },
          { label: 'Fleet efficiency',val: `${fleetEff}%`,      color: fleetEff >= 70 ? 'var(--green)' : fleetEff >= 40 ? 'var(--amber)' : 'var(--red)',      icon: Activity     },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon size={15} color={s.color} style={{ flexShrink: 0 }}/>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Toolbar ── */}
      <div className="inv-toolbar" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search asset, employee, city…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="toggle-group">
          {['All','Online','Active','Offline','No GPS'].map(f => (
            <button key={f} className={`toggle-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button className={`btn btn-sm ${activeTab === 'map' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('map')}><MapPin size={12}/> Map</button>
          <button className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('analytics')}><BarChart2 size={12}/> Analytics</button>
        </div>
      </div>

      {/* ── MAP VIEW — never unmount the map div, just hide ── */}
      <div style={{ display: activeTab === 'map' ? 'grid' : 'none', gridTemplateColumns: mapExpanded ? '1fr' : '1fr 340px', gap: 14, alignItems: 'start' }}>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh col="name"    label="Asset / Employee"/>
                <th>Status</th>
                <SortTh col="online"  label="Online"/>
                <SortTh col="active"  label="Active ⌨️"/>
                <SortTh col="week"    label="Week"/>
                <SortTh col="battery" label="Battery"/>
                <th>CPU</th>
                <th>Location</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10}><div className="empty-state"><Activity size={24} style={{ opacity: .4 }}/><p>Loading…</p></div></td></tr>
              ) : sortedFiltered.length === 0 ? (
                <tr><td colSpan={10}><div className="empty-state"><MapPin size={28} style={{ opacity: .3 }}/><p>{locations.length === 0 ? 'No agents installed.' : 'No matching assets.'}</p></div></td></tr>
              ) : sortedFiltered.map(loc => {
                const online     = loc.is_online;
                const mInfo      = METHOD[loc.location_method] || { icon: '📍', label: '—', color: 'var(--text-muted)' };
                const bat        = loc.battery_pct;
                const batColor   = bat > 50 ? 'var(--green)' : bat > 20 ? 'var(--amber)' : 'var(--red)';
                const isSelected = selected === loc.asset_id;
                // FIX: define hasCoords here — was missing, caused ESLint error
                const hasCoords  = isValidLatLng(loc.lat, loc.lon);
                const effColor   = (loc.efficiency_pct||0) >= 70 ? 'var(--green)' : (loc.efficiency_pct||0) >= 40 ? 'var(--amber)' : 'var(--red)';
                const ac         = avatarColor(loc.emp_name || loc.asset_id);

                return (
                  <tr key={loc.asset_id}
                    onClick={() => {
                      if (!hasCoords && !isSelected) return;
                      setSelected(isSelected ? null : loc.asset_id);
                    }}
                    style={{ cursor: hasCoords ? 'pointer' : 'default', background: isSelected ? 'var(--accent-glow)' : undefined, borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent' }}>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: loc.is_active ? '#22c55e' : online ? '#6366f1' : '#6b7280', flexShrink: 0 }}/>
                        <div>
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12, color: 'var(--accent)' }}>{loc.asset_id}</span>
                          {loc.emp_name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                              <div style={{ width: 18, height: 18, borderRadius: '50%', background: ac.bg, color: ac.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>
                                {getInitials(loc.emp_name)}
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 600 }}>{loc.emp_name}</span>
                            </div>
                          )}
                          {!loc.emp_name && <div style={{ fontSize: 10, color: 'var(--amber)' }}>⚠ Unallocated</div>}
                          {loc.brand && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{loc.brand} {loc.model}</div>}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${online ? 'badge-green' : 'badge-red'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                        {online ? <Wifi size={8}/> : <WifiOff size={8}/>}
                        {online ? 'Online' : 'Offline'}
                      </span>
                      {online && (
                        <div style={{ fontSize: 10, color: loc.is_active ? '#22c55e' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
                          {loc.is_active ? <><Zap size={9} color="#22c55e"/>Active</> : `Idle ${Math.floor((loc.idle_seconds||0)/60)}m`}
                        </div>
                      )}
                    </td>

                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--green)', fontSize: 12 }}>{fmtHours(loc.today_online_hours)}</span>
                      {avgTodayH > 0 && <div style={{ fontSize: 10, color: (loc.today_online_hours||0) >= avgTodayH ? 'var(--green)' : 'var(--amber)' }}>{(loc.today_online_hours||0) >= avgTodayH ? '↑ avg' : '↓ avg'}</div>}
                    </td>

                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: loc.is_active ? '#22c55e' : 'var(--text)' }}>{fmtHours(loc.today_active_hours||0)}</span>
                      <div style={{ fontSize: 10, color: effColor }}>{loc.efficiency_pct||0}% eff</div>
                    </td>

                    <td><span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)', fontSize: 12 }}>{fmtHours(loc.week_online_hours)}</span></td>

                    <td>
                      {bat != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          {loc.battery_charging ? <BatteryCharging size={12} color="var(--amber)"/> : <Battery size={12} color={batColor}/>}
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: batColor, fontSize: 12 }}>{bat}%</span>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{loc.battery_has === false ? 'Desktop' : '—'}</span>}
                    </td>

                    <td>
                      {loc.cpu_usage != null ? (
                        <div>
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: loc.cpu_usage > 80 ? 'var(--red)' : loc.cpu_usage > 50 ? 'var(--amber)' : 'var(--text)' }}>{loc.cpu_usage}%</span>
                          <div style={{ width: 36, height: 3, background: 'var(--surface2)', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${loc.cpu_usage}%`, background: loc.cpu_usage > 80 ? 'var(--red)' : loc.cpu_usage > 50 ? 'var(--amber)' : 'var(--green)', borderRadius: 2 }}/>
                          </div>
                        </div>
                      ) : '—'}
                    </td>

                    <td>
                      {hasCoords ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
                            <span style={{ color: mInfo.color }}>{mInfo.icon}</span>
                            <span>{loc.city || `${Number(loc.lat).toFixed(3)},${Number(loc.lon).toFixed(3)}`}</span>
                          </div>
                          {loc.country && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{loc.region ? `${loc.region}, ` : ''}{loc.country}</div>}
                        </div>
                      ) : <span style={{ fontSize: 12, color: 'var(--amber)' }}>No location</span>}
                    </td>

                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {timeAgo(loc.seconds_ago)}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {hasCoords && (
                          <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lon}`} target="_blank" rel="noreferrer"
                            className="btn btn-sm btn-secondary" style={{ textDecoration: 'none' }}
                            onClick={e => e.stopPropagation()} title="Google Maps">
                            <Navigation size={11}/>
                          </a>
                        )}
                        <button className="btn btn-sm btn-secondary"
                          onClick={e => { e.stopPropagation(); setHistoryId(loc.asset_id); }} title="Location history">
                          <Eye size={11}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Map panel */}
        {!mapExpanded ? (
          <div style={{ position: 'sticky', top: 16 }}>
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', height: 'calc(100vh - 320px)', minHeight: 460, position: 'relative' }}>
              <div ref={mapRef} style={{ width: '100%', height: '100%' }}/>
              <button onClick={() => setMapExpanded(true)}
                style={{ position: 'absolute', top: 10, right: 10, zIndex: 500, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Layers size={12}/> Expand
              </button>
              {!loading && locations.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.55)', color: '#fff', gap: 12, zIndex: 500 }}>
                  <MapPin size={44} style={{ opacity: .5 }}/>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>No tracked laptops</div>
                    <div style={{ fontSize: 12, opacity: .75, maxWidth: 240, lineHeight: 1.6 }}>Deploy MindteckAssetAgent to employee laptops.</div>
                  </div>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 500, background: 'rgba(0,0,0,.7)', borderRadius: 8, padding: '5px 10px', fontSize: 10, color: '#fff', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', marginRight: 3 }}/>Active</span>
                <span><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', display: 'inline-block', marginRight: 3 }}/>Online</span>
                <span><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6b7280', display: 'inline-block', marginRight: 3 }}/>Offline</span>
              </div>
              {selected && (
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 500, background: 'rgba(99,102,241,.9)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>
                  📍 {selected}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,.8)', color: '#fff' }}>
              <span style={{ fontWeight: 700 }}>Live Map — {locations.filter(l => isValidLatLng(l.lat, l.lon)).length} laptops</span>
              <button onClick={() => setMapExpanded(false)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}>
                ✕ Close
              </button>
            </div>
            <div ref={mapRef} style={{ flex: 1 }}/>
          </div>
        )}
      </div>

      {/* ── ANALYTICS VIEW ── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortTh col="name"   label="Employee"/>
                  <th>Asset</th>
                  <SortTh col="online" label="Online today"/>
                  <SortTh col="active" label="Active today ⌨️"/>
                  <th>Efficiency</th>
                  <SortTh col="week"   label="Week online"/>
                  <th>Week active</th>
                  <th>Status</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map(loc => {
                  const eff = loc.efficiency_pct || 0;
                  const effColor = eff >= 70 ? 'var(--green)' : eff >= 40 ? 'var(--amber)' : 'var(--red)';
                  const ac = avatarColor(loc.emp_name || loc.asset_id);
                  return (
                    <tr key={loc.asset_id}>
                      <td>
                        {loc.emp_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: ac.bg, color: ac.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                {getInitials(loc.emp_name)}
                              </div>
                              {loc.is_active && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, background: '#22c55e', borderRadius: '50%', border: '1.5px solid var(--surface)' }}/>}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{loc.emp_name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{loc.department || ''}</div>
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--amber)', fontSize: 12 }}>⚠ Unallocated</span>}
                      </td>
                      <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{loc.asset_id}</span></td>
                      <td>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>{fmtHours(loc.today_online_hours)}</span>
                        {avgTodayH > 0 && <div style={{ fontSize: 10, color: (loc.today_online_hours||0) >= avgTodayH ? 'var(--green)' : 'var(--amber)' }}>{(loc.today_online_hours||0) >= avgTodayH ? '↑ above avg' : '↓ below avg'}</div>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Zap size={10} color={loc.is_active ? '#22c55e' : 'var(--text-muted)'}/>
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: loc.is_active ? '#22c55e' : 'var(--text)' }}>{fmtHours(loc.today_active_hours||0)}</span>
                        </div>
                        {loc.is_active && <div style={{ fontSize: 10, color: '#22c55e' }}>⌨️ Active now</div>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', minWidth: 50 }}>
                            <div style={{ height: '100%', width: `${Math.min(eff, 100)}%`, background: effColor, borderRadius: 4 }}/>
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: effColor, minWidth: 34 }}>{eff}%</span>
                        </div>
                      </td>
                      <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{fmtHours(loc.week_online_hours)}</span></td>
                      <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#22c55e' }}>{fmtHours(loc.week_active_hours||0)}</span></td>
                      <td>
                        <span className={`badge ${loc.is_online ? 'badge-green' : 'badge-red'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          {loc.is_online ? <Wifi size={8}/> : <WifiOff size={8}/>}
                          {loc.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {timeAgo(loc.seconds_ago)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ position: 'sticky', top: 16 }}>
            <AnalyticsPanel locations={locations} avgTodayH={avgTodayH} avgWeekH={avgWeekH} avgActiveH={avgActiveH} fleetEff={fleetEff}/>
          </div>
        </div>
      )}

      {historyId && <HistoryModal assetId={historyId} onClose={() => setHistoryId(null)}/>}
    </div>
  );
}