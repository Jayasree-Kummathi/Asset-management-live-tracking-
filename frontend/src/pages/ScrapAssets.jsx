import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Trash2, Search, X, Edit2, Plus } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const apiFetch = async (path, opts={}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, ...opts
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

// ── Manual Scrap Modal ────────────────────────────────────────────────────────
function AddScrapModal({ assets, onClose, onSaved }) {
  const [assetId, setAssetId] = useState('');
  const [reason,  setReason]  = useState('');
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);

  const availableAssets = assets.filter(a => a.status !== 'Allocated' && a.status !== 'Scrap');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/scraps', { method:'POST', body: JSON.stringify({ asset_id: assetId, reason, notes }) });
      onSaved(); onClose();
    } catch(err){ alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Scrap an Asset</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Select Asset *</label>
              <select className="form-select" required value={assetId} onChange={e=>setAssetId(e.target.value)}>
                <option value="">-- Choose asset --</option>
                {availableAssets.map(a=>(
                  <option key={a.id} value={a.id}>{a.id} — {a.brand} {a.model} ({a.status})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reason for Scrapping *</label>
              <textarea className="form-textarea" required value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Motherboard failure — beyond economical repair"/>
            </div>
            <div className="form-group">
              <label className="form-label">Additional Notes</label>
              <textarea className="form-textarea" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any additional details…"/>
            </div>
            <div style={{padding:'10px 14px',background:'var(--red-bg)',border:'1px solid rgba(248,113,113,.2)',borderRadius:'var(--radius)',fontSize:13,color:'var(--red)',marginBottom:16}}>
              <strong>Warning:</strong> This will permanently mark the asset as Scrap and remove it from active inventory.
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={saving}>
                <Trash2 size={14}/> {saving?'Scrapping…':'Confirm Scrap'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ScrapAssets() {
  const { scraps, assets, refetch } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search,     setSearch]     = useState('');
  const [showAdd,    setShowAdd]    = useState(false);
  const [deleteConf, setDeleteConf] = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  const filtered = scraps.filter(s =>
    !search || [s.assetId, s.serial, s.model, s.reason, s.brand]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const getAsset = id => assets.find(a => a.id === id);

  const handleDelete = async () => {
    if (!deleteConf) return;
    setDeleting(true);
    try {
      // Delete scrap record and reset asset status
      await apiFetch(`/scraps/${deleteConf.dbId}`, { method:'DELETE' });
      setDeleteConf(null);
      refetch();
    } catch(err){ alert(err.message); }
    finally { setDeleting(false); }
  };

  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Scrap Assets</h1>
          <p>End-of-life laptops removed from active inventory</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{padding:'8px 14px',background:'var(--red-bg)',border:'1px solid rgba(248,113,113,.2)',borderRadius:'var(--radius)',fontSize:13,color:'var(--red)',fontWeight:600}}>
            <Trash2 size={14} style={{display:'inline',marginRight:6}}/>
            {scraps.length} Scrapped
          </div>
          {isAdmin && (
            <button className="btn btn-danger" onClick={()=>setShowAdd(true)}>
              <Plus size={14}/> Scrap Asset
            </button>
          )}
        </div>
      </div>

      <div className="inv-toolbar">
        <div className="search-bar" style={{flex:1,maxWidth:340}}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search asset, model, reason…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scrap ID</th><th>Asset No</th><th>Serial</th>
              <th>Model</th><th>Scrap Date</th><th>Reason</th><th>Approved By</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0 ? (
              <tr><td colSpan={isAdmin?8:7}><div className="empty-state"><Trash2 size={32}/><p>No scrap records found</p></div></td></tr>
            ) : filtered.map(s => {
              const asset = getAsset(s.assetId);
              return (
                <tr key={s.id}>
                  <td><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--text-muted)'}}>{s.id}</span></td>
                  <td><span style={{fontFamily:'var(--mono)',fontSize:12.5,color:'var(--red)',fontWeight:700}}>{s.assetId}</span></td>
                  <td><span style={{fontFamily:'var(--mono)',fontSize:12}}>{s.serial||asset?.serial||'—'}</span></td>
                  <td style={{fontSize:12.5,color:'var(--text-dim)'}}>{asset?.brand||s.brand||'—'} {s.model||asset?.model||''}</td>
                  <td style={{fontFamily:'var(--mono)',fontSize:12}}>{s.scrapDate}</td>
                  <td style={{fontSize:13,maxWidth:200,color:'var(--text-dim)'}}>{s.reason}</td>
                  <td style={{fontSize:12.5}}>{s.approvedBy}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={()=>setDeleteConf(s)}>
                        <Trash2 size={12}/> Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && <AddScrapModal assets={assets} onClose={()=>setShowAdd(false)} onSaved={refetch}/>}

      {deleteConf && (
        <div className="modal-overlay" onClick={()=>setDeleteConf(null)}>
          <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Scrap Record</h2>
              <button className="btn btn-icon" onClick={()=>setDeleteConf(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div style={{padding:'14px 16px',background:'var(--red-bg)',border:'1px solid rgba(248,113,113,.2)',borderRadius:'var(--radius)',marginBottom:20}}>
                <div style={{fontWeight:600,color:'var(--red)',marginBottom:4}}>Delete scrap record {deleteConf.id}?</div>
                <div style={{fontSize:13,color:'var(--text-muted)'}}>
                  Asset <strong>{deleteConf.assetId}</strong> will be restored to Stock status.
                </div>
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button className="btn btn-secondary" onClick={()=>setDeleteConf(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  <Trash2 size={14}/> {deleting?'Deleting…':'Delete & Restore to Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
