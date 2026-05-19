import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import CCEmailInput from '../components/common/CCEmailInput';
import {
  Download, CheckCircle, XCircle, AlertTriangle,
  ImagePlus, Trash2, Search, ChevronDown, X, User,
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

// ── Employee Avatar (reused pattern) ─────────────────────────────────────────
function EmpAvatar({ photo, name, size = 36 }) {
  if (photo) {
    return (
      <img src={photo} alt={name}
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: '2px solid var(--border)', flexShrink: 0,
        }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--accent), #818cf8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ── Advanced Allocation Search Dropdown (portal-based) ────────────────────────
function AllocationDropdown({ allocations, assets, selectedAllocId, onSelect }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef();
  const dropRef    = useRef();
  const searchRef  = useRef();
  const [dropStyle, setDropStyle] = useState({});

  const selectedAlloc = allocations.find(a => a.id === selectedAllocId);
  const selectedAsset = selectedAlloc ? assets.find(a => a.id === selectedAlloc.assetId) : null;

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropStyle({
      position: 'fixed',
      top:      rect.bottom + 4,
      left:     rect.left,
      width:    Math.max(rect.width, 420),
      zIndex:   99999,
    });
  };

  useEffect(() => { if (open) { updatePosition(); setTimeout(() => searchRef.current?.focus(), 50); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const h1 = () => updatePosition();
    window.addEventListener('scroll', h1, true);
    window.addEventListener('resize', h1);
    return () => { window.removeEventListener('scroll', h1, true); window.removeEventListener('resize', h1); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current    && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fuzzy-ish multi-field search across allocation + asset
  const filtered = allocations.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const asset = assets.find(x => x.id === a.assetId);
    return [
      a.empName, a.empId, a.id, a.assetId, a.department, a.project,
      asset?.serial, asset?.brand, asset?.model, asset?.config,
    ].some(v => v?.toLowerCase().includes(q));
  });

  const dropdown = open ? ReactDOM.createPortal(
    <div ref={dropRef} style={{
      ...dropStyle,
      background:   'var(--surface)',
      border:       '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      boxShadow:    '0 16px 48px rgba(0,0,0,0.55)',
      overflow:     'hidden',
      display:      'flex',
      flexDirection:'column',
    }}>
      {/* Search bar */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface2)',
      }}>
        <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          ref={searchRef}
          className="form-input"
          style={{ border: 'none', padding: '4px 0', fontSize: 13, background: 'transparent', outline: 'none', flex: 1 }}
          placeholder="Search by name, ID, asset, serial, department…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClick={e => e.stopPropagation()}
        />
        {search && (
          <button type="button" onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Result count */}
      <div style={{
        padding: '5px 14px', fontSize: 11, color: 'var(--text-muted)',
        background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>
          {search
            ? `${filtered.length} of ${allocations.length} allocations`
            : `${allocations.length} active allocation${allocations.length !== 1 ? 's' : ''}`}
        </span>
        {search && filtered.length === 0 && (
          <span style={{ color: 'var(--red)', fontSize: 11 }}>No match</span>
        )}
      </div>

      {/* List */}
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Search size={28} style={{ opacity: 0.25, display: 'block', margin: '0 auto 10px' }} />
            No allocations match "{search}"
          </div>
        ) : filtered.map(alloc => {
          const asset = assets.find(a => a.id === alloc.assetId);
          const isSelected = alloc.id === selectedAllocId;
          return (
            <div
              key={alloc.id}
              onClick={() => { onSelect(alloc.id); setOpen(false); setSearch(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', cursor: 'pointer',
                background: isSelected ? 'var(--accent-glow)' : 'transparent',
                borderBottom: '1px solid var(--border)',
                borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'background .12s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface2)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Avatar */}
              <EmpAvatar photo={alloc.photoUrl} name={alloc.empName} size={38} />

              {/* Main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 13.5, color: isSelected ? 'var(--accent)' : 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {alloc.empName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{alloc.empId}</span>
                  {alloc.department && <span>· {alloc.department}</span>}
                  {alloc.project    && <span>· {alloc.project}</span>}
                </div>
              </div>

              {/* Asset badge */}
              {asset && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700,
                    color: 'var(--accent)', background: 'var(--accent-glow)',
                    padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(99,102,241,.25)',
                    marginBottom: 3,
                  }}>
                    {asset.id}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {asset.brand} {asset.model}
                  </div>
                  {asset.serial && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                      {asset.serial}
                    </div>
                  )}
                </div>
              )}

              {/* Allocated date */}
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 64 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Since</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                  {alloc.allocationDate}
                </div>
              </div>

              {isSelected && (
                <CheckCircle size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginLeft: 4 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        className="form-input"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          justifyContent: 'space-between', minHeight: 48,
          border:     open ? '1px solid var(--accent)' : undefined,
          background: open ? 'var(--accent-glow)'      : undefined,
        }}
        onClick={() => setOpen(o => !o)}
      >
        {selectedAlloc ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <EmpAvatar photo={selectedAlloc.photoUrl} name={selectedAlloc.empName} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedAlloc.empName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ fontFamily: 'var(--mono)' }}>{selectedAlloc.empId}</span>
                {selectedAsset && ` · ${selectedAsset.id} — ${selectedAsset.brand} ${selectedAsset.model}`}
              </div>
            </div>
            {/* Clear button */}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onSelect(''); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, borderRadius: 4,
                display: 'flex', alignItems: 'center',
              }}
              title="Clear selection"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
            <Search size={13} />
            <span style={{ fontSize: 13 }}>Search employee or asset to receive…</span>
          </div>
        )}
        <ChevronDown size={14} style={{
          color: 'var(--text-muted)', flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
        }} />
      </div>
      {dropdown}
    </>
  );
}

// ── Main ReceiveLaptop ────────────────────────────────────────────────────────
export default function ReceiveLaptop() {
  const { allocations, assets, receiveAsset } = useApp();
  const location  = useLocation();
  const navigate  = useNavigate();
  const photoRef  = useRef();

  const [selectedAllocId, setSelectedAllocId] = useState('');
  const [working,         setWorking]         = useState(null);
  const [damaged,         setDamaged]         = useState(null);
  const [damageDesc,      setDamageDesc]      = useState('');
  const [returnPhotos,    setReturnPhotos]    = useState([]);
  const [ccEmails,        setCCEmails]        = useState([]);
  const [submitted,       setSubmitted]       = useState(false);
  const [saving,          setSaving]          = useState(false);

  const activeAllocs = allocations.filter(a => a.status === 'Active');

  useEffect(() => {
    if (location.state?.allocationId) setSelectedAllocId(location.state.allocationId);
  }, [location.state]);

  // Reset condition when allocation changes
  const handleSelectAlloc = (id) => {
    setSelectedAllocId(id);
    setWorking(null); setDamaged(null);
    setDamageDesc(''); setReturnPhotos([]);
  };

  const alloc = allocations.find(a => a.id === selectedAllocId);
  const asset = alloc ? assets.find(a => a.id === alloc.assetId) : null;

  const getCondition = () => {
    if (working === 'yes' && damaged === 'no')  return 'good';
    if (working === 'yes' && damaged === 'yes') return 'repair';
    if (working === 'no')                       return 'scrap';
    return null;
  };
  const condition = getCondition();

  const conditionInfo = {
    good:   { label: 'Return to Stock', color: 'var(--green)', icon: CheckCircle   },
    repair: { label: 'Send to Repair',  color: '#f59e0b',      icon: AlertTriangle },
    scrap:  { label: 'Mark as Scrap',   color: 'var(--red)',   icon: XCircle       },
  };

  // ── Photo handling ─────────────────────────────────────────────────────────
  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setReturnPhotos(prev => prev.length < 6 ? [...prev, ev.target.result] : prev);
      };
      reader.readAsDataURL(file);
    });
    if (photoRef.current) photoRef.current.value = '';
  };
  const removePhoto = (idx) => setReturnPhotos(prev => prev.filter((_, i) => i !== idx));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!alloc || !condition) return;
    setSaving(true);
    try {
      await receiveAsset(alloc.dbId, alloc.assetId, condition, damageDesc, ccEmails, returnPhotos);
      setSubmitted(true);
      setTimeout(() => navigate('/allocation-list'), 1800);
    } catch (_) { setSaving(false); }
  };

  if (submitted) {
    return (
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <CheckCircle size={56} color="var(--green)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Laptop Received!</h2>
          <p style={{ color: 'var(--text-muted)' }}>Asset processed. Notification email sent. Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Receive Laptop</h1>
        <p>Process laptop returns from employees</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ── LEFT: Select Allocation ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* NOTE: overflow:visible is critical for the portal dropdown */}
            <div className="card" style={{ overflow: 'visible' }}>
              <div className="section-title">
                <Search size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Select Allocation
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  {activeAllocs.length} active
                </span>
              </div>

              {/* Advanced searchable dropdown */}
              <div className="form-group" style={{ marginBottom: alloc ? 16 : 0 }}>
                <label className="form-label">Search Employee / Asset *</label>
                <AllocationDropdown
                  allocations={activeAllocs}
                  assets={assets}
                  selectedAllocId={selectedAllocId}
                  onSelect={handleSelectAlloc}
                />
                <div style={{
                  fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6,
                  display: 'flex', gap: 12,
                }}>
                  <span>🔍 Search by name, employee ID, asset number, serial, department…</span>
                </div>
              </div>

              {alloc && asset && (
                <>
                  <div className="section-title" style={{ marginTop: 8 }}>Employee</div>
                  <div className="info-row"><span className="info-label">Employee ID</span><span className="info-value">{alloc.empId}</span></div>
                  <div className="info-row"><span className="info-label">Name</span><span className="info-value">{alloc.empName}</span></div>
                  <div className="info-row"><span className="info-label">Department</span><span className="info-value">{alloc.department || '—'}</span></div>
                  <div className="info-row"><span className="info-label">Project</span><span className="info-value">{alloc.project || '—'}</span></div>
                  <div className="info-row">
                    <span className="info-label">Allocated On</span>
                    <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{alloc.allocationDate}</span>
                  </div>

                  <div className="section-title" style={{ marginTop: 16 }}>Asset Details</div>
                  <div className="info-row">
                    <span className="info-label">Asset Number</span>
                    <span className="info-value" style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{asset.id}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Serial Number</span>
                    <span className="info-value" style={{ fontFamily: 'var(--mono)' }}>{asset.serial}</span>
                  </div>
                  <div className="info-row"><span className="info-label">Model</span><span className="info-value">{asset.brand} {asset.model}</span></div>
                  <div className="info-row"><span className="info-label">Configuration</span><span className="info-value">{asset.config}</span></div>
                  <div className="info-row"><span className="info-label">Accessories</span><span className="info-value">{alloc.accessories?.join(', ') || 'None'}</span></div>

                  {/* Original allocation condition photos */}
                  {(() => {
                    let photos = [];
                    try { photos = JSON.parse(alloc.damagePhotos || alloc.damage_photos || '[]'); } catch (_) {}
                    return photos.length > 0 ? (
                      <div style={{ marginTop: 14 }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                        }}>
                          📷 Original Condition at Allocation
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {photos.map((src, i) => (
                            <img key={i} src={src} alt={`Orig ${i + 1}`}
                              style={{
                                width: '100%', aspectRatio: '1', objectFit: 'cover',
                                borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
                              }}
                              onClick={() => window.open(src, '_blank')}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </>
              )}

              {!alloc && (
                <div style={{
                  marginTop: 12, padding: '20px 16px', background: 'var(--surface2)',
                  border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
                  fontSize: 13, color: 'var(--text-muted)', textAlign: 'center',
                }}>
                  <User size={24} style={{ opacity: 0.25, display: 'block', margin: '0 auto 8px' }} />
                  Search and select an active allocation above to view details
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Condition + Photos + CC ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Condition Assessment */}
            <div className="card">
              <div className="section-title">Condition Assessment</div>

              <div className="form-group">
                <label className="form-label">Is the Laptop Working?</label>
                <div className="radio-group">
                  <label className={`radio-option ${working === 'yes' ? 'selected' : ''}`}>
                    <input type="radio" name="working" value="yes" checked={working === 'yes'}
                      onChange={() => { setWorking('yes'); setDamaged(null); }} />
                    <CheckCircle size={15} /> Yes, Working
                  </label>
                  <label className={`radio-option ${working === 'no' ? 'selected' : ''}`}
                    style={working === 'no' ? { borderColor: 'var(--red)', background: 'var(--red-bg)', color: 'var(--red)' } : {}}>
                    <input type="radio" name="working" value="no" checked={working === 'no'}
                      onChange={() => { setWorking('no'); setDamaged(null); }} />
                    <XCircle size={15} /> No, Not Working
                  </label>
                </div>
              </div>

              {working === 'yes' && (
                <div className="form-group">
                  <label className="form-label">Physical Damage?</label>
                  <div className="radio-group">
                    <label className={`radio-option ${damaged === 'no' ? 'selected' : ''}`}>
                      <input type="radio" name="damaged" value="no" checked={damaged === 'no'}
                        onChange={() => setDamaged('no')} />
                      <CheckCircle size={15} /> No Damage
                    </label>
                    <label className={`radio-option ${damaged === 'yes' ? 'selected' : ''}`}
                      style={damaged === 'yes' ? { borderColor: '#f59e0b', background: 'rgba(251,191,36,.08)', color: '#92400e' } : {}}>
                      <input type="radio" name="damaged" value="yes" checked={damaged === 'yes'}
                        onChange={() => setDamaged('yes')} />
                      <AlertTriangle size={15} /> Has Damage
                    </label>
                  </div>
                </div>
              )}

              {(damaged === 'yes' || working === 'no') && (
                <div className="form-group">
                  <label className="form-label">Damage / Issue Description *</label>
                  <textarea className="form-textarea" required value={damageDesc}
                    onChange={e => setDamageDesc(e.target.value)}
                    placeholder="Describe the damage or issue observed in detail…" />
                </div>
              )}

              {condition && (() => {
                const info = conditionInfo[condition];
                const Icon = info.icon;
                return (
                  <div style={{
                    padding: '14px 16px', borderRadius: 'var(--radius)',
                    border: `1px solid ${info.color}`, background: `${info.color}18`,
                    display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
                  }}>
                    <Icon size={20} color={info.color} />
                    <div>
                      <div style={{ fontWeight: 700, color: info.color, fontSize: 13.5 }}>{info.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {condition === 'good'   && 'Asset will be moved back to Stock.'}
                        {condition === 'repair' && 'Asset will be moved to Repair queue.'}
                        {condition === 'scrap'  && 'Asset will be permanently Scrapped.'}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Return Condition Photos */}
            <div className="card">
              <div className="section-title">
                <ImagePlus size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Return Condition Photos
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  Optional · max 6
                </span>
              </div>
              <div style={{
                fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
                padding: '8px 12px', background: 'rgba(251,191,36,.06)',
                border: '1px solid rgba(251,191,36,.2)', borderRadius: 'var(--radius)',
              }}>
                📷 Capture photos of the laptop condition at return — scratches, damage, missing parts.
                These photos will be included in the return notification email.
              </div>

              <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={handlePhotoAdd} />

              {returnPhotos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  {returnPhotos.map((src, i) => (
                    <div key={i} style={{
                      position: 'relative', borderRadius: 8, overflow: 'hidden',
                      border: '1px solid var(--border)', aspectRatio: '1',
                    }}>
                      <img src={src} alt={`Return ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <button type="button" onClick={() => removePhoto(i)} style={{
                        position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,.85)',
                        border: 'none', borderRadius: '50%', width: 22, height: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#fff',
                      }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {returnPhotos.length < 6 && (
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => photoRef.current?.click()}
                  style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
                  <ImagePlus size={14} />
                  {returnPhotos.length === 0 ? 'Add Return Photos' : `Add More (${returnPhotos.length}/6)`}
                </button>
              )}
              {returnPhotos.length === 6 && (
                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Maximum 6 photos reached
                </div>
              )}
            </div>

            {/* CC Emails */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 10 }}>CC Emails for Notification</div>
              <CCEmailInput ccEmails={ccEmails} onChange={setCCEmails} />
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }}
                onClick={() => navigate('/allocation-list')}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}
                disabled={!alloc || !condition || saving}>
                <Download size={15} /> {saving ? 'Processing…' : 'Receive Laptop'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}