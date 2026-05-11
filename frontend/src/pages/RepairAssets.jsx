import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import { 
  Wrench, Search, X, CheckCircle, Trash2, AlertTriangle, 
  Edit2, Lock, Eye, ArrowLeft, ChevronRight, Save, 
  Calendar, User, Clock, Package, Send 
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ══════════════════════════════════════════════════════════════════════════════
// REPAIR DETAIL PAGE (View Only - for Completed/Unrepairable)
// ══════════════════════════════════════════════════════════════════════════════
function RepairDetailPage({ repair, asset, onBack }) {
  const isCompleted = repair.status === 'Completed';
  const isUnrepairable = repair.status === 'Unrepairable';

  return (
    <div className="fade-in" style={{ animation: 'slideInDetail 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`
        @keyframes slideInDetail {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .info-value {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          text-align: right;
          max-width: 60%;
          word-break: break-word;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--border);
        }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
          <ArrowLeft size={15}/> Repair Assets
        </button>
        <ChevronRight size={13} style={{ opacity: 0.4 }}/>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>Repair #{repair.id}</span>
      </div>

      {/* Header Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
              Repair #{repair.id}
            </h2>
            <StatusBadge status={repair.status} />
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12}/> Repair Date: {repair.repairDate || 'Not set'}
            </span>
            {repair.estimatedReturn && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={12}/> Est. Return: {repair.estimatedReturn}
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={14}/> Back
        </button>
      </div>

      {/* Locked Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px', borderRadius: 'var(--radius)',
        background: isCompleted ? 'var(--green-bg)' : 'var(--red-bg)',
        border: `1px solid ${isCompleted ? 'rgba(52,211,153,.25)' : 'rgba(248,113,113,.25)'}`,
        marginBottom: 24,
      }}>
        <Lock size={15} color={isCompleted ? 'var(--green)' : 'var(--red)'} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isCompleted ? 'var(--green)' : 'var(--red)' }}>
            {isCompleted ? 'Repair Completed — Asset returned to Stock' : 'Marked Unrepairable — Asset moved to Scrap'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            This record is locked and cannot be edited.
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left Column - Asset Info */}
        <div className="card">
          <div className="section-title">
            <Package size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }}/>
            Asset Information
          </div>
          {asset ? (
            <>
              <div className="info-row">
                <span className="info-label">Asset ID</span>
                <span className="info-value" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--amber)' }}>{asset.id}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Brand / Model</span>
                <span className="info-value">{asset.brand} {asset.model}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Serial Number</span>
                <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{asset.serial}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Current Status</span>
                <span className="info-value"><StatusBadge status={asset.status}/></span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
              Asset information not available
            </div>
          )}
        </div>

        {/* Right Column - Repair Details */}
        <div className="card">
          <div className="section-title">
            <Wrench size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }}/>
            Repair Information
          </div>
          <div className="info-row">
            <span className="info-label">Asset No</span>
            <span className="info-value" style={{ fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{repair.assetId}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Issue</span>
            <span className="info-value">{repair.issue}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Vendor</span>
            <span className="info-value">{repair.vendor || '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Repair Date</span>
            <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{repair.repairDate || '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Est. Return</span>
            <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{repair.estimatedReturn || '—'}</span>
          </div>
          {repair.notes && (
            <div className="info-row">
              <span className="info-label">Notes</span>
              <span className="info-value">{repair.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Back Button */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={14}/> Back to Repair Assets
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REPAIR UPDATE PAGE (For In Repair status)
// ══════════════════════════════════════════════════════════════════════════════
function RepairUpdatePage({ repair, asset, onBack, onSaved }) {
  const [status, setStatus] = useState('In Repair');
  const [vendor, setVendor] = useState(repair.vendor || '');
  const [estimatedReturn, setEstimatedReturn] = useState(repair.estimatedReturn || '');
  const [actualReturn, setActualReturn] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState(repair.notes || '');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const statusOptions = [
    {
      value: 'Completed',
      label: 'Mark as Completed',
      sub: 'Asset will move to Stock — available for allocation',
      icon: CheckCircle,
      color: 'var(--green)',
      bg: 'var(--green-bg)',
    },
    {
      value: 'Unrepairable',
      label: 'Mark as Unrepairable',
      sub: 'Asset will be permanently Scrapped',
      icon: Trash2,
      color: 'var(--red)',
      bg: 'var(--red-bg)',
    },
  ];

  const handleSave = async (e) => {
    e.preventDefault();
    if (status === 'In Repair') return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const body = { status, vendor, notes };
      if (estimatedReturn) body.estimated_return = estimatedReturn;
      if (actualReturn) body.actual_return = actualReturn;
      if (cost) body.cost = Number(cost);

      const res = await fetch(`${API}/repairs/${repair.dbId || repair.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');

      if (onSaved) onSaved();
      onBack();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedOpt = statusOptions.find(o => o.value === status);
  const finalStatus = status !== 'In Repair';

  return (
    <div className="fade-in" style={{ animation: 'slideInUpdate 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`
        @keyframes slideInUpdate {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .info-value {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          text-align: right;
          max-width: 60%;
          word-break: break-word;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--border);
        }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
          <ArrowLeft size={15}/> Repair Assets
        </button>
        <ChevronRight size={13} style={{ opacity: 0.4 }}/>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>Update Repair #{repair.id}</span>
      </div>

      {/* Header Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                Update Repair — {repair.assetId}
              </h2>
              <StatusBadge status="In Repair" />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              {asset?.brand} {asset?.model} · Issue: {repair.issue}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onBack}>
            Cancel
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="card" style={{ padding: '24px 28px' }}>
        <form onSubmit={handleSave}>
          {/* Choose outcome */}
          <div className="form-group">
            <label className="form-label">Select Outcome *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {statusOptions.map(opt => {
                const Icon = opt.icon;
                const selected = status === opt.value;
                return (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '14px 16px', borderRadius: 'var(--radius)',
                    border: `1px solid ${selected ? opt.color : 'var(--border)'}`,
                    background: selected ? opt.bg : 'var(--surface2)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}>
                    <input
                      type="radio" name="status" value={opt.value}
                      checked={selected}
                      onChange={() => { setStatus(opt.value); setConfirmed(false); }}
                      style={{ display: 'none' }}
                    />
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: selected ? `${opt.color}22` : 'var(--surface)',
                      border: `1px solid ${selected ? opt.color : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .2s',
                    }}>
                      <Icon size={17} color={selected ? opt.color : 'var(--text-muted)'} />
                    </div>
                    <div style={{ flex: 1, paddingTop: 2 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: selected ? opt.color : 'var(--text)' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
                        {opt.sub}
                      </div>
                    </div>
                    {selected && (
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        border: `2px solid ${opt.color}`,
                        background: opt.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Details — only show after picking an outcome */}
          {finalStatus && (
            <>
              <div className="section-title">Repair Details</div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Vendor / Service Center</label>
                  <input className="form-input" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Dell Service Center" />
                </div>
                <div className="form-group">
                  <label className="form-label">Repair Cost (₹)</label>
                  <input type="number" className="form-input" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" min="0" />
                </div>
                {status === 'Completed' && (
                  <div className="form-group">
                    <label className="form-label">Actual Return Date</label>
                    <input type="date" className="form-input" value={actualReturn} onChange={e => setActualReturn(e.target.value)} />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Notes / Resolution</label>
                <textarea className="form-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={status === 'Completed' ? 'What was replaced or fixed?' : 'Why is this unrepairable?'}
                />
              </div>

              {/* Final confirmation banner */}
              <div style={{
                padding: '14px 16px', borderRadius: 'var(--radius)', marginBottom: 16,
                background: status === 'Completed' ? 'var(--green-bg)' : 'var(--red-bg)',
                border: `1px solid ${status === 'Completed' ? 'rgba(52,211,153,.3)' : 'rgba(248,113,113,.3)'}`,
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                {status === 'Completed'
                  ? <CheckCircle size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                  : <AlertTriangle size={18} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
                }
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: status === 'Completed' ? 'var(--green)' : 'var(--red)' }}>
                    {status === 'Completed'
                      ? `${repair.assetId} will move to Stock`
                      : `${repair.assetId} will be permanently Scrapped`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {status === 'Completed'
                      ? 'This action is final. The asset status will change to "Stock" and this repair record will be locked.'
                      : 'This action is final. The asset will be retired and this repair record will be locked. It cannot be undone.'}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      style={{ accentColor: status === 'Completed' ? 'var(--green)' : 'var(--red)', width: 15, height: 15 }}
                    />
                    <span style={{ color: 'var(--text-dim)' }}>I understand this action is irreversible</span>
                  </label>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
            <button
              type="submit"
              className={`btn ${status === 'Unrepairable' ? 'btn-danger' : 'btn-primary'}`}
              disabled={saving || !finalStatus || !confirmed}
              style={{ opacity: (!finalStatus || !confirmed) ? 0.5 : 1 }}
            >
              {saving
                ? 'Saving…'
                : status === 'Completed'
                  ? <><CheckCircle size={14}/> Complete & Move to Stock</>
                  : status === 'Unrepairable'
                    ? <><Trash2 size={14}/> Confirm Scrap</>
                    : 'Select an outcome above'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function RepairAssets() {
  const { repairs, assets, refetch } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [updateRepair, setUpdateRepair] = useState(null);
  const [viewRepair, setViewRepair] = useState(null);
  const listStateSnapshot = React.useRef({ search: '', filter: 'All' });

  const normalize = (s) => s?.toLowerCase().replace('_', ' ');

  const filtered = repairs.filter(r => {
    const matchFilter = filter === 'All' || normalize(r.status) === normalize(filter);
    const matchSearch = !search || [r.assetId, r.id, r.issue, r.vendor]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const getAsset = id => assets.find(a => a.id === id);

  // Save current list state before navigating
  const handleOpenUpdate = (repair) => {
    listStateSnapshot.current = { search, filter };
    setUpdateRepair(repair);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenView = (repair) => {
    listStateSnapshot.current = { search, filter };
    setViewRepair(repair);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    const { search: prevSearch, filter: prevFilter } = listStateSnapshot.current;
    setSearch(prevSearch);
    setFilter(prevFilter);
    setUpdateRepair(null);
    setViewRepair(null);
  };

  const handleRepairUpdate = async () => {
    await refetch();
  };

  // Render Update Page
  if (updateRepair) {
    const asset = getAsset(updateRepair.assetId);
    return (
      <RepairUpdatePage
        repair={updateRepair}
        asset={asset}
        onBack={handleBackToList}
        onSaved={handleRepairUpdate}
      />
    );
  }

  // Render View Page
  if (viewRepair) {
    const asset = getAsset(viewRepair.assetId);
    return (
      <RepairDetailPage
        repair={viewRepair}
        asset={asset}
        onBack={handleBackToList}
      />
    );
  }

  // Main List View
  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Repair Assets</h1>
          <p>Track and manage laptops currently under repair</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            padding: '8px 14px',
            background: 'var(--amber-bg)', border: '1px solid rgba(251,191,36,.2)',
            borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--amber)', fontWeight: 600,
          }}>
            <Wrench size={14} style={{ display: 'inline', marginRight: 6 }} />
            {repairs.filter(r => r.status === 'In Repair').length} In Repair
          </div>
          <div style={{
            padding: '8px 14px',
            background: 'var(--green-bg)', border: '1px solid rgba(52,211,153,.2)',
            borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--green)', fontWeight: 600,
          }}>
            <CheckCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
            {repairs.filter(r => r.status === 'Completed').length} Completed
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
          <Search size={15} />
          <input
            className="form-input"
            placeholder="Search asset, issue, vendor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="toggle-group">
          {['All', 'In Repair', 'Completed', 'Unrepairable'].map(s => (
            <button key={s} className={`toggle-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Repair ID</th>
              <th>Asset No</th>
              <th>Model</th>
              <th>Issue</th>
              <th>Vendor</th>
              <th>Repair Date</th>
              <th>Est. Return</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state"><Wrench size={32} /><p>No repair records found</p></div>
                </td>
              </tr>
            ) : (
              filtered.map(r => {
                const asset = getAsset(r.assetId);
                const inRepair = r.status === 'In Repair';
                return (
                  <tr key={r.id}>
                    <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{r.id}</span></td>
                    <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--amber)', fontWeight: 700 }}>{r.assetId}</span></td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{asset ? `${asset.brand} ${asset.model}` : '—'}</td>
                    <td style={{ fontSize: 13, maxWidth: 200 }}>{r.issue}</td>
                    <td style={{ fontSize: 12.5 }}>{r.vendor || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.repairDate || '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.estimatedReturn || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      {inRepair ? (
                        <button className="btn btn-sm btn-primary" onClick={() => handleOpenUpdate(r)}>
                          <Edit2 size={12} /> Update
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleOpenView(r)} title="Record is locked">
                          <Eye size={12} /> View
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Info hint */}
      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Lock size={14} color="var(--text-muted)" />
        <span>
          <strong style={{ color: 'var(--accent)' }}>Update</strong> is available only for <strong style={{ color: 'var(--amber)' }}>In Repair</strong> records.
          Once marked <strong style={{ color: 'var(--green)' }}>Completed</strong> or <strong style={{ color: 'var(--red)' }}>Unrepairable</strong>, the record is locked.
        </span>
      </div>
    </div>
  );
}