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
      // Only show employees where laptop is still pending or not yet recorded
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
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:36, height:36, borderRadius:9,
            background: rows.length > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
          }}>
            💻
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>Pending Laptop Returns</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
              Exited employees where laptop handover is unresolved
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {rows.length > 0 ? (
            <span style={{
              fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:20,
              background:'rgba(245,158,11,0.12)', color:'#b45309',
              border:'1px solid rgba(245,158,11,0.3)',
            }}>
              ⚠ {rows.length} pending
            </span>
          ) : (
            <span style={{
              fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:20,
              background:'rgba(34,197,94,0.1)', color:'#166534',
              border:'1px solid rgba(34,197,94,0.25)',
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
        <div style={{ textAlign:'center', padding:'24px 0', fontSize:13, color:'var(--text-muted)' }}>
          Loading…
        </div>

      ) : rows.length === 0 ? (
        <div className="empty-state" style={{ padding:'24px 0' }}>
          <span style={{ fontSize:36 }}>✅</span>
          <p style={{ color:'var(--text-muted)', marginTop:10, fontSize:13 }}>
            All laptop handovers are complete — nothing pending
          </p>
        </div>

      ) : (
        <>
          <div style={{
            fontSize:11, fontWeight:700, color:'#b45309',
            textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10,
          }}>
            ⚠ Awaiting return — {rows.length} employee{rows.length !== 1 ? 's' : ''}
          </div>

          <div style={{ display:'flex', flexDirection:'column' }}>
            {rows.map((emp, idx) => (
              <div key={emp.emp_id} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'10px 0',
                borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none',
              }}>

                {/* Avatar */}
                <div style={{
                  width:38, height:38, borderRadius:'50%', flexShrink:0,
                  background:'rgba(245,158,11,0.12)', color:'#b45309',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:700, fontSize:12,
                }}>
                  {initials(emp.emp_name)}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>
                    {emp.emp_name}
                    <span style={{
                      marginLeft:7, fontSize:11,
                      fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:700,
                    }}>
                      {emp.emp_id}
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                    {[
                      emp.designation,
                      emp.location,
                      emp.deleted_at_fmt ? `exited ${emp.deleted_at_fmt}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>

                {/* Pending badge */}
                <span style={{
                  fontSize:11, padding:'2px 10px', borderRadius:20, flexShrink:0,
                  background:'rgba(245,158,11,0.1)', color:'#b45309',
                  border:'1px solid rgba(245,158,11,0.25)', fontWeight:600,
                }}>
                  Pending
                </span>

                {/* Action buttons */}
                <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize:11 }}
                    onClick={() => markResolved(emp.emp_id, emp.emp_name, 'collected')}
                    title="Laptop collected from employee"
                  >
                    ✅ Collected
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize:11 }}
                    onClick={() => markResolved(emp.emp_id, emp.emp_name, 'client_return')}
                    title="Client-owned laptop, returned to client"
                  >
                    🏢 Client
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize:11 }}
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

      {/* Charts + Pending Laptop Widget */}
      <div className="dashboard-grid">

        {/* Pending Laptop Returns */}
        <PendingLaptopWidget />

        {/* Bar Chart */}
        <div className="card">
          <div className="section-title" style={{ marginBottom:20 }}>Asset Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={32}>
              <XAxis dataKey="name" tick={{ fill:'#e8eaf0', fontSize:12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#e8eaf0', fontSize:12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background:'#e2e5f0', border:'1px solid #c0cae3', borderRadius:8, color:'#e8eaf0', fontSize:13 }}
                cursor={{ fill:'rgba(219,209,209,0.03)' }}
              />
              <Bar dataKey="count" radius={[6,6,0,0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="card">
          <div className="section-title" style={{ marginBottom:20 }}>Asset Breakdown</div>
          <div className="pie-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  dataKey="value" paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke:'#6b7490', strokeWidth:1 }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background:'#eeeef0', border:'1px solid #252a38', borderRadius:8, color:'#e8eaf0', fontSize:13 }}
                  formatter={(value) => [`${value} assets`, 'Count']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {pieData.map((d) => (
                <div key={d.name} className="pie-legend-item">
                  <span className="pie-dot" style={{ background:d.color }} />
                  <span style={{ color:'#e8eaf0' }}>{d.name}</span>
                  <span className="pie-count" style={{ color:'#e8eaf0' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Allocations */}
        <div className="card dashboard-recent">
          <div className="section-title-row">
            <div className="section-title" style={{ marginBottom:0 }}>Recent Allocations</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/allocation-list')}>
              View All <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ marginTop:16 }}>
            {recentAllocs.length === 0 ? (
              <div className="empty-state"><Activity size={32} /><p>No active allocations</p></div>
            ) : (
              recentAllocs.map(a => (
                <div key={a.id} className="recent-row">
                  <div className="recent-avatar">{a.empName?.[0] || '?'}</div>
                  <div className="recent-info">
                    <div className="recent-name">{a.empName || 'Unknown'}</div>
                    <div className="recent-meta">{a.assetId} · {a.project || 'No project'}</div>
                  </div>
                  <div className="recent-right">
                    <StatusBadge status={a.status} />
                    <div className="recent-date">
                      {a.allocationDate
                        ? new Date(a.allocationDate).toLocaleDateString('en-CA')
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
            { label:'Add New Asset',   desc:'Register a new laptop',  path:'/inventory', color:'blue'   },
            { label:'Allocate Laptop', desc:'Assign to an employee',  path:'/allocate',  color:'green'  },
            { label:'Receive Laptop',  desc:'Process returns',         path:'/receive',   color:'amber'  },
            { label:'Swap Laptop',     desc:'Replace employee device', path:'/swap',      color:'purple' },
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