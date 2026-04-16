import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertTriangle, Search, Eye, X, Image } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const apiFetch = async (path) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

const statusConfig = {
  pending:  { cls:'badge-amber', icon:Clock,         label:'Pending'  },
  accepted: { cls:'badge-green', icon:CheckCircle,   label:'Accepted' },
  damaged:  { cls:'badge-red',   icon:AlertTriangle, label:'Damaged'  },
};

function DamageViewModal({ record, onClose }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageError, setImageError] = useState({});
  
  let images = [];
  try {
    if (Array.isArray(record.damage_images)) {
      images = record.damage_images;
    } else if (typeof record.damage_images === 'string') {
      images = JSON.parse(record.damage_images || '[]');
    }
  } catch(e) {
    console.error('Failed to parse images:', e);
    images = [];
  }

  // Get full image URL with authentication
  const getFullImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    // If it's already a full URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // If it's base64
    if (imagePath.startsWith('data:image')) {
      return imagePath;
    }
    
    // Remove /api from base URL for static files
    const baseUrl = API.replace('/api', '');
    
    // Handle different path formats
    let cleanPath = imagePath;
    if (cleanPath.startsWith('/uploads/') || cleanPath.startsWith('uploads/')) {
      cleanPath = cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
    } else if (!cleanPath.startsWith('/')) {
      cleanPath = '/uploads/damage/' + cleanPath;
    }
    
    return `${baseUrl}${cleanPath}`;
  };

  // Open image in new tab with authentication
  const openImageInNewTab = async (imageUrl, originalSrc) => {
    if (imageUrl.startsWith('data:image')) {
      // For base64 images, open directly
      const newWindow = window.open();
      newWindow.document.write(`<img src="${imageUrl}" style="max-width:100%; height:auto;" />`);
    } else if (imageUrl.startsWith('blob:')) {
      // If it's already a blob URL
      window.open(imageUrl, '_blank');
    } else {
      // For server images, try to fetch with token first
      const token = localStorage.getItem('token');
      try {
        const response = await fetch(imageUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const newWindow = window.open(blobUrl, '_blank');
        
        if (!newWindow) {
          // Popup blocked, try alternative
          window.location.href = blobUrl;
        }
        
        // Clean up blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch (error) {
        console.error('Failed to load image:', error);
        // Fallback: open with authentication token in URL
        const urlWithToken = `${imageUrl}?token=${encodeURIComponent(token)}`;
        window.open(urlWithToken, '_blank');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Damage Report — {record.asset_id}</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="section-title">Employee</div>
          <div className="info-row"><span className="info-label">Name</span><span className="info-value">{record.emp_name}</span></div>
          <div className="info-row"><span className="info-label">Email</span><span className="info-value">{record.emp_email}</span></div>
          <div className="info-row"><span className="info-label">Asset</span><span className="info-value" style={{ fontFamily:'var(--mono)', color:'var(--red)' }}>{record.asset_id}</span></div>
          <div className="info-row"><span className="info-label">Submitted</span><span className="info-value" style={{ fontFamily:'var(--mono)', fontSize:12 }}>{record.submitted_at?.split('T')[0]}</span></div>

          <div className="section-title" style={{ marginTop:16 }}>Damage Description</div>
          <div style={{ background:'var(--red-bg)', border:'1px solid rgba(248,113,113,.2)', borderRadius:'var(--radius)', padding:'12px 16px', fontSize:14, color:'var(--text)', lineHeight:1.7, marginBottom:16 }}>
            {record.damage_desc || '—'}
          </div>

          {images.length > 0 && (
            <>
              <div className="section-title">
                <Image size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                Damage Photos ({images.length})
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:10 }}>
                {images.map((src, i) => {
                  const fullUrl = getFullImageUrl(src);
                  return (
                    <div 
                      key={i} 
                      style={{ 
                        aspectRatio:'1', 
                        borderRadius:8, 
                        overflow:'hidden', 
                        border:'1px solid var(--border)',
                        background: '#f5f5f5',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onClick={() => openImageInNewTab(fullUrl, src)}
                    >
                      {!imageError[i] ? (
                        <img 
                          src={fullUrl} 
                          alt={`Damage ${i+1}`}
                          style={{ 
                            width:'100%', 
                            height:'100%', 
                            objectFit:'cover',
                            display: 'block'
                          }}
                          onError={() => {
                            setImageError(prev => ({ ...prev, [i]: true }));
                          }}
                        />
                      ) : (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          flexDirection: 'column',
                          color: '#999'
                        }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                          <p style={{ fontSize: '11px', marginTop: '5px' }}>Click to view</p>
                        </div>
                      )}
                      <div style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        background: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        pointerEvents: 'none'
                      }}>
                        🔍 Click to enlarge
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20 }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AcceptanceTracker() {
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('All');
  const [viewRecord,setViewRecord]= useState(null);

  useEffect(() => {
    apiFetch('/acceptance')
      .then(d => { if (d.success) setRecords(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = records.filter(r => {
    const mf = filter === 'All' || r.status === filter;
    const ms = !search || [r.emp_name, r.emp_email, r.asset_id]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return mf && ms;
  });

  const counts = {
    pending:  records.filter(r => r.status === 'pending').length,
    accepted: records.filter(r => r.status === 'accepted').length,
    damaged:  records.filter(r => r.status === 'damaged').length,
  };

  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Acceptance Tracker</h1>
          <p>Track employee laptop acceptance and damage reports</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Sent',     val:records.length,  color:'var(--accent)' },
          { label:'Pending',        val:counts.pending,  color:'var(--amber)'  },
          { label:'Accepted',       val:counts.accepted, color:'var(--green)'  },
          { label:'Damage Reported',val:counts.damaged,  color:'var(--red)'    },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'16px 18px' }}>
            <div style={{ fontSize:24, fontWeight:800, color:s.color, fontFamily:'var(--mono)', marginBottom:4 }}>{s.val}</div>
            <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex:1, maxWidth:340 }}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search employee, asset…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="toggle-group">
          {['All','pending','accepted','damaged'].map(s => (
            <button key={s} className={`toggle-btn ${filter===s?'active':''}`}
              onClick={() => setFilter(s)}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>Asset</th><th>Sent On</th>
              <th>Submitted On</th><th>Status</th><th>Damage</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className="empty-state"><p>Loading…</p></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><CheckCircle size={32}/><p>No records found</p></div></td></tr>
            ) : filtered.map(r => {
              const sc = statusConfig[r.status] || statusConfig.pending;
              const Icon = sc.icon;
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight:600 }}>{r.emp_name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{r.emp_email}</div>
                  </td>
                  <td>
                    <span style={{ fontFamily:'var(--mono)', fontSize:12.5, color:'var(--accent)', fontWeight:700 }}>{r.asset_id}</span>
                    {r.brand && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.brand} {r.model}</div>}
                  </td>
                  <td style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text-muted)' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-CA') : '-'}
                  </td>
                  <td style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text-muted)' }}>
                    {r.submitted_at
                      ? new Date(r.submitted_at).toLocaleDateString('en-CA')
                      : <span style={{ color:'var(--amber)' }}>Not yet</span>
                    }
                  </td>
                  <td>
                    <span className={`badge ${sc.cls}`}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background:'currentColor', display:'inline-block', marginRight:4 }}/>
                      {sc.label}
                    </span>
                  </td>
                  <td>
                    {r.status === 'damaged' ? (
                      <div>
                        <span style={{ color:'var(--red)', fontSize:12.5, fontWeight:600 }}>⚠ Damage reported</span>
                        {Array.isArray(r.damage_images) && r.damage_images.length > 0 && (
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                            {r.damage_images.length} photo(s)
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>
                    )}
                  </td>
                  <td>
                    {r.status === 'damaged' && (
                      <button className="btn btn-sm btn-danger" onClick={() => setViewRecord(r)}>
                        <Eye size={12}/> View Report
                      </button>
                    )}
                    {r.status === 'accepted' && (
                      <span style={{ color:'var(--green)', fontSize:12, fontWeight:600 }}>✓ Confirmed</span>
                    )}
                    {r.status === 'pending' && (
                      <span style={{ color:'var(--amber)', fontSize:12 }}>Awaiting response</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewRecord && <DamageViewModal record={viewRecord} onClose={() => setViewRecord(null)}/>}
    </div>
  );
}