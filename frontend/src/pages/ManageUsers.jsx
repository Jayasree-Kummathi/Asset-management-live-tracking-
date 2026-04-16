import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Trash2, X, RefreshCw, Search, Shield, Users, UserCheck,
  Camera, Upload, Star, Briefcase, CheckCircle, Eye, EyeOff,
  Copy, AlertTriangle, Edit2, Key, UserX, UserPlus, Lock
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem('token');
  const res   = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const roleConfig = {
  admin:    { label: 'Administrator', color: 'var(--accent)',      bg: 'var(--accent-glow)' },
  it_staff: { label: 'IT Staff',      color: 'var(--green)',       bg: 'var(--green-bg)' },
  employee: { label: 'Employee',      color: 'var(--text-muted)', bg: 'var(--surface2)' },
};

const DESIGNATION_SUGGESTIONS = [
  'IT Manager', 'Assistant Manager', 'Senior IT Lead', 'IT Lead',
  'Senior Team Lead', 'Team Lead', 'IT Engineer', 'Senior IT Engineer',
  'Senior IT Staff', 'IT Admin', 'IT Staff', 'IT Support',
  'Network Engineer', 'Systems Administrator', 'Asset Operations Lead', 'Asset Ops Admin',
];

// ── Generate a random strong password ────────────────────────────────────────
const generatePassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 4; i < 12; i++) pwd.push(all[Math.floor(Math.random() * all.length)]);
  return pwd.sort(() => Math.random() - 0.5).join('');
};

// ── API helpers ───────────────────────────────────────────────────────────────
const getTeamMembers = async () => {
  try { const d = await apiFetch('/team-members'); return d.data || []; }
  catch { return []; }
};

const upsertTeamMember = async (user) => {
  await apiFetch('/team-members', { method: 'POST', body: JSON.stringify(user) });
};

const removeTeamMember = async (userId) => {
  try { await apiFetch(`/team-members/${userId}`, { method: 'DELETE' }); } catch {}
};

const getNextPriority = async () => {
  const team = await getTeamMembers();
  return team.length ? Math.max(...team.map(m => m.priority ?? 0)) + 1 : 1;
};

// ── Success overlay shown INSIDE modal before closing ────────────────────────
function SuccessOverlay({ name, role, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  const rc = roleConfig[role] || roleConfig.employee;
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 'inherit',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      zIndex: 10, animation: 'fadeIn .25s ease',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 32,
        background: `${rc.color}18`, border: `2px solid ${rc.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'scaleIn .3s ease',
      }}>
        <CheckCircle size={28} color={rc.color} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>User Created!</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          <strong style={{ color: rc.color }}>{name}</strong> has been added as {rc.label}.<br/>
          Welcome email sent with login credentials.
        </div>
      </div>
      <div style={{
        width: 140, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: rc.color, borderRadius: 2,
          animation: 'progressBar 2s linear forwards',
        }} />
      </div>
      <style>{`
        @keyframes scaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes progressBar { from { width: 0; } to { width: 100%; } }
      `}</style>
    </div>
  );
}

// ── Designation field with type-ahead ────────────────────────────────────────
function DesignationInput({ value, onChange, required }) {
  const [open,  setOpen]  = useState(false);
  const [local, setLocal] = useState(value || '');
  const wrapRef           = useRef(null);

  useEffect(() => { setLocal(value || ''); }, [value]);
  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = DESIGNATION_SUGGESTIONS.filter(d =>
    !local || d.toLowerCase().includes(local.toLowerCase())
  );
  const pick = (d) => { setLocal(d); onChange(d); setOpen(false); };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input className="form-input" required={required} value={local}
        placeholder="e.g. IT Manager, Senior Team Lead…"
        onChange={e => { setLocal(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: '0 8px 28px rgba(0,0,0,.45)',
          maxHeight: 180, overflowY: 'auto',
        }}>
          {filtered.map(d => (
            <div key={d} onMouseDown={e => { e.preventDefault(); pick(d); }}
              style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Briefcase size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />{d}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Photo capture / upload ────────────────────────────────────────────────────
function PhotoCapture({ value, onChange }) {
  const [mode, setMode] = useState('idle');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setMode('webcam');
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch { alert('Camera not available — please upload a photo instead.'); }
  };

  const stopStream = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };

  const capture = () => {
    const v = videoRef.current; if (!v) return;
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    const side = Math.min(v.videoWidth, v.videoHeight);
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 200, 200);
    stopStream(); onChange(c.toDataURL('image/jpeg', 0.85)); setMode('preview');
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 200; c.height = 200;
        const ctx = c.getContext('2d');
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 200, 200);
        onChange(c.toDataURL('image/jpeg', 0.85)); setMode('preview');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const clear = () => { stopStream(); onChange(''); setMode('idle'); };
  useEffect(() => () => stopStream(), []);

  if (mode === 'webcam') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <video ref={videoRef} autoPlay playsInline muted
        style={{ width: 180, height: 180, borderRadius: 90, objectFit: 'cover', border: '2px solid var(--accent)', background: '#000' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={capture}><Camera size={13} /> Capture</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { stopStream(); setMode('idle'); }}>Cancel</button>
      </div>
    </div>
  );

  if (value) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <img src={value} alt="Profile"
          style={{ width: 90, height: 90, borderRadius: 45, objectFit: 'cover', border: '2px solid var(--green)' }} />
        <button type="button" onClick={clear}
          style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11,
            background: 'var(--red)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <X size={11} />
        </button>
      </div>
      <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Photo ready</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 80, height: 80, borderRadius: 40, background: 'var(--surface2)',
        border: '2px dashed var(--border)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--text-muted)' }}>
        <Camera size={26} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={startWebcam}><Camera size={13} /> Webcam</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> Upload</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Photo shown on homepage team section</span>
    </div>
  );
}

// ── Create User Modal ─────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'it_staff',
    employee_id: '', designation: '', photo: '', priority: '',
  });
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [createdName,  setCreatedName]  = useState('');
  const nextPriorityRef                 = useRef(1);
  const [priorityLabel, setPriorityLabel] = useState(1);

  const isTeam = form.role === 'admin' || form.role === 'it_staff';
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!isTeam) return;
    let cancelled = false;
    getNextPriority().then(p => {
      if (cancelled) return;
      nextPriorityRef.current = p;
      setPriorityLabel(p);
      setForm(f => ({ ...f, priority: f.priority || String(p) }));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.role]);

  const handleGeneratePassword = () => {
    const pwd = generatePassword();
    set('password', pwd);
    setShowPassword(true);
  };

  const handleCopyPassword = () => {
    navigator.clipboard?.writeText(form.password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isTeam && !form.designation.trim()) { setError('Designation / Job Title is required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setSaving(true); setError('');
    try {
      const created = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }),
      });
      const userId = created?.data?.id || created?.id;
      if (isTeam && userId) {
        await upsertTeamMember({
          id: userId, name: form.name, email: form.email, role: form.role,
          employee_id: form.employee_id, designation: form.designation,
          photo: form.photo, priority: Number(form.priority) || nextPriorityRef.current, online: true,
        });
      }
      // ✅ Show success overlay INSIDE modal — no abrupt close
      setCreatedName(form.name);
      setSuccess(true);
      onCreated(); // refresh parent list in background
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const passwordStrength = (pwd) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 2) return { label: 'Weak', color: 'var(--red)', width: '33%' };
    if (score <= 3) return { label: 'Fair', color: 'var(--amber)', width: '60%' };
    return { label: 'Strong', color: 'var(--green)', width: '100%' };
  };
  const strength = passwordStrength(form.password);

  return (
    <div className="modal-overlay" onClick={!success ? onClose : undefined}>
      <div className="modal" style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', maxHeight: '90vh', position: 'relative' }}
        onClick={e => e.stopPropagation()}>

        {/* ✅ Success overlay shown INSIDE the modal — no abrupt page jump */}
        {success && (
          <SuccessOverlay name={createdName} role={form.role} onDone={onClose} />
        )}

        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2 className="modal-title"><UserPlus size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Create New User</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          <form onSubmit={handleSubmit}>

            {/* Role */}
            <div className="form-group">
              <label className="form-label">Role *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { value: 'it_staff', label: 'IT Staff',  desc: 'Can allocate, receive, swap' },
                  { value: 'admin',    label: 'Admin',      desc: 'Full system access' },
                  { value: 'employee', label: 'Employee',   desc: 'Asset recipient / end user' },
                ].map(r => (
                  <label key={r.value} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
                    padding: '12px 14px', borderRadius: 'var(--radius)',
                    border: `1px solid ${form.role === r.value ? (roleConfig[r.value]?.color || 'var(--accent)') : 'var(--border)'}`,
                    background: form.role === r.value ? (roleConfig[r.value]?.bg || 'var(--surface2)') : 'var(--surface2)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}>
                    <input type="radio" name="role" value={r.value} checked={form.role === r.value}
                      onChange={() => set('role', r.value)} style={{ display: 'none' }} />
                    <div style={{ fontWeight: 600, fontSize: 13, color: form.role === r.value ? (roleConfig[r.value]?.color || 'var(--accent)') : 'var(--text)' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Photo */}
            {isTeam && (
              <div className="form-group" style={{ textAlign: 'center' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 10 }}>
                  Profile Photo <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(homepage team section)</span>
                </label>
                <PhotoCapture value={form.photo} onChange={v => set('photo', v)} />
              </div>
            )}

            {/* Name + Employee ID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" required value={form.name}
                  onChange={e => set('name', e.target.value)} placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Employee ID {isTeam ? '*' : ''}</label>
                <input className="form-input" required={isTeam} value={form.employee_id}
                  onChange={e => set('employee_id', e.target.value)} placeholder="EMP-001" />
              </div>
            </div>

            {/* Designation */}
            {isTeam && (
              <div className="form-group">
                <label className="form-label">
                  <Briefcase size={13} color="var(--green)" style={{ marginRight: 5, verticalAlign: 'middle' }} />
                  Designation / Job Title *
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>shown on homepage</span>
                </label>
                <DesignationInput value={form.designation} onChange={v => set('designation', v)} required />
              </div>
            )}

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Work Email *</label>
              <input type="email" className="form-input" required value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="john@mindteck.com" />
            </div>

            {/* Password with strength + generator */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Password *</label>
                <button type="button" className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={handleGeneratePassword}>
                  <Key size={11} /> Generate Strong
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input" required minLength={6}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Min 6 characters"
                  style={{ paddingRight: form.password ? 72 : 40 }}
                />
                <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                  {form.password && (
                    <button type="button" onClick={handleCopyPassword}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
                      title="Copy password">
                      <Copy size={14} />
                    </button>
                  )}
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {/* Password strength bar */}
              {strength && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: strength.width, background: strength.color, borderRadius: 2, transition: 'all .3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: strength.color, marginTop: 3, fontWeight: 600 }}>{strength.label} password</div>
                </div>
              )}
            </div>

            {/* Display order */}
            {isTeam && (
              <div className="form-group">
                <label className="form-label">
                  <Star size={13} color="var(--accent)" style={{ marginRight: 5, verticalAlign: 'middle' }} />
                  Homepage Display Order
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                    · next available: #{priorityLabel}
                  </span>
                </label>
                <input type="number" className="form-input" min={1} max={99} value={form.priority}
                  onChange={e => set('priority', e.target.value)} placeholder={`e.g. ${priorityLabel}`} />
              </div>
            )}

            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--red-bg)',
                border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--radius)',
                color: 'var(--red)', fontSize: 13, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{error}
              </div>
            )}

            <div style={{ background: 'rgba(79,142,247,.06)', border: '1px solid rgba(79,142,247,.15)',
              borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12,
              color: 'var(--text-muted)', marginBottom: 16 }}>
              📧 A welcome email with login credentials will be sent automatically.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving
                  ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite', marginRight: 6 }} />Creating…</>
                  : <><Plus size={15} /> Create User</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

// ── Edit Team Profile Modal ───────────────────────────────────────────────────
function EditTeamModal({ user: targetUser, onClose, onSaved }) {
  const [form, setForm] = useState({ photo: '', employee_id: '', designation: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    getTeamMembers().then(team => {
      const existing = team.find(m => m.id === targetUser.id) || {};
      setForm({ photo: existing.photo || '', employee_id: existing.employee_id || '', designation: existing.designation || '', priority: existing.priority || '' });
    }).finally(() => setLoading(false));
  }, [targetUser.id]);

  const handleSave = async () => {
    if (!form.designation.trim()) { alert('Designation is required.'); return; }
    setSaving(true);
    try {
      await upsertTeamMember({ id: targetUser.id, name: targetUser.name, email: targetUser.email, role: targetUser.role, ...form, priority: Number(form.priority) || 999, online: true });
      onSaved(); onClose();
    } catch (err) { alert('Failed to save: ' + err.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><Edit2 size={15} style={{ marginRight: 8, verticalAlign: 'middle' }} />Edit Team Profile — {targetUser.name}</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <PhotoCapture value={form.photo} onChange={v => set('photo', v)} />
          </div>
          <div className="form-group">
            <label className="form-label">Employee ID</label>
            <input className="form-input" value={form.employee_id} onChange={e => set('employee_id', e.target.value)} placeholder="EMP-001" />
          </div>
          <div className="form-group">
            <label className="form-label"><Briefcase size={13} color="var(--green)" style={{ marginRight: 5, verticalAlign: 'middle' }} />Designation / Job Title *</label>
            <DesignationInput value={form.designation} onChange={v => set('designation', v)} required />
          </div>
          <div className="form-group">
            <label className="form-label"><Star size={13} color="var(--accent)" style={{ marginRight: 5, verticalAlign: 'middle' }} />Display Order</label>
            <input type="number" className="form-input" min={1} max={99} value={form.priority} onChange={e => set('priority', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reset Password Modal ──────────────────────────────────────────────────────
function ResetPasswordModal({ user: targetUser, onClose }) {
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);

  const handleGenerate = () => { setPassword(generatePassword()); setShowPwd(true); };
  const handleCopy = () => navigator.clipboard?.writeText(password);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch(`/users/${targetUser.id}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword: password }) });
      setDone(true); setTimeout(onClose, 1800);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><Lock size={15} style={{ marginRight: 8, verticalAlign: 'middle' }} />Reset Password — {targetUser.name}</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle size={40} color="var(--green)" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--green)' }}>Password Reset Successfully</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>User will need to use the new password on next login.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)',
                borderRadius: 'var(--radius)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
                ⚠️ This will immediately change the password for <strong style={{ color: 'var(--text)' }}>{targetUser.name}</strong>.
                Make sure to share the new password with them.
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>New Password *</label>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 10px' }} onClick={handleGenerate}>
                    <Key size={11} /> Generate
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} className="form-input" required minLength={6}
                    value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters"
                    style={{ paddingRight: password ? 72 : 40 }} autoFocus />
                  <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                    {password && (
                      <button type="button" onClick={handleCopy}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }} title="Copy">
                        <Copy size={14} />
                      </button>
                    )}
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}>
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Resetting…' : 'Reset Password'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Toggle Active/Inactive ────────────────────────────────────────────────────
function ToggleStatusModal({ user: targetUser, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const isActive = targetUser.is_active;

  const handleToggle = async () => {
    setSaving(true);
    try {
      await apiFetch(`/users/${targetUser.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !isActive }) });
      onSaved(); onClose();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isActive ? 'Deactivate' : 'Activate'} User</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ padding: '14px 16px', background: isActive ? 'var(--red-bg)' : 'var(--green-bg)',
            border: `1px solid ${isActive ? 'rgba(248,113,113,.2)' : 'rgba(52,211,153,.2)'}`,
            borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 13 }}>
            {isActive
              ? <>⚠️ Deactivating <strong>{targetUser.name}</strong> will prevent them from logging in. Their data will be preserved.</>
              : <>✅ Activating <strong>{targetUser.name}</strong> will restore their login access.</>
            }
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className={`btn ${isActive ? 'btn-danger' : 'btn-primary'}`} onClick={handleToggle} disabled={saving}>
              {saving ? 'Updating…' : isActive ? <><UserX size={14} /> Deactivate</> : <><UserCheck size={14} /> Activate</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManageUsers() {
  const { user: me } = useAuth();
  const [users,        setUsers]        = useState([]);
  const [teamMembers,  setTeamMembers]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('All');
  const [showCreate,   setShowCreate]   = useState(false);
  const [resetTarget,  setResetTarget]  = useState(null);
  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteConf,   setDeleteConf]   = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersData, teamData] = await Promise.all([apiFetch('/users'), apiFetch('/team-members')]);
      setUsers(usersData.data || []);
      setTeamMembers(teamData.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteConf) return;
    setDeleting(true);
    try {
      await apiFetch(`/users/${deleteConf.id}`, { method: 'DELETE' });
      await removeTeamMember(deleteConf.id);
      setDeleteConf(null);
      await fetchData();
    } catch (err) { alert(err.message); }
    finally { setDeleting(false); }
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || [u.name, u.email, u.role].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchRole = roleFilter === 'All' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    itStaff: users.filter(u => u.role === 'it_staff').length,
    employees: users.filter(u => u.role === 'employee').length,
    inactive: users.filter(u => !u.is_active).length,
  };

  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Manage Users</h1>
          <p>Create and manage IT staff, admin and employee accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Create User
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Users',  val: stats.total,     icon: Users,     color: 'var(--accent)' },
          { label: 'Admins',       val: stats.admins,    icon: Shield,    color: 'var(--accent)' },
          { label: 'IT Staff',     val: stats.itStaff,   icon: UserCheck, color: 'var(--green)' },
          { label: 'Employees',    val: stats.employees, icon: Users,     color: 'var(--text-muted)' },
          { label: 'Inactive',     val: stats.inactive,  icon: UserX,     color: 'var(--red)' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Icon size={15} color={s.color} />
                <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', color: s.color }}>{s.val}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Homepage order preview */}
      {teamMembers.length > 0 && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Star size={13} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 13 }}>Homepage Display Order</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 600 }}>Admin Only</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...teamMembers].sort((a, b) => (a.priority || 999) - (b.priority || 999)).map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 6px',
                borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ width: 18, height: 18, borderRadius: 9, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {m.priority || i + 1}
                </span>
                {m.photo
                  ? <img src={m.photo} alt="" style={{ width: 22, height: 22, borderRadius: 11, objectFit: 'cover' }} />
                  : <div style={{ width: 22, height: 22, borderRadius: 11, background: `${roleConfig[m.role]?.color || 'var(--accent)'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: roleConfig[m.role]?.color || 'var(--accent)' }}>{m.name?.[0]?.toUpperCase()}</div>
                }
                <div>
                  <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{m.name}</div>
                  {m.designation && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.designation}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={15} />
          <input className="form-input" placeholder="Search name, email, role…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="toggle-group">
          {['All', 'admin', 'it_staff', 'employee'].map(r => (
            <button key={r} className={`toggle-btn ${roleFilter === r ? 'active' : ''}`} onClick={() => setRoleFilter(r)}>
              {r === 'All' ? 'All' : roleConfig[r]?.label || r}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}><RefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th><th>Employee ID</th><th>Designation</th>
              <th>Email</th><th>Role</th><th>Order</th><th>Status</th><th>Created</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}><div className="empty-state"><p>Loading…</p></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9}><div className="empty-state"><p>No users found</p></div></td></tr>
            ) : filtered.map(u => {
              const rc = roleConfig[u.role] || roleConfig.employee;
              const isMe = u.id === me?.id;
              const teamData = teamMembers.find(m => m.id === u.id);
              const isTeam = u.role === 'admin' || u.role === 'it_staff';
              return (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {teamData?.photo
                        ? <img src={teamData.photo} alt="" style={{ width: 34, height: 34, borderRadius: 17, objectFit: 'cover', border: `1px solid ${rc.color}44` }} />
                        : <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${rc.color}22`, border: `1px solid ${rc.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: rc.color }}>{u.name?.[0]?.toUpperCase()}</div>
                      }
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                        {isMe && <div style={{ fontSize: 11, color: 'var(--accent)' }}>● You</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>{teamData?.employee_id || '—'}</td>
                  <td>
                    {teamData?.designation
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                          <Briefcase size={10} color="var(--text-muted)" />{teamData.designation}
                        </span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{u.email}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: rc.bg, color: rc.color }}>{rc.label}</span>
                  </td>
                  <td>
                    {isTeam && teamData?.priority
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 10, fontSize: 12, background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 700 }}>
                          <Star size={9} />#{teamData.priority}
                        </span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-muted)' }}>{u.created_at?.split('T')[0]}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {isTeam && (
                        <button className="btn btn-sm btn-secondary" title="Edit profile" onClick={() => setEditTarget(u)}>
                          <Edit2 size={11} />
                        </button>
                      )}
                      <button className="btn btn-sm btn-secondary" title="Reset password" onClick={() => setResetTarget(u)}>
                        <Key size={11} />
                      </button>
                      {!isMe && (
                        <button className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-success'}`}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => setToggleTarget(u)}>
                          {u.is_active ? <UserX size={11} /> : <UserCheck size={11} />}
                        </button>
                      )}
                      {!isMe && (
                        <button className="btn btn-sm btn-danger" title="Delete" onClick={() => setDeleteConf(u)}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreate   && <CreateUserModal    onClose={() => setShowCreate(false)}    onCreated={fetchData} />}
      {editTarget   && <EditTeamModal      user={editTarget}   onClose={() => setEditTarget(null)}   onSaved={fetchData} />}
      {resetTarget  && <ResetPasswordModal user={resetTarget}  onClose={() => setResetTarget(null)} />}
      {toggleTarget && <ToggleStatusModal  user={toggleTarget} onClose={() => setToggleTarget(null)} onSaved={fetchData} />}

      {deleteConf && (
        <div className="modal-overlay" onClick={() => setDeleteConf(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete User</h2>
              <button className="btn btn-icon" onClick={() => setDeleteConf(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '14px 16px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>This action is permanent</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Delete <strong style={{ color: 'var(--text)' }}>{deleteConf.name}</strong> ({deleteConf.email})?
                  Their photo and profile will also be removed from the homepage.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setDeleteConf(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}