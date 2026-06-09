import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import {
  Search, Download, RefreshCw, Eye,
  User, Laptop, Briefcase, Package, Wrench,
  ArrowLeft, ChevronRight, Mail, CheckCircle, Loader, X, AlertTriangle, Send,
} from 'lucide-react';
import { toDateStr } from '../utils/dataUtils';
import * as XLSX from 'xlsx';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

// ── Bulk Audit Inner Page ─────────────────────────────────────────────────────
function BulkAuditPage({ allocations, onBack }) {
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [result, setResult] = useState(null);

  const activeAllocations = allocations.filter(
    a => a.status === 'Active' && (a.empEmail || a.emp_email)
  );
  const noEmailCount = allocations.filter(
    a => a.status === 'Active' && !(a.empEmail || a.emp_email)
  ).length;

  const handleSend = async () => {
    setState('sending');
    try {
      const data = await apiFetch('/allocations/send-audit-email/bulk', { method: 'POST' });
      setResult({ sent: data.sent, failed: data.failed, total: data.total, failures: data.failures });
      setState('done');
    } catch (e) {
      setResult({ error: e.message });
      setState('error');
    }
  };

  return (
    <div className="fade-in">
      {/* ── Breadcrumb ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 24, paddingBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}>
        <button className="btn btn-secondary" onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} /> Back to List
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={onBack}>Allocation List</span>
          <ChevronRight size={13} />
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>Send Audit to All</span>
        </div>
      </div>

      {/* ── Page title ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(79,142,247,.12)', border: '1px solid rgba(79,142,247,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={18} color="var(--accent)" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Bulk Audit Email</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 48 }}>
          Send audit confirmation emails to all active employees at once.
        </p>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
            {activeAllocations.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Will Receive Email
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: noEmailCount > 0 ? '#f59e0b' : 'var(--text-dim)', marginBottom: 4 }}>
            {noEmailCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            No Email — Skipped
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {allocations.filter(a => a.status === 'Active').length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Total Active
          </div>
        </div>
      </div>

      {/* ── What this does ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--accent)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
        }}>
          What this action does
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: <Mail size={14} />, text: `Sends a personalised audit email to each of the ${activeAllocations.length} active employees who have an email address on record.` },
            { icon: <CheckCircle size={14} />, text: 'Each email includes the employee\'s asset details and a unique confirmation link for them to verify or dispute.' },
            { icon: <AlertTriangle size={14} color="#f59e0b" />, text: `${noEmailCount} employee(s) without a recorded email address will be automatically skipped.` },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--surface2)', border: '1px solid var(--border)',
            }}>
              <span style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recipient preview table ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--accent)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Recipients preview</span>
          <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 11, textTransform: 'none' }}>
            {activeAllocations.length} eligible
          </span>
        </div>

        {activeAllocations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            No active allocations with email addresses found.
          </div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                  {['Employee', 'Asset ID', 'Email', 'Department'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                      fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
                      letterSpacing: '0.06em', borderBottom: '1px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeAllocations.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: i < activeAllocations.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{a.empName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.empId}</div>
                    </td>
                    <td style={{ padding: '9px 12px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
                      {a.assetId}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-dim)' }}>
                      {a.empEmail || a.emp_email}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {a.department || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Result banner (shown after send) ── */}
      {state === 'done' && result && (
        <div style={{
          padding: '14px 18px', marginBottom: 16, borderRadius: 8,
          background: result.failed > 0 ? 'rgba(251,191,36,.10)' : 'rgba(34,197,94,.10)',
          border: `1px solid ${result.failed > 0 ? 'rgba(251,191,36,.3)' : 'rgba(34,197,94,.3)'}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {result.failed > 0
            ? <AlertTriangle size={16} color="#f59e0b" />
            : <CheckCircle size={16} color="#22c55e" />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
              {result.failed > 0
                ? `${result.sent} of ${result.total} emails sent — ${result.failed} failed`
                : `All ${result.sent} audit emails sent successfully!`}
            </div>
            {result.failures?.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Failed: {result.failures.map(f => f.email || f.empName).join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {state === 'error' && (
        <div style={{
          padding: '14px 18px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.3)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <X size={16} color="#ef4444" />
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
            {result?.error || 'Failed to send emails. Please try again.'}
          </span>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        paddingTop: 20, borderTop: '1px solid var(--border)',
      }}>
        <button className="btn btn-secondary" onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} /> Back to List
        </button>

        {state === 'idle' && (
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={activeAllocations.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Send size={15} />
            Send to All {activeAllocations.length} Employees
          </button>
        )}

        {state === 'sending' && (
          <button className="btn btn-primary" disabled
            style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.75, cursor: 'not-allowed' }}>
            <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
            Sending emails…
          </button>
        )}

        {state === 'done' && (
          <button className="btn btn-secondary" onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', borderColor: 'rgba(34,197,94,.4)' }}>
            <CheckCircle size={15} /> Done — Back to List
          </button>
        )}

        {state === 'error' && (
          <button className="btn btn-primary" onClick={handleSend}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={15} /> Retry
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Detail Page View ──────────────────────────────────────────────────────────
function AllocationDetailPage({ allocation, asset, onBack }) {
  return (
    <div className="fade-in">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 24, paddingBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}>
        <button className="btn btn-secondary" onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} /> Back to List
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={onBack}>Allocation List</span>
          <ChevronRight size={13} />
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{allocation.empName}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--accent-glow)', border: '2px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
            }}>
              {allocation.empName?.[0] || '?'}
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                {allocation.empName}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {allocation.empId}{allocation.department ? ` · ${allocation.department}` : ''}
              </div>
            </div>
          </div>
          <StatusBadge status={allocation.status} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div style={{
              padding: '12px 14px',
              background: 'rgba(79,142,247,.07)',
              border: '1px solid rgba(79,142,247,.25)',
              borderRadius: 'var(--radius)',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--accent)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                Prepared &amp; Allocated By
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <User size={16} color="var(--accent)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                    {allocation.preparedBy || allocation.prepared_by
                      || allocation.allocatedBy || allocation.allocated_by || '—'}
                  </div>
                  {(allocation.allocatedByEmail || allocation.allocated_by_email) && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                      {allocation.allocatedByEmail || allocation.allocated_by_email}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Laptop size={13} /> Asset Details
            </div>
            <div className="info-row">
              <span className="info-label">Asset ID</span>
              <span className="info-value" style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700 }}>
                {allocation.assetId}
              </span>
            </div>
            <div className="info-row"><span className="info-label">Status</span><StatusBadge status={allocation.status} /></div>
            <div className="info-row">
              <span className="info-label">Brand / Model</span>
              <span className="info-value">{asset ? `${asset.brand} ${asset.model}` : '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Serial</span>
              <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{asset?.serial || '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Configuration</span>
              <span className="info-value">{asset?.config || '—'}</span>
            </div>
          </div>

          {allocation.accessories?.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Package size={13} /> Accessories
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allocation.accessories.map((acc, i) => (
                  <span key={i} style={{
                    fontSize: 12, padding: '4px 12px', borderRadius: 20,
                    background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)',
                  }}>{acc}</span>
                ))}
              </div>
            </div>
          )}

          {(allocation.preparedBy || allocation.prepared_by) && (
            <div className="card">
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wrench size={13} /> Preparation
              </div>
              <div className="info-row">
                <span className="info-label">Configured By</span>
                <span className="info-value" style={{ fontWeight: 600 }}>
                  {allocation.preparedBy || allocation.prepared_by}
                </span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Briefcase size={13} /> Allocation Info
            </div>
            <div className="info-row"><span className="info-label">Project</span><span className="info-value">{allocation.project || '—'}</span></div>
            <div className="info-row"><span className="info-label">Client</span><span className="info-value">{allocation.client || '—'}</span></div>
            <div className="info-row">
              <span className="info-label">Work Email</span>
              <span className="info-value" style={{ fontSize: 12 }}>{allocation.empEmail || '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Mobile</span>
              <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                {allocation.mobileNo || allocation.mobile_no || '—'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Allocation Date</span>
              <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                {toDateStr(allocation.allocationDate) || '—'}
              </span>
            </div>
            {(allocation.returnDate || allocation.return_date) && (
              <div className="info-row">
                <span className="info-label">Return Date</span>
                <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {toDateStr(allocation.returnDate || allocation.return_date)}
                </span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">Delivery</span>
              <span className="info-value" style={{ textTransform: 'capitalize' }}>
                {allocation.deliveryMethod || allocation.delivery_method || 'Hand'}
              </span>
            </div>
          </div>

          {(() => {
            let photos = [];
            try { photos = JSON.parse(allocation.damagePhotos || allocation.damage_photos || '[]'); } catch (_) {}
            return photos.length > 0 ? (
              <div className="card">
                <div className="section-title" style={{ marginBottom: 12 }}>Condition Photos</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {photos.map((src, i) => (
                    <img key={i} src={src} alt={`Condition ${i + 1}`}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover',
                        borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => window.open(src, '_blank')}
                    />
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {(allocation.issueImages || allocation.issue_images)?.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 12 }}>Issue Images</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(allocation.issueImages || allocation.issue_images).map((img, i) => (
                  <img key={i} src={img} alt={`Issue ${i + 1}`}
                    style={{ width: 110, height: 82, objectFit: 'cover',
                      borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => window.open(img, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}

          {allocation.notes && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 10 }}>Notes</div>
              <div style={{
                padding: '10px 14px', background: 'var(--surface2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                fontSize: 13, color: 'var(--text-dim)',
              }}>
                {allocation.notes}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex' }}>
        <button className="btn btn-secondary" onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} /> Back to Allocation List
        </button>
      </div>

      <style>{`
        .section-title {
          font-size: 13px; font-weight: 700; color: var(--text);
          margin-bottom: 12px; padding-bottom: 8px;
          border-bottom: 2px solid var(--border);
        }
        .info-row {
          display: flex; justify-content: space-between;
          padding: 10px 0; border-bottom: 1px solid var(--border);
        }
        .info-row:last-child { border-bottom: none; }
        .info-label {
          font-size: 12px; font-weight: 600; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .info-value {
          font-size: 13px; font-weight: 500; color: var(--text);
          text-align: right; max-width: 60%; word-break: break-word;
        }
      `}</style>
    </div>
  );
}

// ── Main AllocationList ───────────────────────────────────────────────────────
export default function AllocationList() {
  const { allocations, assets } = useApp();
  const navigate = useNavigate();
  const [search,        setSearch]       = useState('');
  const [filter,        setFilter]       = useState('Active');
  const [viewAlloc,     setViewAlloc]    = useState(null);  // detail page
  const [showBulkAudit, setShowBulkAudit] = useState(false); // bulk audit page
  const listStateSnapshot = React.useRef({ search: '', filter: 'Active' });

  const filtered = allocations.filter(a => {
    const matchFilter = filter === 'All' || a.status === filter;
    const matchSearch = !search || [a.empId, a.empName, a.assetId, a.project, a.client]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const activeCount = allocations.filter(
    a => a.status === 'Active' && (a.empEmail || a.emp_email)
  ).length;

  const getAsset = (id) => assets.find(a => a.id === id);

  const handleExportToExcel = () => {
    if (!filtered.length) { alert('No data to export'); return; }
    const exportData = filtered.map(a => {
      const asset = getAsset(a.assetId);
      return {
        'Allocation ID':   a.id,
        'Employee ID':     a.empId,
        'Employee Name':   a.empName,
        'Department':      a.department || '—',
        'Asset ID':        a.assetId,
        'Model':           asset?.model  || '—',
        'Brand':           asset?.brand  || '—',
        'Serial Number':   asset?.serial || '—',
        'Project':         a.project     || '—',
        'Client':          a.client      || '—',
        'Allocation Date': toDateStr(a.allocationDate) || '—',
        'Accessories':     a.accessories?.join(', ') || '—',
        'Prepared By':     a.preparedBy || a.prepared_by || '—',
        'Allocated By':    a.allocatedBy || a.allocated_by || '—',
        'Status':          a.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch:15 },{ wch:12 },{ wch:25 },{ wch:15 },{ wch:12 },
      { wch:20 },{ wch:12 },{ wch:15 },{ wch:20 },{ wch:20 },
      { wch:15 },{ wch:30 },{ wch:20 },{ wch:20 },{ wch:12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Allocations');
    XLSX.writeFile(wb, `Allocations_${filter}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleOpenView = (allocation) => {
    listStateSnapshot.current = { search, filter };
    setViewAlloc(allocation);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBulkAudit = () => {
    listStateSnapshot.current = { search, filter };
    setShowBulkAudit(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    const { search: prevSearch, filter: prevFilter } = listStateSnapshot.current;
    setSearch(prevSearch);
    setFilter(prevFilter);
    setViewAlloc(null);
    setShowBulkAudit(false);
  };

  // ── Render: Bulk Audit inner page ──
  if (showBulkAudit) {
    return (
      <BulkAuditPage
        allocations={allocations}
        onBack={handleBackToList}
      />
    );
  }

  // ── Render: Detail inner page ──
  if (viewAlloc) {
    return (
      <AllocationDetailPage
        allocation={viewAlloc}
        asset={getAsset(viewAlloc.assetId)}
        onBack={handleBackToList}
      />
    );
  }

  // ── Render: Main list ──
  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Allocation List</h1>
          <p>All current and past laptop allocations</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* ── Send Audit to All → navigates to inner page ── */}
          <button
            className="btn btn-secondary"
            onClick={handleOpenBulkAudit}
            disabled={activeCount === 0}
            title={activeCount === 0
              ? 'No active allocations with email addresses'
              : `Send audit confirmation to all ${activeCount} active employees`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Mail size={15} />
            Send Audit to All
            {activeCount > 0 && (
              <span style={{
                marginLeft: 2, padding: '1px 7px', borderRadius: 10,
                background: 'var(--accent-glow)', color: 'var(--accent)',
                fontSize: 11, fontWeight: 700, border: '1px solid rgba(79,142,247,.25)',
              }}>
                {activeCount}
              </span>
            )}
          </button>

          <button className="btn btn-secondary" onClick={handleExportToExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
          <Search size={15} />
          <input className="form-input" placeholder="Search employee, asset, project…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="toggle-group">
          {['All', 'Active', 'Returned', 'Swapped'].map(s => (
            <button key={s} className={`toggle-btn ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Alloc ID</th>
              <th>Employee</th>
              <th>Asset</th>
              <th>Model</th>
              <th>Project</th>
              <th>Prepared By</th>
              <th>Alloc Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9}><div className="empty-state"><p>No allocations found</p></div></td></tr>
            ) : (
              filtered.map(a => {
                const asset     = getAsset(a.assetId);
                const staffName = a.preparedBy || a.prepared_by || a.allocatedBy || a.allocated_by || '—';
                return (
                  <tr key={a.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{a.id}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.empName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {a.empId}{a.department ? ` · ${a.department}` : ''}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>
                        {a.assetId}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{asset?.model || '—'}</td>
                    <td>
                      <div style={{ fontSize: 12.5 }}>{a.project || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.client}</div>
                    </td>
                    <td><div style={{ fontSize: 12.5, fontWeight: 500 }}>{staffName}</div></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{toDateStr(a.allocationDate) || '—'}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleOpenView(a)}>
                          <Eye size={12} /> View
                        </button>
                        {a.status === 'Active' && (
                          <>
                            <button className="btn btn-sm btn-secondary"
                              onClick={() => navigate('/receive', { state: { allocationId: a.id } })}>
                              Receive
                            </button>
                            <button className="btn btn-sm btn-secondary"
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                              onClick={() => navigate('/swap', { state: { allocationId: a.id } })}>
                              <RefreshCw size={12} /> Swap
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}