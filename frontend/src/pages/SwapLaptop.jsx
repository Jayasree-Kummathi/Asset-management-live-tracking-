import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import { RefreshCw, CheckCircle, ChevronRight } from 'lucide-react';
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

  const [step, setStep] = useState(1);
  const [selectedAllocId, setSelectedAllocId] = useState('');
  const [newAssetId, setNewAssetId] = useState('');
  const [issueType, setIssueType] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [oldCondition, setOldCondition] = useState('working');
  const [ccEmails, setCCEmails] = useState([]);
  const [done, setDone] = useState(false);

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

  const handleConfirm = async () => {
    await swapAsset(alloc.dbId, alloc.assetId, newAssetId, { issueType, issueDesc, oldCondition, extra_ccs: ccEmails });
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
              </div>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>CC Emails for Notification</div>
              <CCEmailInput ccEmails={ccEmails} onChange={setCCEmails} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
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
