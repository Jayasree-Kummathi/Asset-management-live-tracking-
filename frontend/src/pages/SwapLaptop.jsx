import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import { RefreshCw, CheckCircle, ChevronRight, Camera, Plus, Wrench, AlertTriangle, X } from 'lucide-react';
import CCEmailInput from '../components/common/CCEmailInput';

const ISSUE_TYPES = ['Hardware Failure', 'Performance Issue', 'Upgrade Request', 'Battery Issue', 'Screen Damage', 'Other'];

const StepIndicator = ({ step, current }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
    {[1,2,3,4].map((s, i) => (
      <React.Fragment key={s}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
          background: s < current ? 'var(--green)' : s === current ? 'var(--accent)' : 'var(--surface2)',
          color: s <= current ? '#fff' : 'var(--text-muted)',
          border: `2px solid ${s < current ? 'var(--green)' : s === current ? 'var(--accent)' : 'var(--border)'}`,
          transition: 'all 0.3s ease',
          flexShrink: 0,
        }}>
          {s < current ? <CheckCircle size={15} /> : s}
        </div>
        {i < 3 && (
          <div style={{
            height: 2, width: 60,
            background: s < current ? 'var(--green)' : 'var(--border)',
            transition: 'background 0.3s ease'
          }} />
        )}
      </React.Fragment>
    ))}
  </div>
);

const stepLabels = ['Search', 'Old Laptop', 'New Laptop', 'Reason & Confirm'];

export default function SwapLaptop() {
  const { allocations, assets, swapAsset } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const issueImgRef = useRef();

  const [step, setStep] = useState(1);
  const [selectedAllocId, setSelectedAllocId] = useState('');
  const [newAssetId, setNewAssetId] = useState('');
  const [issueType, setIssueType] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [oldCondition, setOldCondition] = useState('working');
  const [ccEmails, setCCEmails] = useState([]);
  const [done, setDone] = useState(false);

  // ── NEW fields ──
  const [preparedBy, setPreparedBy] = useState('');
  const [issueImages, setIssueImages] = useState([]);

  const activeAllocs = allocations.filter(a => a.status === 'Active');
  const stockAssets = assets.filter(a => a.status === 'Stock');

  useEffect(() => {
    if (location.state?.allocationId) {
      setSelectedAllocId(location.state.allocationId);
      setStep(2);
    }
  }, [location.state]);

  const alloc = allocations.find(a => a.id === selectedAllocId);
  const oldAsset = alloc ? assets.find(a => a.id === alloc.assetId) : null;
  const newAsset = assets.find(a => a.id === newAssetId);

  // Handle multiple issue images
  const handleIssueImages = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setIssueImages(prev => [...prev, { src: ev.target.result, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeIssueImage = (index) => {
    setIssueImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    await swapAsset(alloc.dbId, alloc.assetId, newAssetId, {
      issueType,
      issueDesc,
      oldCondition,
      extra_ccs: ccEmails,
      // ── NEW ──
      prepared_by: preparedBy,
      issueImages: issueImages.map(img => img.src),
    });
    setDone(true);
    setTimeout(() => navigate('/allocation-list'), 1800);
  };

  if (done) {
    return (
      <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={56} color="var(--green)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Swap Successful!</h2>
          <p style={{ color: 'var(--text-muted)' }}>Laptop has been swapped successfully. Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Swap Laptop</h1>
        <p>Replace an employee's current laptop with another unit</p>
      </div>

      {/* Step indicator */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <StepIndicator step={step} current={step} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Step {step} of 4 — <span style={{ color: 'var(--text)', fontWeight: 600 }}>{stepLabels[step - 1]}</span>
          </div>
        </div>
      </div>

      {/* Step 1: Search */}
      {step === 1 && (
        <div className="card fade-in">
          <div className="section-title">Step 1 — Find Allocation</div>
          <div className="form-group" style={{ maxWidth: 480 }}>
            <label className="form-label">Select Active Allocation *</label>
            <select className="form-select" value={selectedAllocId} onChange={e => setSelectedAllocId(e.target.value)}>
              <option value="">-- Search by employee or asset --</option>
              {activeAllocs.map(a => (
                <option key={a.id} value={a.id}>{a.empName} (ID: {a.empId}) — {a.assetId}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" disabled={!selectedAllocId} onClick={() => setStep(2)}>
            Continue <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Step 2: Old Laptop Details */}
      {step === 2 && alloc && oldAsset && (
        <div className="card fade-in">
          <div className="section-title">Step 2 — Current Laptop Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Employee</div>
              <div className="info-row"><span className="info-label">Name</span><span className="info-value">{alloc.empName}</span></div>
              <div className="info-row"><span className="info-label">ID</span><span className="info-value">{alloc.empId}</span></div>
              <div className="info-row"><span className="info-label">Department</span><span className="info-value">{alloc.department || '—'}</span></div>
              <div className="info-row"><span className="info-label">Project</span><span className="info-value">{alloc.project || '—'}</span></div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Current Laptop</div>
              <div className="info-row"><span className="info-label">Asset No</span><span className="info-value" style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{oldAsset.id}</span></div>
              <div className="info-row"><span className="info-label">Serial</span><span className="info-value" style={{ fontFamily: 'var(--mono)' }}>{oldAsset.serial}</span></div>
              <div className="info-row"><span className="info-label">Model</span><span className="info-value">{oldAsset.brand} {oldAsset.model}</span></div>
              <div className="info-row"><span className="info-label">Config</span><span className="info-value">{oldAsset.config}</span></div>
              <div className="info-row"><span className="info-label">Allocated</span><span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{alloc.allocationDate}</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Select New Laptop <ChevronRight size={15} /></button>
          </div>
        </div>
      )}

      {/* Step 3: Select New Laptop */}
      {step === 3 && (
        <div className="card fade-in">
          <div className="section-title">Step 3 — Select Replacement Laptop</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {stockAssets.length === 0 ? (
              <div className="empty-state"><p>No laptops available in stock</p></div>
            ) : stockAssets.map(a => (
              <label key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                background: newAssetId === a.id ? 'var(--accent-glow)' : 'var(--surface2)',
                border: `1px solid ${newAssetId === a.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'all 0.2s',
              }}>
                <input type="radio" name="newAsset" value={a.id} checked={newAssetId === a.id} onChange={() => setNewAssetId(a.id)} style={{ accentColor: 'var(--accent)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: newAssetId === a.id ? 'var(--accent)' : 'var(--text)' }}>{a.id}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>{a.brand} {a.model} — {a.config}</div>
                </div>
                <StatusBadge status={a.status} />
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" disabled={!newAssetId} onClick={() => setStep(4)}>Continue <ChevronRight size={15} /></button>
          </div>
        </div>
      )}

      {/* Step 4: Reason & Confirm */}
      {step === 4 && (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* LEFT — Issue details + new fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Swap Reason */}
            <div className="card">
              <div className="section-title">Step 4 — Swap Reason</div>
              <div className="form-group">
                <label className="form-label">Issue Type *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ISSUE_TYPES.map(t => (
                    <label key={t} className={`radio-option ${issueType === t ? 'selected' : ''}`} style={{ justifyContent: 'flex-start' }}>
                      <input type="radio" name="issueType" value={t} checked={issueType === t} onChange={() => setIssueType(t)} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Issue Description</label>
                <textarea className="form-textarea" value={issueDesc} onChange={e => setIssueDesc(e.target.value)} placeholder="Describe the issue in detail…" />
              </div>
              <div className="form-group">
                <label className="form-label">Old Laptop Condition After Return</label>
                <div className="radio-group">
                  <label className={`radio-option ${oldCondition === 'working' ? 'selected' : ''}`}>
                    <input type="radio" name="oldCondition" value="working" checked={oldCondition === 'working'} onChange={() => setOldCondition('working')} />
                    Working → Stock
                  </label>
                  <label className={`radio-option ${oldCondition === 'repair' ? 'selected' : ''}`} style={oldCondition === 'repair' ? { borderColor: 'var(--amber)', background: 'var(--amber-bg)', color: 'var(--amber)' } : {}}>
                    <input type="radio" name="oldCondition" value="repair" checked={oldCondition === 'repair'} onChange={() => setOldCondition('repair')} />
                    Needs Repair
                  </label>
                </div>
              </div>
            </div>

            {/* ── NEW: Issue Documentation ── */}
            <div className="card">
              <div className="section-title">
                <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle', color: '#f59e0b' }} />
                Issue Documentation
                {issueImages.length > 0 && (
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 600,
                    color: '#f59e0b', background: 'rgba(251,191,36,.1)',
                    padding: '2px 8px', borderRadius: 20,
                  }}>
                    {issueImages.length} image{issueImages.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--text-muted)', marginBottom: 14,
                padding: '10px 12px',
                background: 'rgba(251,191,36,.06)',
                border: '1px solid rgba(251,191,36,.2)',
                borderRadius: 'var(--radius)',
              }}>
                Capture any visible damage or issues on the old laptop. These images will be attached to the swap email.
              </div>
              <input
                type="file"
                ref={issueImgRef}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleIssueImages}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => issueImgRef.current?.click()}
                style={{ marginBottom: issueImages.length > 0 ? 14 : 0 }}
              >
                <Camera size={13} /> Capture / Attach Issue Images
              </button>
              {issueImages.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {issueImages.map((img, i) => (
                    <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={img.src} alt={`Issue ${i + 1}`}
                        style={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
                        {img.name}
                      </div>
                      <button type="button" onClick={() => removeIssueImage(i)} style={{
                        position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--red, #f87171)', color: '#fff', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, lineHeight: 1,
                      }}>×</button>
                    </div>
                  ))}
                  <div onClick={() => issueImgRef.current?.click()} style={{
                    width: 90, height: 70, borderRadius: 6, border: '2px dashed var(--border2)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, gap: 4,
                  }}>
                    <Plus size={16} style={{ opacity: 0.5 }} />
                    Add more
                  </div>
                </div>
              )}
            </div>

            {/* ── NEW: Preparation Details ── */}
            <div className="card">
              <div className="section-title">
                <Wrench size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Preparation Details
              </div>
              <div style={{
                fontSize: 12, color: 'var(--text-muted)', marginBottom: 14,
                padding: '10px 12px', background: 'rgba(79,142,247,.06)',
                border: '1px solid rgba(79,142,247,.15)', borderRadius: 'var(--radius)',
              }}>
                Record who configured and prepared the new replacement laptop before issuing it.
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Configured / Prepared By</label>
                <input
                  className="form-input"
                  value={preparedBy}
                  onChange={e => setPreparedBy(e.target.value)}
                  placeholder="e.g. Ravi Kumar (IT Support)"
                />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Name of the IT staff member who set up the new laptop.
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Summary + CC + Confirm */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Swap Summary */}
            <div className="card">
              <div className="section-title">Swap Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: '14px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Returning</div>
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>{oldAsset?.id} — {oldAsset?.brand} {oldAsset?.model}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{oldAsset?.config}</div>
                </div>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}><RefreshCw size={18} /></div>
                <div style={{ padding: '14px', background: 'var(--green-bg)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>New Laptop</div>
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>{newAsset?.id} — {newAsset?.brand} {newAsset?.model}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{newAsset?.config}</div>
                </div>
                <div style={{ padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Employee: </span><strong>{alloc?.empName}</strong></div>
                  <div style={{ marginTop: 4 }}><span style={{ color: 'var(--text-muted)' }}>Reason: </span><strong>{issueType || '—'}</strong></div>
                  {preparedBy && (
                    <div style={{ marginTop: 4 }}><span style={{ color: 'var(--text-muted)' }}>Prepared By: </span><strong>{preparedBy}</strong></div>
                  )}
                  {issueImages.length > 0 && (
                    <div style={{ marginTop: 4 }}><span style={{ color: 'var(--text-muted)' }}>Issue Images: </span><strong>{issueImages.length} attached</strong></div>
                  )}
                </div>
              </div>
            </div>

            {/* CC Emails */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 10 }}>CC Emails for Notification</div>
              <CCEmailInput ccEmails={ccEmails} onChange={setCCEmails} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(3)}>Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!issueType} onClick={handleConfirm}>
                <RefreshCw size={15} /> Confirm Swap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}