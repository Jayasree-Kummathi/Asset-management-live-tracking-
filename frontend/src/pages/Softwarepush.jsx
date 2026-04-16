import React, { useState, useEffect, useRef } from 'react';
import { Upload, Package, Send, Check, X, AlertTriangle, RefreshCw, Download, Trash2, Eye } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'https://yourdomain.com/api';
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const res   = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...(!opts.body?.append ? { 'Content-Type': 'application/json' } : {}) },
    ...opts,
  });
  return res.json();
};

const STATUS_COLOR = {
  pending:     { bg: 'rgba(99,102,241,.1)',  color: '#6366f1', label: 'Pending' },
  downloading: { bg: 'rgba(245,158,11,.1)',  color: '#f59e0b', label: 'Downloading' },
  installing:  { bg: 'rgba(245,158,11,.1)',  color: '#f59e0b', label: 'Installing' },
  done:        { bg: 'rgba(34,197,94,.1)',   color: '#22c55e', label: 'Installed ✅' },
  failed:      { bg: 'rgba(239,68,68,.1)',   color: '#ef4444', label: 'Failed ❌' },
};

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

function timeAgo(date) {
  if (!date) return '—';
  const sec = Math.floor((Date.now() - new Date(date)) / 1000);
  if (sec < 60)    return 'Just now';
  if (sec < 3600)  return `${Math.floor(sec/60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec/3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

// ── Push Modal ────────────────────────────────────────────────────────────────
function PushModal({ pkg, onClose }) {
  const [assets,    setAssets]    = useState([]);
  const [selected,  setSelected]  = useState([]);
  const [pushAll,   setPushAll]   = useState(false);
  const [pushing,   setPushing]   = useState(false);
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    apiFetch('/agent/locations').then(r => setAssets(r.data || []));
  }, []);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const push = async () => {
    setPushing(true);
    try {
      const body = pushAll ? { all: true } : { asset_ids: selected };
      const res  = await apiFetch(`/agent/software/${pkg.id}/push`, { method: 'POST', body: JSON.stringify(body) });
      if (res.success) setDone(true);
    } catch (_) {}
    setPushing(false);
  };

  if (done) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Push scheduled!</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Agents will download and install <strong>{pkg.name}</strong> silently on next check-in (within 3 minutes). No user interaction needed.
          </div>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><Send size={15} style={{ marginRight: 8, verticalAlign: 'middle' }}/>Push {pkg.name}</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            📦 <strong>{pkg.name}</strong> {pkg.version ? `v${pkg.version}` : ''} · {fmtSize(pkg.filesize)}<br/>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Silent install args: <code>{pkg.silent_args}</code></span>
          </div>

          {/* Push all toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
            <input type="checkbox" checked={pushAll} onChange={e => setPushAll(e.target.checked)}/>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Push to ALL active laptops ({assets.filter(a => a.is_online).length} online)</span>
          </label>

          {/* Individual selection */}
          {!pushAll && (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Select laptops to push to:
              </div>
              {assets.map(a => (
                <label key={a.asset_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.includes(a.asset_id)} onChange={() => toggle(a.asset_id)}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.emp_name || 'Unallocated'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.asset_id} · {a.brand} {a.model}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: a.is_online ? 'rgba(34,197,94,.1)' : 'rgba(107,114,128,.1)', color: a.is_online ? '#22c55e' : '#6b7280' }}>
                    {a.is_online ? 'Online' : 'Offline'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={pushing || (!pushAll && !selected.length)} onClick={push}>
            <Send size={14}/> {pushing ? 'Scheduling…' : `Push to ${pushAll ? 'all' : selected.length} laptop${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status Modal ──────────────────────────────────────────────────────────────
function StatusModal({ pkg, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/agent/software/${pkg.id}/status`)
      .then(r => setTasks(r.data || []))
      .finally(() => setLoading(false));
  }, [pkg.id]);

  const counts = tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status]||0)+1; return acc; }, {});

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><Eye size={15} style={{ marginRight: 8, verticalAlign: 'middle' }}/>Push Status — {pkg.name}</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          {/* Summary */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_COLOR).filter(([k]) => counts[k]).map(([k, v]) => (
              <div key={k} style={{ padding: '4px 12px', borderRadius: 20, background: v.bg, color: v.color, fontSize: 12, fontWeight: 600 }}>
                {v.label}: {counts[k]}
              </div>
            ))}
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Employee', 'Asset', 'Status', 'Pushed', 'Completed', 'Details'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => {
                    const sc = STATUS_COLOR[t.status] || STATUS_COLOR.pending;
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{t.emp_name || '—'}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', color: 'var(--accent)', fontSize: 11 }}>{t.asset_id}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600 }}>{sc.label}</span>
                        </td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{timeAgo(t.pushed_at)}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{t.completed_at ? timeAgo(t.completed_at) : '—'}</td>
                        <td style={{ padding: '6px 10px', fontSize: 11, color: t.error_msg ? 'var(--red)' : 'var(--text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.error_msg || t.result_log || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SoftwarePush() {
  const [packages,    setPackages]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [pushModal,   setPushModal]   = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [uploadForm,  setUploadForm]  = useState({ name: '', version: '', description: '', silent_args: '/S /silent /quiet' });
  const fileRef = useRef();

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/agent/software');
      if (r.success) setPackages(r.data || []);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchPackages(); }, []);

  const uploadPackage = async (file) => {
    if (!file || !uploadForm.name) return alert('Package name is required');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file',        file);
      fd.append('name',        uploadForm.name);
      fd.append('version',     uploadForm.version);
      fd.append('description', uploadForm.description);
      fd.append('silent_args', uploadForm.silent_args);

      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/agent/software`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        fetchPackages();
        setUploadForm({ name: '', version: '', description: '', silent_args: '/S /silent /quiet' });
        fileRef.current.value = '';
      } else {
        alert(data.message || 'Upload failed');
      }
    } catch (e) { alert('Upload error: ' + e.message); }
    setUploading(false);
  };

  const deletePackage = async (id) => {
    if (!window.confirm('Remove this package?')) return;
    await apiFetch(`/agent/software/${id}`, { method: 'DELETE' });
    fetchPackages();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Software Push</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Upload software → push to employee laptops → installs silently in background</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchPackages}><RefreshCw size={13}/> Refresh</button>
      </div>

      {/* ── Upload form ── */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Upload New Package</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Package Name *</label>
            <input className="form-input" placeholder="e.g. Chrome Browser" value={uploadForm.name} onChange={e => setUploadForm(f => ({...f, name: e.target.value}))}/>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Version</label>
            <input className="form-input" placeholder="e.g. 120.0.1" value={uploadForm.version} onChange={e => setUploadForm(f => ({...f, version: e.target.value}))}/>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Silent Install Arguments</label>
          <input className="form-input" placeholder="/S /silent /quiet" value={uploadForm.silent_args} onChange={e => setUploadForm(f => ({...f, silent_args: e.target.value}))}/>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Common: EXE → <code>/S</code> or <code>/silent</code> · MSI → <code>/qn /norestart</code> · NSIS → <code>/S</code> · Inno Setup → <code>/VERYSILENT /SUPPRESSMSGBOXES</code>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Description</label>
          <input className="form-input" placeholder="What does this install?" value={uploadForm.description} onChange={e => setUploadForm(f => ({...f, description: e.target.value}))}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input ref={fileRef} type="file" accept=".exe,.msi,.zip,.bat" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && uploadPackage(e.target.files[0])}/>
          <button className="btn btn-primary" disabled={uploading || !uploadForm.name} onClick={() => fileRef.current.click()}>
            <Upload size={14}/> {uploading ? 'Uploading…' : 'Select File & Upload'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supports .exe, .msi, .zip, .bat · Max 500MB</span>
        </div>
      </div>

      {/* ── Package list ── */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Package</th>
              <th>Size</th>
              <th>Silent args</th>
              <th>Uploaded</th>
              <th>Push stats</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="empty-state"><p>Loading…</p></div></td></tr>
            ) : packages.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <Package size={32} style={{ opacity: .3 }}/>
                  <p>No packages uploaded yet. Upload an EXE or MSI above to get started.</p>
                </div>
              </td></tr>
            ) : packages.map(pkg => (
              <tr key={pkg.id}>
                <td>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{pkg.name}</div>
                  {pkg.version && <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>v{pkg.version}</div>}
                  {pkg.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pkg.description}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--mono)' }}>{pkg.filename}</div>
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmtSize(pkg.filesize)}</td>
                <td><code style={{ fontSize: 11, background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>{pkg.silent_args}</code></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <div>{timeAgo(pkg.uploaded_at)}</div>
                  <div style={{ fontSize: 11 }}>by {pkg.uploaded_by}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                    {pkg.push_success > 0 && <span style={{ color: '#22c55e', fontWeight: 600 }}>✅ {pkg.push_success}</span>}
                    {pkg.push_failed  > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>❌ {pkg.push_failed}</span>}
                    {pkg.push_pending > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>⏳ {pkg.push_pending}</span>}
                    {!pkg.push_success && !pkg.push_failed && !pkg.push_pending && <span style={{ color: 'var(--text-muted)' }}>No pushes yet</span>}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => setPushModal(pkg)} title="Push to laptops">
                      <Send size={11}/> Push
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setStatusModal(pkg)} title="View push status">
                      <Eye size={11}/>
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => deletePackage(pkg.id)} title="Delete package" style={{ color: 'var(--red)' }}>
                      <Trash2 size={11}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pushModal   && <PushModal   pkg={pushModal}   onClose={() => setPushModal(null)}/>}
      {statusModal && <StatusModal pkg={statusModal} onClose={() => setStatusModal(null)}/>}
    </div>
  );
}