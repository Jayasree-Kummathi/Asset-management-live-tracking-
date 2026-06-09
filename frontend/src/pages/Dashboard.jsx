import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Package, Send, Wrench, Trash2, TrendingUp, ArrowRight, Activity, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

// Google Material Colors
const GOOGLE_COLORS = {
  blue: '#4285f4',
  green: '#34a853',
  yellow: '#fbbc04',
  red: '#ea4335',
  purple: '#9c27b0',
  teal: '#009688',
  orange: '#ff9800',
};

function getRgb(color) {
  const map = {
    blue: '66, 133, 244',
    green: '52, 168, 83',
    purple: '156, 39, 176',
    amber: '251, 188, 4',
    red: '234, 67, 53',
    teal: '0, 150, 136',
  };
  return map[color] || '66, 133, 244';
}

// ── Stat Card with Alert Support ────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, sub, onClick, alert }) => (
  <div
    className={`stat-card stat-${color} ${alert || ''}`}
    onClick={onClick}
    style={{ cursor: onClick ? 'pointer' : 'default' }}
  >
    <div className="stat-top">
      <div className="stat-icon" style={{ background: `rgba(${getRgb(color)}, 0.12)` }}>
        <Icon size={20} style={{ color: GOOGLE_COLORS[color] || GOOGLE_COLORS.blue }} />
      </div>
      <div className="stat-value">{value}</div>
    </div>
    <div className="stat-label">{label}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Home License Widget ───────────────────────────────────────────────────────
function HomeLicenseWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/licenses/home-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error('HomeLicenseWidget:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="card" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Loading licenses...
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary = {}, licenses = [] } = data;

  return (
    <div className="card" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'rgba(66, 133, 244, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            🔑
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Software Licenses</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              License seat availability across all tools
            </div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Licenses', value: summary.total_licenses ?? 0, color: GOOGLE_COLORS.blue },
          { label: 'Assigned', value: summary.total_assigned ?? 0, color: GOOGLE_COLORS.green },
          { label: 'Remaining', value: summary.total_remaining ?? 0, color: (summary.total_remaining ?? 0) === 0 ? GOOGLE_COLORS.red : GOOGLE_COLORS.yellow },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {licenses.length === 0 ? (
        <div className="empty-state" style={{ padding: '16px 0' }}>
          <span style={{ fontSize: 28 }}>🔑</span>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 13 }}>No licenses configured yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {licenses.map(lic => {
            const assigned = parseInt(lic.assigned_count) || 0;
            const total = parseInt(lic.total_seats) || 0;
            const pct = total > 0 ? Math.min(100, Math.round((assigned / total) * 100)) : 0;
            const isFull = total > 0 && assigned >= total;
            const barColor = isFull ? GOOGLE_COLORS.red : pct > 80 ? GOOGLE_COLORS.yellow : GOOGLE_COLORS.green;

            return (
              <div key={lic.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: (lic.color || GOOGLE_COLORS.blue) + '20', border: `1.5px solid ${(lic.color || GOOGLE_COLORS.blue)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                  {lic.icon || '🔑'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lic.name}</span>
                    <span style={{ color: isFull ? GOOGLE_COLORS.red : 'var(--text-muted)', fontSize: 12, flexShrink: 0, marginLeft: 8 }}>
                      {assigned} / {total > 0 ? total : '∞'}
                      {isFull && <span style={{ fontSize: 10, background: 'rgba(234, 67, 53, 0.15)', color: GOOGLE_COLORS.red, padding: '1px 6px', borderRadius: 10, fontWeight: 700, marginLeft: 6 }}>Full</span>}
                    </span>
                  </div>
                  {total > 0 && (
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Recent Received Laptops Widget ────────────────────────────────────────────
function RecentReceiveWidget() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/allocations?status=Returned&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const all = json.data || [];
      const sorted = all.filter(a => a.status === 'Returned').sort((a, b) => new Date(b.return_date || b.created_at || 0) - new Date(a.return_date || a.created_at || 0)).slice(0, 5);
      setRows(sorted);
    } catch (e) {
      console.error('RecentReceiveWidget:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const conditionBadge = (notes = '') => {
    const n = notes.toLowerCase();
    if (n.includes('repair')) return { label: 'Sent to Repair', bg: 'rgba(251, 188, 4, 0.12)', color: GOOGLE_COLORS.yellow };
    if (n.includes('scrap')) return { label: 'Scrapped', bg: 'rgba(234, 67, 53, 0.12)', color: GOOGLE_COLORS.red };
    return { label: 'Back in Stock', bg: 'rgba(52, 168, 83, 0.12)', color: GOOGLE_COLORS.green };
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date)) return '—';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-CA');
  };

  const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="card" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(52, 168, 83, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📥</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Recent Received Laptops</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Latest laptop returns processed by IT</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rows.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'rgba(52, 168, 83, 0.12)', color: GOOGLE_COLORS.green, border: '1px solid rgba(52, 168, 83, 0.25)' }}>{rows.length} recent return{rows.length !== 1 ? 's' : ''}</span>}
          <button className="btn btn-secondary btn-sm" onClick={load} title="Refresh"><RefreshCw size={13} /></button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-muted)' }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}><span style={{ fontSize: 36 }}>📭</span><p style={{ color: 'var(--text-muted)', marginTop: 10, fontSize: 13 }}>No laptop returns recorded yet</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((item, idx) => {
            const badge = conditionBadge(item.notes || '');
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: 'rgba(52, 168, 83, 0.12)', color: GOOGLE_COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💻</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>{item.asset_id}{(item.brand || item.model) && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>· {[item.brand, item.model].filter(Boolean).join(' ')}</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6 }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(66, 133, 244, 0.15)', color: GOOGLE_COLORS.blue, fontSize: 9, fontWeight: 700 }}>{initials(item.emp_name)}</span>{item.emp_name}</span>
                    {item.emp_id && <span style={{ fontFamily: 'var(--mono)', color: GOOGLE_COLORS.blue, fontWeight: 700, fontSize: 10 }}>{item.emp_id}</span>}
                    {item.department && <span style={{ marginLeft: 4 }}>· {item.department}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`, fontWeight: 600, display: 'inline-block' }}>{badge.label}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{fmtDate(item.return_date)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Pending Laptop Widget ─────────────────────────────────────────────────────
function PendingLaptopWidget() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/employees/deleted`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const all = json.data || [];
      setRows(all.filter(e => !e.laptop_status || e.laptop_status === 'pending'));
    } catch (e) {
      console.error('PendingLaptopWidget:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markResolved = async (empId, empName, status) => {
  const labelMap = { collected: 'Collected', client_return: 'Client Return', no_laptop: 'No Laptop' };
  if (!window.confirm(`Mark laptop as "${labelMap[status]}" for ${empName}? This will remove them from the pending list.`)) return;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/employees/${empId}/laptop-status`, {  // ← fixed URL
      method: 'PUT',                                                        // ← fixed method
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ laptop_status: status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Update failed');
    load();
  } catch (e) {
    console.error('markResolved error:', e);
    alert('Update failed: ' + e.message);
  }
};

  const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="card" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: rows.length > 0 ? 'rgba(251, 188, 4, 0.12)' : 'rgba(52, 168, 83, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💻</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Pending Laptop Returns</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Exited employees where laptop handover is unresolved</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rows.length > 0 ? <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'rgba(251, 188, 4, 0.12)', color: GOOGLE_COLORS.yellow, border: '1px solid rgba(251, 188, 4, 0.3)' }}>⚠ {rows.length} pending</span> : <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'rgba(52, 168, 83, 0.12)', color: GOOGLE_COLORS.green, border: '1px solid rgba(52, 168, 83, 0.25)' }}>✓ All clear</span>}
          <button className="btn btn-secondary btn-sm" onClick={load} title="Refresh"><RefreshCw size={13} /></button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-muted)' }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}><span style={{ fontSize: 36 }}>✅</span><p style={{ color: 'var(--text-muted)', marginTop: 10, fontSize: 13 }}>All laptop handovers are complete — nothing pending</p></div>
      ) : (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: GOOGLE_COLORS.yellow, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>⚠ Awaiting return — {rows.length} employee{rows.length !== 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((emp, idx) => (
              <div key={emp.emp_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'rgba(251, 188, 4, 0.12)', color: GOOGLE_COLORS.yellow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{initials(emp.emp_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.emp_name}<span style={{ marginLeft: 7, fontSize: 11, fontFamily: 'var(--mono)', color: GOOGLE_COLORS.blue, fontWeight: 700 }}>{emp.emp_id}</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{[emp.designation, emp.location, emp.deleted_at_fmt ? `exited ${emp.deleted_at_fmt}` : null].filter(Boolean).join(' · ')}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, flexShrink: 0, background: 'rgba(251, 188, 4, 0.12)', color: GOOGLE_COLORS.yellow, border: '1px solid rgba(251, 188, 4, 0.25)', fontWeight: 600 }}>Pending</span>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => markResolved(emp.emp_id, emp.emp_name, 'collected')}>✅ Collected</button>
                  <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => markResolved(emp.emp_id, emp.emp_name, 'client_return')}>🏢 Client</button>
                  <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => markResolved(emp.emp_id, emp.emp_name, 'no_laptop')}>❌ No laptop</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { assets, allocations, repairs, scraps, stats } = useApp();
  const navigate = useNavigate();

  // Stats for the 5 main cards
  const totalAssets = stats.total || 0;
  const allocated = stats.allocated || 0;
  const inStock = stats.stock || 0;
  const underRepair = stats.repair || 0;
  const scrapped = stats.scrap || 0;

  // Alert conditions for blinking effects
  const lowStockAlert = inStock > 0 && inStock < 5;
  const hasAllocated = allocated > 0;
  const hasRepair = underRepair > 0;
  const hasScrap = scrapped > 0;

  const pieData = [
    { name: 'Stock', value: inStock, color: GOOGLE_COLORS.green },
    { name: 'Allocated', value: allocated, color: GOOGLE_COLORS.blue },
    { name: 'Repair', value: underRepair, color: GOOGLE_COLORS.yellow },
    { name: 'Scrap', value: scrapped, color: GOOGLE_COLORS.red },
  ].filter(d => d.value > 0);

  const barData = [
    { name: 'Stock', count: inStock, color: GOOGLE_COLORS.green },
    { name: 'Allocated', count: allocated, color: GOOGLE_COLORS.blue },
    { name: 'Repair', count: underRepair, color: GOOGLE_COLORS.yellow },
    { name: 'Scrap', count: scrapped, color: GOOGLE_COLORS.red },
  ];

  const recentAllocs = allocations.filter(a => a.status === 'Active').slice(0, 4);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Asset management summary for your organization</p>
      </div>

      {/* 5 Main Stats Cards with Alert Animations */}
      <div className="stats-grid">
        <StatCard
          label="TOTAL ASSETS"
          value={totalAssets}
          icon={Package}
          color="blue"
          sub="All assets in system"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          label="ALLOCATED"
          value={allocated}
          icon={Send}
          color="purple"
          sub="Currently with employees"
          onClick={() => navigate('/allocation-list')}
          alert={hasAllocated ? 'stat-card-alert-purple' : ''}
        />
        <StatCard
          label="IN STOCK"
          value={inStock}
          icon={TrendingUp}
          color="green"
          sub={lowStockAlert ? '⚠️ Low stock - replenish soon' : 'Ready to allocate'}
          onClick={() => navigate('/inventory')}
          alert={lowStockAlert ? 'stat-card-alert-green blink-fast' : ''}
        />
        <StatCard
          label="UNDER REPAIR"
          value={underRepair}
          icon={Wrench}
          color="amber"
          sub={hasRepair ? '⚠️ Awaiting service' : 'No assets in repair'}
          onClick={() => navigate('/repair')}
          alert={hasRepair ? 'stat-card-alert-amber' : ''}
        />
        <StatCard
          label="SCRAPPED"
          value={scrapped}
          icon={Trash2}
          color="red"
          sub="End of life"
          onClick={() => navigate('/scrap')}
          alert={hasScrap ? 'stat-card-alert-red' : ''}
        />
      </div>

      {/* Main grid */}
      <div className="dashboard-grid">
        <HomeLicenseWidget />
        <RecentReceiveWidget />
        <PendingLaptopWidget />

        {/* Bar Chart */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 20 }}>Asset Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={40}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 20 }}>Asset Breakdown</div>
          <div className="pie-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={75}
                  dataKey="value" paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={(value) => [`${value} assets`, 'Count']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {pieData.map((d) => (
                <div key={d.name} className="pie-legend-item">
                  <span className="pie-dot" style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <span className="pie-count">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Allocations */}
        <div className="card dashboard-recent">
          <div className="section-title-row">
            <div className="section-title" style={{ marginBottom: 0 }}>Recent Allocations</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/allocation-list')}>
              View All <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            {recentAllocs.length === 0 ? (
              <div className="empty-state"><Activity size={32} /><p>No active allocations</p></div>
            ) : (
              recentAllocs.map(a => (
                <div key={a.id} className="recent-row">
                  <div className="recent-avatar">{a.empName?.[0] || a.emp_name?.[0] || '?'}</div>
                  <div className="recent-info">
                    <div className="recent-name">{a.empName || a.emp_name || 'Unknown'}</div>
                    <div className="recent-meta">{a.assetId || a.asset_id} · {a.project || 'No project'}</div>
                  </div>
                  <div className="recent-right">
                    <StatusBadge status={a.status} />
                    <div className="recent-date">
                      {(a.allocationDate || a.allocation_date) ? new Date(a.allocationDate || a.allocation_date).toLocaleDateString('en-CA') : '-'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <div className="section-title">Quick Actions</div>
        <div className="quick-grid">
          {[
            { label: 'Add New Asset', desc: 'Register a new laptop', path: '/inventory', color: 'blue' },
            { label: 'Allocate Laptop', desc: 'Assign to an employee', path: '/allocate', color: 'green' },
            { label: 'Receive Laptop', desc: 'Process returns', path: '/receive', color: 'amber' },
            { label: 'Swap Laptop', desc: 'Replace employee device', path: '/swap', color: 'purple' },
          ].map(q => (
            <div key={q.label} className={`quick-card quick-${q.color}`} onClick={() => navigate(q.path)}>
              <div className="quick-label">{q.label}</div>
              <div className="quick-desc">{q.desc}</div>
              <ArrowRight size={14} className="quick-arrow" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}