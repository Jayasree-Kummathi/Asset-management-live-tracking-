import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Plus, Edit2, X, Clock, Usb, Globe,
  AlertTriangle, CheckCircle, Mail, RefreshCw, Search,
  Bell, Lock, Unlock, Link, Wifi,
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

const daysLeft = (expiryDate) => {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-CA') : '—';

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
      } else {
        await apiFetch('/access-control', { method: 'POST', body: JSON.stringify(payload) });
      }
      onGranted();
      onClose();
    } catch (err) { alert(err.message); }
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

            {/* ── Custom URL field — only shown when type = custom ── */}
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
      onRevoked();
      onClose();
    } catch (err) { alert(err.message); }
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
  const [editing,    setEditing]    = useState(null);
  const [revoking,   setRevoking]   = useState(null);
  const [sending,    setSending]    = useState(null);

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/dashboard');
  }, [user, navigate]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/access-control');
      setRecords(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const sendReminderEmail = async (id) => {
    setSending(id);
    try {
      await apiFetch(`/access-control/${id}/remind`, { method: 'POST' });
      alert('Reminder email sent successfully');
    } catch (err) { alert(err.message); }
    finally { setSending(null); }
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
      {/* ── Header ── */}
      <div className="ac-page-header">
        <div className="ac-header-left">
          <div className="ac-header-icon"><Shield size={22} /></div>
          <div>
            <h1>Access Control</h1>
            <p>Manage website, USB &amp; custom access for employees</p>
          </div>
        </div>
        <button className="ac-btn ac-btn-primary" onClick={() => { setEditing(null); setShowGrant(true); }}>
          <Plus size={15} /> Grant Access
        </button>
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

                    {/* Employee */}
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

                    {/* Access Type badge */}
                    <td>
                      <span className={`ac-type-tag ac-type-${r.access_type}`}>
                        {getTypeIcon(r.access_type)}
                        {getTypeLabel(r.access_type)}
                      </span>
                    </td>

                    {/* ── Resource / URL column — FIXED ── */}
                    <td>
                      {r.access_type === 'custom' ? (
                        // Custom always shows the URL — this was the bug
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

                    {/* Granted date */}
                    <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                      {formatDate(r.created_at)}
                    </td>

                    {/* Expiry */}
                    <td>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 4 }}>
                        {r.expiry_date ? formatDate(r.expiry_date) : '—'}
                      </div>
                      <StatusChip days={days} />
                    </td>

                    {/* Status badge */}
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

                    {/* Notes */}
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 140 }}>
                      {r.notes || '—'}
                    </td>

                    {/* ── Actions — FIXED: always visible based on status ── */}
                    <td>
                      <div className="ac-actions">
                        {isActive && (
                          <>
                            {/* Remind — only if has expiry */}
                            {r.expiry_date && (
                              <button className="ac-action-btn" title="Send Reminder"
                                onClick={() => sendReminderEmail(r.id)}
                                disabled={sending === r.id}>
                                {sending === r.id
                                  ? <RefreshCw size={13} className="ac-spin" />
                                  : <Mail size={13} />}
                              </button>
                            )}
                            {/* Edit */}
                            <button className="ac-action-btn" title="Edit Access"
                              onClick={() => { setEditing(r); setShowGrant(true); }}>
                              <Edit2 size={13} />
                            </button>
                            {/* Revoke */}
                            <button className="ac-action-btn ac-action-danger" title="Revoke Access"
                              onClick={() => setRevoking(r)}>
                              <Lock size={13} />
                            </button>
                          </>
                        )}
                        {(isRevoked || isExpired) && (
                          /* Re-grant */
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
    </div>
  );
}