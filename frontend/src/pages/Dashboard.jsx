import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Package, Send, Wrench, Trash2, TrendingUp, ArrowRight, Activity, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

const COLORS = ['#34d399', '#4f8ef7', '#fbbf24', '#f87171'];
const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color, sub, onClick, alert }) => (
  <div
    className={`stat-card stat-${color} ${alert || ''}`}
    onClick={onClick}
    style={{ cursor: onClick ? 'pointer' : 'default' }}
  >
    <div className="stat-top">
      <div className="stat-icon"><Icon size={18} /></div>
      <div className="stat-value">{value}</div>
    </div>
    <div className="stat-label">{label}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

// ── Home License Widget ───────────────────────────────────────────────────────
function HomeLicenseWidget() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/licenses/home-stats`, {
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
          Loading…
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary = {}, licenses = [] } = data;

  return (
    <div className="card" style={{ gridColumn: 'span 2', marginBottom: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'rgba(99,102,241,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            🔑
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Home Licenses</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Software license seat availability across all tools
            </div>
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={load}
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Summary count row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Licenses', value: summary.total_licenses ?? 0,  color: '#6366f1' },
          { label: 'Assigned',       value: summary.total_assigned  ?? 0,  color: '#34d399' },
          {
            label: 'Remaining',
            value: summary.total_remaining ?? 0,
            color: (summary.total_remaining ?? 0) === 0 ? '#f87171' : '#fbbf24',
          },
        ].map(s => (
          <div
            key={s.label}
            style={{
              flex: 1,
              background: 'var(--surface2)',
              borderRadius: 8,
              padding: '10px 12px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Per-license breakdown */}
      {licenses.length === 0 ? (
        <div className="empty-state" style={{ padding: '16px 0' }}>
          <span style={{ fontSize: 28 }}>🔑</span>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 13 }}>
            No licenses configured yet
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {licenses.map(lic => {
            const assigned = parseInt(lic.assigned_count) || 0;
            const total    = parseInt(lic.total_seats)    || 0;
            const pct      = total > 0 ? Math.min(100, Math.round((assigned / total) * 100)) : 0;
            const isFull   = total > 0 && assigned >= total;
            const barColor = isFull ? '#f87171' : pct > 80 ? '#fbbf24' : '#34d399';

            return (
              <div key={lic.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                  background: (lic.color || '#6366f1') + '20',
                  border: `1.5px solid ${(lic.color || '#6366f1')}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                }}>
                  {lic.icon || '🔑'}
                </div>

                {/* Name + bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, marginBottom: 4, alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lic.name}
                    </span>
                    <span style={{
                      color: isFull ? '#f87171' : 'var(--text-muted)',
                      fontSize: 12, flexShrink: 0, marginLeft: 8,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      {assigned} / {total > 0 ? total : '∞'}
                      {isFull && (
                        <span style={{
                          fontSize: 10, background: 'rgba(248,113,113,0.15)',
                          color: '#f87171', padding: '1px 6px',
                          borderRadius: 10, fontWeight: 700,
                        }}>
                          Full
                        </span>
                      )}
                    </span>
                  </div>
                  {total > 0 && (
                    <div style={{
                      height: 5, background: 'var(--border)',
                      borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: barColor, borderRadius: 3,
                        transition: 'width 0.4s ease',
                      }} />
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
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Fetch recent returned allocations — up to 20, then slice to the 5 most recent
      const res  = await fetch(`${API}/allocations?status=Returned&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      // allocationController returns { success, data: [...] }
      const all = json.data || [];

      // Sort by return_date desc (most recent first), take top 5
      const sorted = all
        .filter(a => a.status === 'Returned')
        .sort((a, b) => {
          const da = new Date(a.return_date || a.created_at || 0);
          const db = new Date(b.return_date || b.created_at || 0);
          return db - da;
        })
        .slice(0, 5);

      setRows(sorted);
    } catch (e) {
      console.error('RecentReceiveWidget:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derive a readable label + style for each row's asset new status
  // allocationController sets asset to Stock / Repair / Scrap on receive
  const conditionBadge = (notes = '') => {
    const n = notes.toLowerCase();
    if (n.includes('repair'))  return { label: 'Sent to Repair', bg: 'rgba(251,191,36,0.12)',  color: '#b45309' };
    if (n.includes('scrap'))   return { label: 'Scrapped',       bg: 'rgba(248,113,113,0.12)', color: '#b91c1c' };
    return                            { label: 'Back in Stock',  bg: 'rgba(34,197,94,0.12)',   color: '#166534' };
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date)) return '—';
    const today    = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString())     return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD
  };

  const initials = (name) =>
    (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="card" style={{ gridColumn: 'span 2', marginBottom: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'rgba(34,197,94,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            📥
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Recent Received Laptops</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Latest laptop returns processed by IT
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rows.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
              background: 'rgba(34,197,94,0.1)', color: '#166534',
              border: '1px solid rgba(34,197,94,0.25)',
            }}>
              {rows.length} recent return{rows.length !== 1 ? 's' : ''}
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={load} title="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Loading…
        </div>

      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <span style={{ fontSize: 36 }}>📭</span>
          <p style={{ color: 'var(--text-muted)', marginTop: 10, fontSize: 13 }}>
            No laptop returns recorded yet
          </p>
        </div>

      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((item, idx) => {
            const badge = conditionBadge(item.notes || '');
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Laptop icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                  background: 'rgba(34,197,94,0.1)', color: '#166534',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>
                  💻
                </div>

                {/* Asset + employee info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item.asset_id}
                    {(item.brand || item.model) && (
                      <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>
                        · {[item.brand, item.model].filter(Boolean).join(' ')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      marginRight: 6,
                    }}>
                      {/* Employee avatar inline */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'rgba(99,102,241,0.15)', color: '#6366f1',
                        fontSize: 9, fontWeight: 700,
                      }}>
                        {initials(item.emp_name)}
                      </span>
                      {item.emp_name}
                    </span>
                    {item.emp_id && (
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700, fontSize: 10 }}>
                        {item.emp_id}
                      </span>
                    )}
                    {item.department && (
                      <span style={{ marginLeft: 4 }}>· {item.department}</span>
                    )}
                  </div>
                </div>

                {/* Badge + date */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 20,
                    background: badge.bg, color: badge.color,
                    border: `1px solid ${badge.color}30`, fontWeight: 600,
                    display: 'inline-block',
                  }}>
                    {badge.label}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {fmtDate(item.return_date)}
                  </div>
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
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/employees/deleted`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const all  = json.data || [];
      setRows(all.filter(e => !e.laptop_status || e.laptop_status === 'pending'));
    } catch (e) {
      console.error('PendingLaptopWidget:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markResolved = async (empId, empName, status) => {
    const labelMap = {
      collected:     'Collected',
      client_return: 'Client Return',
      no_laptop:     'No Laptop',
    };
    if (!window.confirm(`Mark laptop as "${labelMap[status]}" for ${empName}?\nThis will remove them from the pending list.`)) return;
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/employees/deleted/${empId}/laptop-status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ laptop_status: status }),
      });
      if (!res.ok) throw new Error('Request failed');
      load();
    } catch (e) {
      alert('Update failed — check console.');
      console.error(e);
    }
  };

  const initials = (name) =>
    (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="card" style={{ gridColumn: 'span 2', marginBottom: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: rows.length > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            💻
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Pending Laptop Returns</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Exited employees where laptop handover is unresolved
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rows.length > 0 ? (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
              background: 'rgba(245,158,11,0.12)', color: '#b45309',
              border: '1px solid rgba(245,158,11,0.3)',
            }}>
              ⚠ {rows.length} pending
            </span>
          ) : (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
              background: 'rgba(34,197,94,0.1)', color: '#166534',
              border: '1px solid rgba(34,197,94,0.25)',
            }}>
              ✓ All clear
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={load} title="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Loading…
        </div>

      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <span style={{ fontSize: 36 }}>✅</span>
          <p style={{ color: 'var(--text-muted)', marginTop: 10, fontSize: 13 }}>
            All laptop handovers are complete — nothing pending
          </p>
        </div>

      ) : (
        <>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#b45309',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
          }}>
            ⚠ Awaiting return — {rows.length} employee{rows.length !== 1 ? 's' : ''}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((emp, idx) => (
              <div key={emp.emp_id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none',
              }}>

                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(245,158,11,0.12)', color: '#b45309',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12,
                }}>
                  {initials(emp.emp_name)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {emp.emp_name}
                    <span style={{
                      marginLeft: 7, fontSize: 11,
                      fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700,
                    }}>
                      {emp.emp_id}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[
                      emp.designation,
                      emp.location,
                      emp.deleted_at_fmt ? `exited ${emp.deleted_at_fmt}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>

                {/* Pending badge */}
                <span style={{
                  fontSize: 11, padding: '2px 10px', borderRadius: 20, flexShrink: 0,
                  background: 'rgba(245,158,11,0.1)', color: '#b45309',
                  border: '1px solid rgba(245,158,11,0.25)', fontWeight: 600,
                }}>
                  Pending
                </span>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: 11 }}
                    onClick={() => markResolved(emp.emp_id, emp.emp_name, 'collected')}
                    title="Laptop collected from employee"
                  >
                    ✅ Collected
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: 11 }}
                    onClick={() => markResolved(emp.emp_id, emp.emp_name, 'client_return')}
                    title="Client-owned laptop, returned to client"
                  >
                    🏢 Client
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: 11 }}
                    onClick={() => markResolved(emp.emp_id, emp.emp_name, 'no_laptop')}
                    title="No laptop was assigned to this employee"
                  >
                    ❌ No laptop
                  </button>
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

  const lowStockAlert = stats.stock > 0 && stats.stock < 5;
  const hasAllocated  = stats.allocated > 0;
  const hasRepair     = stats.repair > 0;
  const hasScrap      = stats.scrap > 0;

  const pieData = [
    { name: 'Stock',     value: stats.stock,    color: COLORS[0] },
    { name: 'Allocated', value: stats.allocated, color: COLORS[1] },
    { name: 'Repair',    value: stats.repair,    color: COLORS[2] },
    { name: 'Scrap',     value: stats.scrap,     color: COLORS[3] },
  ].filter(d => d.value > 0);

  const barData = [
    { name: 'Stock',     count: stats.stock,    color: COLORS[0] },
    { name: 'Allocated', count: stats.allocated, color: COLORS[1] },
    { name: 'Repair',    count: stats.repair,    color: COLORS[2] },
    { name: 'Scrap',     count: stats.scrap,     color: COLORS[3] },
  ];

  const recentAllocs = allocations.filter(a => a.status === 'Active').slice(0, 4);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Overview</h1>
        <p>Asset management summary for your organization</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          label="Total Assets" value={stats.total} icon={Package} color="blue"
          sub="All assets in system" onClick={() => navigate('/inventory')} alert=""
        />
        <StatCard
          label="In Stock" value={stats.stock} icon={TrendingUp} color="green"
          sub={lowStockAlert ? '⚠️ Low stock - replenish soon' : 'Ready to allocate'}
          onClick={() => navigate('/inventory')}
          alert={lowStockAlert ? 'stat-card-alert-green blink-fast' : ''}
        />
        <StatCard
          label="Allocated" value={stats.allocated} icon={Send} color="purple"
          sub="Currently with employees"
          onClick={() => navigate('/allocation-list')}
          alert={hasAllocated ? 'stat-card-alert-blue' : ''}
        />
        <StatCard
          label="Under Repair" value={stats.repair} icon={Wrench} color="amber"
          sub={hasRepair ? '⚠️ Awaiting service' : 'No assets in repair'}
          onClick={() => navigate('/repair')}
          alert={hasRepair ? 'stat-card-alert-amber' : ''}
        />
        <StatCard
          label="Scrapped" value={stats.scrap} icon={Trash2} color="red"
          sub="End of life"
          onClick={() => navigate('/scrap')}
          alert={hasScrap ? 'stat-card-alert-red' : ''}
        />
      </div>

      {/* Main grid */}
      <div className="dashboard-grid">

        {/* Home Licenses */}
        <HomeLicenseWidget />

        {/* Recent Received Laptops */}
        <RecentReceiveWidget />

        {/* Pending Laptop Returns */}
        <PendingLaptopWidget />

        {/* Bar Chart */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 20 }}>Asset Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={32}>
              <XAxis dataKey="name" tick={{ fill: '#e8eaf0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#e8eaf0', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#e2e5f0', border: '1px solid #c0cae3', borderRadius: 8, color: '#e8eaf0', fontSize: 13 }}
                cursor={{ fill: 'rgba(219,209,209,0.03)' }}
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
                  innerRadius={50} outerRadius={80}
                  dataKey="value" paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#6b7490', strokeWidth: 1 }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#eeeef0', border: '1px solid #252a38', borderRadius: 8, color: '#e8eaf0', fontSize: 13 }}
                  formatter={(value) => [`${value} assets`, 'Count']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {pieData.map((d) => (
                <div key={d.name} className="pie-legend-item">
                  <span className="pie-dot" style={{ background: d.color }} />
                  <span style={{ color: '#e8eaf0' }}>{d.name}</span>
                  <span className="pie-count" style={{ color: '#e8eaf0' }}>{d.value}</span>
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
                      {(a.allocationDate || a.allocation_date)
                        ? new Date(a.allocationDate || a.allocation_date).toLocaleDateString('en-CA')
                        : '-'}
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
            { label: 'Add New Asset',   desc: 'Register a new laptop',  path: '/inventory', color: 'blue'   },
            { label: 'Allocate Laptop', desc: 'Assign to an employee',  path: '/allocate',  color: 'green'  },
            { label: 'Receive Laptop',  desc: 'Process returns',         path: '/receive',   color: 'amber'  },
            { label: 'Swap Laptop',     desc: 'Replace employee device', path: '/swap',      color: 'purple' },
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