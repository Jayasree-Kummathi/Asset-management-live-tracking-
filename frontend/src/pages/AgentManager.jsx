import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldOff, Copy, RefreshCw, Check,
  AlertTriangle, Wifi, WifiOff, Clock, X, Download,
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...opts,
  });
  return res.json();
};

function timeAgo(date) {
  if (!date) return '—';
  const sec = Math.floor((Date.now() - new Date(date)) / 1000);
  if (sec < 60)    return 'Just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// ── Disable Modal ─────────────────────────────────────────────────────────────
function DisableModal({ reg, onConfirm, onClose }) {
  const [note, setNote] = useState('');
  const reasons = ['Employee resigned', 'Laptop returned', 'Security concern', 'Maintenance', 'Other'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><ShieldOff size={15} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--red)' }}/>Disable Agent</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <strong>{reg.emp_name || reg.hostname || reg.asset_id}</strong> will stop reporting to the dashboard. The agent stays installed on the laptop but reports will be rejected.
          </div>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {reasons.map(r => (
                <button key={r} type="button"
                  className={`toggle-btn ${note === r ? 'active' : ''}`}
                  style={{ fontSize: 11 }}
                  onClick={() => setNote(r)}>
                  {r}
                </button>
              ))}
            </div>
            <input className="form-input" placeholder="Or type a custom reason…" value={note} onChange={e => setNote(e.target.value)}/>
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn" style={{ flex: 1, background: 'var(--red)', color: '#fff' }} onClick={() => onConfirm(note)}>
            <ShieldOff size={14}/> Disable Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AgentManager() {
  const [registrations, setRegistrations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [installToken,  setInstallToken]  = useState(null);
  const [tokenLoading,  setTokenLoading]  = useState(false);
  const [tokenCopied,   setTokenCopied]   = useState(false);
  const [disableModal,  setDisableModal]  = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [search,        setSearch]        = useState('');
  const [filter,        setFilter]        = useState('All'); // All | Enabled | Disabled

  const fetchRegs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/agent/registrations');
      if (res.success) setRegistrations(res.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRegs(); }, []);

  const generateToken = async () => {
    setTokenLoading(true);
    try {
      const res = await apiFetch('/agent/generate-token', { method: 'POST' });
      if (res.success) setInstallToken(res);
    } catch (_) {}
    finally { setTokenLoading(false); }
  };

  const copyToken = (text) => {
    navigator.clipboard.writeText(text);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const toggleAgent = async (reg, enable, note = '') => {
    setActionLoading(reg.id);
    try {
      const res = await apiFetch(`/agent/registrations/${reg.id}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: enable, note }),
      });
      if (res.success) {
        setRegistrations(prev => prev.map(r =>
          r.id === reg.id ? { ...r, is_enabled: enable, disable_note: note, disabled_by: enable ? null : 'Admin', disabled_at: enable ? null : new Date().toISOString() } : r
        ));
      }
    } catch (_) {}
    finally {
      setActionLoading(null);
      setDisableModal(null);
    }
  };

  const filtered = registrations.filter(r => {
    const ms = !search || [r.hostname, r.asset_id, r.emp_name, r.emp_id, r.mac_address]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const mf = filter === 'All'
      || (filter === 'Enabled'  && r.is_enabled !== false)
      || (filter === 'Disabled' && r.is_enabled === false);
    return ms && mf;
  });

  const enabledCount  = registrations.filter(r => r.is_enabled !== false).length;
  const disabledCount = registrations.filter(r => r.is_enabled === false).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Agent Management</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Enable/disable agents · Generate install tokens · No password needed on laptops</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchRegs}><RefreshCw size={13}/> Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={generateToken} disabled={tokenLoading}>
            <Shield size={13}/> {tokenLoading ? 'Generating…' : 'Generate Install Token'}
          </button>
        </div>
      </div>

      {/* ── Install token card ── */}
      {installToken && (
        <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={15}/> Install Token Generated
            </div>
            <button className="btn btn-icon btn-sm" onClick={() => setInstallToken(null)}><X size={14}/></button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            Valid for 24 hours · One-time use · No admin password needed on target laptop
          </div>

          {/* Token display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <code style={{ flex: 1, background: 'var(--surface2)', padding: '8px 12px', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '.05em', wordBreak: 'break-all' }}>
              {installToken.token}
            </code>
            <button className="btn btn-secondary btn-sm" onClick={() => copyToken(installToken.token)}>
              {tokenCopied ? <Check size={13} color="var(--green)"/> : <Copy size={13}/>}
            </button>
          </div>

          {/* Instructions */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>How to use on the employee laptop:</div>
          <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)', marginBottom: 10 }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}># Step 1 — No admin password needed. Just double-click:</div>
            <div>install_token.bat</div>
            <div style={{ color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}># Or run from USB with the token:</div>
            <div>MindteckAssetAgent.exe --token {installToken.token}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => copyToken(`MindteckAssetAgent.exe --token ${installToken.token}`)}>
              <Copy size={12}/> Copy install command
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const content = `@echo off\necho Installing Mindteck Agent...\nMindteckAssetAgent.exe --token ${installToken.token}\necho Done!\npause`;
              const blob = new Blob([content], { type: 'text/plain' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'install_token.bat';
              a.click();
            }}>
              <Download size={12}/> Download install_token.bat
            </button>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[
          { label: 'Total registered', val: registrations.length, color: 'var(--accent)' },
          { label: 'Enabled', val: enabledCount, color: 'var(--green)' },
          { label: 'Disabled', val: disabledCount, color: 'var(--red)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'var(--mono)' }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Search + filter ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder="Search hostname, asset, employee…"
          style={{ flex: 1, maxWidth: 300 }}
          value={search} onChange={e => setSearch(e.target.value)}/>
        <div className="toggle-group">
          {['All', 'Enabled', 'Disabled'].map(f => (
            <button key={f} className={`toggle-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {/* ── Registrations table ── */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>Employee</th>
              <th>Asset</th>
              <th>Last seen</th>
              <th>Status</th>
              <th>Disabled info</th>
              <th style={{ textAlign: 'center' }}>Control</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}><div className="empty-state"><p>Loading…</p></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><p>No registered agents found.</p></div></td></tr>
            ) : filtered.map(reg => {
              const isEnabled = reg.is_enabled !== false;
              const isLoading = actionLoading === reg.id;

              return (
                <tr key={reg.id} style={{ opacity: isEnabled ? 1 : 0.6 }}>

                  {/* Device */}
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                      {reg.hostname || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{reg.mac_address}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{reg.ip_address}</div>
                  </td>

                  {/* Employee */}
                  <td>
                    {reg.emp_name
                      ? <div><div style={{ fontWeight: 600, fontSize: 13 }}>{reg.emp_name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{reg.emp_id}</div></div>
                      : <span style={{ fontSize: 12, color: 'var(--amber)' }}>⚠ Unallocated</span>}
                  </td>

                  {/* Asset */}
                  <td>
                    {reg.asset_id
                      ? <div><div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{reg.asset_id}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{reg.brand} {reg.model}</div></div>
                      : <span style={{ fontSize: 12, color: 'var(--amber)' }}>Pending assign</span>}
                  </td>

                  {/* Last seen */}
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                    <div>{timeAgo(reg.last_seen)}</div>
                    <div style={{ fontSize: 10 }}>{reg.last_seen ? new Date(reg.last_seen).toLocaleDateString() : '—'}</div>
                  </td>

                  {/* Status */}
                  <td>
                    {isEnabled ? (
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Shield size={9}/> Enabled
                      </span>
                    ) : (
                      <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShieldOff size={9}/> Disabled
                      </span>
                    )}
                  </td>

                  {/* Disabled info */}
                  <td>
                    {!isEnabled ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {reg.disabled_by && <div>By: <strong>{reg.disabled_by}</strong></div>}
                        {reg.disabled_at && <div>{timeAgo(reg.disabled_at)}</div>}
                        {reg.disable_note && <div style={{ color: 'var(--amber)', marginTop: 2 }}>📝 {reg.disable_note}</div>}
                      </div>
                    ) : '—'}
                  </td>

                  {/* Toggle button */}
                  <td style={{ textAlign: 'center' }}>
                    {isEnabled ? (
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(239,68,68,.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.3)' }}
                        disabled={isLoading}
                        onClick={() => setDisableModal(reg)}>
                        <ShieldOff size={12}/> {isLoading ? '…' : 'Disable'}
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(34,197,94,.1)', color: 'var(--green)', border: '1px solid rgba(34,197,94,.3)' }}
                        disabled={isLoading}
                        onClick={() => toggleAgent(reg, true)}>
                        <Shield size={12}/> {isLoading ? '…' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Disable modal ── */}
      {disableModal && (
        <DisableModal
          reg={disableModal}
          onConfirm={(note) => toggleAgent(disableModal, false, note)}
          onClose={() => setDisableModal(null)}
        />
      )}
    </div>
  );
}