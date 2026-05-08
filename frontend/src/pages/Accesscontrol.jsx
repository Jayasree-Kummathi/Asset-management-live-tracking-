import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Plus, Edit2, X, Clock, Usb, Globe,
  AlertTriangle, CheckCircle, Mail, RefreshCw, Search,
  Bell, Lock, Unlock, Link, Wifi, Download, FileText,
  FileSpreadsheet, ChevronDown, Activity, Filter,
  ChevronRight, Eye, Info, CheckCircle2, XCircle
} from 'lucide-react';
import './Accesscontrol.css';

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

const downloadFile = async (url, filename) => {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
    const blob = await response.blob();
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
};

const daysLeft = (expiryDate) => {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-CA') : '—';

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

// ── Toast Notification System ─────────────────────────────────────────────────
let toastId = 0;
const toastListeners = new Set();

export const toast = {
  _emit(msg) { toastListeners.forEach(fn => fn(msg)); },
  success(text, detail) { this._emit({ id: ++toastId, type: 'success', text, detail }); },
  error(text, detail)   { this._emit({ id: ++toastId, type: 'error',   text, detail }); },
  warn(text, detail)    { this._emit({ id: ++toastId, type: 'warn',    text, detail }); },
  info(text, detail)    { this._emit({ id: ++toastId, type: 'info',    text, detail }); },
};

function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (msg) => {
      setToasts(prev => [msg, ...prev].slice(0, 5));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== msg.id)), 4500);
    };
    toastListeners.add(handler);
    return () => toastListeners.delete(handler);
  }, []);

  const icons = {
    success: <CheckCircle2 size={15} />,
    error:   <XCircle size={15} />,
    warn:    <AlertTriangle size={15} />,
    info:    <Info size={15} />,
  };

  return (
    <div className="ac-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`ac-toast ac-toast-${t.type}`}>
          <span className="ac-toast-icon">{icons[t.type]}</span>
          <div className="ac-toast-body">
            <span className="ac-toast-text">{t.text}</span>
            {t.detail && <span className="ac-toast-detail">{t.detail}</span>}
          </div>
          <button className="ac-toast-close" onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

const StatusChip = ({ days }) => {
  if (days === null) return <span className="ac-chip ac-chip-none">No Expiry</span>;
  if (days < 0)   return <span className="ac-chip ac-chip-expired">Expired {Math.abs(days)}d ago</span>;
  if (days === 0) return <span className="ac-chip ac-chip-expired">Expires Today</span>;
  if (days <= 2)  return <span className="ac-chip ac-chip-critical">{days}d left</span>;
  if (days <= 7)  return <span className="ac-chip ac-chip-warn">{days}d left</span>;
  return <span className="ac-chip ac-chip-ok">{days}d left</span>;
};

const ACCESS_TYPES = [
  { value: 'website', label: 'Website Access',  icon: Globe,   description: 'General website access' },
  { value: 'usb',     label: 'USB Access',       icon: Usb,     description: 'USB device access only' },
  { value: 'both',    label: 'Website + USB',    icon: Shield,  description: 'Website + USB access' },
  { value: 'full',    label: 'Full Access',      icon: Wifi,    description: 'Complete system access' },
  { value: 'custom',  label: 'Custom / URL',     icon: Link,    description: 'Specific site or resource' },
];

const getTypeIcon = (type) => {
  const found = ACCESS_TYPES.find(t => t.value === type);
  if (!found) return <Shield size={12} />;
  const Icon = found.icon;
  return <Icon size={12} />;
};

const getTypeLabel = (type) => {
  const found = ACCESS_TYPES.find(t => t.value === type);
  return found ? found.label : type;
};

const EMPTY_FORM = {
  empId: '', empName: '', empEmail: '', department: '',
  accessType: 'website', accessValue: '',
  durationDays: 30, customExpiry: '', notes: '',
};

// ── Audit action meta ─────────────────────────────────────────────────────────
const auditMeta = (action) => {
  const map = {
    ACCESS_GRANTED:       { color: 'green',  icon: <Unlock size={12} />,       label: 'Granted' },
    ACCESS_REVOKED:       { color: 'red',    icon: <Lock size={12} />,         label: 'Revoked' },
    ACCESS_EXPIRED:       { color: 'amber',  icon: <Clock size={12} />,        label: 'Expired' },
    ACCESS_UPDATED:       { color: 'blue',   icon: <Edit2 size={12} />,        label: 'Updated' },
    ACCESS_REMINDER_SENT: { color: 'purple', icon: <Mail size={12} />,         label: 'Reminder' },
    ACCESS_REMINDER_AUTO: { color: 'purple', icon: <Bell size={12} />,         label: 'Auto Reminder' },
  };
  return map[action] || { color: 'muted', icon: <Activity size={12} />, label: action };
};

// ── Audit Log Panel ───────────────────────────────────────────────────────────
function AuditPanel({ onClose }) {
  const [logs,       setLogs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [actionFilt, setActionFilt] = useState('all');
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const LIMIT = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category: 'access_control',
        limit: LIMIT,
        page,
        ...(search ? { search } : {}),
      });
      const data = await apiFetch(`/audit?${params}`);
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error('Failed to load audit logs', err.message);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, actionFilt]);

  const filtered = actionFilt === 'all'
    ? logs
    : logs.filter(l => l.action === actionFilt);

  const actionTypes = [...new Set(logs.map(l => l.action))];

  return (
    <div className="ac-overlay" onClick={onClose}>
      <div className="ac-audit-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ac-audit-header">
          <div className="ac-audit-title">
            <div className="ac-audit-title-icon"><Activity size={16} /></div>
            <div>
              <h2>Audit Log</h2>
              <p>{total} access events recorded</p>
            </div>
          </div>
          <button className="ac-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Filters */}
        <div className="ac-audit-filters">
          <div className="ac-audit-search">
            <Search size={13} />
            <input
              placeholder="Search by name, action, details…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="ac-audit-type-scroll">
            <button
              className={`ac-audit-type-btn${actionFilt === 'all' ? ' active' : ''}`}
              onClick={() => setActionFilt('all')}
            >All</button>
            {actionTypes.map(a => {
              const m = auditMeta(a);
              return (
                <button
                  key={a}
                  className={`ac-audit-type-btn ac-audit-type-${m.color}${actionFilt === a ? ' active' : ''}`}
                  onClick={() => setActionFilt(a)}
                >
                  {m.icon} {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Log list */}
        <div className="ac-audit-list">
          {loading ? (
            <div className="ac-audit-loading">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="ac-audit-skeleton" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="ac-audit-empty">
              <Activity size={32} />
              <p>No audit events found</p>
            </div>
          ) : (
            filtered.map((log, idx) => {
              const meta = auditMeta(log.action);
              return (
                <div key={log.id} className={`ac-audit-item ac-audit-item-${meta.color}`}
                  style={{ animationDelay: `${idx * 20}ms` }}>
                  <div className={`ac-audit-dot ac-audit-dot-${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div className="ac-audit-content">
                    <div className="ac-audit-row1">
                      <span className={`ac-audit-badge ac-audit-badge-${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="ac-audit-time">{timeAgo(log.created_at)}</span>
                    </div>
                    <div className="ac-audit-detail">{log.detail}</div>
                    <div className="ac-audit-meta">
                      <span>by <strong>{log.performed_by || 'System'}</strong></span>
                      <span className="ac-audit-ts">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="ac-audit-pagination">
            <button
              className="ac-btn ac-btn-secondary"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >← Prev</button>
            <span>Page {page} of {Math.ceil(total / LIMIT)}</span>
            <button
              className="ac-btn ac-btn-secondary"
              disabled={page >= Math.ceil(total / LIMIT)}
              onClick={() => setPage(p => p + 1)}
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Grant / Edit Modal ────────────────────────────────────────────────────────
function GrantModal({ onClose, onGranted, editing }) {
  const [form, setForm] = useState(editing ? {
    empId:        editing.emp_id,
    empName:      editing.emp_name,
    empEmail:     editing.emp_email,
    department:   editing.department   || '',
    accessType:   editing.access_type  || 'website',
    accessValue:  editing.access_value || '',
    durationDays: editing.duration_days || 30,
    customExpiry: editing.expiry_date ? editing.expiry_date.split('T')[0] : '',
    notes:        editing.notes || '',
  } : EMPTY_FORM);

  const [saving,    setSaving]    = useState(false);
  const [useCustom, setUseCustom] = useState(!!editing?.expiry_date);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const computedExpiry = () => {
    if (useCustom && form.customExpiry) return form.customExpiry;
    if (!form.durationDays) return null;
    const d = new Date();
    d.setDate(d.getDate() + Number(form.durationDays));
    return d.toISOString().split('T')[0];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        emp_id:       form.empId,
        emp_name:     form.empName,
        emp_email:    form.empEmail,
        department:   form.department,
        access_type:  form.accessType,
        access_value: form.accessType === 'custom' ? form.accessValue : null,
        duration_days: useCustom ? null : Number(form.durationDays),
        expiry_date:  computedExpiry(),
        notes:        form.notes,
      };
      if (editing) {
        await apiFetch(`/access-control/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Access updated', `${form.empName}'s access has been updated`);
      } else {
        await apiFetch('/access-control', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Access granted', `${form.empName} now has ${getTypeLabel(form.accessType)}`);
      }
      onGranted();
      onClose();
    } catch (err) {
      toast.error('Failed', err.message);
    }
    finally { setSaving(false); }
  };

  const presets = [7, 14, 30, 60, 90, 180];

  return (
    <div className="ac-overlay" onClick={onClose}>
      <div className="ac-modal" onClick={e => e.stopPropagation()}>
        <div className="ac-modal-header">
          <div className="ac-modal-title">
            <Shield size={16} />
            {editing ? 'Edit Access' : 'Grant New Access'}
          </div>
          <button className="ac-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="ac-modal-body">
          <form onSubmit={handleSubmit}>
            <div className="ac-section-label">Employee Info</div>
            <div className="ac-form-grid">
              <div className="ac-form-group">
                <label>Employee ID *</label>
                <input required value={form.empId} onChange={e => set('empId', e.target.value)} placeholder="EMP-001" />
              </div>
              <div className="ac-form-group">
                <label>Full Name *</label>
                <input required value={form.empName} onChange={e => set('empName', e.target.value)} placeholder="John Doe" />
              </div>
              <div className="ac-form-group">
                <label>Email *</label>
                <input required type="email" value={form.empEmail} onChange={e => set('empEmail', e.target.value)} placeholder="john@company.com" />
              </div>
              <div className="ac-form-group">
                <label>Department</label>
                <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="IT / HR / Finance" />
              </div>
            </div>

            <div className="ac-section-label">Access Type</div>
            <div className="ac-type-grid">
              {ACCESS_TYPES.map(t => (
                <button key={t.value} type="button"
                  className={`ac-type-btn${form.accessType === t.value ? ' ac-type-active' : ''}`}
                  onClick={() => set('accessType', t.value)}
                  title={t.description}>
                  <t.icon size={15} />
                  <div className="ac-type-content">
                    <span>{t.label}</span>
                    <small>{t.description}</small>
                  </div>
                </button>
              ))}
            </div>

            {form.accessType === 'custom' && (
              <div className="ac-form-group" style={{ marginTop: 12 }}>
                <label>Website / Resource URL *</label>
                <input
                  required
                  value={form.accessValue}
                  onChange={e => set('accessValue', e.target.value)}
                  placeholder="e.g., youtube.com, vpn.company.com, github.com"
                />
                <small style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Enter the specific website or resource the employee needs access to
                </small>
              </div>
            )}

            <div className="ac-section-label">Duration</div>
            <div className="ac-duration-toggle">
              <button type="button" className={`ac-dur-tab${!useCustom ? ' active' : ''}`} onClick={() => setUseCustom(false)}>
                Preset Duration
              </button>
              <button type="button" className={`ac-dur-tab${useCustom ? ' active' : ''}`} onClick={() => setUseCustom(true)}>
                Custom Date
              </button>
            </div>

            {!useCustom ? (
              <div className="ac-preset-grid">
                {presets.map(d => (
                  <button key={d} type="button"
                    className={`ac-preset-btn${Number(form.durationDays) === d ? ' active' : ''}`}
                    onClick={() => set('durationDays', d)}>
                    {d}d
                  </button>
                ))}
                <input type="number" min="1" max="365"
                  className="ac-preset-custom"
                  value={form.durationDays}
                  onChange={e => set('durationDays', e.target.value)}
                  placeholder="Custom days" />
              </div>
            ) : (
              <div className="ac-form-group">
                <label>Expiry Date *</label>
                <input type="date" required={useCustom} value={form.customExpiry}
                  onChange={e => set('customExpiry', e.target.value)}
                  min={new Date().toISOString().split('T')[0]} />
              </div>
            )}

            {computedExpiry() && (
              <div className="ac-expiry-preview">
                <Clock size={13} />
                Access expires on <strong>{computedExpiry()}</strong>
                {!useCustom && form.durationDays && <span> ({form.durationDays} days from today)</span>}
              </div>
            )}

            <div className="ac-form-group" style={{ marginTop: 16 }}>
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Reason for access, project name, etc." rows={2} />
            </div>

            <div className="ac-modal-actions">
              <button type="button" className="ac-btn ac-btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="ac-btn ac-btn-primary" disabled={saving}>
                <Shield size={14} />
                {saving ? 'Saving…' : editing ? 'Update Access' : 'Grant Access'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Revoke Modal ──────────────────────────────────────────────────────────────
function RevokeModal({ record, onClose, onRevoked }) {
  const [loading, setLoading] = useState(false);
  const handleRevoke = async () => {
    setLoading(true);
    try {
      await apiFetch(`/access-control/${record.id}/revoke`, { method: 'PUT' });
      toast.warn('Access revoked', `${record.emp_name}'s ${getTypeLabel(record.access_type)} has been revoked`);
      onRevoked();
      onClose();
    } catch (err) {
      toast.error('Revoke failed', err.message);
    }
    finally { setLoading(false); }
  };
  return (
    <div className="ac-overlay" onClick={onClose}>
      <div className="ac-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="ac-modal-header">
          <div className="ac-modal-title"><Lock size={16} /> Revoke Access</div>
          <button className="ac-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="ac-modal-body">
          <div className="ac-revoke-warn">
            <AlertTriangle size={16} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>This will immediately revoke access</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                <strong>{record.emp_name}</strong> ({record.emp_id}) will lose{' '}
                <strong>{getTypeLabel(record.access_type)}</strong> access
                {record.access_value ? ` (${record.access_value})` : ''} and receive a notification email.
              </div>
            </div>
          </div>
          <div className="ac-modal-actions">
            <button className="ac-btn ac-btn-secondary" onClick={onClose}>Cancel</button>
            <button className="ac-btn ac-btn-danger" onClick={handleRevoke} disabled={loading}>
              <Lock size={14} /> {loading ? 'Revoking…' : 'Revoke Access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Report Modal ──────────────────────────────────────────────────────────────
function ReportModal({ onClose }) {
  const [format, setFormat] = useState('excel');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let url = `${API}/access-control/report/excel`;
      if (dateRange.start && dateRange.end) {
        url += `?start=${dateRange.start}&end=${dateRange.end}`;
      }
      const filename = `access-control-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadFile(url, filename);
      toast.success('Report downloaded', filename);
      onClose();
    } catch (err) {
      toast.error('Failed to generate report', err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="ac-overlay" onClick={onClose}>
      <div className="ac-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="ac-modal-header">
          <div className="ac-modal-title">
            <FileSpreadsheet size={16} />
            Export Access Control Report
          </div>
          <button className="ac-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="ac-modal-body">
          <div className="ac-section-label">Report Format</div>
          <div className="ac-format-options">
            <button
              className={`ac-format-btn ${format === 'excel' ? 'active' : ''}`}
              onClick={() => setFormat('excel')}
            >
              <FileSpreadsheet size={18} />
              Excel (.xlsx)
              <small>Multi-sheet detailed report</small>
            </button>
            <button
              className={`ac-format-btn ${format === 'csv' ? 'active' : ''}`}
              onClick={() => setFormat('csv')}
            >
              <FileText size={18} />
              CSV (.csv)
              <small>Simple spreadsheet format</small>
            </button>
          </div>

          <div className="ac-section-label" style={{ marginTop: 20 }}>Date Range (Optional)</div>
          <div className="ac-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="ac-form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="ac-form-group">
              <label>End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                min={dateRange.start}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="ac-info-box">
            <Shield size={14} />
            <span>The report includes: Access records, employee details, expiry status, department breakdown, and statistics</span>
          </div>

          <div className="ac-modal-actions">
            <button className="ac-btn ac-btn-secondary" onClick={onClose}>Cancel</button>
            <button className="ac-btn ac-btn-primary" onClick={handleGenerate} disabled={generating}>
              <Download size={14} />
              {generating ? 'Generating...' : `Generate ${format.toUpperCase()} Report`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Notification Bell ─────────────────────────────────────────────────────────
function NotificationBell({ records }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const alerts = records.filter(r => {
    const d = daysLeft(r.expiry_date);
    return r.status === 'active' && d !== null && d >= 0 && d <= 7;
  }).sort((a, b) => daysLeft(a.expiry_date) - daysLeft(b.expiry_date));

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="ac-notif-wrap" ref={ref}>
      <button className="ac-notif-bell" onClick={() => setOpen(o => !o)}>
        <Bell size={16} />
        {alerts.length > 0 && <span className="ac-notif-badge">{alerts.length}</span>}
      </button>
      {open && (
        <div className="ac-notif-dropdown">
          <div className="ac-notif-header">
            <Bell size={13} /> Expiring Soon
            <span className="ac-notif-count">{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <div className="ac-notif-empty">
              <CheckCircle size={22} />
              <p>All access is healthy</p>
            </div>
          ) : (
            <div className="ac-notif-list">
              {alerts.map(r => {
                const d = daysLeft(r.expiry_date);
                return (
                  <div key={r.id} className={`ac-notif-item${d <= 2 ? ' ac-notif-urgent' : ''}`}>
                    <div className="ac-notif-avatar">{r.emp_name?.[0] || '?'}</div>
                    <div className="ac-notif-info">
                      <div className="ac-notif-name">{r.emp_name}</div>
                      <div className="ac-notif-sub">{getTypeLabel(r.access_type)}</div>
                    </div>
                    <div className={`ac-notif-days${d <= 2 ? ' urgent' : ''}`}>
                      {d === 0 ? 'Today' : `${d}d`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccessControl() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showGrant,  setShowGrant]  = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAudit,  setShowAudit]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [revoking,   setRevoking]   = useState(null);
  const [sending,    setSending]    = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/dashboard');
  }, [user, navigate]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/access-control');
      setRecords(data.data || []);
    } catch (err) {
      toast.error('Failed to load records', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const sendReminderEmail = async (id, empName) => {
    setSending(id);
    try {
      await apiFetch(`/access-control/${id}/remind`, { method: 'POST' });
      toast.success('Reminder sent', `Email sent to ${empName}`);
    } catch (err) {
      toast.error('Reminder failed', err.message);
    } finally { setSending(null); }
  };

  const handleQuickExport = async (format) => {
    try {
      let url, filename;
      if (format === 'excel') {
        url = `${API}/access-control/report/excel`;
        filename = `access-control-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      } else {
        url = `${API}/access-control/export/csv`;
        filename = `access-control-${new Date().toISOString().split('T')[0]}.csv`;
      }
      await downloadFile(url, filename);
      toast.success(`${format.toUpperCase()} exported`, filename);
      setShowExportMenu(false);
    } catch (err) {
      toast.error('Export failed', err.message);
    }
  };

  const filtered = records.filter(r => {
    const matchSearch = !search || [r.emp_id, r.emp_name, r.emp_email, r.department, r.access_value]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const days = daysLeft(r.expiry_date);
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'active'   ? (r.status === 'active' && (days === null || days > 0)) :
      filter === 'expiring' ? (days !== null && days >= 0 && days <= 7) :
      filter === 'expired'  ? (r.status === 'expired' || (days !== null && days < 0)) :
      filter === 'revoked'  ? r.status === 'revoked' : true;
    const matchType = typeFilter === 'all' || r.access_type === typeFilter;
    return matchSearch && matchFilter && matchType;
  });

  const stats = {
    total:    records.length,
    active:   records.filter(r => r.status === 'active' && (daysLeft(r.expiry_date) === null || daysLeft(r.expiry_date) > 0)).length,
    expiring: records.filter(r => { const d = daysLeft(r.expiry_date); return r.status === 'active' && d !== null && d >= 0 && d <= 7; }).length,
    expired:  records.filter(r => r.status === 'expired' || (r.status === 'active' && daysLeft(r.expiry_date) !== null && daysLeft(r.expiry_date) < 0)).length,
    revoked:  records.filter(r => r.status === 'revoked').length,
    critical: records.filter(r => { const d = daysLeft(r.expiry_date); return r.status === 'active' && d !== null && d >= 0 && d <= 2; }).length,
  };

  return (
    <div className="ac-page fade-in">
      <ToastContainer />

      {/* ── Header ── */}
      <div className="ac-page-header">
        <div className="ac-header-left">
          <div className="ac-header-icon"><Shield size={22} /></div>
          <div>
            <h1>Access Control</h1>
            <p>Manage website, USB &amp; custom access for employees</p>
          </div>
        </div>
        <div className="ac-header-actions">
          {/* Notification Bell */}
          <NotificationBell records={records} />

          {/* Audit Log Button */}
          <button className="ac-btn ac-btn-ghost" onClick={() => setShowAudit(true)} title="View Audit Log">
            <Activity size={15} /> Audit Log
          </button>

          <div className="ac-export-dropdown">
            <button
              className="ac-btn ac-btn-secondary"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <Download size={15} /> Export <ChevronDown size={14} />
            </button>
            {showExportMenu && (
              <div className="ac-dropdown-menu">
                <button onClick={() => handleQuickExport('excel')}>
                  <FileSpreadsheet size={14} /> Export as Excel
                </button>
                <button onClick={() => handleQuickExport('csv')}>
                  <FileText size={14} /> Export as CSV
                </button>
                <hr />
                <button onClick={() => { setShowReport(true); setShowExportMenu(false); }}>
                  <Download size={14} /> Advanced Report Options
                </button>
              </div>
            )}
          </div>
          <button className="ac-btn ac-btn-primary" onClick={() => { setEditing(null); setShowGrant(true); }}>
            <Plus size={15} /> Grant Access
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="ac-stats">
        {[
          { label: 'Total',        value: stats.total,    color: 'blue',  filter: 'all' },
          { label: 'Active',       value: stats.active,   color: 'green', filter: 'active' },
          { label: 'Expiring ≤7d', value: stats.expiring, color: 'amber', filter: 'expiring', pulse: stats.expiring > 0 },
          { label: 'Expired',      value: stats.expired,  color: 'red',   filter: 'expired',  pulse: stats.expired > 0 },
          { label: 'Revoked',      value: stats.revoked,  color: 'muted', filter: 'revoked' },
        ].map(s => (
          <div key={s.label}
            className={`ac-stat ac-stat-${s.color}${s.pulse ? ' ac-stat-pulse' : ''}${filter === s.filter ? ' ac-stat-active' : ''}`}
            onClick={() => setFilter(s.filter)}>
            <div className="ac-stat-value">{s.value}</div>
            <div className="ac-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Banners ── */}
      {stats.critical > 0 && (
        <div className="ac-alert-banner ac-alert-critical">
          <AlertTriangle size={15} />
          <strong>{stats.critical} record{stats.critical !== 1 ? 's' : ''} expiring in ≤2 days!</strong>
          <span>Urgent action required.</span>
        </div>
      )}
      {stats.expiring > 0 && stats.critical === 0 && (
        <div className="ac-alert-banner">
          <Bell size={15} />
          <strong>{stats.expiring} record{stats.expiring !== 1 ? 's' : ''} expiring within 7 days</strong>
          — employees are notified automatically.
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="ac-toolbar">
        <div className="ac-search">
          <Search size={14} />
          <input placeholder="Search name, ID, email, resource…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="ac-toggle-group">
          {['all','website','usb','both','full','custom'].map(t => (
            <button key={t}
              className={`ac-toggle${typeFilter === t ? ' active' : ''}`}
              onClick={() => setTypeFilter(t)}>
              {t === 'all' ? 'All' : t === 'website' ? '🌐 Web' : t === 'usb' ? '🔌 USB'
                : t === 'both' ? '⚡ Both' : t === 'full' ? '✨ Full' : '🔗 Custom'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="ac-table-wrap">
        {loading ? (
          <div className="ac-loading">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="ac-skeleton" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="ac-empty">
            <Shield size={40} />
            <p>No access records found</p>
            <button className="ac-btn ac-btn-primary" onClick={() => setShowGrant(true)}>
              <Plus size={14} /> Grant First Access
            </button>
          </div>
        ) : (
          <table className="ac-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Access Type</th>
                <th>Resource / URL</th>
                <th>Granted On</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const days     = daysLeft(r.expiry_date);
                const isExpired = r.status === 'expired' || (days !== null && days < 0);
                const isRevoked = r.status === 'revoked';
                const isCritical = r.status === 'active' && days !== null && days >= 0 && days <= 2;
                const isActive   = !isExpired && !isRevoked;

                return (
                  <tr key={r.id}
                    className={[
                      isExpired  && !isRevoked ? 'ac-row-expired'  : '',
                      isRevoked               ? 'ac-row-revoked'  : '',
                      isCritical              ? 'ac-row-blink'    : '',
                    ].filter(Boolean).join(' ')}>

                    <td>
                      <div className="ac-emp-cell">
                        <div className="ac-avatar">{r.emp_name?.[0] || '?'}</div>
                        <div>
                          <div className="ac-emp-name">{r.emp_name}</div>
                          <div className="ac-emp-meta">{r.emp_id}{r.department ? ` · ${r.department}` : ''}</div>
                          <div className="ac-emp-email">{r.emp_email}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`ac-type-tag ac-type-${r.access_type}`}>
                        {getTypeIcon(r.access_type)}
                        {getTypeLabel(r.access_type)}
                      </span>
                    </td>

                    <td>
                      {r.access_type === 'custom' ? (
                        <div className="ac-resource-cell">
                          <Link size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          <span className="ac-resource-url">
                            {r.access_value || <em style={{ color: 'var(--text-muted)' }}>No URL set</em>}
                          </span>
                        </div>
                      ) : r.access_type === 'website' ? (
                        <div className="ac-resource-cell">
                          <Globe size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>General Web Access</span>
                        </div>
                      ) : r.access_type === 'full' ? (
                        <div className="ac-resource-cell">
                          <Wifi size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Full System Access</span>
                        </div>
                      ) : r.access_type === 'usb' ? (
                        <div className="ac-resource-cell">
                          <Usb size={12} style={{ color: 'var(--green)', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>USB Devices</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                      {formatDate(r.created_at)}
                    </td>

                    <td>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 4 }}>
                        {r.expiry_date ? formatDate(r.expiry_date) : '—'}
                      </div>
                      <StatusChip days={days} />
                    </td>

                    <td>
                      {isRevoked ? (
                        <span className="ac-status-badge ac-status-revoked"><Lock size={11} /> Revoked</span>
                      ) : isExpired ? (
                        <span className="ac-status-badge ac-status-expired"><AlertTriangle size={11} /> Expired</span>
                      ) : isCritical ? (
                        <span className="ac-status-badge ac-status-critical"><AlertTriangle size={11} /> Critical</span>
                      ) : (
                        <span className="ac-status-badge ac-status-active"><CheckCircle size={11} /> Active</span>
                      )}
                    </td>

                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 140 }}>
                      {r.notes || '—'}
                    </td>

                    <td>
                      <div className="ac-actions">
                        {isActive && (
                          <>
                            {r.expiry_date && (
                              <button className="ac-action-btn" title="Send Reminder"
                                onClick={() => sendReminderEmail(r.id, r.emp_name)}
                                disabled={sending === r.id}>
                                {sending === r.id
                                  ? <RefreshCw size={13} className="ac-spin" />
                                  : <Mail size={13} />}
                              </button>
                            )}
                            <button className="ac-action-btn" title="Edit Access"
                              onClick={() => { setEditing(r); setShowGrant(true); }}>
                              <Edit2 size={13} />
                            </button>
                            <button className="ac-action-btn ac-action-danger" title="Revoke Access"
                              onClick={() => setRevoking(r)}>
                              <Lock size={13} />
                            </button>
                          </>
                        )}
                        {(isRevoked || isExpired) && (
                          <button className="ac-action-btn ac-action-success" title="Re-grant Access"
                            onClick={() => { setEditing(r); setShowGrant(true); }}>
                            <Unlock size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {showGrant && (
        <GrantModal
          editing={editing}
          onClose={() => { setShowGrant(false); setEditing(null); }}
          onGranted={fetchRecords}
        />
      )}
      {revoking && (
        <RevokeModal
          record={revoking}
          onClose={() => setRevoking(null)}
          onRevoked={fetchRecords}
        />
      )}
      {showReport && (
        <ReportModal onClose={() => setShowReport(false)} />
      )}
      {showAudit && (
        <AuditPanel onClose={() => setShowAudit(false)} />
      )}
    </div>
  );
}