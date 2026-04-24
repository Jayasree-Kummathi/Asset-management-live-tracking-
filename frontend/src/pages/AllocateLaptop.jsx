import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import CCEmailInput from '../components/common/CCEmailInput';
import {
  Send, CheckSquare, Square, Truck, HandMetal,
  Camera, X, FileText, MapPin, Package, User, ImagePlus, Trash2
} from 'lucide-react';

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

const EMPTY = {
  empId: '', empName: '', empEmail: '', personalEmail: '', mobileNo: '',
  department: '', client: '', project: '',
  allocationDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().split('T')[0],
  deliveryMethod: 'hand',
  deliveryAddress: '',
  photoUrl: '',
  preparedBy: '',        // NEW
};

export default function AllocateLaptop() {
  const { assets, allocateAsset, user } = useApp();
  const location = useLocation();
  const navigate  = useNavigate();
  const fileRef   = useRef();
  const damageRef = useRef();

  const [selectedAsset, setSelectedAsset] = useState('');
  const [form,          setForm]          = useState({ ...EMPTY, preparedBy: user?.name || '' });
  const [accessories,   setAccessories]   = useState([]);
  const [ccEmails,      setCCEmails]      = useState([]);
  const [saving,        setSaving]        = useState(false);
  const [photoPreview,  setPhotoPreview]  = useState('');
  const [damagePhotos,  setDamagePhotos]  = useState([]); // NEW — array of base64

  const [stockItems,    setStockItems]    = useState([]);
  const [stockLoading,  setStockLoading]  = useState(true);

  const stockAssets   = assets.filter(a => a.status === 'Stock');
  const asset         = assets.find(a => a.id === selectedAsset);
  const availableStock = stockItems.filter(s => s.quantity > 0);

  useEffect(() => {
    apiFetch('/accessories/stock')
      .then(res => setStockItems(res.data || []))
      .catch(e => console.error('Stock fetch failed:', e.message))
      .finally(() => setStockLoading(false));
  }, []);

  useEffect(() => {
    if (location.state?.assetId) setSelectedAsset(location.state.assetId);
  }, [location.state]);

  // Pre-fill preparedBy from logged-in user
  useEffect(() => {
    if (user?.name && !form.preparedBy) set('preparedBy', user.name);
  }, [user]);

  const toggleAcc = (stockItem) => {
    setAccessories(prev => {
      const exists = prev.find(a => a.stockId === stockItem.id);
      if (exists) return prev.filter(a => a.stockId !== stockItem.id);
      return [...prev, { stockId: stockItem.id, name: stockItem.name, quantity: 1 }];
    });
  };
  const isSelected = (stockId) => accessories.some(a => a.stockId === stockId);
  const updateQty = (stockId, qty, maxQty) => {
    const clamped = Math.max(1, Math.min(qty, maxQty));
    setAccessories(prev => prev.map(a => a.stockId === stockId ? { ...a, quantity: clamped } : a));
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPhotoPreview(ev.target.result); set('photoUrl', ev.target.result); };
    reader.readAsDataURL(file);
  };

  // ── Damage photos ─────────────────────────────────────────────────────────
  const handleDamagePhotos = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDamagePhotos(prev => prev.length < 6 ? [...prev, ev.target.result] : prev);
      };
      reader.readAsDataURL(file);
    });
    // reset input so same file can be re-selected
    if (damageRef.current) damageRef.current.value = '';
  };
  const removeDamagePhoto = (idx) => setDamagePhotos(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      await allocateAsset(selectedAsset, {
        ...form,
        accessories: accessories.map(a => `${a.name}${a.quantity > 1 ? ` x${a.quantity}` : ''}`),
        accessoryDetails: accessories,
        extra_ccs: ccEmails,
        prepared_by: form.preparedBy,
        damage_photos: JSON.stringify(damagePhotos),
      });
      navigate('/allocation-list');
    } catch (_) { setSaving(false); }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Allocate Laptop</h1>
        <p>Assign a laptop from stock to an employee</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ── LEFT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Select Asset */}
            <div className="card">
              <div className="section-title">Select Asset</div>
              <div className="form-group">
                <label className="form-label">Asset Number *</label>
                <select className="form-select" required value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
                  <option value="">-- Select a laptop --</option>
                  {stockAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.id} — {a.brand} {a.model} ({a.config})</option>
                  ))}
                </select>
              </div>
              {asset && (
                <div style={{ marginTop: 8 }}>
                  {[
                    ['Asset Number', asset.id, 'var(--accent)', 'var(--mono)'],
                    ['Serial Number', asset.serial, null, 'var(--mono)'],
                    ['Brand / Model', `${asset.brand} ${asset.model}`],
                    ['Configuration', asset.config],
                    ['Warranty', `${asset.warrantyStart} → ${asset.warrantyEnd}`],
                  ].map(([label, val, color, font]) => (
                    <div className="info-row" key={label}>
                      <span className="info-label">{label}</span>
                      <span className="info-value" style={{ color, fontFamily: font, fontSize: font ? 12 : undefined }}>{val}</span>
                    </div>
                  ))}
                  <div className="info-row"><span className="info-label">Status</span><StatusBadge status={asset.status}/></div>
                </div>
              )}
            </div>

            {/* Accessories */}
            <div className="card">
              <div className="section-title">
                <Package size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                Accessories Included
                {accessories.length > 0 && (
                  <span style={{ marginLeft:8, fontSize:11, fontWeight:600, color:'var(--green)',
                    background:'var(--green-bg)', padding:'2px 8px', borderRadius:20 }}>
                    {accessories.length} selected
                  </span>
                )}
              </div>
              {stockLoading ? (
                <div style={{ color:'var(--text-muted)', fontSize:13, padding:'8px 0' }}>Loading accessories…</div>
              ) : availableStock.length === 0 ? (
                <div style={{ padding:'14px 16px', background:'var(--surface2)', borderRadius:'var(--radius)',
                  fontSize:13, color:'var(--text-muted)', border:'1px dashed var(--border)', textAlign:'center' }}>
                  <Package size={20} style={{ marginBottom:6, opacity:0.4 }}/><br/>
                  No accessories in stock.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {availableStock.map(item => {
                    const selected = isSelected(item.id);
                    const selItem  = accessories.find(a => a.stockId === item.id);
                    return (
                      <div key={item.id} style={{
                        display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                        borderRadius:'var(--radius)',
                        border:`1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        background: selected ? 'var(--accent-glow)' : 'var(--surface2)',
                        cursor:'pointer', transition:'all .2s',
                      }} onClick={() => toggleAcc(item)}>
                        <div style={{ flexShrink:0 }}>
                          {selected ? <CheckSquare size={16} color="var(--accent)"/> : <Square size={16} style={{ opacity:0.4 }}/>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:13, color: selected ? 'var(--accent)' : 'var(--text)' }}>
                            {item.name}
                            {item.brand && <span style={{ fontWeight:400, color:'var(--text-muted)', marginLeft:6 }}>{item.brand}</span>}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                            {item.quantity} in stock{item.location && ` · ${item.location}`}
                          </div>
                        </div>
                        {selected && (
                          <div style={{ display:'flex', alignItems:'center', gap:6 }} onClick={e => e.stopPropagation()}>
                            <button type="button" className="btn btn-icon" style={{ width:24, height:24, fontSize:16 }}
                              onClick={() => updateQty(item.id, (selItem?.quantity||1) - 1, item.quantity)}>−</button>
                            <span style={{ fontFamily:'var(--mono)', fontWeight:700, minWidth:20, textAlign:'center' }}>
                              {selItem?.quantity || 1}
                            </span>
                            <button type="button" className="btn btn-icon" style={{ width:24, height:24, fontSize:16 }}
                              onClick={() => updateQty(item.id, (selItem?.quantity||1) + 1, item.quantity)}>+</button>
                          </div>
                        )}
                        <span style={{
                          fontSize:10, padding:'2px 7px', borderRadius:20, fontWeight:700, flexShrink:0,
                          background: item.quantity < 3 ? 'rgba(251,191,36,.1)' : 'var(--green-bg)',
                          color: item.quantity < 3 ? '#f59e0b' : 'var(--green)',
                        }}>
                          {item.quantity < 3 ? 'Low' : 'In Stock'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Delivery Method */}
            <div className="card">
              <div className="section-title">
                <Truck size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                Delivery Method
              </div>
              <div style={{ display:'flex', gap:12, marginBottom:16 }}>
                {[
                  { value:'hand',    label:'Hand Delivery', icon:HandMetal, desc:'Delivered in person at office' },
                  { value:'courier', label:'Courier',        icon:Truck,    desc:'Shipped to employee address' },
                ].map(opt => {
                  const Icon = opt.icon;
                  const sel  = form.deliveryMethod === opt.value;
                  return (
                    <label key={opt.value} style={{
                      flex:1, display:'flex', alignItems:'flex-start', gap:12, padding:'14px 16px',
                      borderRadius:'var(--radius)',
                      border:`1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                      background: sel ? 'var(--accent-glow)' : 'var(--surface2)',
                      cursor:'pointer', transition:'all .2s',
                    }}>
                      <input type="radio" name="delivery" value={opt.value} checked={sel}
                        onChange={() => set('deliveryMethod', opt.value)} style={{ display:'none' }}/>
                      <Icon size={18} color={sel ? 'var(--accent)' : 'var(--text-muted)'}/>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13.5, color:sel ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{opt.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {form.deliveryMethod === 'courier' && (
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label"><MapPin size={12} style={{ display:'inline', marginRight:4 }}/>Delivery Address *</label>
                  <textarea className="form-textarea" required style={{ minHeight:90 }}
                    value={form.deliveryAddress} onChange={e => set('deliveryAddress', e.target.value)}
                    placeholder="Full delivery address…"/>
                </div>
              )}
            </div>

            {/* ── NEW: Damage / Condition Photos ── */}
            <div className="card">
              <div className="section-title">
                <ImagePlus size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                Condition / Damage Photos
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400, marginLeft:8 }}>
                  Optional · max 6
                </span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>
                Capture current condition of the laptop before allocation (scratches, stickers, existing damage).
              </div>
              <input ref={damageRef} type="file" accept="image/*" multiple style={{ display:'none' }}
                onChange={handleDamagePhotos}/>

              {damagePhotos.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
                  {damagePhotos.map((src, i) => (
                    <div key={i} style={{ position:'relative', borderRadius:8, overflow:'hidden',
                      border:'1px solid var(--border)', aspectRatio:'1' }}>
                      <img src={src} alt={`Damage ${i+1}`}
                        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                      <button type="button" onClick={() => removeDamagePhoto(i)}
                        style={{ position:'absolute', top:4, right:4, background:'rgba(220,38,38,.85)',
                          border:'none', borderRadius:'50%', width:22, height:22, display:'flex',
                          alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {damagePhotos.length < 6 && (
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => damageRef.current?.click()}
                  style={{ width:'100%', justifyContent:'center', gap:8 }}>
                  <ImagePlus size={14}/>
                  {damagePhotos.length === 0 ? 'Add Condition Photos' : 'Add More Photos'}
                  {damagePhotos.length > 0 && ` (${damagePhotos.length}/6)`}
                </button>
              )}
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Employee Photo */}
            <div className="card">
              <div className="section-title">
                <Camera size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                Employee Photo
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                <div style={{ width:80, height:80, borderRadius:'50%', background:'var(--surface2)',
                  border:'2px dashed var(--border2)', display:'flex', alignItems:'center',
                  justifyContent:'center', overflow:'hidden', flexShrink:0, cursor:'pointer' }}
                  onClick={() => fileRef.current?.click()}>
                  {photoPreview
                    ? <img src={photoPreview} alt="Employee" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <Camera size={24} color="var(--text-muted)"/>
                  }
                </div>
                <div>
                  <input type="file" ref={fileRef} accept="image/*" style={{ display:'none' }} onChange={handlePhoto}/>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                    <Camera size={13}/> {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {photoPreview && (
                    <button type="button" className="btn btn-sm" style={{ marginLeft:8 }}
                      onClick={() => { setPhotoPreview(''); set('photoUrl',''); fileRef.current.value=''; }}>
                      <X size={13}/> Remove
                    </button>
                  )}
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>Appears in allocation email & QR card.</div>
                </div>
              </div>
            </div>

            {/* Employee Details */}
            <div className="card">
              <div className="section-title">Employee Details</div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Employee ID *</label>
                  <input className="form-input" required value={form.empId} onChange={e => set('empId', e.target.value)} placeholder="EMP-1001"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input className="form-input" type="tel" value={form.mobileNo} onChange={e => set('mobileNo', e.target.value)} placeholder="+91 98765 43210"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Employee Name *</label>
                <input className="form-input" required value={form.empName} onChange={e => set('empName', e.target.value)} placeholder="Jacob Thomas"/>
              </div>
              <div className="form-group">
                <label className="form-label">Work Email *</label>
                <input type="email" className="form-input" required value={form.empEmail} onChange={e => set('empEmail', e.target.value)} placeholder="jacob@mindteck.com"/>
              </div>
              <div className="form-group">
                <label className="form-label">Personal Email</label>
                <input type="email" className="form-input" value={form.personalEmail} onChange={e => set('personalEmail', e.target.value)} placeholder="jacob@gmail.com"/>
                <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:4 }}>Email also sent here</div>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-input" value={form.department} onChange={e => set('department', e.target.value)} placeholder="Engineering"/>
              </div>
              <div className="section-title" style={{ marginTop:8 }}>Project Details</div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Client</label>
                  <input className="form-input" value={form.client} onChange={e => set('client', e.target.value)} placeholder="Client Name"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Project</label>
                  <input className="form-input" value={form.project} onChange={e => set('project', e.target.value)} placeholder="Project Name"/>
                </div>
              </div>

              <div className="section-title" style={{ marginTop:8 }}>Allocation</div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Allocation Date *</label>
                  <input type="date" className="form-input" required value={form.allocationDate} onChange={e => set('allocationDate', e.target.value)}/>
                </div>
                {/* ── NEW: Prepared By ── */}
                <div className="form-group">
                  <label className="form-label">
                    <User size={11} style={{ display:'inline', marginRight:4, verticalAlign:'middle' }}/>
                    Prepared By *
                  </label>
                  <input className="form-input" required value={form.preparedBy}
                    onChange={e => set('preparedBy', e.target.value)}
                    placeholder="IT Staff name"/>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
                    Auto-filled from your login
                  </div>
                </div>
              </div>
            </div>

            {/* CC Emails */}
            <div className="card">
              <div className="section-title" style={{ marginBottom:10 }}>
                <FileText size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
                CC Emails for Notification
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10, padding:'8px 12px',
                background:'rgba(79,142,247,.06)', border:'1px solid rgba(79,142,247,.15)', borderRadius:'var(--radius)' }}>
                Allocation email + signed agreement DOCX will be sent to employee.<br/>
                sysadmin@mindteck.us and your account are always CC'd automatically.
              </div>
              <CCEmailInput ccEmails={ccEmails} onChange={setCCEmails}/>
            </div>

            {/* Submit */}
            <div style={{ display:'flex', gap:10 }}>
              <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={() => navigate('/inventory')}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={!selectedAsset || saving}>
                <Send size={15}/> {saving ? 'Allocating…' : 'Allocate Laptop'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}