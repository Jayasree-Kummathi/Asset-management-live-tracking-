import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import {
  Plus, Search, Edit2, X, User, Mail,
  Calendar, Briefcase, Users, Camera, Trash2, Eye,
  Key, RefreshCw, Download, Lock, EyeOff, Eye as EyeIcon,
  AlertTriangle, Clock, Upload, FileSpreadsheet, Link as LinkIcon,
  HelpCircle, Phone, Save, ChevronUp, ChevronDown, AlertCircle,
  ArrowLeft, MapPin, Building2, Shield, Smartphone, Globe,
  Hash, UserCheck, ChevronRight, ChevronLeft, Check, AlignLeft
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

// ── Predefined portal URLs ────────────────────────────────────────────────────
const PRESET_PORTALS = [
  { label: 'GoDaddy SSO (Titan Email)',  url: 'https://sso.godaddy.com/login?app=titan&realm=pass' },
  { label: 'Microsoft Outlook (Office)', url: 'https://outlook.office.com' },
];

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const LEVELS       = ['L1','L2','L3','L4','L5','L6','Manager','Senior Manager','Director','VP','S1 G1','S1 G2','S2 G1','S2 G2','S3','S4'];

const EMPTY_FORM = {
  emp_id: '', emp_name: '', doj: '', level: '', designation: '', location: '',
  mobile_no: '', service_line: '', client: '', reporting_manager: '',
  suggested_email: '', personal_email: '', blood_group: '', dob: '',
  password_hint: '', company_email: '', company_email_password: '',
  photo_url: '', status: 'Active', notes: '', cc_emails: '',
  portal_urls: [],
};

const EMPTY_EDIT = {
  emp_id: '', emp_name: '', doj: '', dob: '', blood_group: '',
  level: '', designation: '', service_line: '', client: '',
  location: '', reporting_manager: '', status: 'Active',
  mobile_no: '', company_email: '', suggested_email: '',
  personal_email: '', company_email_password: '', password_hint: '',
  notes: '', cc_emails: '', portal_urls: [], photo_url: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const portalUrlsToString = (arr) => {
  if (!arr || !arr.length) return '';
  try { return JSON.stringify(arr); } catch { return ''; }
};
const portalUrlsFromString = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.startsWith('http')) return [{ label: 'Portal', url: value }];
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
};

// ── Avatar ────────────────────────────────────────────────────────────────────
function EmpAvatar({ photo, name, size = 40 }) {
  if (photo) return (
    <img src={photo} alt={name} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)', flexShrink:0 }}/>
  );
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent), #818cf8)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:size*0.38, flexShrink:0, border:'2px solid var(--border)' }}>
      {(name||'?')[0].toUpperCase()}
    </div>
  );
}

function BulkAvatar({ photo, name, size = 40 }) {
  if (photo) return (
    <img src={photo} alt={name} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)', flexShrink:0 }}/>
  );
  const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent), #818cf8)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:size*0.36, flexShrink:0 }}>
      {initials}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <input type={show?'text':'password'} className="form-input" value={value} onChange={onChange} placeholder={placeholder} style={{ paddingRight:40 }}/>
      <button type="button" onClick={()=>setShow(s=>!s)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', alignItems:'center' }}>
        {show ? <EyeOff size={15}/> : <EyeIcon size={15}/>}
      </button>
    </div>
  );
}

function PasswordViewOnly({ value }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:700, color:'#92400e', flex:1 }}>
        {show ? value : '•'.repeat(Math.min(value.length, 12))}
      </span>
      <button type="button" onClick={()=>setShow(s=>!s)} style={{ background:'none', border:'none', cursor:'pointer', color:'#92400e', display:'flex', alignItems:'center' }}>
        {show ? <EyeOff size={14}/> : <EyeIcon size={14}/>}
      </button>
    </div>
  );
}

function BulkSectionHeader({ icon: Icon, title }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:20, marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
      {Icon && <Icon size={13}/>}{title}
    </div>
  );
}

function FormField({ label, children, span2 }) {
  return (
    <div className="form-group" style={span2 ? { gridColumn:'span 2' } : {}}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

// ── CC Tags input ─────────────────────────────────────────────────────────────
function CcTagsInput({ tags, onTagsChange }) {
  const [ccInput, setCcInput] = useState('');
  const [ccError, setCcError] = useState('');
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const addTag = () => {
    const email = ccInput.trim();
    if (!email) return;
    if (!isValidEmail(email)) { setCcError('Invalid email address'); return; }
    if (tags.includes(email)) { setCcError('Already added'); return; }
    onTagsChange([...tags, email]);
    setCcInput(''); setCcError('');
  };
  const removeTag = (email) => onTagsChange(tags.filter(t => t !== email));
  const handleKey = (e) => { if (e.key==='Enter'||e.key===',') { e.preventDefault(); addTag(); } };
  return (
    <div>
      <div style={{ display:'flex', gap:8 }}>
        <input type="text" className="form-input" style={{ flex:1, fontSize:12 }} value={ccInput} onChange={e=>{setCcInput(e.target.value);setCcError('');}} onKeyDown={handleKey} placeholder="Type email and press Enter or comma…"/>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addTag} disabled={!ccInput.trim()}><Plus size={13}/> Add</button>
      </div>
      {ccError && <div style={{ fontSize:11, color:'var(--red,#ef4444)', marginTop:4 }}>{ccError}</div>}
      {tags.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8, padding:'8px 10px', background:'rgba(99,102,241,0.04)', border:'1px solid var(--border)', borderRadius:8 }}>
          {tags.map(email => (
            <div key={email} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, background:'var(--accent-glow)', border:'1px solid rgba(99,102,241,0.2)', color:'var(--accent)' }}>
              <Mail size={10}/><span>{email}</span>
              <button type="button" onClick={()=>removeTag(email)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', color:'var(--text-muted)' }}><X size={11}/></button>
            </div>
          ))}
        </div>
      )}
      {tags.length===0 && <div style={{ marginTop:6, fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>No CC recipients added yet.</div>}
    </div>
  );
}

// ── Photo upload widget ───────────────────────────────────────────────────────
function PhotoUploadWidget({ preview, onPhotoChange, onPhotoRemove }) {
  const photoRef = useRef();
  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onPhotoChange(ev.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
      <div onClick={()=>photoRef.current?.click()} style={{ width:64, height:64, borderRadius:'50%', overflow:'hidden', border:'2px dashed var(--border)', background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
        {preview ? <img src={preview} alt="emp" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <Camera size={20} color="var(--text-muted)"/>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <input type="file" ref={photoRef} accept="image/*" style={{ display:'none' }} onChange={handleFile}/>
        <button type="button" className="btn btn-secondary btn-sm" onClick={()=>photoRef.current?.click()}><Camera size={12}/> {preview?'Change':'Upload Photo'}</button>
        {preview && <button type="button" className="btn btn-sm" style={{ fontSize:11 }} onClick={()=>{onPhotoRemove();if(photoRef.current)photoRef.current.value='';}}><X size={11}/> Remove</button>}
      </div>
    </div>
  );
}

// ── Portal URLs Manager ───────────────────────────────────────────────────────
function PortalUrlsManager({ portalUrls, onChange }) {
  const [customLabel, setCustomLabel] = useState('');
  const [customUrl,   setCustomUrl]   = useState('');
  const [customErr,   setCustomErr]   = useState('');

  const isSelected = (url) => portalUrls.some(p => p.url === url);

  const togglePreset = (preset) => {
    if (isSelected(preset.url)) onChange(portalUrls.filter(p => p.url !== preset.url));
    else onChange([...portalUrls, { label: preset.label, url: preset.url }]);
  };

  const addCustom = () => {
    if (!customUrl.trim()) { setCustomErr('URL is required'); return; }
    if (!customUrl.startsWith('http')) { setCustomErr('URL must start with http:// or https://'); return; }
    if (portalUrls.some(p => p.url === customUrl.trim())) { setCustomErr('Already added'); return; }
    onChange([...portalUrls, { label: customLabel.trim() || 'Custom Portal', url: customUrl.trim() }]);
    setCustomLabel(''); setCustomUrl(''); setCustomErr('');
  };

  const removePortal = (url) => onChange(portalUrls.filter(p => p.url !== url));

  return (
    <div>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Quick Select</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {PRESET_PORTALS.map(preset => {
            const selected = isSelected(preset.url);
            return (
              <button key={preset.url} type="button" onClick={() => togglePreset(preset)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
                  border:`1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected ? 'var(--accent-glow)' : 'var(--surface2)',
                  color: selected ? 'var(--accent)' : 'var(--text-muted)', transition:'all 0.15s ease' }}>
                {selected ? <Check size={12}/> : <Globe size={12}/>}{preset.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding:'12px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, marginBottom:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Add Custom URL</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input className="form-input" style={{ flex:'0 0 160px', fontSize:12 }} value={customLabel} onChange={e=>setCustomLabel(e.target.value)} placeholder="Label (e.g. HRMS)"/>
          <input className="form-input" style={{ flex:1, minWidth:200, fontSize:12 }} value={customUrl}
            onChange={e=>{setCustomUrl(e.target.value);setCustomErr('');}} placeholder="https://your-portal.com"
            onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addCustom(); }}}/>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addCustom}><Plus size={13}/> Add</button>
        </div>
        {customErr && <div style={{ fontSize:11, color:'var(--red,#ef4444)', marginTop:4 }}>{customErr}</div>}
      </div>
      {portalUrls.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Selected Portals ({portalUrls.length})</div>
          {portalUrls.map(p => (
            <div key={p.url} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'var(--accent-glow)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:8 }}>
              <Globe size={12} color="var(--accent)"/>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--accent)', flex:1 }}>{p.label}</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--mono)', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.url}</span>
              <button type="button" onClick={()=>removePortal(p.url)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:0 }}><X size={13}/></button>
            </div>
          ))}
        </div>
      )}
      {portalUrls.length === 0 && <div style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>No portals selected yet.</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INLINE EDIT PAGE (inside bulk import review)
// ══════════════════════════════════════════════════════════════════════════════
function InlineEditPage({ employees, editIdx, editedSet, onSave, onCancel, onNav }) {
  const [form, setForm] = useState({ ...EMPTY_EDIT, ...employees[editIdx] });
  const [changedFields, setChangedFields] = useState(new Set());
  const [ccTags, setCcTags] = useState(() => {
    const cc = employees[editIdx]?.cc_emails || '';
    return cc ? cc.split(',').map(e=>e.trim()).filter(Boolean) : [];
  });
  const [preview, setPreview] = useState(employees[editIdx]?.photo_url || '');
  const [portalUrls, setPortalUrls] = useState(() => portalUrlsFromString(employees[editIdx]?.portal_urls || employees[editIdx]?.portal_url || ''));

  useEffect(() => {
    const emp = employees[editIdx];
    setForm({ ...EMPTY_EDIT, ...emp });
    setChangedFields(new Set());
    const cc = emp?.cc_emails || '';
    setCcTags(cc ? cc.split(',').map(e=>e.trim()).filter(Boolean) : []);
    setPreview(emp?.photo_url || '');
    setPortalUrls(portalUrlsFromString(emp?.portal_urls || emp?.portal_url || ''));
  }, [editIdx, employees]);

  const setField = (k, v) => { setForm(f=>({...f,[k]:v})); setChangedFields(prev=>new Set([...prev,k])); };
  const handleCcChange    = (tags)  => { setCcTags(tags);  setField('cc_emails', tags.join(', ')); };
  const handlePhotoChange = (dataUrl) => { setPreview(dataUrl); setField('photo_url', dataUrl); };
  const handlePhotoRemove = () => { setPreview(''); setField('photo_url', ''); };
  const handlePortalChange = (urls) => { setPortalUrls(urls); setChangedFields(prev=>new Set([...prev,'portal_urls'])); };

  const handleSave = () => onSave(editIdx, { ...form, cc_emails: ccTags.join(', '), photo_url: preview, portal_urls: portalUrls }, changedFields.size > 0);
  const handleNav  = (dir) => { onSave(editIdx, { ...form, cc_emails: ccTags.join(', '), photo_url: preview, portal_urls: portalUrls }, changedFields.size > 0); onNav(dir); };

  const total = employees.length; const isFirst = editIdx===0; const isLast = editIdx===total-1;
  const hasChanges = changedFields.size > 0;

  return (
    <div style={{ animation:'slideInRight 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:13, color:'var(--text-muted)' }}>
        <button onClick={onCancel} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:0 }}>
          <ArrowLeft size={15}/> Review
        </button>
        <ChevronRight size={13} style={{ opacity:0.4 }}/>
        <span style={{ color:'var(--text)', fontWeight:600 }}>Edit — {form.emp_name || 'Employee'}</span>
        {hasChanges && (
          <span style={{ marginLeft:6, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'rgba(245,158,11,0.12)', color:'#b45309', border:'1px solid rgba(245,158,11,0.25)' }}>
            {changedFields.size} field{changedFields.size!==1?'s':''} modified
          </span>
        )}
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'20px 28px', marginBottom:20, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <BulkAvatar photo={preview} name={form.emp_name} size={52}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:16 }}>{form.emp_name||'—'}</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{[form.emp_id,form.designation,form.location].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <button className="btn btn-secondary btn-sm" disabled={isFirst} onClick={()=>handleNav(-1)}><ChevronLeft size={14}/> Prev</button>
          <span style={{ fontSize:12, color:'var(--text-muted)', minWidth:60, textAlign:'center' }}>{editIdx+1} / {total}</span>
          <button className="btn btn-secondary btn-sm" disabled={isLast}  onClick={()=>handleNav(1)}>Next <ChevronRight size={14}/></button>
        </div>
      </div>

      {hasChanges && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', marginBottom:16, background:'rgba(59,184,122,0.08)', border:'1px solid rgba(59,184,122,0.25)', borderRadius:8, fontSize:13, color:'#1a8050' }}>
          <Check size={14}/> Unsaved changes — click "Save &amp; back to review" to apply
        </div>
      )}

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'24px 28px' }}>
        <BulkSectionHeader icon={Camera} title="Employee Photo"/>
        <div style={{ marginBottom:4 }}>
          <PhotoUploadWidget preview={preview} onPhotoChange={handlePhotoChange} onPhotoRemove={handlePhotoRemove}/>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>Photo will appear in the welcome email and employee profile.</div>
        </div>

        <BulkSectionHeader icon={User} title="Basic information"/>
        <div className="form-grid form-grid-3">
          <FormField label="Employee ID *">
            <input className="form-input" required value={form.emp_id} onChange={e=>setField('emp_id',e.target.value)} placeholder="e.g. IBC001"
              style={changedFields.has('emp_id')?{borderColor:'var(--accent)',background:'var(--accent-glow)'}:{}}/>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>Edit to correct auto-generated IDs</div>
          </FormField>
          <FormField label="Full name *" span2>
            <input className="form-input" required value={form.emp_name} onChange={e=>setField('emp_name',e.target.value)} placeholder="Jacob Thomas"/>
          </FormField>
          <FormField label="Date of Joining">
            <input className="form-input" value={form.doj} onChange={e=>setField('doj',e.target.value)} placeholder="e.g. 04-May-26 or 2026-05-04"/>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Enter any date format — it will be saved as-is</div>
          </FormField>
          <FormField label="Date of Birth">
            <input className="form-input" value={form.dob} onChange={e=>setField('dob',e.target.value)} placeholder="e.g. 07-Dec-00 or 2000-12-07"/>
          </FormField>
          <FormField label="Blood group">
            <select className="form-select" value={form.blood_group} onChange={e=>setField('blood_group',e.target.value)}>
              <option value="">— select —</option>
              {BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
            </select>
          </FormField>
        </div>

        <BulkSectionHeader icon={Briefcase} title="Job details"/>
        <div className="form-grid form-grid-3">
          <FormField label="Level">
            <select className="form-select" value={form.level} onChange={e=>setField('level',e.target.value)}>
              <option value="">— select —</option>
              {LEVELS.map(l=><option key={l}>{l}</option>)}
            </select>
          </FormField>
          <FormField label="Designation" span2><input className="form-input" value={form.designation} onChange={e=>setField('designation',e.target.value)} placeholder="Software Engineer"/></FormField>
          <FormField label="Service line"><input className="form-input" value={form.service_line} onChange={e=>setField('service_line',e.target.value)} placeholder="Engineering"/></FormField>
          <FormField label="Client"><input className="form-input" value={form.client} onChange={e=>setField('client',e.target.value)} placeholder="Client name"/></FormField>
          <FormField label="Location"><input className="form-input" value={form.location} onChange={e=>setField('location',e.target.value)} placeholder="Bengaluru"/></FormField>
          <FormField label="Reporting manager" span2><input className="form-input" value={form.reporting_manager} onChange={e=>setField('reporting_manager',e.target.value)} placeholder="Manager name"/></FormField>
          <FormField label="Status">
            <select className="form-select" value={form.status} onChange={e=>setField('status',e.target.value)}>
              <option>Active</option><option>Inactive</option>
            </select>
          </FormField>
        </div>

        <BulkSectionHeader icon={Mail} title="Contact & email"/>
        <div className="form-grid form-grid-3">
          <FormField label="Mobile number"><input className="form-input" type="tel" value={form.mobile_no} onChange={e=>setField('mobile_no',e.target.value)} placeholder="+91 98765 43210"/></FormField>
          <FormField label="Company email" span2><input type="email" className="form-input" value={form.company_email} onChange={e=>setField('company_email',e.target.value)} placeholder="jacob@mindteck.com"/></FormField>
          <FormField label="Suggested / alternative email" span2><input type="email" className="form-input" value={form.suggested_email} onChange={e=>setField('suggested_email',e.target.value)} placeholder="jacob.thomas@mindteck.com"/></FormField>
          <FormField label="Personal email"><input type="email" className="form-input" value={form.personal_email} onChange={e=>setField('personal_email',e.target.value)} placeholder="jacob@gmail.com"/></FormField>
        </div>

        <BulkSectionHeader icon={Mail} title="CC recipients (for welcome email)"/>
        <div style={{ marginBottom:4 }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8, lineHeight:1.6 }}>Add manager / HR emails to CC on the welcome email.</div>
          <CcTagsInput tags={ccTags} onTagsChange={handleCcChange}/>
        </div>

        <BulkSectionHeader icon={Lock} title="Credentials"/>
        <div className="form-grid form-grid-2">
          <FormField label="Company email password"><input className="form-input" value={form.company_email_password} onChange={e=>setField('company_email_password',e.target.value)} placeholder="e.g. Mindteck@2024"/></FormField>
          <FormField label="Password hint"><input className="form-input" value={form.password_hint} onChange={e=>setField('password_hint',e.target.value)} placeholder="e.g. First letter uppercase + @year"/></FormField>
        </div>

        <BulkSectionHeader icon={Globe} title="Portal URLs"/>
        <PortalUrlsManager portalUrls={portalUrls} onChange={handlePortalChange}/>

        <BulkSectionHeader icon={AlignLeft} title="Notes"/>
        <div className="form-group">
          <textarea className="form-textarea" rows={2} value={form.notes} onChange={e=>setField('notes',e.target.value)} placeholder="Any additional notes…"/>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}><Check size={14}/> Save &amp; back to review</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BULK IMPORT PAGE
// ══════════════════════════════════════════════════════════════════════════════
function BulkImportPage({ onBack, onImport }) {
  const [textData,   setTextData]   = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [importing,  setImporting]  = useState(false);
  const [error,      setError]      = useState('');
  const [sendEmails, setSendEmails] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [editIdx,    setEditIdx]    = useState(null);
  const editedSet = useRef(new Set());

  const FIELD_MAP = {
    'emp id':'emp_id','employee id':'emp_id','employee name':'emp_name','emp name':'emp_name',
    'eid':'emp_id','employee eid':'emp_id','name':'emp_name','full name':'emp_name',
    'doj':'doj','date of joining':'doj','joining date':'doj',
    'dob':'dob','date of birth':'dob','d o b':'dob','birth date':'dob','birthdate':'dob',
    'level':'level','designation':'designation','title':'designation','role':'designation',
    'location':'location','service line':'service_line','service':'service_line',
    'service line department':'service_line','service department':'service_line',
    'client':'client','reporting manager':'reporting_manager','manager':'reporting_manager',
    'mobile number':'mobile_no','mobile no':'mobile_no','mobile':'mobile_no','phone':'mobile_no',
    'suggested email id':'suggested_email','suggested email':'suggested_email',
    'suggested mail':'suggested_email','alternate email':'suggested_email',
    'alternative email':'suggested_email',
    'personal email':'personal_email','personal email id':'personal_email',
    'personal mail':'personal_email','personal mail id':'personal_email',
    'email personal':'personal_email','gmail':'personal_email',
    'company email':'company_email','email':'company_email',
    'blood group':'blood_group','blood':'blood_group','bloodgroup':'blood_group','blood grp':'blood_group',
    'portal url':'portal_url','portal link':'portal_url','login url':'portal_url','login link':'portal_url',
    'password hint':'password_hint','password_hint':'password_hint',
    'notes':'notes','cc emails':'cc_emails','cc_emails':'cc_emails','cif':'cif',
  };

  const detectDelimiter = (line) => line.includes('\t') ? '\t' : line.includes(',') ? ',' : '|';

  const splitLine = (line, delim) => {
    if (delim !== ',') return line.split(delim).map(v => v.trim());
    const result = []; let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === delim && !inQ) { result.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const normalizeBloodGroup = (raw) => {
    if (!raw) return '';
    let v = raw.trim()
      .replace(/\+\s*ve$/i, '+')
      .replace(/-\s*ve$/i,  '-')
      .replace(/positive$/i, '+')
      .replace(/negative$/i, '-')
      .replace(/\s+/g, '')
      .toUpperCase();
    return BLOOD_GROUPS.includes(v) ? v : '';
  };

  const generateEmpId = (emp, index) => {
    const name  = (emp.emp_name || '').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const prefix = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : 'EMP';
    return `${prefix}${String(index + 1).padStart(3, '0')}`;
  };

  // ── matchHeader: maps a merged/combined header string to a field key ──────
  const matchHeader = (raw) => {
    const c = raw.toLowerCase().trim();
    // Exact key match first
    if (FIELD_MAP[c]) return FIELD_MAP[c];
    // Substring match: key is contained in header or header is contained in key
    for (const [key, val] of Object.entries(FIELD_MAP)) {
      if (c.includes(key) || key.includes(c)) return val;
    }
    return c; // unmapped — keep as-is
  };

  const parseTabularData = () => {
    if (!textData.trim()) { setError('Please paste some data'); return; }
    setError('');

    const rawLines = textData.split('\n').filter(l => l.trim().length > 0);
    if (rawLines.length < 2) { setError('Need at least a header row and one data row'); return; }

    const delim = detectDelimiter(rawLines[0]);

    // ── STEP 1: Detect 1-row vs 2-row header ─────────────────────────────────
    const HEADER_KEYWORDS = [
      'name','id','eid','email','date','doj','dob','designation','level','location',
      'mobile','phone','service','line','department','manager','suggested','personal',
      'blood','group','grp','client','reporting','cif','notes','cc',
      'portal','url','password','hint','status','joining','birth',
    ];

    const isHeaderCell = (cell) => {
      const t = cell.trim().toLowerCase();
      if (!t || t === '—' || t === '-') return false;
      return HEADER_KEYWORDS.some(kw => t.includes(kw));
    };

    const isDataCell = (cell) => {
      const t = cell.trim();
      if (!t || t === '—' || t === '-') return false;
      return (
        /^[A-Z]{1,6}\d{2,8}$/i.test(t) ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ||
        /^\+?\d[\d\s\-]{7,}$/.test(t) ||
        /^\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}$/.test(t) ||
        /^\d{4}-\d{2}-\d{2}$/.test(t) ||
        /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(t)
      );
    };

    const countHeaderCells = (line) => splitLine(line, delim).filter(isHeaderCell).length;
    const countDataCells   = (line) => splitLine(line, delim).filter(isDataCell).length;

    let headers;
    let dataStartIndex;

    const row0cells = splitLine(rawLines[0], delim);
    const row1cells = rawLines[1] ? splitLine(rawLines[1], delim) : [];

    const row1headerCount = rawLines[1] ? countHeaderCells(rawLines[1]) : 0;
    const row1dataCount   = rawLines[1] ? countDataCells(rawLines[1])   : 0;
    const row1firstCell   = (row1cells[0] || '').trim();

    const isRow1HeaderContinuation =
      row1headerCount > row1dataCount &&
      !(/^[A-Z]{1,6}\d{2,8}$/i.test(row1firstCell));

    if (isRow1HeaderContinuation && rawLines.length >= 3) {
      // ── FIX: detect offset merge when row 1 starts with "& Xxx" ────────────
      // Excel wraps merged-cell headers: "Service Line" in row 0 col 7 becomes
      // "Service Line" (row 0) + "& Department" (row 1 col 0 of the continuation).
      // The continuation row is shifted left by (row0.length - 1) positions
      // relative to row 0, so we must merge with that offset rather than 1:1.
      const row1StartsWithContinuation = /^[&+]/.test(row1firstCell);

      if (row1StartsWithContinuation) {
        // row1[0] is a suffix for row0[row0.length-1]
        // row1[1..] are new column headers appended after row 0's columns
        const offset = row0cells.length - 1; // index in merged array where row1 begins
        const totalCols = row0cells.length + row1cells.length - 1;
        headers = Array.from({ length: totalCols }, (_, idx) => {
          const h1 = (row0cells[idx] || '').trim();
          const h2raw = (row1cells[idx - offset] || '').trim();
          // Strip leading & / + / - / whitespace from continuation suffix
          const h2 = h2raw.replace(/^[&+\-\/\s]+/, '').trim();
          if (h1 && h2) return `${h1} ${h2}`.trim();
          return h1 || h2;
        }).filter(h => h && h.length > 0);
      } else {
        // Standard positional merge (no offset)
        const maxLen = Math.max(row0cells.length, row1cells.length);
        headers = Array.from({ length: maxLen }, (_, idx) => {
          const h1 = (row0cells[idx] || '').trim();
          const h2 = (row1cells[idx] || '').trim();
          const h2clean = h2.replace(/^[&+\-\/\s]+/, '').trim();
          if (h1 && h2clean) return `${h1} ${h2clean}`.trim();
          return h1 || h2clean;
        }).filter(h => h && h.length > 0);
      }
      dataStartIndex = 2;
    } else {
      headers        = row0cells.map(h => h.trim()).filter(Boolean);
      dataStartIndex = 1;
    }

    // Map each header string to a field key
    const mapped = headers.map(h => matchHeader(h.replace(/\r/g, '').trim()));
    const hCount = headers.length;

    // ── STEP 2: Parse data rows ───────────────────────────────────────────────
    const isValidEmpId = (cell) => {
      const t = cell.trim();
      if (!t) return false;
      if (/^[ABO]{1,2}[+-]?(ve)?$/i.test(t)) return false;        // blood group
      if (/^\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}$/.test(t)) return false; // date
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;            // ISO date
      if (/^(yes|no)$/i.test(t)) return false;                     // YES/NO
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;     // email
      if (isHeaderCell(t) && !(/\d/.test(t))) return false;        // looks like header
      return true;
    };

    const lineToFields = (line) => {
      const cells  = splitLine(line, delim);
      const padded = Array.from({ length: hCount }, (_, idx) => cells[idx] || '');
      const obj    = {};
      mapped.forEach((field, idx) => {
        const val = (padded[idx] || '').replace(/[\r\n]+/g, ' ').trim();
        if (val && val !== '—' && val !== '-' && val !== '–') {
          obj[field] = val;
        }
      });
      return obj;
    };

    // Group lines into employee blocks
    const empObjects = [];
    for (let i = dataStartIndex; i < rawLines.length; i++) {
      const line      = rawLines[i];
      const cells     = splitLine(line, delim);
      const firstCell = (cells[0] || '').trim();

      if (isValidEmpId(firstCell)) {
        empObjects.push(lineToFields(line));
      } else if (empObjects.length > 0) {
        // Continuation row — merge into last employee, only filling empty slots
        const extra = lineToFields(line);
        const last  = empObjects[empObjects.length - 1];
        Object.keys(extra).forEach(field => {
          if (!last[field]) last[field] = extra[field];
        });
      }
    }

    if (empObjects.length === 0) {
      setError('No data rows found. Please check your paste format.');
      return;
    }

    // ── STEP 3: Build final employee objects ──────────────────────────────────
    const employees = empObjects.map((emp, rowIndex) => {
      if (emp.blood_group) {
        emp.blood_group = normalizeBloodGroup(emp.blood_group) || '';
      }

      if (emp.emp_name && !emp.company_email) {
        const parts = emp.emp_name.toLowerCase().trim().split(/\s+/);
        emp.company_email = parts.length >= 2
          ? `${parts[0]}.${parts[1]}@mindteck.com`
          : `${parts[0]}@mindteck.com`;
      }

      if (!emp.emp_id && emp.emp_name) emp.emp_id = generateEmpId(emp, rowIndex);

      if (emp.cif) {
        emp.notes = emp.notes ? `${emp.notes}\nCIF: ${emp.cif}` : `CIF: ${emp.cif}`;
        delete emp.cif;
      }

      if (!emp.company_email_password) emp.company_email_password = `Mindteck@${new Date().getFullYear()}`;
      if (!emp.status)    emp.status    = 'Active';
      if (!emp.photo_url) emp.photo_url = '';
      if (!emp.cc_emails) emp.cc_emails = '';
      emp.portal_urls = [];

      return emp;
    }).filter(e => e.emp_name);

    if (!employees.length) {
      setError('No valid employee data found. Please ensure your data has an "Employee Name" column with values.');
      return;
    }

    setParsedData(employees);
    editedSet.current = new Set();
    setReviewMode(true);
  };

  const formatDateForAPI = (ds) => {
    if (!ds || ds === '—' || ds === '-') return null;
    try {
      if (/\d{1,2}-[A-Za-z]{3}-\d{2,4}/.test(ds)) {
        const [d, m, y] = ds.split('-');
        const mm = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                     jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }[m.toLowerCase().slice(0,3)];
        const yr = y.length === 2 ? (parseInt(y) > 30 ? `19${y}` : `20${y}`) : y;
        return `${yr}-${mm}-${d.padStart(2, '0')}`;
      }
      if (/\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(ds)) {
        const parts = ds.split(/[-/]/);
        return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
      if (/\d{4}-\d{2}-\d{2}/.test(ds)) return ds;
      const d = new Date(ds);
      return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    } catch { return null; }
  };

  const handleImport = async () => {
    if (!parsedData.length) return;
    setImporting(true);
    let ok = 0, fail = 0;
    const errs = [];

    for (const emp of parsedData) {
      try {
        const doj = formatDateForAPI(emp.doj);
        const dob = formatDateForAPI(emp.dob);
        if (!emp.emp_id)   throw new Error('Employee ID missing');
        if (!emp.emp_name) throw new Error('Employee name missing');

        await apiFetch('/employees', {
          method: 'POST',
          body: JSON.stringify({
            emp_id:   emp.emp_id,   emp_name: emp.emp_name,
            doj:      doj || null,  dob:      dob || null,
            level:    emp.level    || null, designation:       emp.designation       || null,
            location: emp.location || null, mobile_no:         emp.mobile_no         || null,
            service_line:      emp.service_line      || null,
            client:            emp.client            || null,
            reporting_manager: emp.reporting_manager || null,
            suggested_email:   emp.suggested_email   || null,
            personal_email:    emp.personal_email    || null,
            blood_group:       emp.blood_group       || null,
            password_hint:     emp.password_hint     || null,
            company_email:          emp.company_email          || null,
            company_email_password: emp.company_email_password || null,
            photo_url:  emp.photo_url  || null,
            status:     emp.status     || 'Active',
            notes:      emp.notes      || null,
            cc_emails:  emp.cc_emails  || null,
            portal_url: portalUrlsToString(emp.portal_urls || []),
          }),
        });
        ok++;
      } catch (e) {
        fail++;
        errs.push(`${emp.emp_name || emp.emp_id}: ${e.message}`);
      }
    }

    const edited = editedSet.current.size;
    let msg = `Import done!\n✅ Success: ${ok}\n❌ Failed: ${fail}`;
    if (edited)      msg += `\n✏️ ${edited} record${edited !== 1 ? 's' : ''} manually edited before import`;
    if (sendEmails)  msg += `\n📧 Welcome emails sent.`;
    else             msg += `\n⏸️ No emails sent.`;
    if (errs.length) msg += `\n\nErrors:\n${errs.slice(0, 5).join('\n')}`;

    alert(msg);
    if (ok > 0) { onImport(); onBack(); }
    setImporting(false);
  };

  const openEdit       = (idx) => setEditIdx(idx);
  const handleSaveEdit = (idx, updatedEmp, hasChanges) => {
    setParsedData(prev => { const next = [...prev]; next[idx] = { ...next[idx], ...updatedEmp }; return next; });
    if (hasChanges) editedSet.current.add(idx);
    setEditIdx(null);
  };
  const handleNavEdit = (dir) => {
    const next = editIdx + dir;
    if (next >= 0 && next < parsedData.length) setEditIdx(next);
  };

  if (editIdx !== null) {
    return (
      <InlineEditPage
        employees={parsedData} editIdx={editIdx} editedSet={editedSet.current}
        onSave={handleSaveEdit} onCancel={() => setEditIdx(null)} onNav={handleNavEdit}
      />
    );
  }

  if (reviewMode) {
    return (
      <div style={{ animation: 'fadeIn 0.18s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
            <ArrowLeft size={15}/> Employees
          </button>
          <ChevronRight size={13} style={{ opacity: 0.4 }}/>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>
            Bulk Import — Review ({parsedData.length} employee{parsedData.length !== 1 ? 's' : ''})
          </span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{parsedData.length} employee{parsedData.length !== 1 ? 's' : ''} ready to import</strong>
              {editedSet.current.size > 0 && (
                <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', color: '#b45309', border: '1px solid rgba(245,158,11,0.25)' }}>
                  {editedSet.current.size} edited
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={sendEmails} onChange={e => setSendEmails(e.target.checked)} style={{ width: 16, height: 16 }}/>
                <Mail size={13}/> Send welcome emails
              </label>
              <button className="btn btn-secondary btn-sm" onClick={() => setReviewMode(false)}>
                <Edit2 size={12}/> Back to paste
              </button>
            </div>
          </div>

          <div className="table-wrap" style={{ maxHeight: 480, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table style={{ fontSize: 12, width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th style={{ width: 48 }}>Photo</th>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>DOJ</th>
                  <th>Blood Group</th>
                  <th>Company Email</th>
                  <th>Location</th>
                  <th style={{ width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.map((emp, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{idx + 1}</td>
                    <td><BulkAvatar photo={emp.photo_url} name={emp.emp_name} size={32}/></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{emp.emp_id}</td>
                    <td><span style={{ fontWeight: 600 }}>{emp.emp_name}</span></td>
                    <td>{emp.designation || '—'}</td>
                    <td>{emp.doj || '—'}</td>
                    <td>
                      <select
                        value={emp.blood_group || ''}
                        onChange={e => {
                          setParsedData(prev => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], blood_group: e.target.value };
                            return next;
                          });
                          editedSet.current.add(idx);
                        }}
                        style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', minWidth: 70 }}
                      >
                        <option value="">—</option>
                        {BLOOD_GROUPS.map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </td>
                    <td>{emp.company_email || '—'}</td>
                    <td>{emp.location || '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(idx)}>
                        <Edit2 size={12}/> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${parsedData.length} Employee${parsedData.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.18s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
          <ArrowLeft size={15}/> Employees
        </button>
        <ChevronRight size={13} style={{ opacity: 0.4 }}/>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>Bulk Import</span>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px', marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">Paste your Excel data here:</label>
          <textarea
            className="form-textarea" rows={9} value={textData}
            onChange={e => { setTextData(e.target.value); setError(''); setParsedData([]); }}
            placeholder="Copy and paste from Excel (including headers)"
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        {error && (
          <div style={{ padding: '10px 14px', marginBottom: 14, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 6, color: '#991B1B', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={parseTabularData}>
              <Eye size={14}/> Parse &amp; review data
            </button>
            <button className="btn btn-secondary" onClick={() => { setTextData(''); setParsedData([]); setError(''); }}>
              Clear
            </button>
          </div>
          <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXIT CHECKLIST PAGE
// ══════════════════════════════════════════════════════════════════════════════
function ExitChecklistPage({ emp, onCancel, onConfirm, deleting }) {
  const LAPTOP_STATUS_OPTIONS = [
    { value:'collected',     label:'Laptop Collected (Company Asset)',                   icon:'✅', color:'#166534', bg:'#dcfce7', border:'#86efac', emailText:'The company-issued laptop has been successfully collected from the employee.' },
    { value:'client_return', label:'Client-Owned Laptop – To Be Returned to Client',    icon:'🏢', color:'#1e40af', bg:'#dbeafe', border:'#93c5fd', emailText:'The employee was using a client-owned laptop. Please confirm that the asset has been returned to the respective client.' },
    { value:'no_laptop',     label:'No Laptop Assigned',                                icon:'❌', color:'#6b7280', bg:'#f3f4f6', border:'#d1d5db', emailText:'No laptop or company asset was assigned to this employee.' },
    { value:'pending',       label:'Pending Verification (Check with Client/Manager)',  icon:'⏳', color:'#92400e', bg:'#fef3c7', border:'#fcd34d', emailText:'The laptop has not been received yet, and the asset status remains pending verification. Please coordinate with the client, reporting manager, or relevant team to confirm the handover/return status.' },
  ];
  const CHECKLIST_ITEMS = [
    { key:'email_deactivated', label:'Deactivate Email & Portal Access',        detail:'Disable company email and revoke all portal / SSO logins',            icon:'📧', category:'IT' },
    { key:'ad_removed',        label:'Remove from Active Directory / Azure AD', detail:'Delete or disable the AD/AAD account to cut all Windows/M365 access', icon:'🖥️', category:'IT' },
    { key:'vpn_revoked',       label:'Revoke VPN & Remote Access',              detail:'Remove VPN profile and any remote-desktop / SSH keys',                 icon:'🔒', category:'IT' },
    { key:'licenses_revoked',  label:'Revoke Software Licenses',                detail:'Unassign M365, Adobe, JetBrains and other licensed apps',              icon:'📦', category:'IT' },
  ];

  const [checked,      setChecked]      = useState({});
  const [laptopStatus, setLaptopStatus] = useState('');
  const [ccTags,       setCcTags]       = useState([]);
  const [notes,        setNotes]        = useState('');

  const toggle         = (key) => setChecked(prev=>({...prev,[key]:!prev[key]}));
  const checkedCount   = Object.values(checked).filter(Boolean).length+(laptopStatus?1:0);
  const totalItems     = CHECKLIST_ITEMS.length+1;
  const allChecked     = checkedCount===totalItems;
  const progressPct    = Math.round((checkedCount/totalItems)*100);
  const selectedLaptop = LAPTOP_STATUS_OPTIONS.find(o=>o.value===laptopStatus);

  const handleConfirm = () => onConfirm({ checklist:{...checked,laptop_status:laptopStatus,notes:notes.trim()}, cc_emails_override:ccTags.join(', ') });

  return (
    <div className="fade-in" style={{ animation:'slideInExit 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInExit{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:13, color:'var(--text-muted)' }}>
        <button onClick={onCancel} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:0 }}>
          <ArrowLeft size={15}/> Employees
        </button>
        <ChevronRight size={13} style={{ opacity:0.4 }}/>
        <span style={{ color:'var(--text)', fontWeight:600 }}>Exit &amp; Offboarding — {emp.emp_name}</span>
      </div>
      <div style={{ background:'linear-gradient(135deg,rgba(20,83,45,0.06),rgba(22,101,52,0.02))', border:'1px solid #86efac', borderRadius:16, padding:'20px 28px', marginBottom:24, display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ width:48, height:48, borderRadius:12, background:'linear-gradient(135deg,#14532d,#166534)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><span style={{ fontSize:24 }}>🚪</span></div>
        <EmpAvatar photo={emp.photo_url} name={emp.emp_name} size={48}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:16, color:'#14532d' }}>{emp.emp_name}</div>
          <div style={{ fontSize:12, color:'#166534', marginTop:2 }}>{emp.emp_id}{emp.designation?` · ${emp.designation}`:''}{emp.location?` · ${emp.location}`:''}</div>
        </div>
        <div style={{ fontSize:12, fontWeight:700, background:'#fef2f2', color:'#991b1b', padding:'4px 14px', borderRadius:20, border:'1px solid #fca5a5', flexShrink:0 }}>⚠️ Permanent Delete</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)' }}>Checklist Progress</span>
              <span style={{ fontSize:12, fontWeight:700, color:allChecked?'#166534':'var(--text-muted)', fontFamily:'var(--mono)' }}>{checkedCount} / {totalItems}{allChecked?' ✓ All Done':''}</span>
            </div>
            <div style={{ height:8, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progressPct}%`, borderRadius:99, background:allChecked?'linear-gradient(90deg,#22c55e,#16a34a)':'linear-gradient(90deg,#4ade80,#16a34a)', transition:'width 0.35s ease' }}/>
            </div>
          </div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#3b82f6', flexShrink:0 }}/>
              <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:'0.05em' }}>IT Access Revocation</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {CHECKLIST_ITEMS.map(item=>{
                const isDone=!!checked[item.key];
                return (
                  <div key={item.key} onClick={()=>toggle(item.key)} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', borderRadius:8, cursor:'pointer', border:`1px solid ${isDone?'#93c5fd':'var(--border)'}`, background:isDone?'#dbeafe':'var(--surface2)', transition:'all 0.15s ease', userSelect:'none' }}>
                    <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, marginTop:1, border:`2px solid ${isDone?'#3b82f6':'var(--border)'}`, background:isDone?'#3b82f6':'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s ease' }}>
                      {isDone&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:isDone?'#1e40af':'var(--text)', textDecoration:isDone?'line-through':'none', opacity:isDone?0.85:1 }}>{item.icon} {item.label}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, lineHeight:1.4 }}>{item.detail}</div>
                    </div>
                    {isDone&&<span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'#3b82f6', color:'#fff', flexShrink:0, alignSelf:'flex-start', marginTop:2 }}>DONE</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#f97316', flexShrink:0 }}/>
              <span style={{ fontSize:11, fontWeight:700, color:'#c2410c', textTransform:'uppercase', letterSpacing:'0.05em' }}>Asset Recovery</span>
            </div>
            <div style={{ padding:'12px 14px', borderRadius:8, border:`1px solid ${laptopStatus?(selectedLaptop?.border||'#fed7aa'):'#fed7aa'}`, background:laptopStatus?(selectedLaptop?.bg||'#fff7ed'):'#fff7ed' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontSize:18 }}>💻</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Laptop &amp; Hardware Status</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>Select the laptop return status</div>
                </div>
                {laptopStatus&&<span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:selectedLaptop?.color||'#c2410c', color:'#fff', flexShrink:0 }}>RECORDED</span>}
              </div>
              <select className="form-select" value={laptopStatus} onChange={e=>setLaptopStatus(e.target.value)} style={{ width:'100%', fontSize:13, fontWeight:laptopStatus?600:400, color:laptopStatus?(selectedLaptop?.color||'#c2410c'):'var(--text-muted)', background:'#ffffff', border:`1.5px solid ${laptopStatus?(selectedLaptop?.border||'#fed7aa'):'var(--border)'}`, marginBottom:laptopStatus?10:0 }}>
                <option value="">-- Select laptop status --</option>
                {LAPTOP_STATUS_OPTIONS.map(opt=><option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>)}
              </select>
              {laptopStatus&&selectedLaptop&&(
                <div style={{ padding:'10px 12px', borderRadius:6, background:selectedLaptop.bg, border:`1px solid ${selectedLaptop.border}`, fontSize:12, color:selectedLaptop.color, lineHeight:1.6 }}>
                  <div style={{ fontWeight:700, marginBottom:3, fontSize:11 }}>📧 Email will say:</div>
                  {selectedLaptop.emailText}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}><Mail size={13} color="var(--accent)"/>CC — Exit Notification Recipients</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:12, lineHeight:1.6 }}>
              Exit email goes to <strong>HR</strong>. Add managers or team leads to notify.
              <span style={{ display:'block', marginTop:3, color:'var(--red)', fontWeight:500 }}>⚠️ Employee's own emails are automatically excluded.</span>
            </div>
            <CcTagsInput tags={ccTags} onTagsChange={setCcTags}/>
          </div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
            <label className="form-label" style={{ marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              📝 Admin Notes <span style={{ fontWeight:400, color:'var(--text-muted)', fontSize:11 }}>(optional — appears in exit email)</span>
            </label>
            <textarea className="form-textarea" rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Resigned, last day 10 May. Laptop handed over. All access removed." style={{ fontSize:12, resize:'vertical' }}/>
          </div>
          <div style={{ padding:'12px 16px', background:'#fef9c3', border:'1px solid #fde047', borderRadius:10, fontSize:12, color:'#854d0e', lineHeight:1.6 }}>
            <strong>⚠️ Note:</strong> Unchecked items will appear as <strong>PENDING</strong> in the exit notification email sent to HR.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button className="btn btn-danger" onClick={handleConfirm} disabled={deleting} style={{ width:'100%', justifyContent:'center', padding:'12px 20px', fontSize:14, fontWeight:700 }}>
              <Trash2 size={15}/>{deleting?'Deleting employee…':`Confirm Exit & Delete ${emp.emp_name}`}
            </button>
            <button className="btn btn-secondary" onClick={onCancel} disabled={deleting} style={{ width:'100%', justifyContent:'center' }}>
              <ArrowLeft size={14}/> Cancel — Go Back to Employees
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DELETED EMPLOYEES PAGE
// ══════════════════════════════════════════════════════════════════════════════
function DeletedEmployeesPage({ onBack }) {
  const [deleted, setDeleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  useEffect(() => {
    apiFetch('/employees/deleted').then(d=>setDeleted(d.data||[])).catch(console.error).finally(()=>setLoading(false));
  }, []);
  const filtered = deleted.filter(e => !search||[e.emp_id,e.emp_name,e.company_email,e.designation,e.service_line,e.location].some(v=>v?.toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="fade-in" style={{ animation:'slideInDeleted 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInDeleted{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:13, color:'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:0 }}><ArrowLeft size={15}/> Employees</button>
        <ChevronRight size={13} style={{ opacity:0.4 }}/>
        <span style={{ color:'var(--text)', fontWeight:600 }}>Deleted Employees</span>
      </div>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:'#fef2f2', border:'1px solid #fca5a5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Trash2 size={20} color="#ef4444"/></div>
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Deleted Employees</h2>
              <p style={{ fontSize:12, color:'var(--text-muted)', margin:'3px 0 0' }}>{deleted.length} record{deleted.length!==1?'s':''} removed from the system</p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={14}/> Back to Employees</button>
        </div>
        <div className="search-bar" style={{ marginBottom:16, maxWidth:420 }}>
          <Search size={14}/><input className="form-input" placeholder="Search by name, ID, email, designation…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {!loading&&<div style={{ marginBottom:12, fontSize:12, color:'var(--text-muted)' }}>Showing {filtered.length} of {deleted.length} records</div>}
        {loading ? (
          <div className="empty-state"><div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading deleted employees…</div></div>
        ) : filtered.length===0 ? (
          <div className="empty-state"><Trash2 size={32} style={{ opacity:0.3 }}/><p style={{ color:'var(--text-muted)' }}>{deleted.length===0?'No deleted employees yet':'No results match your search'}</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>#</th><th>Emp ID</th><th>Name</th><th>Designation</th><th>Service Line</th><th>Location</th><th>Company Email</th><th>Deleted At</th></tr></thead>
              <tbody>
                {filtered.map((e,idx)=>(
                  <tr key={e.emp_id} style={{ opacity:0.78 }}>
                    <td style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{idx+1}</td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12, color:'#ef4444', fontWeight:700 }}>{e.emp_id}</span></td>
                    <td><div style={{ fontWeight:600, textDecoration:'line-through', color:'var(--text-muted)' }}>{e.emp_name}</div></td>
                    <td style={{ fontSize:12.5, color:'var(--text-muted)' }}>{e.designation||'—'}</td>
                    <td style={{ fontSize:12.5, color:'var(--text-muted)' }}>{e.service_line||'—'}</td>
                    <td style={{ fontSize:12.5, color:'var(--text-muted)' }}>{e.location||'—'}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{e.company_email||'—'}</td>
                    <td><div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'#ef4444', fontFamily:'var(--mono)' }}><Clock size={11}/> {e.deleted_at_fmt||'—'}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:24, paddingTop:16, borderTop:'1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={14}/> Back to Employees</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════
function EmployeeDetailPage({ emp, onBack, onEdit, isAdmin }) {
  const { user } = useAuth();
  const portalUrls = portalUrlsFromString(emp.portal_url||'');
  
  // Only sysadmin@mindteck.com can view passwords
  const canViewPassword = user?.email?.toLowerCase() === 'sysadmin@mindteck.com';

  const InfoCard = ({ icon:Icon, label, value, mono=false, href=null, accent=false }) => {
    if (!value) return null;
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:4, padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{Icon&&<Icon size={11}/>}{label}</div>
        {href
          ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize:13.5, fontWeight:600, color:'var(--accent)', textDecoration:'none', fontFamily:mono?'var(--mono)':'inherit', wordBreak:'break-all' }}>{value}</a>
          : <div style={{ fontSize:13.5, fontWeight:600, color:accent?'var(--accent)':'var(--text)', fontFamily:mono?'var(--mono)':'inherit', wordBreak:'break-word' }}>{value}</div>}
      </div>
    );
  };
  
  const SectionHeader = ({ icon:Icon, title, color='var(--accent)' }) => (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, marginTop:8 }}>
      <div style={{ width:28, height:28, borderRadius:7, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon size={14} color={color}/></div>
      <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{title}</span>
      <div style={{ flex:1, height:1, background:'var(--border)', marginLeft:4 }}/>
    </div>
  );

  return (
    <div className="fade-in" style={{ animation:'slideInDetail 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInDetail{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:13, color:'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:0 }}><ArrowLeft size={15}/> Employees</button>
        <ChevronRight size={13} style={{ opacity:0.4 }}/>
        <span style={{ color:'var(--text)', fontWeight:600 }}>{emp.emp_name}</span>
      </div>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 32px', marginBottom:24, display:'flex', alignItems:'center', gap:24, flexWrap:'wrap', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, right:0, width:200, height:200, background:'radial-gradient(circle at top right, var(--accent-glow, rgba(99,102,241,0.08)), transparent)', pointerEvents:'none' }}/>
        <EmpAvatar photo={emp.photo_url} name={emp.emp_name} size={80}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:6 }}>
            <h2 style={{ fontSize:22, fontWeight:800, margin:0, color:'var(--text)' }}>{emp.emp_name}</h2>
            <StatusBadge status={emp.status}/>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 18px', fontSize:13, color:'var(--text-muted)' }}>
            {emp.emp_id&&<span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)' }}>{emp.emp_id}</span>}
            {emp.designation&&<span>{emp.designation}</span>}
            {emp.level&&<span style={{ padding:'1px 9px', borderRadius:20, background:'var(--accent-glow)', color:'var(--accent)', fontWeight:700, fontSize:11 }}>{emp.level}</span>}
            {emp.location&&<span style={{ display:'flex', alignItems:'center', gap:4 }}><MapPin size={12}/>{emp.location}</span>}
            {emp.service_line&&<span style={{ display:'flex', alignItems:'center', gap:4 }}><Building2 size={12}/>{emp.service_line}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          {isAdmin&&<button className="btn btn-primary" onClick={()=>onEdit(emp)}><Edit2 size={14}/> Edit</button>}
          <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={14}/> Back</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <SectionHeader icon={User} title="Basic Information"/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <InfoCard icon={Hash}     label="Employee ID"     value={emp.emp_id} mono accent/>
              <InfoCard icon={Calendar} label="Date of Joining" value={emp.doj_fmt||emp.doj}/>
              <InfoCard icon={Calendar} label="Date of Birth"   value={emp.dob_fmt||emp.dob}/>
              <InfoCard icon={Shield}   label="Blood Group"     value={emp.blood_group}/>
            </div>
          </div>
          <div>
            <SectionHeader icon={Briefcase} title="Job Details"/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <InfoCard icon={Briefcase}  label="Designation"       value={emp.designation}/>
              <InfoCard icon={Hash}       label="Level"             value={emp.level}/>
              <InfoCard icon={Building2}  label="Service Line"      value={emp.service_line}/>
              <InfoCard icon={Users}      label="Client"            value={emp.client}/>
              <InfoCard icon={MapPin}     label="Location"          value={emp.location}/>
              <InfoCard icon={UserCheck}  label="Reporting Manager" value={emp.reporting_manager}/>
            </div>
          </div>
          {emp.notes&&(
            <div>
              <SectionHeader icon={Edit2} title="Notes"/>
              <div style={{ padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, fontSize:13, color:'var(--text)', lineHeight:1.7 }}>{emp.notes}</div>
            </div>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <SectionHeader icon={Mail} title="Contact & Email"/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:10 }}>
              <InfoCard icon={Smartphone} label="Mobile"          value={emp.mobile_no}/>
              <InfoCard icon={Mail} label="Company Email"   value={emp.company_email}  href={emp.company_email?`mailto:${emp.company_email}`:null}/>
              <InfoCard icon={Mail} label="Suggested Email" value={emp.suggested_email} href={emp.suggested_email?`mailto:${emp.suggested_email}`:null}/>
              <InfoCard icon={Mail} label="Personal Email"  value={emp.personal_email} href={emp.personal_email?`mailto:${emp.personal_email}`:null}/>
              {emp.cc_emails&&(
                <div style={{ padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10 }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}><Mail size={11}/> CC Emails</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {emp.cc_emails.split(',').map(e=>e.trim()).filter(Boolean).map(email=>(
                      <a key={email} href={`mailto:${email}`} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, background:'var(--accent-glow)', border:'1px solid rgba(99,102,241,0.2)', color:'var(--accent)', textDecoration:'none', fontSize:12 }}>
                        <Mail size={10}/>{email}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {portalUrls.length > 0 && (
            <div>
              <SectionHeader icon={Globe} title="Portal Links"/>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {portalUrls.map(p=>(
                  <div key={p.url} style={{ padding:'10px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, display:'flex', alignItems:'center', gap:10 }}>
                    <Globe size={14} color="var(--accent)" style={{ flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:2 }}>{p.label}</div>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color:'var(--accent)', textDecoration:'none', fontSize:12, fontFamily:'var(--mono)', wordBreak:'break-all' }}>{p.url}</a>
                    </div>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:6, background:'var(--accent-glow)', color:'var(--accent)', textDecoration:'none' }}>
                      <LinkIcon size={12}/>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* CREDENTIALS SECTION - Only visible to sysadmin@mindteck.com */}
          {canViewPassword && (emp.company_email_password || emp.password_hint) && (
            <div>
              <SectionHeader icon={Lock} title="Credentials" color="#f59e0b"/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:10 }}>
                {emp.company_email_password && (
                  <div style={{ padding:'12px 16px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10 }}>
                    <div style={{ fontSize:11, color:'#92400e', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                      <Lock size={11}/> Email Password
                    </div>
                    <PasswordViewOnly value={emp.company_email_password}/>
                  </div>
                )}
                {emp.password_hint && (
                  <div style={{ padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10 }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                      <Key size={11}/> Password Hint
                    </div>
                    <div style={{ fontSize:13, color:'var(--text)', fontWeight:600 }}>{emp.password_hint}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop:28, paddingTop:20, borderTop:'1px solid var(--border)', display:'flex', gap:10 }}>
        <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={14}/> Back to Employees</button>
        {isAdmin&&<button className="btn btn-primary" onClick={()=>onEdit(emp)}><Edit2 size={14}/> Edit Employee</button>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED EMPLOYEE FORM SECTIONS
// ══════════════════════════════════════════════════════════════════════════════
function EmpFormBody({ form, setField, preview, setPreview, photoRef, ccTags, setCcTags, portalUrls, setPortalUrls, handleCcChange, isEdit=false }) {
  const handlePhoto = (e) => {
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{ setPreview(ev.target.result); setField('photo_url',ev.target.result); };
    reader.readAsDataURL(file);
  };
  const Section = ({icon:Icon,title}) => (
    <div className="section-title" style={{ marginTop:16 }}>
      {Icon&&<Icon size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>}{title}
    </div>
  );
  return (
    <>
      <Section icon={Camera} title="Photo"/>
      <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:8 }}>
        <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', border:'2px dashed var(--border)', background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }} onClick={()=>photoRef.current?.click()}>
          {preview?<img src={preview} alt="emp" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>:<Camera size={24} color="var(--text-muted)"/>}
        </div>
        <div>
          <input type="file" ref={photoRef} accept="image/*" style={{ display:'none' }} onChange={handlePhoto}/>
          <button type="button" className="btn btn-secondary btn-sm" onClick={()=>photoRef.current?.click()}><Camera size={13}/> {preview?'Change Photo':'Upload Photo'}</button>
          {preview&&<button type="button" className="btn btn-sm" style={{ marginLeft:8 }} onClick={()=>{setPreview('');setField('photo_url','');if(photoRef.current)photoRef.current.value='';}}><X size={13}/> Remove</button>}
        </div>
      </div>

      <Section icon={User} title="Basic Information"/>
      <div className="form-grid form-grid-3">
        <div className="form-group">
          <label className="form-label">Employee ID *</label>
          {isEdit
            ? <input className="form-input" required value={form.emp_id} disabled style={{ opacity:0.6, cursor:'not-allowed', background:'var(--surface2)' }}/>
            : <input className="form-input" required value={form.emp_id} onChange={e=>setField('emp_id',e.target.value)} placeholder="EMP-001"/>}
          {isEdit&&<div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Employee ID cannot be changed</div>}
        </div>
        <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Full Name *</label><input className="form-input" required value={form.emp_name} onChange={e=>setField('emp_name',e.target.value)} placeholder="Jacob Thomas"/></div>
        <div className="form-group">
          <label className="form-label">Date of Joining</label>
          <input className="form-input" value={form.doj} onChange={e=>setField('doj',e.target.value)} placeholder="e.g. 04-May-26 or 2026-05-04"/>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Any format accepted</div>
        </div>
        <div className="form-group">
          <label className="form-label">Date of Birth</label>
          <input className="form-input" value={form.dob} onChange={e=>setField('dob',e.target.value)} placeholder="e.g. 07-Dec-00 or 2000-12-07"/>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Any format accepted</div>
        </div>
        <div className="form-group"><label className="form-label">Blood Group</label><select className="form-select" value={form.blood_group} onChange={e=>setField('blood_group',e.target.value)}><option value="">-- Select --</option>{BLOOD_GROUPS.map(b=><option key={b} value={b}>{b}</option>)}</select></div>
      </div>

      <Section icon={Briefcase} title="Job Details"/>
      <div className="form-grid form-grid-3">
        <div className="form-group"><label className="form-label">Level</label><select className="form-select" value={form.level} onChange={e=>setField('level',e.target.value)}><option value="">-- Select --</option>{LEVELS.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
        <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Designation</label><input className="form-input" value={form.designation} onChange={e=>setField('designation',e.target.value)} placeholder="Software Engineer"/></div>
        <div className="form-group"><label className="form-label">Service Line</label><input className="form-input" value={form.service_line} onChange={e=>setField('service_line',e.target.value)} placeholder="Engineering"/></div>
        <div className="form-group"><label className="form-label">Client</label><input className="form-input" value={form.client} onChange={e=>setField('client',e.target.value)} placeholder="Client Name"/></div>
        <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={e=>setField('location',e.target.value)} placeholder="Bengaluru"/></div>
        <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Reporting Manager</label><input className="form-input" value={form.reporting_manager} onChange={e=>setField('reporting_manager',e.target.value)} placeholder="Manager Name"/></div>
        <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e=>setField('status',e.target.value)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
      </div>

      <Section icon={Mail} title="Contact & Email"/>
      <div className="form-grid form-grid-3">
        <div className="form-group"><label className="form-label">Mobile Number</label><input className="form-input" type="tel" value={form.mobile_no} onChange={e=>setField('mobile_no',e.target.value)} placeholder="+91 98765 43210"/></div>
        <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Company Email</label><input type="email" className="form-input" value={form.company_email} onChange={e=>setField('company_email',e.target.value)} placeholder="jacob@mindteck.com"/></div>
        <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Suggested / Alternative Email</label><input type="email" className="form-input" value={form.suggested_email} onChange={e=>setField('suggested_email',e.target.value)} placeholder="jacob.thomas@mindteck.com"/></div>
        <div className="form-group"><label className="form-label">Personal Email</label><input type="email" className="form-input" value={form.personal_email} onChange={e=>setField('personal_email',e.target.value)} placeholder="jacob@gmail.com"/></div>
      </div>

      <Section icon={Mail} title="CC Recipients"/>
      <div style={{ marginBottom:16 }}>
        <label className="form-label" style={{ marginBottom:8, display:'block' }}>Additional Email Addresses for CC</label>
        <CcTagsInput tags={ccTags} onTagsChange={handleCcChange}/>
      </div>

      <Section icon={Globe} title="Portal URLs"/>
      <div style={{ marginBottom:16 }}>
        <label className="form-label" style={{ marginBottom:8, display:'block' }}>Select or add portal login links</label>
        <PortalUrlsManager portalUrls={portalUrls} onChange={setPortalUrls}/>
      </div>

      <Section icon={Lock} title="Login Credentials"/>
      <div className="form-grid form-grid-2">
        <div className="form-group"><label className="form-label"><Lock size={11} style={{ display:'inline', marginRight:4 }}/>Company Email Password</label><PasswordInput value={form.company_email_password} onChange={e=>setField('company_email_password',e.target.value)} placeholder="e.g. Mindteck@2024"/></div>
        <div className="form-group"><label className="form-label"><Key size={11} style={{ display:'inline', marginRight:4 }}/>Password Hint</label><input className="form-input" value={form.password_hint} onChange={e=>setField('password_hint',e.target.value)} placeholder="e.g. First letter uppercase + @year"/></div>
      </div>

      <Section icon={null} title="Notes"/>
      <div className="form-group"><textarea className="form-textarea" value={form.notes} onChange={e=>setField('notes',e.target.value)} placeholder="Any additional notes…" rows={3}/></div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADD EMPLOYEE PAGE
// ── FIX 2: reads useLocation().state.addEmployee to pre-fill from chatbot ───
// ══════════════════════════════════════════════════════════════════════════════
function AddEmployeePage({ onBack, onSaved }) {
  const photoRef = useRef();
  const location = useLocation();
  const prefill  = location.state?.addEmployee || {};

  const [form, setFormState] = useState({
    ...EMPTY_FORM,
    emp_id:            prefill.emp_id            || '',
    emp_name:          prefill.emp_name          || '',
    doj:               prefill.doj               || '',
    dob:               prefill.dob               || '',
    level:             prefill.level             || '',
    designation:       prefill.designation       || '',
    location:          prefill.location          || '',
    mobile_no:         prefill.mobile_no         || '',
    service_line:      prefill.service_line      || '',
    client:            prefill.client            || '',
    reporting_manager: prefill.reporting_manager || '',
    suggested_email:   prefill.suggested_email   || '',
    personal_email:    prefill.personal_email    || '',
    blood_group:       prefill.blood_group       || '',
    company_email:     prefill.company_email     || prefill.suggested_email || '',
    notes:             prefill.notes             || '',
  });
  const [saving,     setSaving]    = useState(false);
  const [preview,    setPreview]   = useState(prefill.photo_url || '');
  const [ccTags,     setCcTags]    = useState(
    prefill.cc_emails
      ? prefill.cc_emails.split(',').map(e => e.trim()).filter(Boolean)
      : []
  );
  const [portalUrls, setPortalUrls] = useState([]);

  const setField       = (k,v) => setFormState(f=>({...f,[k]:v}));
  const handleCcChange = (tags) => { setCcTags(tags); setField('cc_emails', tags.join(', ')); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch('/employees', {
        method:'POST',
        body: JSON.stringify({ ...form, cc_emails: ccTags.join(', '), portal_url: portalUrlsToString(portalUrls) }),
      });
      if (onSaved) onSaved();
      onBack();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const hasPrefill = !!prefill.emp_name;

  return (
    <div className="fade-in" style={{ animation:'slideInAdd 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInAdd{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:13, color:'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:0 }}><ArrowLeft size={15}/> Employees</button>
        <ChevronRight size={13} style={{ opacity:0.4 }}/>
        <span style={{ color:'var(--text)', fontWeight:600 }}>Add New Employee</span>
        {hasPrefill && (
          <span style={{ marginLeft:6, fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background:'rgba(34,197,94,0.12)', color:'#15803d', border:'1px solid #86efac' }}>
            ✨ Pre-filled from AI Chatbot
          </span>
        )}
      </div>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 32px', marginBottom:24 }}>
        <form onSubmit={handleSubmit}>
          <EmpFormBody form={form} setField={setField} preview={preview} setPreview={setPreview} photoRef={photoRef} ccTags={ccTags} setCcTags={setCcTags} portalUrls={portalUrls} setPortalUrls={setPortalUrls} handleCcChange={handleCcChange} isEdit={false}/>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8, paddingTop:16, borderTop:'1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}><User size={14}/> {saving?'Adding…':'Add Employee & Send Welcome Mail'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE EDIT PAGE
// ══════════════════════════════════════════════════════════════════════════════
function EmployeeEditPage({ emp, onBack, onSaved }) {
  const photoRef = useRef();
  const [form, setFormState] = useState({
    ...EMPTY_FORM, ...emp,
    doj: emp.doj || emp.doj_fmt || '',
    dob: emp.dob || emp.dob_fmt || '',
    company_email_password: emp.company_email_password || '',
    cc_emails:  emp.cc_emails  || '',
  });
  const [saving,     setSaving]    = useState(false);
  const [preview,    setPreview]   = useState(emp?.photo_url || '');
  const [ccTags,     setCcTags]    = useState(() => emp?.cc_emails ? emp.cc_emails.split(',').map(e=>e.trim()).filter(Boolean) : []);
  const [portalUrls, setPortalUrls]= useState(() => portalUrlsFromString(emp?.portal_url||''));

  const setField       = (k,v) => setFormState(f=>({...f,[k]:v}));
  const handleCcChange = (tags) => { setCcTags(tags); setField('cc_emails', tags.join(', ')); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch(`/employees/${emp.emp_id}`, {
        method:'PUT',
        body: JSON.stringify({ ...form, cc_emails: ccTags.join(', '), portal_url: portalUrlsToString(portalUrls) }),
      });
      if (onSaved) onSaved();
      onBack();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ animation:'slideInEdit 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInEdit{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:13, color:'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:0 }}><ArrowLeft size={15}/> Back to {emp.emp_name}</button>
        <ChevronRight size={13} style={{ opacity:0.4 }}/>
        <span style={{ color:'var(--text)', fontWeight:600 }}>Edit Employee</span>
      </div>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 32px', marginBottom:24 }}>
        <form onSubmit={handleSubmit}>
          <EmpFormBody form={form} setField={setField} preview={preview} setPreview={setPreview} photoRef={photoRef} ccTags={ccTags} setCcTags={setCcTags} portalUrls={portalUrls} setPortalUrls={setPortalUrls} handleCcChange={handleCcChange} isEdit={true}/>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8, paddingTop:16, borderTop:'1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}><Save size={14}/> {saving?'Saving…':'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// IT SUPPORT — ADD / EDIT INLINE FORM PAGE
// ══════════════════════════════════════════════════════════════════════════════
function SupportContactFormPage({ existing, onBack, onSaved }) {
  const isEdit = !!existing;
  const [form, setForm] = useState(
    existing
      ? { name: existing.name, phone: existing.phone || '', email: existing.email || '',
          role: existing.role || 'IT Support', sort_order: existing.sort_order || 0,
          is_active: existing.is_active !== false }
      : { name: '', phone: '', email: '', role: 'IT Support', sort_order: 0, is_active: true }
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) await apiFetch(`/employees/support-contacts/${existing.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else        await apiFetch('/employees/support-contacts', { method: 'POST', body: JSON.stringify(form) });
      onSaved();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ animation:'slideInAdd 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInAdd{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:13, color:'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:0 }}>
          <ArrowLeft size={15}/> IT Support Contacts
        </button>
        <ChevronRight size={13} style={{ opacity:0.4 }}/>
        <span style={{ color:'var(--text)', fontWeight:600 }}>{isEdit ? `Edit — ${existing.name}` : 'Add Support Contact'}</span>
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 32px', maxWidth:580 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
          <div style={{ width:48, height:48, borderRadius:12, background:'var(--accent-glow)', border:'1px solid rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <HelpCircle size={22} color="var(--accent)"/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:17 }}>{isEdit ? 'Edit Support Contact' : 'New Support Contact'}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>
              {isEdit ? `Updating details for ${existing.name}` : 'This contact will appear in the "Need Help?" section of welcome emails.'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g., Hari Patnaik"/>
          </div>
          <div className="form-group">
            <label className="form-label">Role / Designation</label>
            <input className="form-input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})} placeholder="e.g., IT Head, IT Support"/>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label"><Phone size={11} style={{ display:'inline', marginRight:4 }}/>Phone Number</label>
              <input className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="e.g., 9916675460"/>
            </div>
            <div className="form-group">
              <label className="form-label"><Mail size={11} style={{ display:'inline', marginRight:4 }}/>Email Address</label>
              <input type="email" className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="e.g., sysadmin@mindteck.us"/>
            </div>
          </div>
          <div className="form-group" style={{ marginTop:4 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})} style={{ width:16, height:16, cursor:'pointer' }}/>
              <span style={{ fontSize:13, fontWeight:500 }}>Active — visible in welcome emails</span>
            </label>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:24, paddingTop:20, borderTop:'1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={14}/> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// IT SUPPORT CONTACTS PAGE
// ══════════════════════════════════════════════════════════════════════════════
function SupportContactsPage({ onBack, isAdmin }) {
  const [contacts,    setContacts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [addMode,     setAddMode]     = useState(false);
  const [editContact, setEditContact] = useState(null);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/employees/support-contacts/all');
      setContacts(data.data || []);
    } catch {
      try { const data = await apiFetch('/employees/support-contacts'); setContacts(data.data || []); }
      catch { setContacts([]); alert('Failed to load support contacts.'); }
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchContacts(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete support contact "${name}"?`)) return;
    try { await apiFetch(`/employees/support-contacts/${id}`, { method: 'DELETE' }); await fetchContacts(); }
    catch (err) { alert(err.message); }
  };

  const moveContact = async (id, direction) => {
    const index = contacts.findIndex(c => c.id === id); if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= contacts.length) return;
    const current = contacts[index]; const other = contacts[newIndex];
    try {
      await apiFetch(`/employees/support-contacts/${current.id}`, { method:'PUT', body:JSON.stringify({...current,sort_order:other.sort_order}) });
      await apiFetch(`/employees/support-contacts/${other.id}`,   { method:'PUT', body:JSON.stringify({...other,  sort_order:current.sort_order}) });
      await fetchContacts();
    } catch { alert('Failed to reorder contacts'); }
  };

  const handleSaved        = async () => { await fetchContacts(); setAddMode(false); setEditContact(null); };
  const handleBackFromForm = ()       => { setAddMode(false); setEditContact(null); };

  if (addMode)     return <SupportContactFormPage existing={null}        onBack={handleBackFromForm} onSaved={handleSaved}/>;
  if (editContact) return <SupportContactFormPage existing={editContact} onBack={handleBackFromForm} onSaved={handleSaved}/>;

  const filtered = contacts.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.phone && c.phone.includes(search)) ||
    (c.role  && c.role.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fade-in" style={{ animation:'slideInSupport 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInSupport{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:13, color:'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:0 }}>
          <ArrowLeft size={15}/> Employees
        </button>
        <ChevronRight size={13} style={{ opacity:0.4 }}/>
        <span style={{ color:'var(--text)', fontWeight:600 }}>IT Support Contacts</span>
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 32px', marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:'var(--accent-glow)', border:'1px solid rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <HelpCircle size={20} color="var(--accent)"/>
            </div>
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>IT Support Contacts</h2>
              <p style={{ fontSize:12, color:'var(--text-muted)', margin:'3px 0 0' }}>
                These contacts appear in the "Need Help?" section of welcome emails
              </p>
            </div>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setAddMode(true)}>
              <Plus size={15}/> Add Contact
            </button>
          )}
        </div>

        <div className="inv-toolbar" style={{ marginBottom:16 }}>
          <div className="search-bar" style={{ flex:1, maxWidth:360 }}>
            <Search size={15}/>
            <input className="form-input" placeholder="Search by name, email, phone, role…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <button className="btn btn-secondary" onClick={fetchContacts} style={{ padding:'6px 12px' }}>
            <RefreshCw size={14}/> Refresh
          </button>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>{filtered.length} contact{filtered.length!==1?'s':''}</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width:50 }}>#</th>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Email</th>
                <th style={{ width:80 }}>Status</th>
                {isAdmin && <th style={{ width:180 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin?7:6}><div className="empty-state"><div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading contacts…</div></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={isAdmin?7:6}>
                  <div className="empty-state">
                    <Users size={32} style={{ opacity:0.3 }}/>
                    <p>{contacts.length === 0 ? 'No support contacts yet' : 'No results match your search'}</p>
                    {isAdmin && contacts.length === 0 && (
                      <button className="btn btn-primary" onClick={() => setAddMode(true)}><Plus size={14}/> Add First Contact</button>
                    )}
                  </div>
                </td></tr>
              ) : filtered.map((contact, idx) => (
                <tr key={contact.id}>
                  <td style={{ textAlign:'center', fontFamily:'monospace', fontSize:12, color:'var(--text-muted)' }}>
                    {contact.sort_order !== undefined ? contact.sort_order + 1 : idx + 1}
                  </td>
                  <td><div style={{ fontWeight:600 }}>{contact.name}</div></td>
                  <td><span style={{ fontSize:12, color:'var(--text-muted)' }}>{contact.role || 'IT Support'}</span></td>
                  <td>
                    {contact.phone
                      ? <a href={`tel:${contact.phone}`} style={{ color:'var(--accent)', textDecoration:'none', fontSize:12 }}>
                          <Phone size={11} style={{ display:'inline', marginRight:4 }}/>{contact.phone}
                        </a>
                      : '—'}
                  </td>
                  <td>
                    {contact.email
                      ? <a href={`mailto:${contact.email}`} style={{ color:'var(--accent)', textDecoration:'none', fontSize:12 }}>
                          <Mail size={11} style={{ display:'inline', marginRight:4 }}/>{contact.email}
                        </a>
                      : '—'}
                  </td>
                  <td>
                    <span className={`badge ${contact.is_active !== false ? 'badge-success' : 'badge-danger'}`}>
                      {contact.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button className="btn btn-sm btn-secondary" title="Move Up"   onClick={() => moveContact(contact.id,'up')}   disabled={idx===0}><ChevronUp size={12}/></button>
                        <button className="btn btn-sm btn-secondary" title="Move Down" onClick={() => moveContact(contact.id,'down')} disabled={idx===filtered.length-1}><ChevronDown size={12}/></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditContact(contact)}><Edit2 size={12}/> Edit</button>
                        <button className="btn btn-sm btn-danger"    onClick={() => handleDelete(contact.id, contact.name)}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={14}/> Back to Employees</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ── FIX 2b: read location.state.addEmployee on mount to open Add page ────────
// ══════════════════════════════════════════════════════════════════════════════
export default function Employees() {
  const { user }   = useAuth();
  const location   = useLocation();
  const isAdmin = user?.role==='admin'||user?.role==='it_staff'||user?.role==='superadmin';

  const [employees,       setEmployees]       = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [filter,          setFilter]          = useState('Active');

  const [viewEmp,         setViewEmp]         = useState(null);
  const [editEmp,         setEditEmp]         = useState(null);
  // ── Open Add page immediately if chatbot navigated here with addEmployee state
  const [showAddPage,     setShowAddPage]     = useState(() => !!location.state?.addEmployee);
  const [showBulkPage,    setShowBulkPage]    = useState(false);
  const [showSupportPage, setShowSupportPage] = useState(false);
  const [showDeletedPage, setShowDeletedPage] = useState(false);
  const [exitEmp,         setExitEmp]         = useState(null);
  const [deleting,        setDeleting]        = useState(false);

  const listStateSnapshot = useRef({ search:'', filter:'Active' });
  const filterRef = useRef(filter);
  const searchRef = useRef(search);
  useEffect(()=>{ filterRef.current=filter; },[filter]);
  useEffect(()=>{ searchRef.current=search; },[search]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params=new URLSearchParams({ limit:10000 });
      if(filterRef.current!=='All') params.set('status',filterRef.current);
      if(searchRef.current) params.set('search',searchRef.current);
      const data=await apiFetch(`/employees?${params}`);
      setEmployees(data.data||[]);
    } catch(err){ console.error(err); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ fetchEmployees(); },[filter,search,fetchEmployees]);

  const handleViewEmp = (emp) => { listStateSnapshot.current={search,filter}; setViewEmp(emp);  window.scrollTo({top:0,behavior:'smooth'}); };
  const handleEditEmp = (emp) => { listStateSnapshot.current={search,filter}; setEditEmp(emp);  window.scrollTo({top:0,behavior:'smooth'}); };
  const handleExitEmp = (emp) => { listStateSnapshot.current={search,filter}; setExitEmp(emp);  window.scrollTo({top:0,behavior:'smooth'}); };

  const handleBackToList = () => {
    const { search:prevSearch, filter:prevFilter } = listStateSnapshot.current;
    setSearch(prevSearch); setFilter(prevFilter);
    setViewEmp(null); setEditEmp(null); setExitEmp(null);
    setShowAddPage(false); setShowBulkPage(false);
    setShowSupportPage(false); setShowDeletedPage(false);
  };

  const handleDelete = async ({ checklist, cc_emails_override }) => {
    if (!exitEmp) return;
    setDeleting(true);
    const empId=exitEmp.emp_id;
    setEmployees(prev=>prev.filter(e=>e.emp_id!==empId));
    setExitEmp(null);
    try {
      await apiFetch(`/employees/${empId}`,{method:'DELETE',body:JSON.stringify({checklist:{...checklist,cc_emails_override}})});
      await fetchEmployees();
    } catch(err){ alert(err.message); await fetchEmployees(); }
    finally { setDeleting(false); handleBackToList(); }
  };

  const exportCSV = () => {
    const headers=['Emp ID','Name','DOJ','Level','Designation','Location','Mobile','Service Line','Client','Reporting Manager','Company Email','Suggested Email','Personal Email','Blood Group','DOB','Status','CC Emails','Portal URLs'];
    const rows=employees.map(e=>[e.emp_id,e.emp_name,e.doj||e.doj_fmt||'',e.level||'',e.designation||'',e.location||'',e.mobile_no||'',e.service_line||'',e.client||'',e.reporting_manager||'',e.company_email||'',e.suggested_email||'',e.personal_email||'',e.blood_group||'',e.dob||e.dob_fmt||'',e.status,e.cc_emails||'',e.portal_url||'']);
    const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`employees-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Page routing ──────────────────────────────────────────────────────────
  if (exitEmp)         return <div className="fade-in"><ExitChecklistPage   emp={exitEmp}   onCancel={handleBackToList} onConfirm={handleDelete} deleting={deleting}/></div>;
  if (viewEmp)         return <div className="fade-in"><EmployeeDetailPage  emp={viewEmp}   onBack={handleBackToList} onEdit={handleEditEmp} isAdmin={isAdmin}/></div>;
  if (editEmp)         return <div className="fade-in"><EmployeeEditPage    emp={editEmp}   onBack={handleBackToList} onSaved={fetchEmployees}/></div>;
  if (showAddPage)     return <div className="fade-in"><AddEmployeePage     onBack={handleBackToList} onSaved={fetchEmployees}/></div>;
  if (showBulkPage)    return <div className="fade-in"><BulkImportPage      onBack={handleBackToList} onImport={fetchEmployees}/></div>;
  if (showSupportPage) return <div className="fade-in"><SupportContactsPage onBack={handleBackToList} isAdmin={isAdmin}/></div>;
  if (showDeletedPage) return <div className="fade-in"><DeletedEmployeesPage onBack={handleBackToList}/></div>;

  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div><h1>Employee Management</h1><p>Manage employee records and IT support contacts</p></div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {isAdmin&&(
            <>
              <button className="btn btn-secondary" onClick={()=>setShowBulkPage(true)} style={{ color:'var(--accent)', borderColor:'var(--accent-border)' }}><FileSpreadsheet size={14}/> Bulk Import</button>
              <button className="btn btn-secondary" onClick={()=>setShowDeletedPage(true)} style={{ color:'#ef4444', borderColor:'#fca5a5' }}><Trash2 size={14}/> Deleted List</button>
            </>
          )}
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={15}/> Export CSV</button>
          <button className="btn btn-secondary" onClick={fetchEmployees}><RefreshCw size={14}/></button>
          {isAdmin&&<button className="btn btn-primary" onClick={()=>setShowAddPage(true)}><Plus size={15}/> Add Employee</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid var(--border)' }}>
        <button className="btn" onClick={()=>{}} style={{ padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontWeight:500, color:'var(--accent)', borderBottom:'2px solid var(--accent)', borderRadius:0 }}>
          <Users size={14} style={{ display:'inline', marginRight:8 }}/>Employees
        </button>
        <button className="btn" onClick={()=>setShowSupportPage(true)} style={{ padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontWeight:500, color:'var(--text-muted)', borderRadius:0 }}>
          <HelpCircle size={14} style={{ display:'inline', marginRight:8 }}/>IT Support Contacts
        </button>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        {[
          { label:'Total',    value:employees.length,                                  color:'var(--accent)' },
          { label:'Active',   value:employees.filter(e=>e.status==='Active').length,   color:'var(--green)'  },
          { label:'Inactive', value:employees.filter(e=>e.status==='Inactive').length, color:'var(--red)'    },
        ].map(stat=>(
          <div key={stat.label} className="card" style={{ padding:'12px 20px', display:'flex', alignItems:'center', gap:12, minWidth:120 }}>
            <div style={{ fontSize:24, fontWeight:800, color:stat.color, fontFamily:'var(--mono)' }}>{stat.value}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex:1, maxWidth:360 }}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search name, ID, email, designation…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="toggle-group">
          {['All','Active','Inactive'].map(s=>(
            <button key={s} className={`toggle-btn ${filter===s?'active':''}`} onClick={()=>setFilter(s)}>{s}</button>
          ))}
        </div>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>{employees.length} employee{employees.length!==1?'s':''}</span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Photo</th><th>Emp ID</th><th>Name &amp; Designation</th><th>DOJ</th><th>Level</th>
              <th>Mobile</th><th>Service Line</th><th>Client</th><th>Location</th>
              <th>Company Email</th><th>Portals</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading?(
              <tr><td colSpan={13}><div className="empty-state"><div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading employees…</div></div></td></tr>
            ):employees.length===0?(
              <tr><td colSpan={13}><div className="empty-state">
                <Users size={32} style={{ opacity:.3 }}/><p>No employees found</p>
                {isAdmin&&<button className="btn btn-primary" onClick={()=>setShowAddPage(true)}><Plus size={14}/> Add First Employee</button>}
              </div></td></tr>
            ):employees.map(emp=>{
              const portals = portalUrlsFromString(emp.portal_url||'');
              return (
                <tr key={emp.emp_id}>
                  <td><EmpAvatar photo={emp.photo_url} name={emp.emp_name} size={36}/></td>
                  <td><span style={{ fontFamily:'var(--mono)', fontSize:12.5, color:'var(--accent)', fontWeight:700 }}>{emp.emp_id}</span></td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:13.5, color:'var(--accent)', cursor:'pointer', textDecoration:'underline', textDecorationColor:'transparent', transition:'text-decoration-color 0.15s' }}
                      onClick={()=>handleViewEmp(emp)}
                      onMouseEnter={e=>e.currentTarget.style.textDecorationColor='var(--accent)'}
                      onMouseLeave={e=>e.currentTarget.style.textDecorationColor='transparent'}>
                      {emp.emp_name}
                    </div>
                    {emp.designation&&<div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{emp.designation}</div>}
                  </td>
                  <td style={{ fontFamily:'var(--mono)', fontSize:12 }}>{emp.doj||emp.doj_fmt||'—'}</td>
                  <td>{emp.level?<span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'var(--accent-glow)', color:'var(--accent)' }}>{emp.level}</span>:'—'}</td>
                  <td style={{ fontSize:12.5 }}>{emp.mobile_no||'—'}</td>
                  <td style={{ fontSize:12.5 }}>{emp.service_line||'—'}</td>
                  <td style={{ fontSize:12.5 }}>{emp.client||'—'}</td>
                  <td style={{ fontSize:12.5 }}>{emp.location||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-dim)' }}>{emp.company_email||'—'}</td>
                  <td style={{ fontSize:11 }}>
                    {portals.length>0
                      ? <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          {portals.map(p=>(
                            <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
                              onClick={e=>e.stopPropagation()}
                              style={{ color:'var(--accent)', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:3, fontSize:11 }}>
                              <LinkIcon size={10}/>{p.label}
                            </a>
                          ))}
                        </div>
                      : '—'}
                  </td>
                  <td><StatusBadge status={emp.status}/></td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-sm btn-secondary" onClick={()=>handleViewEmp(emp)}><Eye size={12}/> View</button>
                      {isAdmin&&(
                        <>
                          <button className="btn btn-sm btn-secondary" onClick={()=>handleEditEmp(emp)} title="Edit"><Edit2 size={12}/></button>
                          <button className="btn btn-sm btn-danger"    onClick={()=>handleExitEmp(emp)} title="Exit & Delete"><Trash2 size={12}/></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}