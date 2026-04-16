import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import CCEmailInput from '../components/common/CCEmailInput';
import { Plus, Search, X, Package, CheckCircle, ArrowDownCircle, RefreshCw, Trash2, Laptop } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const ACCESSORY_LIST = [
  'Monitor', 'Keyboard', 'Mouse', 'Webcam', 'External Hard Disk',
  'USB Hub', 'Headset', 'Headphones', 'Docking Station', 'Laptop Stand',
  'Ethernet Cable', 'HDMI Cable', 'Pendrive / USB Drive', 'Printer',
  'Scanner', 'SSD / Storage Upgrade', 'RAM Upgrade', 'Power Strip', 'Other',
];

// ── Allocate Modal ────────────────────────────────────────────────────────────
function AllocateModal({ allocations, assets, stock, onClose, onCreated }) {
  const [empSearch, setEmpSearch] = useState('');
  const [selAlloc,  setSelAlloc]  = useState('');
  const [selStock,  setSelStock]  = useState('');
  const [itemName,  setItemName]  = useState('');
  const [quantity,  setQuantity]  = useState(1);
  const [notes,     setNotes]     = useState('');
  const [ccEmails,  setCCEmails]  = useState([]);
  const [saving,    setSaving]    = useState(false);

  const activeAllocs = allocations.filter(a => a.status === 'Active');
  const filteredAllocs = empSearch
    ? activeAllocs.filter(a =>
        [a.empName, a.empId, a.assetId].some(v => v?.toLowerCase().includes(empSearch.toLowerCase()))
      )
    : activeAllocs;

  const alloc = allocations.find(a => a.id === selAlloc);
  const inStockItems = (stock || []).filter(s => s.quantity > 0);

  const handleStockSelect = (id) => {
    setSelStock(id);
    const item = stock.find(s => s.id === Number(id));
    if (item) setItemName(item.name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!alloc || !itemName) return alert('Select employee and item');
    setSaving(true);
    try {
      await apiFetch('/accessories/allocations', {
        method: 'POST',
        body: JSON.stringify({
          stock_id:   selStock ? Number(selStock) : null,
          item_name:  itemName,
          quantity,
          emp_id:     alloc.empId,
          emp_name:   alloc.empName,
          emp_email:  alloc.empEmail,
          department: alloc.department,
          mobile_no:  alloc.mobileNo || '',
          asset_id:   alloc.assetId,
          notes,
          extra_ccs:  ccEmails,
        }),
      });
      onCreated(); onClose();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Allocate Accessory to Employee</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="section-title">Step 1 — Select Employee</div>
            <div className="form-group">
              <label className="form-label">Search by name / ID / asset</label>
              <input className="form-input" placeholder="Type to search allocated employees…"
                value={empSearch} onChange={e => setEmpSearch(e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Employee Allocation *</label>
              <select className="form-select" required value={selAlloc} onChange={e => setSelAlloc(e.target.value)}>
                <option value="">-- Select employee --</option>
                {filteredAllocs.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.empName} ({a.empId}) — Laptop: {a.assetId}
                  </option>
                ))}
              </select>
            </div>

            {alloc && (
              <div style={{ background:'var(--accent-glow)', border:'1px solid var(--accent)22', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:16, fontSize:13 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 20px' }}>
                  <div><span style={{ color:'var(--text-muted)' }}>Name: </span><strong>{alloc.empName}</strong></div>
                  <div><span style={{ color:'var(--text-muted)' }}>ID: </span>{alloc.empId}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>Dept: </span>{alloc.department||'—'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>Asset: </span>
                    <span style={{ fontFamily:'var(--mono)', color:'var(--accent)' }}>{alloc.assetId}</span>
                  </div>
                  <div><span style={{ color:'var(--text-muted)' }}>Project: </span>{alloc.project||'—'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>Email: </span>{alloc.empEmail}</div>
                </div>
              </div>
            )}

            <div className="section-title">Step 2 — Select Accessory</div>
            {inStockItems.length > 0 && (
              <div className="form-group">
                <label className="form-label">From Stock (optional)</label>
                <select className="form-select" value={selStock} onChange={e => handleStockSelect(e.target.value)}>
                  <option value="">-- Select from stock inventory --</option>
                  {inStockItems.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.brand ? `(${s.brand})` : ''} — {s.quantity} in stock
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <select className="form-select" required value={itemName} onChange={e => setItemName(e.target.value)}>
                <option value="">-- Select item --</option>
                {ACCESSORY_LIST.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input type="number" className="form-input" min={1} max={10} value={quantity}
                onChange={e => setQuantity(Number(e.target.value))} style={{ maxWidth:100 }}/>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any notes about this accessory allocation…"/>
            </div>
            <div className="form-group">
              <label className="form-label">CC Emails</label>
              <CCEmailInput ccEmails={ccEmails} onChange={setCCEmails}/>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving||!selAlloc||!itemName}>
                <Package size={14}/> {saving ? 'Allocating…' : 'Allocate + Send Email'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Stock Management Modal ────────────────────────────────────────────────────
function StockModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item || { name:'', brand:'', model:'', serial_no:'', quantity:1, location:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const isEdit = !!item;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/accessories/stock/${item.id}`, { method:'PUT', body: JSON.stringify(form) });
      } else {
        await apiFetch('/accessories/stock', { method:'POST', body: JSON.stringify(form) });
      }
      onSaved(); onClose();
    } catch(err){ alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit' : 'Add'} Stock Item</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSave}>
            <div className="form-grid form-grid-2">
              <div className="form-group"><label className="form-label">Item Name *</label>
                <select className="form-select" required value={form.name} onChange={e=>set('name',e.target.value)}>
                  <option value="">-- Select --</option>
                  {ACCESSORY_LIST.map(i=><option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Quantity</label>
                <input type="number" className="form-input" min={0} value={form.quantity||1} onChange={e=>set('quantity',Number(e.target.value))}/></div>
              <div className="form-group"><label className="form-label">Brand</label>
                <input className="form-input" value={form.brand||''} onChange={e=>set('brand',e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Model</label>
                <input className="form-input" value={form.model||''} onChange={e=>set('model',e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Serial No</label>
                <input className="form-input" value={form.serial_no||''} onChange={e=>set('serial_no',e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Location</label>
                <input className="form-input" value={form.location||''} onChange={e=>set('location',e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : (isEdit ? 'Update' : 'Add to Stock')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccessoryRequests() {
  const { allocations, assets } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab,       setTab]       = useState('allocations');
  const [allocList, setAllocList] = useState([]);
  const [stock,     setStock]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('All');
  const [showAlloc, setShowAlloc] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [editStock, setEditStock] = useState(null);
  const [updating,  setUpdating]  = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        apiFetch('/accessories/allocations'),
        apiFetch('/accessories/stock'),
      ]);
      setAllocList(aRes.data);
      setStock(sRes.data);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleReceive = async (id) => {
    setUpdating(id);
    try {
      await apiFetch(`/accessories/allocations/${id}/receive`, { method:'PUT', body:'{}' });
      fetchAll();
    } catch(e){ alert(e.message); }
    finally { setUpdating(null); }
  };

  const handleReturn = async (id) => {
    if (!window.confirm('Return this accessory to stock?')) return;
    setUpdating(id);
    try {
      await apiFetch(`/accessories/allocations/${id}/return`, { method:'PUT', body:'{}' });
      fetchAll();
    } catch(e){ alert(e.message); }
    finally { setUpdating(null); }
  };

  const handleDeleteStock = async (id) => {
    if (!window.confirm('Delete this stock item?')) return;
    try {
      await apiFetch(`/accessories/stock/${id}`, { method:'DELETE' });
      fetchAll();
    } catch(e){ alert(e.message); }
  };

  // ✅ Check if an accessory was auto-allocated via laptop (notes contains "Allocated with laptop")
  const isLaptopAllocated = (r) =>
    r.notes && r.notes.includes('Allocated with laptop');

  const filteredAllocs = allocList.filter(r => {
    const mf = filter === 'All' || r.status === filter;
    const ms = !search || [r.emp_name, r.emp_id, r.asset_id, r.item_name]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return mf && ms;
  });

  const counts = {
    Allocated: allocList.filter(r => r.status === 'Allocated').length,
    Received:  allocList.filter(r => r.status === 'Received').length,
    Returned:  allocList.filter(r => r.status === 'Returned').length,
  };

  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Accessory Management</h1>
          <p>Allocate monitors, keyboards, webcams and more to employees</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => setShowStock(true)}>
              <Plus size={14}/> Add to Stock
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAlloc(true)}>
            <Package size={14}/> Allocate Accessory
          </button>
        </div>
      </div>

      {/* Tab toggle */}
      <div style={{ display:'flex', gap:0, marginBottom:20, border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden', width:'fit-content' }}>
        {[
          { id:'allocations', label:'Allocation History' },
          { id:'stock',       label:'Stock Inventory' },
        ].map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            className={tab===t.id ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ borderRadius:0, border:'none', minWidth:160 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'allocations' && (
        <>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
            {[
              { label:'Total Allocations', val:allocList.length,   color:'var(--accent)' },
              { label:'Pending Receipt',   val:counts.Allocated,   color:'var(--amber)'  },
              { label:'Received',          val:counts.Received,    color:'var(--green)'  },
              { label:'Returned to Stock', val:counts.Returned,    color:'var(--text-muted)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding:'14px 18px' }}>
                <div style={{ fontSize:22, fontWeight:800, color:s.color, fontFamily:'var(--mono)', marginBottom:4 }}>{s.val}</div>
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="inv-toolbar">
            <div className="search-bar" style={{ flex:1, maxWidth:340 }}>
              <Search size={15}/>
              <input className="form-input" placeholder="Search employee, item, asset…"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="toggle-group">
              {['All','Allocated','Received','Returned'].map(s=>(
                <button key={s} className={`toggle-btn ${filter===s?'active':''}`} onClick={()=>setFilter(s)}>{s}</button>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchAll}><RefreshCw size={13}/></button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th><th>Asset</th><th>Item</th><th>Qty</th>
                  <th>Source</th><th>Allocated By</th><th>Date</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9}><div className="empty-state"><p>Loading…</p></div></td></tr>
                ) : filteredAllocs.length === 0 ? (
                  <tr><td colSpan={9}><div className="empty-state"><Package size={28}/><p>No allocations found</p></div></td></tr>
                ) : filteredAllocs.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight:600 }}>{r.emp_name}</div>
                      <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{r.emp_id} · {r.department||'—'}</div>
                      {r.emp_email && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.emp_email}</div>}
                    </td>
                    <td>
                      <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)', fontWeight:700 }}>{r.asset_id||'—'}</span>
                    </td>
                    <td style={{ fontWeight:600, fontSize:13 }}>{r.item_name}</td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:13 }}>{r.quantity}</td>

                    {/* ✅ Source column — shows if auto-allocated with laptop */}
                    <td>
                      {isLaptopAllocated(r) ? (
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          fontSize:11, padding:'2px 8px', borderRadius:20,
                          background:'var(--accent-glow)', color:'var(--accent)',
                          fontWeight:600,
                        }}>
                          <Laptop size={10}/> With Laptop
                        </span>
                      ) : (
                        <span style={{
                          fontSize:11, padding:'2px 8px', borderRadius:20,
                          background:'var(--surface2)', color:'var(--text-muted)',
                          fontWeight:600,
                        }}>
                          Manual
                        </span>
                      )}
                    </td>

                    <td style={{ fontSize:12.5 }}>{r.allocated_by}</td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:11.5, color:'var(--text-muted)' }}>
                      {(r.allocation_date || r.created_at)?.split('T')[0]}
                    </td>
                    <td>
                      <span className={`badge ${
                        r.status==='Received' ? 'badge-green' :
                        r.status==='Returned' ? 'badge-blue'  : 'badge-amber'
                      }`}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:'currentColor', display:'inline-block', marginRight:4 }}/>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        {/* ✅ Laptop-allocated accessories auto-return — no manual Received button needed */}
                        {r.status === 'Allocated' && !isLaptopAllocated(r) && (
                          <button className="btn btn-sm btn-success" disabled={updating===r.id}
                            onClick={() => handleReceive(r.id)}>
                            <CheckCircle size={12}/> Received
                          </button>
                        )}
                        {r.status === 'Allocated' && isLaptopAllocated(r) && (
                          <span style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>
                            Auto on laptop return
                          </span>
                        )}
                        {r.status === 'Received' && isAdmin && (
                          <button className="btn btn-sm btn-secondary" disabled={updating===r.id}
                            onClick={() => handleReturn(r.id)}>
                            <ArrowDownCircle size={12}/> Return to Stock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'stock' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th><th>Brand</th><th>Model</th><th>Serial No</th>
                <th>Qty</th><th>Location</th><th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {stock.length === 0 ? (
                <tr><td colSpan={isAdmin?8:7}>
                  <div className="empty-state"><Package size={28}/><p>No stock items. Add items above.</p></div>
                </td></tr>
              ) : stock.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight:600 }}>{s.name}</td>
                  <td style={{ fontSize:12.5 }}>{s.brand||'—'}</td>
                  <td style={{ fontSize:12.5 }}>{s.model||'—'}</td>
                  <td style={{ fontFamily:'var(--mono)', fontSize:11.5 }}>{s.serial_no||'—'}</td>
                  <td>
                    <span style={{
                      fontFamily:'var(--mono)', fontWeight:700, fontSize:14,
                      color: s.quantity === 0 ? 'var(--red)' : s.quantity < 3 ? 'var(--amber)' : 'var(--green)',
                    }}>{s.quantity}</span>
                  </td>
                  <td style={{ fontSize:12.5 }}>{s.location||'—'}</td>
                  <td>
                    <span className={`badge ${s.quantity===0?'badge-red':s.quantity<3?'badge-amber':'badge-green'}`}>
                      {s.quantity === 0 ? 'Out of Stock' : s.quantity < 3 ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditStock(s)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteStock(s.id)}>
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAlloc && (
        <AllocateModal
          allocations={allocations} assets={assets} stock={stock}
          onClose={() => setShowAlloc(false)} onCreated={fetchAll}
        />
      )}
      {showStock && <StockModal onClose={() => setShowStock(false)} onSaved={fetchAll}/>}
      {editStock && <StockModal item={editStock} onClose={() => setEditStock(null)} onSaved={fetchAll}/>}
    </div>
  );
}