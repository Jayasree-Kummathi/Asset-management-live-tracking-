import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import { Laptop, Calendar, MapPin, Cpu, Package, User, RefreshCw, Shield } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [allocation, setAllocation] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const fetchMyLaptop = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/allocations/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAllocation(data.data);   // null if no active allocation
      } else {
        setError(data.message || 'Failed to load data');
      }
    } catch (err) {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMyLaptop(); }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'50vh' }}>
      <div style={{ color:'var(--text-muted)', fontSize:14 }}>Loading your dashboard…</div>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(79,142,247,0.12), rgba(124,106,247,0.08))',
        border: '1px solid rgba(79,142,247,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0,
        }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
            {user?.email} &nbsp;·&nbsp;
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Employee Portal</span>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchMyLaptop}>
          <RefreshCw size={13}/> Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding:'14px 18px', background:'var(--red-bg)', border:'1px solid rgba(248,113,113,.2)', borderRadius:'var(--radius)', color:'var(--red)', marginBottom:20, fontSize:14 }}>
          {error}
        </div>
      )}

      {!allocation ? (
        /* No active allocation */
        <div className="card" style={{ textAlign:'center', padding:'60px 40px' }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
            <Package size={28} color="var(--text-muted)"/>
          </div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:10 }}>No Laptop Allocated</h2>
          <p style={{ color:'var(--text-muted)', fontSize:14, maxWidth:380, margin:'0 auto 20px' }}>
            You don't have an active laptop allocation. Please contact your IT team.
          </p>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px', background:'rgba(79,142,247,0.08)', border:'1px solid rgba(79,142,247,0.2)', borderRadius:'var(--radius)', fontSize:13, color:'var(--accent)' }}>
            <Shield size={14}/>
            IT Support: <strong>{process.env.REACT_APP_SYSADMIN_EMAIL || 'sysadmin@mindteck.us'}</strong>
          </div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

          {/* Laptop Card */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'var(--accent-glow)', border:'1px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Laptop size={22} color="var(--accent)"/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:16, fontWeight:800, color:'var(--accent)' }}>{allocation.asset_id}</div>
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{allocation.brand} {allocation.model}</div>
              </div>
              <StatusBadge status="Active"/>
            </div>

            <div className="section-title">
              <Cpu size={12} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
              Specifications
            </div>
            <div className="info-row"><span className="info-label">Configuration</span><span className="info-value">{allocation.config||'—'}</span></div>
            <div className="info-row"><span className="info-label">Processor</span><span className="info-value">{allocation.processor||'—'}</span></div>
            <div className="info-row"><span className="info-label">RAM</span><span className="info-value">{allocation.ram||'—'}</span></div>
            <div className="info-row"><span className="info-label">Storage</span><span className="info-value">{allocation.storage||'—'}</span></div>
            <div className="info-row"><span className="info-label">Serial No</span><span className="info-value" style={{ fontFamily:'var(--mono)', fontSize:12 }}>{allocation.serial||'—'}</span></div>
          </div>

          {/* Allocation Info */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card">
              <div className="section-title">
                <Calendar size={12} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                Allocation Details
              </div>
              <div className="info-row"><span className="info-label">Allocated On</span><span className="info-value" style={{ fontFamily:'var(--mono)', fontSize:12 }}>{allocation.allocation_date?.split('T')[0]}</span></div>
              <div className="info-row"><span className="info-label">Department</span><span className="info-value">{allocation.department||'—'}</span></div>
              <div className="info-row"><span className="info-label">Project</span><span className="info-value">{allocation.project||'—'}</span></div>
              <div className="info-row"><span className="info-label">Client</span><span className="info-value">{allocation.client||'—'}</span></div>
              <div className="info-row"><span className="info-label">Accessories</span><span className="info-value">{(allocation.accessories||[]).join(', ')||'None'}</span></div>
            </div>

            <div className="card">
              <div className="section-title">
                <MapPin size={12} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                Warranty
              </div>
              <div className="info-row">
                <span className="info-label">Warranty End</span>
                <span className="info-value" style={{
                  fontFamily:'var(--mono)', fontSize:12,
                  color: allocation.warranty_end && new Date(allocation.warranty_end) < new Date()
                    ? 'var(--red)' : 'var(--green)',
                }}>
                  {allocation.warranty_end?.split('T')[0]||'—'}
                  {allocation.warranty_end && new Date(allocation.warranty_end) < new Date() &&
                    <span style={{ fontSize:10, marginLeft:8, background:'var(--red-bg)', color:'var(--red)', padding:'1px 6px', borderRadius:4 }}>Expired</span>
                  }
                </span>
              </div>
              <div className="info-row"><span className="info-label">Vendor</span><span className="info-value">{allocation.vendor||'—'}</span></div>
            </div>
          </div>

          {/* Contact IT card */}
          <div className="card" style={{ gridColumn:'span 2', background:'rgba(79,142,247,0.04)', border:'1px solid rgba(79,142,247,0.15)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <User size={18} color="var(--accent)"/>
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--accent)', marginBottom:6 }}>Need help with your laptop?</div>
                <div style={{ fontSize:13.5, color:'var(--text-muted)', lineHeight:1.7 }}>
                  For any hardware issues, software problems, or if you need a laptop swap — contact your IT department.
                  Only IT staff can process returns and swaps in the system.
                </div>
                <div style={{ marginTop:10, fontSize:13 }}>
                  <strong style={{ color:'var(--text-dim)' }}>IT Support: </strong>
                  <a href="mailto:sysadmin@mindteck.us" style={{ color:'var(--accent)', textDecoration:'none' }}>sysadmin@mindteck.us</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
