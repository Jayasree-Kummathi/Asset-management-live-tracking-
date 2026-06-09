import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Trash2, X, RefreshCw, Search, Shield, Users, UserCheck,
  Camera, Upload, Star, Briefcase, CheckCircle, Eye, EyeOff,
  Copy, AlertTriangle, Edit2, Key, UserX, UserPlus, Lock,
  Globe, MapPin, ArrowLeft, Save, ChevronDown, ChevronRight, Settings,
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
  superadmin: { label: 'Super Admin',   color: '#7c3aed',           bg: 'rgba(124,58,237,0.1)' },
  admin:      { label: 'Administrator', color: 'var(--accent)',     bg: 'var(--accent-glow)' },
  it_staff:   { label: 'IT Staff',      color: 'var(--green)',      bg: 'var(--green-bg)' },
  employee:   { label: 'Employee',      color: 'var(--text-muted)', bg: 'var(--surface2)' },
};

const DEFAULT_REGION_GROUPS = {
  India: ['Bengaluru', 'Kolkata', 'Mumbai'],
  'USA': [
    'Edison (New Jersey), USA', 'Newark (California), USA', 'Plano (Texas), USA',
    'Cincinnati (Ohio), USA', 'St. Louis (Missouri), USA',
    'Camp Hill (Pennsylvania), USA', 'Naples (Florida), USA',
  ],
  Canada: ['Mississauga (Ontario), Canada'],
  'United Kingdom': ['Borehamwood (Hertfordshire), United Kingdom'],
  Germany: ['Frankfurt am Main, Germany'],
  Singapore: ['Singapore'],
  Malaysia: ['Cyberjaya (Selangor), Malaysia'],
  Bahrain: ['Manama, Bahrain'],
};

const flatLocations = (groups) => Object.values(groups).flat();

const guessRegion = (name, groups) => {
  const lower = name.toLowerCase();
  if (lower.includes('india') || lower.includes('bengaluru') || lower.includes('kolkata') || lower.includes('mumbai') || lower.includes('delhi') || lower.includes('hyderabad') || lower.includes('pune')) return 'India';
  if (lower.includes('usa') || lower.includes('united states') || lower.includes(', us')) return 'USA';
  if (lower.includes('canada') || lower.includes('ontario') || lower.includes('quebec') || lower.includes('toronto')) return 'Canada';
  if (lower.includes('uk') || lower.includes('united kingdom') || lower.includes('england') || lower.includes('london')) return 'United Kingdom';
  if (lower.includes('germany') || lower.includes('frankfurt') || lower.includes('berlin') || lower.includes('munich')) return 'Germany';
  if (lower.includes('singapore')) return 'Singapore';
  if (lower.includes('malaysia') || lower.includes('selangor') || lower.includes('cyberjaya') || lower.includes('kuala')) return 'Malaysia';
  if (lower.includes('bahrain') || lower.includes('manama')) return 'Bahrain';
  return 'Other';
};

const DESIGNATION_SUGGESTIONS = [
  'IT Manager', 'Assistant Manager', 'Senior IT Lead', 'IT Lead',
  'Senior Team Lead', 'Team Lead', 'IT Engineer', 'Senior IT Engineer',
  'Senior IT Staff', 'IT Admin', 'IT Staff', 'IT Support',
  'Network Engineer', 'Systems Administrator', 'Asset Operations Lead', 'Asset Ops Admin',
];

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

const getTeamMembers   = async () => { try { const d = await apiFetch('/team-members'); return d.data || []; } catch { return []; } };
const upsertTeamMember = async (u) => { await apiFetch('/team-members', { method: 'POST', body: JSON.stringify(u) }); };
const removeTeamMember = async (id) => { try { await apiFetch(`/team-members/${id}`, { method: 'DELETE' }); } catch {} };
const getNextPriority  = async () => { const t = await getTeamMembers(); return t.length ? Math.max(...t.map(m => m.priority ?? 0)) + 1 : 1; };

const parseLocations = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p.filter(Boolean); } catch {}
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

const serializeLocations = (arr) => JSON.stringify(arr);

// ── Multi-location checkbox panel ─────────────────────────────────────────────
function LocationCheckboxPanel({ selected = [], onChange, regionGroups, label = 'Office Access', required = false }) {
  const [collapsed, setCollapsed] = useState({});
  const toggle = (loc) => {
    const next = selected.includes(loc) ? selected.filter(l => l !== loc) : [...selected, loc];
    onChange(next);
  };
  const toggleRegion = (region) => {
    const locs = regionGroups[region] || [];
    const allSelected = locs.every(l => selected.includes(l));
    if (allSelected) {
      onChange(selected.filter(l => !locs.includes(l)));
    } else {
      const next = [...new Set([...selected, ...locs])];
      onChange(next);
    }
  };
  const toggleCollapse = (r) => setCollapsed(c => ({ ...c, [r]: !c[r] }));

  return (
    <div className="form-group">
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <MapPin size={13} color="var(--accent)" />
        {label}
        {required && <span style={{ color: 'var(--red)' }}>*</span>}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
          — check all offices this user can access
        </span>
      </label>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--surface2)' }}>
        {Object.entries(regionGroups).map(([region, locs], ri) => {
          const allChecked  = locs.length > 0 && locs.every(l => selected.includes(l));
          const someChecked = locs.some(l => selected.includes(l));
          const open        = !collapsed[region];
          return (
            <div key={region} style={{ borderBottom: ri < Object.keys(regionGroups).length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'var(--surface)', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={() => toggleRegion(region)}
                  style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  title={`Select all in ${region}`}
                />
                <div onClick={() => toggleCollapse(region)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Globe size={11} color={someChecked ? 'var(--accent)' : 'var(--text-muted)'} />
                  <span style={{ fontWeight: 700, fontSize: 12, color: someChecked ? 'var(--accent)' : 'var(--text)' }}>{region}</span>
                  {someChecked && (
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 700 }}>
                      {locs.filter(l => selected.includes(l)).length}/{locs.length}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                    {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>
                </div>
              </div>
              {open && (
                <div style={{ paddingLeft: 16 }}>
                  {locs.map(loc => (
                    <label key={loc} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', cursor: 'pointer', borderTop: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <input type="checkbox"
                        checked={selected.includes(loc)}
                        onChange={() => toggle(loc)}
                        style={{ width: 13, height: 13, accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                      <MapPin size={10} color={selected.includes(loc) ? 'var(--accent)' : 'var(--text-muted)'} />
                      <span style={{ fontSize: 12.5, color: selected.includes(loc) ? 'var(--text)' : 'var(--text-muted)' }}>{loc}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {Object.keys(regionGroups).length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No locations configured yet.
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {selected.map(l => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <MapPin size={9} />{l}
              <button type="button" onClick={() => toggle(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Read-only location display (for non-superadmin viewing their own locations) ──
function LocationReadOnly({ selected = [] }) {
  if (!selected.length) return (
    <div style={{ padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', fontSize: 13 }}>
      No office locations assigned. Contact your Super Admin to assign locations.
    </div>
  );
  return (
    <div style={{ padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lock size={11} /> Assigned by Super Admin — contact them to change
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {selected.map(l => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <MapPin size={10} color="var(--accent)" />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Add Location modal ────────────────────────────────────────────────────────
function AddLocationPanel({ regionGroups, onAdd }) {
  const [open, setOpen]     = useState(false);
  const [name, setName]     = useState('');
  const [region, setRegion] = useState('');
  const [newReg, setNewReg] = useState('');
  const [error, setError]   = useState('');
  const allRegions          = Object.keys(regionGroups);

  const handleAdd = () => {
    const loc = name.trim();
    if (!loc) { setError('Location name is required.'); return; }
    const allLocs = flatLocations(regionGroups);
    if (allLocs.includes(loc)) { setError('This location already exists.'); return; }
    const targetRegion = region === '__new__' ? newReg.trim() : region || guessRegion(loc, regionGroups);
    if (!targetRegion) { setError('Please select or enter a region.'); return; }
    onAdd(loc, targetRegion);
    setName(''); setRegion(''); setNewReg(''); setError(''); setOpen(false);
  };

  if (!open) return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12 }}>
      <Plus size={12} /> Add New Location
    </button>
  );

  return (
    <div style={{ marginTop: 10, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
        <MapPin size={13} color="var(--accent)" /> Add New Office Location
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label" style={{ fontSize: 11 }}>Location Name *</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Chennai (Tamil Nadu), India" style={{ fontSize: 12 }} />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: 11 }}>Region / Group</label>
          <select className="form-select" value={region} onChange={e => setRegion(e.target.value)} style={{ fontSize: 12 }}>
            <option value="">— Auto-detect —</option>
            {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
            <option value="__new__">+ Create new region…</option>
          </select>
        </div>
      </div>
      {region === '__new__' && (
        <div style={{ marginTop: 10 }}>
          <label className="form-label" style={{ fontSize: 11 }}>New Region Name *</label>
          <input className="form-input" value={newReg} onChange={e => setNewReg(e.target.value)} placeholder="e.g. Middle East" style={{ fontSize: 12 }} />
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd} style={{ fontSize: 12 }}><Plus size={12} /> Add Location</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setOpen(false); setError(''); }} style={{ fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Designation input ─────────────────────────────────────────────────────────
function DesignationInput({ value, onChange, required }) {
  const [open, setOpen]   = useState(false);
  const [local, setLocal] = useState(value || '');
  const wrapRef           = useRef(null);
  useEffect(() => { setLocal(value || ''); }, [value]);
  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const filtered = DESIGNATION_SUGGESTIONS.filter(d => !local || d.toLowerCase().includes(local.toLowerCase()));
  const pick = (d) => { setLocal(d); onChange(d); setOpen(false); };
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input className="form-input" required={required} value={local}
        placeholder="e.g. IT Manager, Senior Team Lead…"
        onChange={e => { setLocal(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 8px 28px rgba(0,0,0,.45)', maxHeight: 180, overflowY: 'auto' }}>
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

// ── Photo capture ─────────────────────────────────────────────────────────────
function PhotoCapture({ value, onChange }) {
  const [mode, setMode] = useState('idle');
  const videoRef        = useRef(null);
  const streamRef       = useRef(null);
  const fileRef         = useRef(null);

  const startWebcam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = s; setMode('webcam');
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch { alert('Camera not available — please upload a photo instead.'); }
  };
  const stopStream = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  const capture = () => {
    const v = videoRef.current; if (!v) return;
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const side = Math.min(v.videoWidth, v.videoHeight);
    c.getContext('2d').drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 200, 200);
    stopStream(); onChange(c.toDataURL('image/jpeg', .85)); setMode('preview');
  };
  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 200; c.height = 200;
        const side = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 200, 200);
        onChange(c.toDataURL('image/jpeg', .85)); setMode('preview');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  const clear = () => { stopStream(); onChange(''); setMode('idle'); };
  useEffect(() => () => stopStream(), []);

  if (mode === 'webcam') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: 180, height: 180, borderRadius: 90, objectFit: 'cover', border: '2px solid var(--accent)', background: '#000' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={capture}><Camera size={13} /> Capture</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { stopStream(); setMode('idle'); }}>Cancel</button>
      </div>
    </div>
  );
  if (value) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <img src={value} alt="Profile" style={{ width: 90, height: 90, borderRadius: 45, objectFit: 'cover', border: '2px solid var(--green)' }} />
        <button type="button" onClick={clear} style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, background: 'var(--red)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><X size={11} /></button>
      </div>
      <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Photo ready</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 80, height: 80, borderRadius: 40, background: 'var(--surface2)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><Camera size={26} /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={startWebcam}><Camera size={13} /> Webcam</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> Upload</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Photo shown on homepage team section</span>
    </div>
  );
}

// ── Location badge ────────────────────────────────────────────────────────────
function LocationBadge({ managed_locations, role, compact = false }) {
  if (role === 'superadmin') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)' }}>
      <Globe size={10} /> Global
    </span>
  );
  const locs = parseLocations(managed_locations);
  if (!locs.length) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  if (compact || locs.length === 1) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
      <MapPin size={10} /> {locs.length === 1 ? locs[0] : `${locs.length} offices`}
    </span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {locs.slice(0, 2).map(l => (
        <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <MapPin size={8} />{l}
        </span>
      ))}
      {locs.length > 2 && (
        <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
          +{locs.length - 2} more
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EDIT USER PAGE
// ══════════════════════════════════════════════════════════════════════════════
function EditUserPage({ targetUser, onBack, onSaved, regionGroups, onAddLocation, currentUserRole }) {
  const isSA             = currentUserRole === 'superadmin';
  const existingLocs     = parseLocations(targetUser.managed_locations || targetUser.managed_location);
  const needLocation     = targetUser.role !== 'superadmin' && targetUser.role !== 'employee';

  const [form, setForm]   = useState({
    photo: '', employee_id: '', designation: '', priority: '',
    managed_locations: existingLocs,
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    getTeamMembers().then(team => {
      const existing = team.find(m => m.id === targetUser.id) || {};
      setForm({
        photo:             existing.photo || '',
        employee_id:       existing.employee_id || '',
        designation:       existing.designation || '',
        priority:          existing.priority || '',
        managed_locations: parseLocations(targetUser.managed_locations || targetUser.managed_location),
      });
    }).finally(() => setLoading(false));
  }, [targetUser.id, targetUser.managed_locations, targetUser.managed_location]);

 const handleSave = async (e) => {
  e.preventDefault();
  if (!form.designation.trim()) { setError('Designation is required.'); return; }
  setSaving(true); setError('');
  try {
    // Only call PUT /users/:id if there's actually something to update in the users table
    if (isSA && needLocation) {
      await apiFetch(`/users/${targetUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          managed_locations: serializeLocations(form.managed_locations),
        }),
      });
    }

    // Always update team member profile (photo, designation, employee_id, priority)
    await upsertTeamMember({
      id:          targetUser.id,
      name:        targetUser.name,
      email:       targetUser.email,
      role:        targetUser.role,
      photo:       form.photo,
      employee_id: form.employee_id,
      designation: form.designation,
      priority:    Number(form.priority) || 999,
      online:      true,
    });

    setSuccess(true);
    setTimeout(() => { onSaved(); onBack(); }, 1200);
  } catch (err) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
};

  const rc = roleConfig[targetUser.role] || roleConfig.employee;

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Back to Users
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Edit User Profile</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Update profile details for {targetUser.name}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, maxWidth: 900 }}>
        {/* Left card */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, height: 'fit-content' }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, background: `${rc.color}22`, border: `2px solid ${rc.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: rc.color }}>
            {targetUser.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{targetUser.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{targetUser.email}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: rc.bg, color: rc.color }}>{rc.label}</span>
          <LocationBadge managed_locations={form.managed_locations} role={targetUser.role} />
        </div>

        {/* Right form */}
        <div className="card" style={{ padding: 28 }}>
          {success ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '40px 0' }}>
              <CheckCircle size={48} color="var(--green)" />
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--green)' }}>Saved successfully!</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Returning to user list…</div>
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <div className="form-group" style={{ textAlign: 'center', marginBottom: 24 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 12 }}>Profile Photo</label>
                <PhotoCapture value={form.photo} onChange={v => set('photo', v)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Employee ID</label>
                  <input className="form-input" value={form.employee_id} onChange={e => set('employee_id', e.target.value)} placeholder="EMP-001" />
                </div>
                <div className="form-group">
                  <label className="form-label"><Star size={13} color="var(--accent)" style={{ marginRight: 5, verticalAlign: 'middle' }} />Display Order</label>
                  <input type="number" className="form-input" min={1} max={99} value={form.priority} onChange={e => set('priority', e.target.value)} placeholder="e.g. 1" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label"><Briefcase size={13} color="var(--green)" style={{ marginRight: 5, verticalAlign: 'middle' }} />Designation / Job Title *</label>
                <DesignationInput value={form.designation} onChange={v => set('designation', v)} required />
              </div>

              {/* ── LOCATION SECTION ─────────────────────────────────────────
                  Superadmin → editable checkbox panel
                  Admin/IT   → read-only display, lock icon, "contact superadmin"
              ─────────────────────────────────────────────────────────────── */}
              {needLocation && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <MapPin size={13} color="var(--accent)" />
                    Office Access
                    {!isSA && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'rgba(251,191,36,0.12)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.3)', marginLeft: 4 }}>
                        <Lock size={9} /> Super Admin only
                      </span>
                    )}
                  </label>
                  {isSA ? (
                    <>
                      <LocationCheckboxPanel
                        selected={form.managed_locations}
                        onChange={v => set('managed_locations', v)}
                        regionGroups={regionGroups}
                        label=""
                      />
                      <AddLocationPanel regionGroups={regionGroups} onAdd={(loc, reg) => {
                        onAddLocation(loc, reg);
                        set('managed_locations', [...form.managed_locations, loc]);
                      }} />
                    </>
                  ) : (
                    <LocationReadOnly selected={form.managed_locations} />
                  )}
                </div>
              )}

              {error && (
                <div style={{ padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite', marginRight: 6 }} />Saving…</>
                    : <><Save size={14} /> Save Changes</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE USER PAGE
// ══════════════════════════════════════════════════════════════════════════════
function CreateUserPage({ onBack, onCreated, currentUserRole, regionGroups, onAddLocation }) {
  const isSA = currentUserRole === 'superadmin';

  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'it_staff',
    employee_id: '', designation: '', photo: '', priority: '',
    managed_locations: [],
  });
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [success,       setSuccess]       = useState(false);
  const nextPriorityRef                   = useRef(1);
  const [priorityLabel, setPriorityLabel] = useState(1);

  const isTeam       = form.role === 'admin' || form.role === 'it_staff' || form.role === 'superadmin';
  const needLocation = form.role !== 'superadmin' && form.role !== 'employee';
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── When a non-superadmin creates a user, auto-assign their own locations ──
  useEffect(() => {
    if (!isSA && needLocation && form.managed_locations.length === 0) {
      // Will be set on submit from the backend (req.user), but show it in UI too
      // by fetching the current user's managed_locations from the token
      try {
        const token   = localStorage.getItem('token');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          // managed_locations may not be in token; backend handles it server-side
        }
      } catch {}
    }
  }, [form.role]); // eslint-disable-line

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
  }, [form.role]); // eslint-disable-line

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isTeam && form.role !== 'superadmin' && !form.designation.trim()) { setError('Designation is required.'); return; }
    // Only superadmin must pick location; non-SA admins: backend assigns their own location
    if (isSA && needLocation && form.managed_locations.length === 0) {
      setError('Select at least one office location.'); return;
    }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setSaving(true); setError('');
    try {
      const created = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          name:              form.name,
          email:             form.email,
          password:          form.password,
          role:              form.role,
          // Superadmin picks locations explicitly; non-SA: backend uses their own location
          managed_locations: (isSA && needLocation) ? serializeLocations(form.managed_locations) : null,
          managed_location:  (isSA && needLocation && form.managed_locations.length) ? form.managed_locations[0] : null,
        }),
      });
      const userId = created?.data?.id || created?.id;
      if (isTeam && userId && form.role !== 'superadmin') {
        await upsertTeamMember({
          id:          userId,
          name:        form.name,
          email:       form.email,
          role:        form.role,
          employee_id: form.employee_id,
          designation: form.designation,
          photo:       form.photo,
          priority:    Number(form.priority) || nextPriorityRef.current,
          online:      true,
        });
      }
      setSuccess(true);
      onCreated();
      setTimeout(onBack, 1800);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const strength = (pwd) => {
    if (!pwd) return null;
    let s = 0;
    if (pwd.length >= 8) s++; if (pwd.length >= 12) s++;
    if (/[A-Z]/.test(pwd)) s++; if (/[0-9]/.test(pwd)) s++; if (/[^A-Za-z0-9]/.test(pwd)) s++;
    if (s <= 2) return { label: 'Weak',   color: 'var(--red)',   width: '33%' };
    if (s <= 3) return { label: 'Fair',   color: 'var(--amber)', width: '60%' };
    return           { label: 'Strong', color: 'var(--green)', width: '100%' };
  };
  const str = strength(form.password);

  const roleOptions = [
    ...(isSA ? [{ value: 'superadmin', label: 'Super Admin',   desc: 'Full global access — all offices', icon: '🌐' }] : []),
    { value: 'admin',    label: 'Administrator', desc: 'Full access — assigned offices only', icon: '🛡️' },
    { value: 'it_staff', label: 'IT Staff',      desc: 'Allocate, receive, swap — assigned offices', icon: '🔧' },
    { value: 'employee', label: 'Employee',      desc: 'Asset recipient / end user', icon: '👤' },
  ];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Back to Users
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}><UserPlus size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Create New User</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Add a new team member or employee account</p>
        </div>
      </div>

      <div style={{ maxWidth: 700 }}>
        <div className="card" style={{ padding: 28 }}>
          {success ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
              <CheckCircle size={52} color="var(--green)" />
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--green)' }}>User Created!</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Returning to user list…</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Role selector */}
              <div className="form-group">
                <label className="form-label">Role *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {roleOptions.map(r => (
                    <label key={r.value} style={{ flex: '1 1 130px', display: 'flex', flexDirection: 'column', gap: 4, padding: '11px 13px', borderRadius: 'var(--radius)', border: `1px solid ${form.role === r.value ? (roleConfig[r.value]?.color || 'var(--accent)') : 'var(--border)'}`, background: form.role === r.value ? (roleConfig[r.value]?.bg || 'var(--surface2)') : 'var(--surface2)', cursor: 'pointer', transition: 'all .2s' }}>
                      <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => set('role', r.value)} style={{ display: 'none' }} />
                      <div style={{ fontSize: 16 }}>{r.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: form.role === r.value ? (roleConfig[r.value]?.color || 'var(--accent)') : 'var(--text)' }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              {form.role === 'superadmin' && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 'var(--radius)', fontSize: 13, color: '#7c3aed' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>🌐 Super Admin — Unrestricted Global Access</div>
                  <div style={{ fontSize: 12, opacity: .8 }}>This user will have full read/write access across ALL offices and regions.</div>
                </div>
              )}

              {/* ── LOCATION SECTION ──────────────────────────────────────────
                  Superadmin creating user → shows full checkbox panel
                  Admin creating user      → shows info banner (backend auto-assigns their location)
              ──────────────────────────────────────────────────────────────── */}
              {needLocation && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <MapPin size={13} color="var(--accent)" />
                    Office Access *
                    {!isSA && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'rgba(251,191,36,0.12)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.3)', marginLeft: 4 }}>
                        <Lock size={9} /> Auto-assigned
                      </span>
                    )}
                  </label>
                  {isSA ? (
                    <>
                      <LocationCheckboxPanel
                        selected={form.managed_locations}
                        onChange={v => set('managed_locations', v)}
                        regionGroups={regionGroups}
                        label=""
                        required
                      />
                      <AddLocationPanel regionGroups={regionGroups} onAdd={(loc, reg) => {
                        onAddLocation(loc, reg);
                        set('managed_locations', [...form.managed_locations, loc]);
                      }} />
                      {form.managed_locations.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                          💡 Select at least one office location.
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MapPin size={14} color="var(--accent)" />
                      <div>
                        This user will be assigned to <strong style={{ color: 'var(--text)' }}>your office location</strong> automatically.
                        Only a Super Admin can assign a different location.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isTeam && form.role !== 'superadmin' && (
                <div className="form-group" style={{ textAlign: 'center' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: 10 }}>Profile Photo <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(homepage)</span></label>
                  <PhotoCapture value={form.photo} onChange={v => set('photo', v)} />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label">Employee ID {form.role !== 'employee' && form.role !== 'superadmin' ? '*' : ''}</label>
                  <input className="form-input" required={form.role !== 'employee' && form.role !== 'superadmin'} value={form.employee_id} onChange={e => set('employee_id', e.target.value)} placeholder="EMP-001" />
                </div>
              </div>

              {form.role !== 'superadmin' && form.role !== 'employee' && (
                <div className="form-group">
                  <label className="form-label"><Briefcase size={13} color="var(--green)" style={{ marginRight: 5, verticalAlign: 'middle' }} />Designation / Job Title *</label>
                  <DesignationInput value={form.designation} onChange={v => set('designation', v)} required />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Work Email *</label>
                <input type="email" className="form-input" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@company.com" />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Password *</label>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 10px' }}
                    onClick={() => { const p = generatePassword(); set('password', p); setShowPassword(true); }}>
                    <Key size={11} /> Generate Strong
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} className="form-input" required minLength={6}
                    value={form.password} onChange={e => set('password', e.target.value)}
                    placeholder="Min 6 characters" style={{ paddingRight: form.password ? 72 : 40 }} />
                  <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                    {form.password && (
                      <button type="button" onClick={() => navigator.clipboard?.writeText(form.password)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}>
                        <Copy size={14} />
                      </button>
                    )}
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}>
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                {str && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: str.width, background: str.color, borderRadius: 2, transition: 'all .3s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: str.color, marginTop: 3, fontWeight: 600 }}>{str.label} password</div>
                  </div>
                )}
              </div>

              {form.role !== 'superadmin' && form.role !== 'employee' && (
                <div className="form-group">
                  <label className="form-label">
                    <Star size={13} color="var(--accent)" style={{ marginRight: 5, verticalAlign: 'middle' }} />
                    Homepage Display Order
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>· next: #{priorityLabel}</span>
                  </label>
                  <input type="number" className="form-input" min={1} max={99} value={form.priority}
                    onChange={e => set('priority', e.target.value)} placeholder={`e.g. ${priorityLabel}`} />
                </div>
              )}

              {error && (
                <div style={{ padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: 13, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{error}
                </div>
              )}

              <div style={{ padding: '10px 14px', background: 'rgba(79,142,247,.06)', border: '1px solid rgba(79,142,247,.15)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                📧 A welcome email with login credentials will be sent automatically.
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={onBack} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite', marginRight: 6 }} />Creating…</>
                    : <><Plus size={15} /> Create User</>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD PAGE
// ══════════════════════════════════════════════════════════════════════════════
function ResetPasswordPage({ targetUser, onBack }) {
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await apiFetch(`/users/${targetUser.id}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword: password }),
      });
      setDone(true);
      setTimeout(onBack, 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Back to Users
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}><Lock size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Reset Password</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Change password for {targetUser.name}</p>
        </div>
      </div>
      <div style={{ maxWidth: 480 }}>
        <div className="card" style={{ padding: 28 }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <CheckCircle size={48} color="var(--green)" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--green)' }}>Password Reset Successfully</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Returning to user list…</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                ⚠️ This will immediately change the password for <strong style={{ color: 'var(--text)' }}>{targetUser.name}</strong>.
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>New Password *</label>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 10px' }}
                    onClick={() => { setPassword(generatePassword()); setShowPwd(true); }}>
                    <Key size={11} /> Generate
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} className="form-input" required minLength={6}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters" style={{ paddingRight: password ? 72 : 40 }} autoFocus />
                  <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
                    {password && (
                      <button type="button" onClick={() => navigator.clipboard?.writeText(password)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}>
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
              {error && <div style={{ padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Resetting…' : 'Reset Password'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ManageUsers() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === 'superadmin';

  const [view,          setView]         = useState('list');
  const [activeUser,    setActiveUser]   = useState(null);
  const [users,         setUsers]        = useState([]);
  const [teamMembers,   setTeamMembers]  = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [search,        setSearch]       = useState('');
  const [roleFilter,    setRoleFilter]   = useState('All');
  const [regionFilter,  setRegionFilter] = useState('All');
  const [deleteConf,    setDeleteConf]   = useState(null);
  const [toggleTarget,  setToggleTarget] = useState(null);
  const [deleting,      setDeleting]     = useState(false);

  const [regionGroups, setRegionGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('regionGroups');
      return saved ? JSON.parse(saved) : DEFAULT_REGION_GROUPS;
    } catch { return DEFAULT_REGION_GROUPS; }
  });

  const saveRegionGroups = (groups) => {
    setRegionGroups(groups);
    try { localStorage.setItem('regionGroups', JSON.stringify(groups)); } catch {}
  };

  const handleAddLocation = (loc, region) => {
    const updated = { ...regionGroups };
    if (!updated[region]) updated[region] = [];
    if (!updated[region].includes(loc)) updated[region] = [...updated[region], loc];
    saveRegionGroups(updated);
  };

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

  const goBack = useCallback(() => {
    setView('list');
    setActiveUser(null);
    fetchData();
  }, [fetchData]);

  if (view === 'create') return <CreateUserPage onBack={goBack} onCreated={fetchData} currentUserRole={me?.role} regionGroups={regionGroups} onAddLocation={handleAddLocation} />;
  if (view === 'edit'   && activeUser) return <EditUserPage targetUser={activeUser} onBack={goBack} onSaved={fetchData} regionGroups={regionGroups} onAddLocation={handleAddLocation} currentUserRole={me?.role} />;
  if (view === 'reset'  && activeUser) return <ResetPasswordPage targetUser={activeUser} onBack={goBack} />;

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  const allRegions = Object.keys(regionGroups);

  const filtered = users.filter(u => {
    const uLocs      = parseLocations(u.managed_locations || u.managed_location);
    const matchSearch  = !search || [u.name, u.email, u.role, ...uLocs].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchRole    = roleFilter === 'All' || u.role === roleFilter;
    const matchRegion  = regionFilter === 'All' || u.role === 'superadmin' || uLocs.some(l => (regionGroups[regionFilter] || []).includes(l));
    return matchSearch && matchRole && matchRegion;
  });

  const stats = {
    total:      users.length,
    superadmin: users.filter(u => u.role === 'superadmin').length,
    admins:     users.filter(u => u.role === 'admin').length,
    itStaff:    users.filter(u => u.role === 'it_staff').length,
    employees:  users.filter(u => u.role === 'employee').length,
    inactive:   users.filter(u => !u.is_active).length,
  };

  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Manage Users</h1>
          <p>Create and manage IT staff, admin and employee accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setView('create')}>
          <Plus size={15} /> Create User
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total',       val: stats.total,      color: 'var(--accent)',      icon: Users },
          { label: 'Super Admin', val: stats.superadmin, color: '#7c3aed',            icon: Globe },
          { label: 'Admins',      val: stats.admins,     color: 'var(--accent)',      icon: Shield },
          { label: 'IT Staff',    val: stats.itStaff,    color: 'var(--green)',       icon: UserCheck },
          { label: 'Employees',   val: stats.employees,  color: 'var(--text-muted)', icon: Users },
          { label: 'Inactive',    val: stats.inactive,   color: 'var(--red)',         icon: UserX },
        ].map(s => { const Icon = s.icon; return (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Icon size={14} color={s.color} />
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', color: s.color }}>{s.val}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ); })}
      </div>

      {/* Homepage order */}
      {teamMembers.length > 0 && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Star size={13} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 13 }}>Homepage Display Order</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...teamMembers].sort((a, b) => (a.priority || 999) - (b.priority || 999)).map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 6px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ width: 18, height: 18, borderRadius: 9, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{m.priority || i + 1}</span>
                {m.photo
                  ? <img src={m.photo} alt="" style={{ width: 22, height: 22, borderRadius: 11, objectFit: 'cover' }} />
                  : <div style={{ width: 22, height: 22, borderRadius: 11, background: `${roleConfig[m.role]?.color || 'var(--accent)'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: roleConfig[m.role]?.color || 'var(--accent)' }}>{m.name?.[0]?.toUpperCase()}</div>}
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
      <div className="inv-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 220, maxWidth: 320 }}>
          <Search size={15} />
          <input className="form-input" placeholder="Search name, email, role, office…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="toggle-group">
          {['All', 'superadmin', 'admin', 'it_staff', 'employee'].map(r => (
            <button key={r} className={`toggle-btn ${roleFilter === r ? 'active' : ''}`} onClick={() => setRoleFilter(r)}>
              {r === 'All' ? 'All' : roleConfig[r]?.label || r}
            </button>
          ))}
        </div>
        {isSuperAdmin && allRegions.length > 0 && (
          <select className="form-select" style={{ fontSize: 12, padding: '6px 10px', minWidth: 160 }}
            value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
            <option value="All">🌐 All Regions</option>
            {allRegions.map(r => <option key={r} value={r}>📍 {r}</option>)}
          </select>
        )}
        <button className="btn btn-secondary btn-sm" onClick={fetchData}><RefreshCw size={14} /></button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th><th>Employee ID</th><th>Designation</th>
              <th>Email</th><th>Role</th><th>Office Access</th>
              <th>Order</th><th>Status</th><th>Created</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10}><div className="empty-state"><p>Loading…</p></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10}><div className="empty-state"><p>No users found</p></div></td></tr>
            ) : filtered.map(u => {
              const rc       = roleConfig[u.role] || roleConfig.employee;
              const isMe     = u.id === me?.id;
              const teamData = teamMembers.find(m => m.id === u.id);
              const isTeam   = u.role === 'admin' || u.role === 'it_staff' || u.role === 'superadmin';
              return (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {teamData?.photo
                        ? <img src={teamData.photo} alt="" style={{ width: 34, height: 34, borderRadius: 17, objectFit: 'cover', border: `1px solid ${rc.color}44` }} />
                        : <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${rc.color}22`, border: `1px solid ${rc.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: rc.color }}>{u.name?.[0]?.toUpperCase()}</div>}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                        {isMe && <div style={{ fontSize: 11, color: 'var(--accent)' }}>● You</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>{teamData?.employee_id || '—'}</td>
                  <td>{teamData?.designation ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Briefcase size={10} color="var(--text-muted)" />{teamData.designation}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{u.email}</td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: rc.bg, color: rc.color }}>{rc.label}</span></td>
                  <td style={{ maxWidth: 200 }}><LocationBadge managed_locations={u.managed_locations || u.managed_location} role={u.role} /></td>
                  <td>{isTeam && teamData?.priority ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 10, fontSize: 12, background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 700 }}><Star size={9} />#{teamData.priority}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                  <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-muted)' }}>{u.created_at?.split('T')[0]}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {isTeam && (
                        <button className="btn btn-sm btn-secondary" title="Edit profile"
                          onClick={() => { setActiveUser(u); setView('edit'); }}>
                          <Edit2 size={11} />
                        </button>
                      )}
                      <button className="btn btn-sm btn-secondary" title="Reset password"
                        onClick={() => { setActiveUser(u); setView('reset'); }}>
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
                        <button className="btn btn-sm btn-danger" title="Delete"
                          onClick={() => setDeleteConf(u)}>
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

      {/* Toggle status modal */}
      {toggleTarget && (
        <div className="modal-overlay" onClick={() => setToggleTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{toggleTarget.is_active ? 'Deactivate' : 'Activate'} User</h2>
              <button className="btn btn-icon" onClick={() => setToggleTarget(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '14px 16px', background: toggleTarget.is_active ? 'var(--red-bg)' : 'var(--green-bg)', border: `1px solid ${toggleTarget.is_active ? 'rgba(248,113,113,.2)' : 'rgba(52,211,153,.2)'}`, borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 13 }}>
                {toggleTarget.is_active
                  ? <>⚠️ Deactivating <strong>{toggleTarget.name}</strong> will prevent them from logging in.</>
                  : <>✅ Activating <strong>{toggleTarget.name}</strong> will restore their login access.</>}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setToggleTarget(null)}>Cancel</button>
                <button className={`btn ${toggleTarget.is_active ? 'btn-danger' : 'btn-primary'}`}
                  onClick={async () => {
                    try {
                      await apiFetch(`/users/${toggleTarget.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !toggleTarget.is_active }) });
                      setToggleTarget(null); fetchData();
                    } catch (err) { alert(err.message); }
                  }}>
                  {toggleTarget.is_active ? <><UserX size={14} /> Deactivate</> : <><UserCheck size={14} /> Activate</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
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