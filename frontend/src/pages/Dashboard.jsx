import React from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Package, Send, Wrench, Trash2, TrendingUp, ArrowRight, Activity } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

const StatCard = ({ label, value, icon: Icon, color, sub, onClick }) => (
  <div className={`stat-card stat-${color}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
    <div className="stat-top">
      <div className="stat-icon"><Icon size={18} /></div>
      <div className="stat-value">{value}</div>
    </div>
    <div className="stat-label">{label}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

const COLORS = ['#34d399', '#4f8ef7', '#fbbf24', '#f87171'];

export default function Dashboard() {
  const { assets, allocations, repairs, scraps, stats } = useApp();
  const navigate = useNavigate();

  const pieData = [
    { name: 'Stock', value: stats.stock },
    { name: 'Allocated', value: stats.allocated },
    { name: 'Repair', value: stats.repair },
    { name: 'Scrap', value: stats.scrap },
  ].filter(d => d.value > 0);

  const barData = [
    { name: 'Stock', count: stats.stock },
    { name: 'Allocated', count: stats.allocated },
    { name: 'Repair', count: stats.repair },
    { name: 'Scrap', count: stats.scrap },
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
        <StatCard label="Total Assets" value={stats.total} icon={Package} color="blue" sub="All assets in system" onClick={() => navigate('/inventory')} />
        <StatCard label="In Stock" value={stats.stock} icon={TrendingUp} color="green" sub="Ready to allocate" onClick={() => navigate('/inventory')} />
        <StatCard label="Allocated" value={stats.allocated} icon={Send} color="purple" sub="Currently with employees" onClick={() => navigate('/allocation-list')} />
        <StatCard label="Under Repair" value={stats.repair} icon={Wrench} color="amber" sub="Awaiting service" onClick={() => navigate('/repair')} />
        <StatCard label="Scrapped" value={stats.scrap} icon={Trash2} color="red" sub="End of life" onClick={() => navigate('/scrap')} />
      </div>

      {/* Charts + Table */}
      <div className="dashboard-grid">
        {/* Bar Chart */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 20 }}>Asset Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={32}>
              <XAxis dataKey="name" tick={{ fill: '#6b7490', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7490', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1c2030', border: '1px solid #252a38', borderRadius: 8, color: '#e8eaf0', fontSize: 13 }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="count" fill="#4f8ef7" radius={[6, 6, 0, 0]}>
                {barData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
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
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1c2030', border: '1px solid #252a38', borderRadius: 8, color: '#e8eaf0', fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {pieData.map((d, i) => (
                <div key={d.name} className="pie-legend-item">
                  <span className="pie-dot" style={{ background: COLORS[i] }} />
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
                  <div className="recent-avatar">{a.empName[0]}</div>
                  <div className="recent-info">
                    <div className="recent-name">{a.empName}</div>
                    <div className="recent-meta">{a.assetId} · {a.project}</div>
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
