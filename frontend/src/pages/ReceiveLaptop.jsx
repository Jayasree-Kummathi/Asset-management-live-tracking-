import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import CCEmailInput from '../components/common/CCEmailInput';
import { Download, CheckCircle, XCircle, AlertTriangle, ImagePlus, Trash2 } from 'lucide-react';

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

export default function ReceiveLaptop() {
  const { allocations, assets, receiveAsset } = useApp();
  const location  = useLocation();
  const navigate  = useNavigate();
  const photoRef  = useRef();

  const [selectedAllocId, setSelectedAllocId] = useState('');
  const [working,         setWorking]         = useState(null);
  const [damaged,         setDamaged]         = useState(null);
  const [damageDesc,      setDamageDesc]      = useState('');
  const [returnPhotos,    setReturnPhotos]    = useState([]); // ← NEW
  const [ccEmails,        setCCEmails]        = useState([]);
  const [submitted,       setSubmitted]       = useState(false);
  const [saving,          setSaving]          = useState(false);

  const activeAllocs = allocations.filter(a => a.status === 'Active');

  useEffect(() => {
    if (location.state?.allocationId) setSelectedAllocId(location.state.allocationId);
  }, [location.state]);

  const alloc = allocations.find(a => a.id === selectedAllocId);
  const asset  = alloc ? assets.find(a => a.id === alloc.assetId) : null;

  const getCondition = () => {
    if (working === 'yes' && damaged === 'no')  return 'good';
    if (working === 'yes' && damaged === 'yes') return 'repair';
    if (working === 'no')                       return 'scrap';
    return null;
  };
  const condition = getCondition();

  const conditionInfo = {
    good:   { label: 'Return to Stock', color: 'var(--green)', icon: CheckCircle,   },
    repair: { label: 'Send to Repair',  color: '#f59e0b',      icon: AlertTriangle, },
    scrap:  { label: 'Mark as Scrap',   color: 'var(--red)',   icon: XCircle,       },
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
      // Pass return photos alongside condition data
      await receiveAsset(
        alloc.dbId,
        alloc.assetId,
        condition,
        damageDesc,
        ccEmails,
        returnPhotos,   // ← NEW param
      );
      setSubmitted(true);
      setTimeout(() => navigate('/allocation-list'), 1800);
    } catch (_) {
      setSaving(false);
    }
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
            <div className="card">
              <div className="section-title">Select Allocation</div>
              <div className="form-group">
                <label className="form-label">Active Allocation *</label>
                <select
                  className="form-select" required value={selectedAllocId}
                  onChange={e => {
                    setSelectedAllocId(e.target.value);
                    setWorking(null); setDamaged(null);
                    setDamageDesc(''); setReturnPhotos([]);
                  }}
                >
                  <option value="">-- Select employee / allocation --</option>
                  {activeAllocs.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.empName} — {a.assetId} ({a.id})
                    </option>
                  ))}
                </select>
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

                  {/* ── Show original allocation condition photos ── */}
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
                              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover',
                                borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }}
                              onClick={() => window.open(src, '_blank')}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </>
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

            {/* ── Return Condition Photos (NEW) ── */}
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
                      <button type="button" onClick={() => removePhoto(i)}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(220,38,38,.85)', border: 'none',
                          borderRadius: '50%', width: 22, height: 22,
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