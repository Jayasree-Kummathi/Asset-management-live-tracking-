import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import {
  Plus, Search, Edit2, X, User, Mail,
  Calendar, Briefcase, Users, Camera, Trash2, Eye,
  Key, RefreshCw, Download, Lock, EyeOff, Eye as EyeIcon,
  AlertTriangle, Clock, Upload, FileSpreadsheet, Link as LinkIcon,
  HelpCircle, Phone, Save, ChevronUp, ChevronDown, AlertCircle,
  ArrowLeft, MapPin, Building2, Shield, Smartphone, Globe,
  Hash, UserCheck, ChevronRight
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

const EMPTY_FORM = {
  emp_id: '', emp_name: '', doj: '', level: '', designation: '', location: '',
  mobile_no: '', service_line: '', client: '', reporting_manager: '',
  suggested_email: '', personal_email: '', blood_group: '', dob: '',
  password_hint: '', company_email: '', company_email_password: '',
  photo_url: '', status: 'Active', notes: '', cc_emails: '', portal_url: '',
};
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const LEVELS       = ['L1','L2','L3','L4','L5','L6','Manager','Senior Manager','Director','VP','S1 G1','S1 G2','S2 G1','S2 G2','S3'];

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

// ── Password Input ────────────────────────────────────────────────────────────
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

// Small helper — show password with toggle, no form needed
function PasswordViewOnly({ value }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: '#92400e', flex: 1 }}>
        {show ? value : '•'.repeat(Math.min(value.length, 12))}
      </span>
      <button type="button" onClick={() => setShow(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', display: 'flex', alignItems: 'center' }}>
        {show ? <EyeOff size={14}/> : <EyeIcon size={14}/>}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════
function EmployeeDetailPage({ emp, onBack, onEdit, isAdmin }) {
  const InfoCard = ({ icon: Icon, label, value, mono = false, href = null, accent = false }) => {
    if (!value) return null;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {Icon && <Icon size={11}/>}
          {label}
        </div>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', fontFamily: mono ? 'var(--mono)' : 'inherit', wordBreak: 'break-all' }}>
            {value}
          </a>
        ) : (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: accent ? 'var(--accent)' : 'var(--text)', fontFamily: mono ? 'var(--mono)' : 'inherit', wordBreak: 'break-word' }}>
            {value}
          </div>
        )}
      </div>
    );
  };

  const SectionHeader = ({ icon: Icon, title, color = 'var(--accent)' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={color}/>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }}/>
    </div>
  );

  return (
    <div className="fade-in" style={{ animation: 'slideInDetail 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`
        @keyframes slideInDetail {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
          <ArrowLeft size={15}/> Employees
        </button>
        <ChevronRight size={13} style={{ opacity: 0.4 }}/>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{emp.emp_name}</span>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'radial-gradient(circle at top right, var(--accent-glow, rgba(99,102,241,0.08)), transparent)', pointerEvents: 'none' }}/>
        <EmpAvatar photo={emp.photo_url} name={emp.emp_name} size={80}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text)' }}>{emp.emp_name}</h2>
            <StatusBadge status={emp.status}/>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, color: 'var(--text-muted)' }}>
            {emp.emp_id && <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{emp.emp_id}</span>}
            {emp.designation && <span>{emp.designation}</span>}
            {emp.level && <span style={{ padding: '1px 9px', borderRadius: 20, background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 700, fontSize: 11 }}>{emp.level}</span>}
            {emp.location && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12}/>{emp.location}</span>}
            {emp.service_line && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12}/>{emp.service_line}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => onEdit(emp)}>
              <Edit2 size={14}/> Edit
            </button>
          )}
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={14}/> Back
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <SectionHeader icon={User} title="Basic Information"/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <InfoCard icon={Hash} label="Employee ID" value={emp.emp_id} mono accent/>
              <InfoCard icon={Calendar} label="Date of Joining" value={emp.doj_fmt || emp.doj}/>
              <InfoCard icon={Calendar} label="Date of Birth" value={emp.dob_fmt || emp.dob}/>
              <InfoCard icon={Shield} label="Blood Group" value={emp.blood_group}/>
            </div>
          </div>
          <div>
            <SectionHeader icon={Briefcase} title="Job Details"/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <InfoCard icon={Briefcase} label="Designation" value={emp.designation}/>
              <InfoCard icon={Hash} label="Level" value={emp.level}/>
              <InfoCard icon={Building2} label="Service Line" value={emp.service_line}/>
              <InfoCard icon={Users} label="Client" value={emp.client}/>
              <InfoCard icon={MapPin} label="Location" value={emp.location}/>
              <InfoCard icon={UserCheck} label="Reporting Manager" value={emp.reporting_manager}/>
            </div>
          </div>
          {emp.notes && (
            <div>
              <SectionHeader icon={Edit2} title="Notes"/>
              <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
                {emp.notes}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <SectionHeader icon={Mail} title="Contact & Email"/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <InfoCard icon={Smartphone} label="Mobile" value={emp.mobile_no}/>
              <InfoCard icon={Mail} label="Company Email" value={emp.company_email} href={emp.company_email ? `mailto:${emp.company_email}` : null}/>
              <InfoCard icon={Mail} label="Suggested Email" value={emp.suggested_email} href={emp.suggested_email ? `mailto:${emp.suggested_email}` : null}/>
              <InfoCard icon={Mail} label="Personal Email" value={emp.personal_email} href={emp.personal_email ? `mailto:${emp.personal_email}` : null}/>
              {emp.cc_emails && (
                <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mail size={11}/> CC Emails
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {emp.cc_emails.split(',').map(e => e.trim()).filter(Boolean).map(email => (
                      <a key={email} href={`mailto:${email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)', textDecoration: 'none', fontSize: 12 }}>
                        <Mail size={10}/>{email}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {emp.portal_url && (
            <div>
              <SectionHeader icon={Globe} title="Portal"/>
              <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe size={11}/> Portal URL
                </div>
                <a href={emp.portal_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 13, fontFamily: 'var(--mono)', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LinkIcon size={12}/>{emp.portal_url}
                </a>
              </div>
            </div>
          )}
          {isAdmin && (emp.company_email_password || emp.password_hint) && (
            <div>
              <SectionHeader icon={Lock} title="Credentials" color="#f59e0b"/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                {emp.company_email_password && (
                  <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Lock size={11}/> Email Password
                    </div>
                    <PasswordViewOnly value={emp.company_email_password}/>
                  </div>
                )}
                {emp.password_hint && (
                  <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Key size={11}/> Password Hint
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{emp.password_hint}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={14}/> Back to Employees
        </button>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => onEdit(emp)}>
            <Edit2 size={14}/> Edit Employee
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE EDIT PAGE
// ══════════════════════════════════════════════════════════════════════════════
function EmployeeEditPage({ emp, onBack, onSaved, isAdmin }) {
  const photoRef = useRef();
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...emp,
    doj: emp.doj_fmt || emp.doj || '',
    dob: emp.dob_fmt || emp.dob || '',
    company_email_password: emp.company_email_password || '',
    cc_emails: emp.cc_emails || '',
    portal_url: emp.portal_url || ''
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(emp?.photo_url || '');
  const [ccTags, setCcTags] = useState(() => {
    if (emp && emp.cc_emails) return emp.cc_emails.split(',').map(e => e.trim()).filter(Boolean);
    return [];
  });
  const [ccInput, setCcInput] = useState('');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  
  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      setField('photo_url', ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  const addCcEmail = () => {
    const email = ccInput.trim();
    if (email && isValidEmail(email) && !ccTags.includes(email)) {
      const next = [...ccTags, email];
      setCcTags(next);
      setField('cc_emails', next.join(', '));
      setCcInput('');
    }
  };
  
  const removeCcEmail = (emailToRemove) => {
    const next = ccTags.filter(e => e !== emailToRemove);
    setCcTags(next);
    setField('cc_emails', next.join(', '));
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCcEmail();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const submitForm = { ...form, cc_emails: ccTags.join(', ') };
      await apiFetch(`/employees/${emp.emp_id}`, {
        method: 'PUT',
        body: JSON.stringify(submitForm)
      });
      if (onSaved) onSaved();
      onBack();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ icon: Icon, title }) => (
    <div className="section-title" style={{ marginTop: 16 }}>
      {Icon && <Icon size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />}{title}
    </div>
  );

  return (
    <div className="fade-in" style={{ animation: 'slideInEdit 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`
        @keyframes slideInEdit {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
          <ArrowLeft size={15}/> Back to {emp.emp_name}
        </button>
        <ChevronRight size={13} style={{ opacity: 0.4 }}/>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>Edit Employee</span>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
      }}>
        <form onSubmit={handleSubmit}>
          <Section icon={Camera} title="Photo"/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 8 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '2px dashed var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => photoRef.current?.click()}>
              {preview ? <img src={preview} alt="emp" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Camera size={24} color="var(--text-muted)"/>}
            </div>
            <div>
              <input type="file" ref={photoRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhoto}/>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => photoRef.current?.click()}><Camera size={13}/> {preview ? 'Change Photo' : 'Upload Photo'}</button>
              {preview && <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => { setPreview(''); setField('photo_url', ''); if(photoRef.current) photoRef.current.value = ''; }}><X size={13}/> Remove</button>}
            </div>
          </div>

          <Section icon={User} title="Basic Information"/>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Employee ID *</label>
              <input className="form-input" required value={form.emp_id} disabled style={{ opacity: 0.6, cursor: 'not-allowed', background: 'var(--surface2)' }}/>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Employee ID cannot be changed</div>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Full Name *</label>
              <input className="form-input" required value={form.emp_name} onChange={e => setField('emp_name', e.target.value)} placeholder="Jacob Thomas"/>
            </div>
            <div className="form-group">
              <label className="form-label">Date of Joining</label>
              <input type="date" className="form-input" value={form.doj} onChange={e => setField('doj', e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-input" value={form.dob} onChange={e => setField('dob', e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Blood Group</label>
              <select className="form-select" value={form.blood_group} onChange={e => setField('blood_group', e.target.value)}>
                <option value="">-- Select --</option>
                {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <Section icon={Briefcase} title="Job Details"/>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Level</label>
              <select className="form-select" value={form.level} onChange={e => setField('level', e.target.value)}>
                <option value="">-- Select --</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Designation</label>
              <input className="form-input" value={form.designation} onChange={e => setField('designation', e.target.value)} placeholder="Software Engineer"/>
            </div>
            <div className="form-group">
              <label className="form-label">Service Line</label>
              <input className="form-input" value={form.service_line} onChange={e => setField('service_line', e.target.value)} placeholder="Engineering"/>
            </div>
            <div className="form-group">
              <label className="form-label">Client</label>
              <input className="form-input" value={form.client} onChange={e => setField('client', e.target.value)} placeholder="Client Name"/>
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={e => setField('location', e.target.value)} placeholder="Bengaluru"/>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Reporting Manager</label>
              <input className="form-input" value={form.reporting_manager} onChange={e => setField('reporting_manager', e.target.value)} placeholder="Manager Name"/>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <Section icon={Mail} title="Contact & Email"/>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input className="form-input" type="tel" value={form.mobile_no} onChange={e => setField('mobile_no', e.target.value)} placeholder="+91 98765 43210"/>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Company Email</label>
              <input type="email" className="form-input" value={form.company_email} onChange={e => setField('company_email', e.target.value)} placeholder="jacob@mindteck.com"/>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Suggested / Alternative Email</label>
              <input type="email" className="form-input" value={form.suggested_email} onChange={e => setField('suggested_email', e.target.value)} placeholder="jacob.thomas@mindteck.com"/>
            </div>
            <div className="form-group">
              <label className="form-label">Personal Email</label>
              <input type="email" className="form-input" value={form.personal_email} onChange={e => setField('personal_email', e.target.value)} placeholder="jacob@gmail.com"/>
            </div>
          </div>

          <Section icon={Mail} title="CC Recipients"/>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Additional Email Addresses for CC</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <input type="text" className="form-input" value={ccInput} onChange={e => setCcInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type email and press Enter or comma..."/>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Press Enter or comma to add multiple emails.</div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addCcEmail} disabled={!ccInput.trim() || !isValidEmail(ccInput.trim())}><Plus size={13}/> Add</button>
            </div>
            {ccTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, padding: '8px 12px', background: 'rgba(99,102,241,0.04)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                {ccTags.map(email => (
                  <div key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, fontSize: 12, color: 'var(--accent)' }}>
                    <Mail size={11}/><span>{email}</span>
                    <button type="button" onClick={() => removeCcEmail(email)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}><X size={12}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Section icon={LinkIcon} title="Portal Configuration"/>
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Portal URL</label>
              <input type="url" className="form-input" value={form.portal_url} onChange={e => setField('portal_url', e.target.value)} placeholder="https://your-portal.com"/>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>This URL will appear in the welcome email.</div>
            </div>
          </div>

          <Section icon={Lock} title="Login Credentials"/>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label"><Lock size={11} style={{ display: 'inline', marginRight: 4 }}/>Company Email Password</label>
              <PasswordInput value={form.company_email_password} onChange={e => setField('company_email_password', e.target.value)} placeholder="Initial password (e.g. Mindteck@2024)"/>
            </div>
            <div className="form-group">
              <label className="form-label"><Key size={11} style={{ display: 'inline', marginRight: 4 }}/>Password Hint / Notes</label>
              <input className="form-input" value={form.password_hint} onChange={e => setField('password_hint', e.target.value)} placeholder="e.g. First letter uppercase + @year"/>
            </div>
          </div>

          <Section icon={null} title="Notes"/>
          <div className="form-group">
            <textarea className="form-textarea" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any additional notes…" rows={3}/>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={14}/> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADD EMPLOYEE PAGE (dedicated page)
// ══════════════════════════════════════════════════════════════════════════════
function AddEmployeePage({ onBack, onSaved, isAdmin }) {
  const photoRef = useRef();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState('');
  const [ccTags, setCcTags] = useState([]);
  const [ccInput, setCcInput] = useState('');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  
  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      setField('photo_url', ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  const addCcEmail = () => {
    const email = ccInput.trim();
    if (email && isValidEmail(email) && !ccTags.includes(email)) {
      const next = [...ccTags, email];
      setCcTags(next);
      setField('cc_emails', next.join(', '));
      setCcInput('');
    }
  };
  
  const removeCcEmail = (emailToRemove) => {
    const next = ccTags.filter(e => e !== emailToRemove);
    setCcTags(next);
    setField('cc_emails', next.join(', '));
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCcEmail();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const submitForm = { ...form, cc_emails: ccTags.join(', ') };
      await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify(submitForm)
      });
      if (onSaved) onSaved();
      onBack();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ icon: Icon, title }) => (
    <div className="section-title" style={{ marginTop: 16 }}>
      {Icon && <Icon size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />}{title}
    </div>
  );

  return (
    <div className="fade-in" style={{ animation: 'slideInAdd 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`
        @keyframes slideInAdd {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
          <ArrowLeft size={15}/> Employees
        </button>
        <ChevronRight size={13} style={{ opacity: 0.4 }}/>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>Add New Employee</span>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
      }}>
        <form onSubmit={handleSubmit}>
          <Section icon={Camera} title="Photo"/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 8 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '2px dashed var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => photoRef.current?.click()}>
              {preview ? <img src={preview} alt="emp" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Camera size={24} color="var(--text-muted)"/>}
            </div>
            <div>
              <input type="file" ref={photoRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhoto}/>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => photoRef.current?.click()}><Camera size={13}/> {preview ? 'Change Photo' : 'Upload Photo'}</button>
              {preview && <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => { setPreview(''); setField('photo_url', ''); if(photoRef.current) photoRef.current.value = ''; }}><X size={13}/> Remove</button>}
            </div>
          </div>

          <Section icon={User} title="Basic Information"/>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Employee ID *</label>
              <input className="form-input" required value={form.emp_id} onChange={e => setField('emp_id', e.target.value)} placeholder="EMP-001"/>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Full Name *</label>
              <input className="form-input" required value={form.emp_name} onChange={e => setField('emp_name', e.target.value)} placeholder="Jacob Thomas"/>
            </div>
            <div className="form-group">
              <label className="form-label">Date of Joining</label>
              <input type="date" className="form-input" value={form.doj} onChange={e => setField('doj', e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-input" value={form.dob} onChange={e => setField('dob', e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Blood Group</label>
              <select className="form-select" value={form.blood_group} onChange={e => setField('blood_group', e.target.value)}>
                <option value="">-- Select --</option>
                {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <Section icon={Briefcase} title="Job Details"/>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Level</label>
              <select className="form-select" value={form.level} onChange={e => setField('level', e.target.value)}>
                <option value="">-- Select --</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Designation</label>
              <input className="form-input" value={form.designation} onChange={e => setField('designation', e.target.value)} placeholder="Software Engineer"/>
            </div>
            <div className="form-group">
              <label className="form-label">Service Line</label>
              <input className="form-input" value={form.service_line} onChange={e => setField('service_line', e.target.value)} placeholder="Engineering"/>
            </div>
            <div className="form-group">
              <label className="form-label">Client</label>
              <input className="form-input" value={form.client} onChange={e => setField('client', e.target.value)} placeholder="Client Name"/>
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={e => setField('location', e.target.value)} placeholder="Bengaluru"/>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Reporting Manager</label>
              <input className="form-input" value={form.reporting_manager} onChange={e => setField('reporting_manager', e.target.value)} placeholder="Manager Name"/>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <Section icon={Mail} title="Contact & Email"/>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input className="form-input" type="tel" value={form.mobile_no} onChange={e => setField('mobile_no', e.target.value)} placeholder="+91 98765 43210"/>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Company Email</label>
              <input type="email" className="form-input" value={form.company_email} onChange={e => setField('company_email', e.target.value)} placeholder="jacob@mindteck.com"/>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Suggested / Alternative Email</label>
              <input type="email" className="form-input" value={form.suggested_email} onChange={e => setField('suggested_email', e.target.value)} placeholder="jacob.thomas@mindteck.com"/>
            </div>
            <div className="form-group">
              <label className="form-label">Personal Email</label>
              <input type="email" className="form-input" value={form.personal_email} onChange={e => setField('personal_email', e.target.value)} placeholder="jacob@gmail.com"/>
            </div>
          </div>

          <Section icon={Mail} title="CC Recipients"/>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Additional Email Addresses for CC</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <input type="text" className="form-input" value={ccInput} onChange={e => setCcInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type email and press Enter or comma..."/>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Press Enter or comma to add multiple emails.</div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addCcEmail} disabled={!ccInput.trim() || !isValidEmail(ccInput.trim())}><Plus size={13}/> Add</button>
            </div>
            {ccTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, padding: '8px 12px', background: 'rgba(99,102,241,0.04)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                {ccTags.map(email => (
                  <div key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, fontSize: 12, color: 'var(--accent)' }}>
                    <Mail size={11}/><span>{email}</span>
                    <button type="button" onClick={() => removeCcEmail(email)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}><X size={12}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Section icon={LinkIcon} title="Portal Configuration"/>
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Portal URL</label>
              <input type="url" className="form-input" value={form.portal_url} onChange={e => setField('portal_url', e.target.value)} placeholder="https://your-portal.com"/>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>This URL will appear in the welcome email.</div>
            </div>
          </div>

          <Section icon={Lock} title="Login Credentials"/>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label"><Lock size={11} style={{ display: 'inline', marginRight: 4 }}/>Company Email Password</label>
              <PasswordInput value={form.company_email_password} onChange={e => setField('company_email_password', e.target.value)} placeholder="Initial password (e.g. Mindteck@2024)"/>
            </div>
            <div className="form-group">
              <label className="form-label"><Key size={11} style={{ display: 'inline', marginRight: 4 }}/>Password Hint / Notes</label>
              <input className="form-input" value={form.password_hint} onChange={e => setField('password_hint', e.target.value)} placeholder="e.g. First letter uppercase + @year"/>
            </div>
          </div>

          <Section icon={null} title="Notes"/>
          <div className="form-group">
            <textarea className="form-textarea" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any additional notes…" rows={3}/>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <User size={14}/> {saving ? 'Adding…' : 'Add Employee & Send Welcome Mail'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BULK IMPORT PAGE (dedicated page)
// ══════════════════════════════════════════════════════════════════════════════
function BulkImportPage({ onBack, onImport }) {
  const [textData,    setTextData]    = useState('');
  const [parsedData,  setParsedData]  = useState([]);
  const [preview,     setPreview]     = useState([]);
  const [importing,   setImporting]   = useState(false);
  const [error,       setError]       = useState('');
  const [sendEmails,  setSendEmails]  = useState(true);
  const [reviewMode,  setReviewMode]  = useState(false);
  const [editingEmp,  setEditingEmp]  = useState(null);

  const FIELD_MAP = {
    'emp id':'emp_id','employee id':'emp_id','employee name':'emp_name','emp name':'emp_name','name':'emp_name','full name':'emp_name',
    'doj':'doj','date of joining':'doj','joining date':'doj','level':'level','designation':'designation','title':'designation','role':'designation',
    'location':'location','mobile number':'mobile_no','mobile no':'mobile_no','mobile':'mobile_no','phone':'mobile_no',
    'service line':'service_line','service':'service_line','client':'client','reporting manager':'reporting_manager','manager':'reporting_manager',
    'suggested email id':'suggested_email','suggested email':'suggested_email','personal email':'personal_email',
    'blood group':'blood_group','blood':'blood_group','dob':'dob','date of birth':'dob',
    'company email':'company_email','email':'company_email','portal url':'portal_url','portal link':'portal_url','login url':'portal_url','login link':'portal_url',
    'password hint':'password_hint','password_hint':'password_hint','notes':'notes','cc emails':'cc_emails','cc_emails':'cc_emails',
  };

  const detectDelimiter = (line) => { if (line.includes('\t')) return '\t'; if (line.includes(',')) return ','; if (line.includes('|')) return '|'; return '\t'; };
  const splitLine = (line, delimiter) => {
    if (delimiter !== ',') return line.split(delimiter).map(v => v.trim());
    const result = []; let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim()); return result;
  };
  const isMeaningful = (v) => v && v.trim() !== '' && v.trim() !== '—' && v.trim() !== '-' && v.trim() !== '–';
  const BLOOD_RE = /^(A|B|AB|O)[+-]$/i;

  const parseTabularData = () => {
    if (!textData.trim()) { setError('Please paste some data'); return; }
    setError('');
    const rawLines = textData.split('\n');
    if (rawLines.length < 2) { setError('Need at least a header row and one data row'); return; }
    const delimiter = detectDelimiter(rawLines[0]);
    const headerCells = splitLine(rawLines[0], delimiter);
    const headerCount = headerCells.length;
    const mappedFields = headerCells.map(h => FIELD_MAP[h.trim().toLowerCase()] || h.trim().toLowerCase());
    const EMP_ID_RE = /^[A-Z]{2,5}\d{3,6}$/i;
    const logicalRows = [];
    for (let i = 1; i < rawLines.length; i++) {
      const raw = rawLines[i]; if (!raw.trim()) continue;
      const cells = splitLine(raw, delimiter);
      const padded = Array.from({ length: headerCount }, (_, idx) => cells[idx] ?? '');
      const firstCell = padded[0].trim();
      const isContinuation = logicalRows.length > 0 && (!firstCell || BLOOD_RE.test(firstCell) || /^\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}$/.test(firstCell) || /^\d{4}-\d{2}-\d{2}$/.test(firstCell) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(firstCell) || (!EMP_ID_RE.test(firstCell) && cells.filter(isMeaningful).length <= 3));
      if (isContinuation) {
        const prev = logicalRows[logicalRows.length - 1];
        padded.forEach((val, idx) => { if (isMeaningful(val) && !isMeaningful(prev[idx])) prev[idx] = val.trim(); });
      } else { logicalRows.push(padded.map(v => v.trim())); }
    }
    if (logicalRows.length === 0) { setError('No valid employee data found.'); return; }
    const employees = logicalRows.map(cells => {
      const emp = {};
      mappedFields.forEach((field, idx) => { const val = (cells[idx] || '').trim(); if (isMeaningful(val)) emp[field] = val; });
      if (emp.emp_name && !emp.company_email) { const parts = emp.emp_name.toLowerCase().split(' '); emp.company_email = parts.length >= 2 ? `${parts[0]}.${parts[1]}@mindteck.com` : `${parts[0]}@mindteck.com`; }
      if (!emp.emp_id && emp.emp_name) { const initials = emp.emp_name.split(' ').map(n => n[0]).join('').toUpperCase(); emp.emp_id = `${initials}${Math.floor(Math.random() * 9000) + 1000}`; }
      if (!emp.company_email_password) emp.company_email_password = `Mindteck@${new Date().getFullYear()}`;
      if (!emp.status) emp.status = 'Active';
      return emp;
    }).filter(emp => emp.emp_name);
    if (employees.length === 0) { setError('No valid employee data found.'); return; }
    setParsedData(employees); setPreview(employees); setReviewMode(true);
  };

  const formatDateForAPI = (dateStr) => {
    if (!dateStr || dateStr === '—' || dateStr === '-') return null;
    try {
      if (/\d{1,2}-[A-Za-z]{3}-\d{2,4}/.test(dateStr)) {
        const [d, m, y] = dateStr.split('-');
        const monthMap = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
        const month = monthMap[m.toLowerCase().substring(0,3)]; let year = y;
        if (year.length === 2) year = parseInt(year) > 30 ? `19${year}` : `20${year}`;
        return `${year}-${month}-${d.padStart(2,'0')}`;
      }
      if (/\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(dateStr)) { const parts = dateStr.split(/[-/]/); return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`; }
      if (/\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
      const d = new Date(dateStr); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return null;
    } catch { return null; }
  };

  const handleImport = async () => {
    if (!parsedData.length) return;
    setImporting(true); let successCount = 0, errorCount = 0; const errors = [];
    for (const emp of parsedData) {
      try {
        if (emp.doj) { const f = formatDateForAPI(emp.doj); if (f) emp.doj = f; }
        if (emp.dob) { const f = formatDateForAPI(emp.dob); if (f) emp.dob = f; }
        if (!emp.emp_id) throw new Error('Employee ID missing');
        if (!emp.emp_name) throw new Error('Employee name missing');
        await apiFetch('/employees', { method: 'POST', body: JSON.stringify({ emp_id:emp.emp_id,emp_name:emp.emp_name,doj:emp.doj||null,level:emp.level||null,designation:emp.designation||null,location:emp.location||null,mobile_no:emp.mobile_no||null,service_line:emp.service_line||null,client:emp.client||null,reporting_manager:emp.reporting_manager||null,suggested_email:emp.suggested_email||null,personal_email:emp.personal_email||null,blood_group:emp.blood_group||null,dob:emp.dob||null,password_hint:emp.password_hint||null,company_email:emp.company_email||null,company_email_password:emp.company_email_password||null,photo_url:emp.photo_url||null,status:emp.status||'Active',notes:emp.notes||null,cc_emails:emp.cc_emails||null,portal_url:emp.portal_url||null }) });
        successCount++;
      } catch (err) { errorCount++; errors.push(`${emp.emp_name || emp.emp_id}: ${err.message}`); }
    }
    let message = `Import completed!\n✅ Success: ${successCount}\n❌ Failed: ${errorCount}`;
    if (sendEmails) message += `\n📧 Welcome emails were sent.`; else message += `\n⏸️ No emails sent.`;
    if (errors.length > 0 && errors.length <= 5) message += `\n\nErrors:\n${errors.join('\n')}`;
    else if (errors.length > 5) message += `\n\nFirst 5 errors:\n${errors.slice(0,5).join('\n')}`;
    alert(message);
    if (successCount > 0) { onImport(); onBack(); }
    setImporting(false);
  };

  return (
    <div className="fade-in" style={{ animation: 'slideInBulk 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`
        @keyframes slideInBulk {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
          <ArrowLeft size={15}/> Employees
        </button>
        <ChevronRight size={13} style={{ opacity: 0.4 }}/>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>Bulk Import</span>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
      }}>
        {!reviewMode ? (
          <>
            <div style={{ marginBottom: 18, padding: '12px 16px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE', fontSize: 12, color: '#1E3A8A', lineHeight: 1.7 }}>
              <strong>📋 How to paste from Excel:</strong>
              <ul style={{ margin: '6px 0 0 18px' }}>
                <li>Select your rows (including the header) in Excel → Ctrl+C → paste here</li>
                <li>Supported date formats: <code>04-May-26</code>, <code>07-Dec-00</code>, <code>DD-MM-YYYY</code>, <code>YYYY-MM-DD</code></li>
                <li>Company email and Employee ID are auto-generated if missing</li>
              </ul>
            </div>
            <div className="form-group">
              <label className="form-label">Paste your Excel data here:</label>
              <textarea className="form-textarea" rows={9} value={textData} onChange={e=>{ setTextData(e.target.value); setError(''); setParsedData([]); setPreview([]); }} placeholder={'Emp ID\tEmployee Name\tDOJ\tLevel\tDesignation\tLocation\tMobile Number\tService Line\tClient\tReporting Manager\tSuggested Email Id\tPersonal Email\tBlood Group\tDOB'} style={{ fontFamily:'monospace', fontSize:12 }}/>
            </div>
            {error && <div style={{ padding:'10px 14px', marginBottom:14, background:'#FEE2E2', border:'1px solid #FCA5A5', borderRadius:6, color:'#991B1B', fontSize:13 }}>⚠️ {error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={parseTabularData}><Eye size={14}/> Parse & Review Data</button>
                <button className="btn btn-secondary" onClick={()=>{ setTextData(''); setParsedData([]); setPreview([]); setError(''); }}>Clear</button>
              </div>
              <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div><strong>{parsedData.length} employee{parsedData.length !== 1 ? 's' : ''} ready for import</strong><span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>Click ✏️ to edit any record before importing</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }}/>
                  <Mail size={13}/><span>Send welcome emails automatically</span>
                </label>
                <div style={{ width: 1, height: 20, background: 'var(--border)' }}/>
                <button className="btn btn-secondary btn-sm" onClick={() => setReviewMode(false)}><Edit2 size={12}/> Back to paste</button>
              </div>
            </div>
            <div className="table-wrap" style={{ maxHeight: 450, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ fontSize: 12, width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <tr><th style={{ width: 40 }}>#</th><th>Emp ID</th><th>Name</th><th>Designation</th><th>Level</th><th>Company Email</th><th>Personal Email</th><th>DOJ</th><th>Mobile</th><th>Location</th><th style={{ width: 60 }}>Actions</th></tr>
                </thead>
                <tbody>
                  {parsedData.map((emp, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{emp.emp_id}</td>
                      <td style={{ padding: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{emp.emp_name}</td>
                      <td style={{ padding: '8px' }}>{emp.designation || '—'}</td>
                      <td style={{ padding: '8px' }}>{emp.level ? <span style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--accent-glow)', fontSize: 11 }}>{emp.level}</span> : '—'}</td>
                      <td style={{ padding: '8px', color: 'var(--text-dim)' }}>{emp.company_email || '—'}</td>
                      <td style={{ padding: '8px', color: 'var(--text-dim)' }}>{emp.personal_email || '—'}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: 11 }}>{emp.doj || '—'}</td>
                      <td style={{ padding: '8px' }}>{emp.mobile_no || '—'}</td>
                      <td style={{ padding: '8px' }}>{emp.location || '—'}</td>
                      <td style={{ padding: '8px' }}><button className="btn btn-icon btn-sm" onClick={() => setEditingEmp({ index: idx, emp })} title="Edit this employee" style={{ padding: 4 }}><Edit2 size={12}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing} style={{ minWidth: 220 }}>
                <FileSpreadsheet size={14}/>{importing ? `Importing ${parsedData.length} employees…` : `${sendEmails ? '📧 Import & Send Emails' : '📥 Import Without Emails'} (${parsedData.length})`}
              </button>
            </div>
          </>
        )}
      </div>

      {editingEmp && (
        <div className="modal-overlay" onClick={() => setEditingEmp(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Employee</h2>
              <button className="btn btn-icon" onClick={() => setEditingEmp(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>Employee ID</label><input className="form-input" value={editingEmp.emp.emp_id} disabled/></div>
              <div className="form-group"><label>Full Name</label><input className="form-input" value={editingEmp.emp.emp_name} onChange={e => { const updated = [...parsedData]; updated[editingEmp.index].emp_name = e.target.value; setParsedData(updated); setEditingEmp({ ...editingEmp, emp: updated[editingEmp.index] }); }}/></div>
              <div className="form-group"><label>Designation</label><input className="form-input" value={editingEmp.emp.designation || ''} onChange={e => { const updated = [...parsedData]; updated[editingEmp.index].designation = e.target.value; setParsedData(updated); setEditingEmp({ ...editingEmp, emp: updated[editingEmp.index] }); }}/></div>
              <div className="form-group"><label>Company Email</label><input className="form-input" value={editingEmp.emp.company_email || ''} onChange={e => { const updated = [...parsedData]; updated[editingEmp.index].company_email = e.target.value; setParsedData(updated); setEditingEmp({ ...editingEmp, emp: updated[editingEmp.index] }); }}/></div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button className="btn btn-secondary" onClick={() => setEditingEmp(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// IT SUPPORT CONTACTS PAGE (dedicated page)
// ══════════════════════════════════════════════════════════════════════════════
function SupportContactsPage({ onBack, isAdmin }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', role: 'IT Support', sort_order: 0, is_active: true
  });

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/employees/support-contacts/all');
      setContacts(data.data || []);
    } catch (err) {
      try {
        const data = await apiFetch('/employees/support-contacts');
        setContacts(data.data || []);
      } catch (err2) {
        setContacts([]);
        alert('Failed to load support contacts.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const filteredContacts = contacts.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.phone && c.phone.includes(search)) ||
    (c.role && c.role.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingContact) {
        await apiFetch(`/employees/support-contacts/${editingContact.id}`, { method: 'PUT', body: JSON.stringify(formData) });
      } else {
        await apiFetch('/employees/support-contacts', { method: 'POST', body: JSON.stringify(formData) });
      }
      await fetchContacts(); setShowModal(false); resetForm();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete support contact "${name}"?`)) {
      try {
        await apiFetch(`/employees/support-contacts/${id}`, { method: 'DELETE' });
        await fetchContacts();
      } catch (err) { alert(err.message); }
    }
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData({ name: contact.name, phone: contact.phone || '', email: contact.email || '', role: contact.role || 'IT Support', sort_order: contact.sort_order || 0, is_active: contact.is_active !== false });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingContact(null);
    setFormData({ name: '', phone: '', email: '', role: 'IT Support', sort_order: contacts.length, is_active: true });
  };

  const moveContact = async (id, direction) => {
    const index = contacts.findIndex(c => c.id === id);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= contacts.length) return;
    const current = contacts[index]; const other = contacts[newIndex];
    try {
      await apiFetch(`/employees/support-contacts/${current.id}`, { method: 'PUT', body: JSON.stringify({ ...current, sort_order: other.sort_order }) });
      await apiFetch(`/employees/support-contacts/${other.id}`, { method: 'PUT', body: JSON.stringify({ ...other, sort_order: current.sort_order }) });
      await fetchContacts();
    } catch (err) { alert('Failed to reorder contacts'); }
  };

  return (
    <div className="fade-in" style={{ animation: 'slideInSupport 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`
        @keyframes slideInSupport {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}>
          <ArrowLeft size={15}/> Employees
        </button>
        <ChevronRight size={13} style={{ opacity: 0.4 }}/>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>IT Support Contacts</span>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <HelpCircle size={20} color="var(--accent)"/>IT Support Contacts
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>These contacts appear in the "Need Help?" section of welcome emails</p>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}><Plus size={15}/> Add Contact</button>}
        </div>

        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0' }}>
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Mail size={20} color="#15803d"/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>Welcome Email Preview</div>
                <div style={{ fontSize: 11, color: '#15803d' }}>These contacts appear in the "Need Help?" section of welcome emails</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#166534', background: '#ffffff', padding: '4px 12px', borderRadius: 20 }}>
              {contacts.filter(c => c.is_active !== false).length} active contact(s)
            </div>
          </div>
        </div>

        <div className="inv-toolbar" style={{ marginBottom: 16 }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <Search size={15}/>
            <input className="form-input" placeholder="Search by name, email, phone, role..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <button className="btn btn-secondary" onClick={fetchContacts} style={{ padding: '6px 12px' }}><RefreshCw size={14}/> Refresh</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th><th>Name</th><th>Role</th><th>Phone</th><th>Email</th>
                <th style={{ width: 80 }}>Status</th>
                {isAdmin && <th style={{ width: 120 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6}><div className="empty-state"><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading contacts...</div></div></td></tr>
              ) : filteredContacts.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6}><div className="empty-state">
                  <Users size={32} style={{ opacity: 0.3 }}/><p>No support contacts found</p>
                  {isAdmin && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14}/> Add First Contact</button>}
                </div></td></tr>
              ) : filteredContacts.map((contact, idx) => (
                <tr key={contact.id}>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                    {contact.sort_order !== undefined ? contact.sort_order + 1 : idx + 1}
                   </td>
                  <td><div style={{ fontWeight: 600 }}>{contact.name}</div></td>
                  <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contact.role || 'IT Support'}</span></td>
                  <td>{contact.phone ? <a href={`tel:${contact.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 12 }}><Phone size={11} style={{ display: 'inline', marginRight: 4 }}/>{contact.phone}</a> : '—'}</td>
                  <td>{contact.email ? <a href={`mailto:${contact.email}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 12 }}><Mail size={11} style={{ display: 'inline', marginRight: 4 }}/>{contact.email}</a> : '—'}</td>
                  <td><span className={`badge ${contact.is_active !== false ? 'badge-success' : 'badge-danger'}`}>{contact.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => moveContact(contact.id, 'up')} disabled={idx === 0} title="Move Up"><ChevronUp size={12}/></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => moveContact(contact.id, 'down')} disabled={idx === filteredContacts.length - 1} title="Move Down"><ChevronDown size={12}/></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(contact)}><Edit2 size={12}/></button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(contact.id, contact.name)}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onBack}>Back to Employees</button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingContact ? 'Edit Support Contact' : 'Add Support Contact'}</h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSave}>
                <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Hari Patnaik"/></div>
                <div className="form-group"><label className="form-label">Role / Designation</label><input className="form-input" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} placeholder="e.g., IT Head, IT Support"/></div>
                <div className="form-group"><label className="form-label">Phone Number</label><input className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="e.g., 9916675460"/><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Will appear in the "Need Help?" section of welcome emails</div></div>
                <div className="form-group"><label className="form-label">Email Address</label><input type="email" className="form-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="e.g., sysadmin@mindteck.us"/></div>
                <div className="form-group"><label className="form-label"><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} style={{ marginRight: 8 }}/>Active (visible in welcome emails)</label></div>
                <div style={{ marginTop: 20, padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, fontSize: 12, color: '#1E3A8A' }}>
                  <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }}/>Contacts with email addresses will appear with clickable email links in welcome emails.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}><Save size={14}/>{saving ? 'Saving...' : editingContact ? 'Update Contact' : 'Add Contact'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deleted Employees Panel (stays as modal) ───────────────────────────────────
function DeletedPanel({ onClose }) {
  const [deleted, setDeleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => { apiFetch('/employees/deleted').then(d=>setDeleted(d.data||[])).catch(console.error).finally(()=>setLoading(false)); }, []);

  const filtered = deleted.filter(e => !search || [e.emp_id, e.emp_name, e.company_email, e.designation].some(v=>v?.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:720 }} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:8, background:'var(--red-bg)', border:'1px solid var(--red-border)', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 size={16} color="var(--red)"/></div>
            <div><h2 className="modal-title">Deleted Employees</h2><div style={{ fontSize:12, color:'var(--text-muted)' }}>{deleted.length} record{deleted.length!==1?'s':''} removed</div></div>
          </div>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="search-bar" style={{ marginBottom:16 }}><Search size={14}/><input className="form-input" placeholder="Search deleted employees…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {loading ? <div className="empty-state"><div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading…</div></div> : filtered.length === 0 ? (
            <div className="empty-state"><Trash2 size={28} style={{ opacity:.3 }}/><p>{deleted.length===0 ? 'No deleted employees yet' : 'No results match your search'}</p></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Emp ID</th><th>Name</th><th>Designation</th><th>Company Email</th><th>Service Line</th><th>Deleted At</th></tr></thead>
                <tbody>{filtered.map(e=>(<tr key={e.emp_id} style={{ opacity:0.75 }}>
                  <td><span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--red)', fontWeight:700 }}>{e.emp_id}</span></td>
                  <td><div style={{ fontWeight:600, textDecoration:'line-through', color:'var(--text-muted)' }}>{e.emp_name}</div></td>
                  <td style={{ fontSize:12.5, color:'var(--text-muted)' }}>{e.designation||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-dim)' }}>{e.company_email||'—'}</td>
                  <td style={{ fontSize:12.5, color:'var(--text-muted)' }}>{e.service_line||'—'}</td>
                  <td><div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, color:'var(--red)', fontFamily:'var(--mono)' }}><Clock size={11}/> {e.deleted_at_fmt||'—'}</div></td>
                </tr>))}</tbody>
              </table>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
        </div>
      </div>
    </div>
  );
}

// ── Exit Checklist Modal (stays as modal) ──────────────────────────────────────
function ExitChecklistModal({ emp, onClose, onConfirm, deleting }) {
  const LAPTOP_STATUS_OPTIONS = [
    { value:'collected',    label:'Laptop Collected (Company Asset)',                           icon:'✅', color:'#166534', bg:'#dcfce7', border:'#86efac', emailText:'The company-issued laptop has been successfully collected from the employee.' },
    { value:'client_return',label:'Client-Owned Laptop – To Be Returned to Client',             icon:'🏢', color:'#1e40af', bg:'#dbeafe', border:'#93c5fd', emailText:'The employee was using a client-owned laptop. Please confirm that the asset has been returned to the respective client.' },
    { value:'no_laptop',    label:'No Laptop Assigned',                                        icon:'❌', color:'#6b7280', bg:'#f3f4f6', border:'#d1d5db', emailText:'No laptop or company asset was assigned to this employee.' },
    { value:'pending',      label:'Pending Verification (Check with Client/Manager)',           icon:'⏳', color:'#92400e', bg:'#fef3c7', border:'#fcd34d', emailText:'Laptop ownership and return status are pending verification. Please confirm with the client or reporting manager.' },
  ];
  const CHECKLIST_ITEMS = [
    { key:'email_deactivated', label:'Deactivate Email & Portal Access',       detail:'Disable company email and revoke all portal / SSO logins',            icon:'📧', category:'IT' },
    { key:'ad_removed',        label:'Remove from Active Directory / Azure AD',detail:'Delete or disable the AD/AAD account to cut all Windows/M365 access', icon:'🖥️', category:'IT' },
    { key:'vpn_revoked',       label:'Revoke VPN & Remote Access',             detail:'Remove VPN profile and any remote-desktop / SSH keys',                 icon:'🔒', category:'IT' },
    { key:'licenses_revoked',  label:'Revoke Software Licenses',               detail:'Unassign M365, Adobe, JetBrains and other licensed apps',              icon:'📦', category:'IT' },
  ];
  const CATEGORY_META = { IT: { label:'IT Access', bg:'#eff6ff', border:'#bfdbfe', text:'#1d4ed8', dot:'#3b82f6' } };

  const [checked,      setChecked]      = useState({});
  const [laptopStatus, setLaptopStatus] = useState('');
  const [ccInput,      setCcInput]      = useState('');
  const [ccTags,       setCcTags]       = useState([]);
  const [notes,        setNotes]        = useState('');
  const [ccError,      setCcError]      = useState('');

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const toggle = (key) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));
  const checkedCount = Object.values(checked).filter(Boolean).length + (laptopStatus ? 1 : 0);
  const totalItems = CHECKLIST_ITEMS.length + 1;
  const allChecked = checkedCount === totalItems;
  const progressPct = Math.round((checkedCount / totalItems) * 100);
  const selectedLaptop = LAPTOP_STATUS_OPTIONS.find(o => o.value === laptopStatus);

  const addCc = () => {
    const email = ccInput.trim(); if (!email) return;
    if (!isValidEmail(email)) { setCcError('Invalid email address'); return; }
    if (ccTags.includes(email)) { setCcError('Already added'); return; }
    if (email === emp.company_email || email === emp.personal_email) { setCcError("Cannot add employee's own email"); return; }
    setCcTags(t => [...t, email]); setCcInput(''); setCcError('');
  };
  const removeCc = (email) => setCcTags(t => t.filter(e => e !== email));
  const handleCcKey = (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCc(); } };
  const handleConfirm = () => onConfirm({ checklist: { ...checked, laptop_status: laptopStatus, notes: notes.trim() }, cc_emails_override: ccTags.join(', ') });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems:'flex-start', paddingTop:32, paddingBottom:32, overflowY:'auto' }}>
      <div className="modal" style={{ maxWidth:580, width:'100%', margin:'0 auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom:'2px solid #d1fae5', background:'linear-gradient(135deg,rgba(20,83,45,0.04),transparent)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:42, height:42, borderRadius:10, background:'linear-gradient(135deg,#14532d,#166534)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 12px rgba(20,83,45,0.3)' }}><span style={{ fontSize:22 }}>🚪</span></div>
            <div><h2 className="modal-title" style={{ color:'#14532d', fontSize:16 }}>Exit &amp; Offboarding Checklist</h2><div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>Complete before removing <strong style={{ color:'var(--text)' }}>{emp.emp_name}</strong></div></div>
          </div>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body" style={{ paddingTop:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', marginBottom:18, background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10 }}>
            <EmpAvatar photo={emp.photo_url} name={emp.emp_name} size={38}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#14532d' }}>{emp.emp_name}</div>
              <div style={{ fontSize:11, color:'#166534', marginTop:1 }}>{emp.emp_id}{emp.designation ? ` · ${emp.designation}` : ''}{emp.location ? ` · ${emp.location}` : ''}</div>
            </div>
            <div style={{ fontSize:11, color:'#166534', fontWeight:700, background:'#fff', padding:'3px 10px', borderRadius:20, border:'1px solid #86efac', whiteSpace:'nowrap' }}>⚠️ Permanent Delete</div>
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)' }}>Checklist Progress</span>
              <span style={{ fontSize:12, fontWeight:700, color:allChecked ? '#166534' : 'var(--text-muted)', fontFamily:'var(--mono)' }}>{checkedCount} / {totalItems}{allChecked ? ' ✓ All Done' : ''}</span>
            </div>
            <div style={{ height:8, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progressPct}%`, borderRadius:99, background: allChecked ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#4ade80,#16a34a)', transition:'width 0.35s ease' }}/>
            </div>
          </div>

          {['IT'].map(cat => {
            const items = CHECKLIST_ITEMS.filter(i => i.category === cat);
            const col = CATEGORY_META[cat];
            return (
              <div key={cat} style={{ marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:col.dot, flexShrink:0 }}/>
                  <span style={{ fontSize:11, fontWeight:700, color:col.text, textTransform:'uppercase', letterSpacing:'0.05em' }}>{col.label}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, paddingLeft:14, borderLeft:`2px solid ${col.border}` }}>
                  {items.map(item => {
                    const isDone = !!checked[item.key];
                    return (
                      <div key={item.key} onClick={() => toggle(item.key)} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 12px', borderRadius:8, cursor:'pointer', border:`1px solid ${isDone ? col.border : 'var(--border)'}`, background: isDone ? col.bg : 'var(--surface)', transition:'all 0.15s ease', userSelect:'none' }}>
                        <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, marginTop:1, border:`2px solid ${isDone ? col.dot : 'var(--border)'}`, background: isDone ? col.dot : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s ease' }}>
                          {isDone && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color: isDone ? col.text : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.85 : 1 }}>{item.icon} {item.label}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, lineHeight:1.4 }}>{item.detail}</div>
                        </div>
                        {isDone && <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:col.dot, color:'#fff', flexShrink:0, alignSelf:'flex-start', marginTop:2 }}>DONE</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}><div style={{ width:8, height:8, borderRadius:'50%', background:'#f97316', flexShrink:0 }}/><span style={{ fontSize:11, fontWeight:700, color:'#c2410c', textTransform:'uppercase', letterSpacing:'0.05em' }}>Asset Recovery</span></div>
            <div style={{ paddingLeft:14, borderLeft:'2px solid #fed7aa' }}>
              <div style={{ padding:'12px 14px', borderRadius:8, border:`1px solid ${laptopStatus ? (selectedLaptop?.border || '#fed7aa') : '#fed7aa'}`, background: laptopStatus ? (selectedLaptop?.bg || '#fff7ed') : '#fff7ed' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:18 }}>💻</span>
                  <div><div style={{ fontSize:13, fontWeight:600, color:'#1a202c' }}>Laptop &amp; Hardware Status</div><div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>Select the laptop return status for proper asset tracking</div></div>
                  {laptopStatus && <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background: selectedLaptop?.color || '#c2410c', color:'#fff', flexShrink:0 }}>RECORDED</span>}
                </div>
                <select className="form-select" value={laptopStatus} onChange={e => setLaptopStatus(e.target.value)} style={{ width:'100%', fontSize:13, fontWeight: laptopStatus ? 600 : 400, color: laptopStatus ? (selectedLaptop?.color || '#c2410c') : 'var(--text-muted)', background:'#ffffff', border:`1.5px solid ${laptopStatus ? (selectedLaptop?.border || '#fed7aa') : 'var(--border)'}`, marginBottom: laptopStatus ? 10 : 0 }}>
                  <option value="">-- Select laptop status --</option>
                  {LAPTOP_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>)}
                </select>
                {laptopStatus && selectedLaptop && (
                  <div style={{ padding:'10px 12px', borderRadius:6, background: selectedLaptop.bg, border:`1px solid ${selectedLaptop.border}`, fontSize:12, color: selectedLaptop.color, lineHeight:1.6 }}>
                    <div style={{ fontWeight:700, marginBottom:3, fontSize:11 }}>📧 Email will say:</div>{selectedLaptop.emailText}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop:18, padding:'14px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}><Mail size={13} color="var(--accent)"/>CC — Exit Notification Recipients</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>Exit email goes to <strong>HR</strong>. Add managers or team leads to notify.<span style={{ display:'block', marginTop:3, color:'var(--red)', fontWeight:500 }}>⚠️ Employee's own emails are automatically excluded.</span></div>
            <div style={{ display:'flex', gap:8 }}>
              <input type="text" className="form-input" style={{ flex:1, fontSize:12 }} value={ccInput} onChange={e => { setCcInput(e.target.value); setCcError(''); }} onKeyDown={handleCcKey} placeholder="Add email and press Enter…"/>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addCc} disabled={!ccInput.trim()}><Plus size={13}/> Add</button>
            </div>
            {ccError && <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>{ccError}</div>}
            {ccTags.length > 0 ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10, padding:'8px 10px', background:'rgba(99,102,241,0.04)', border:'1px solid var(--border)', borderRadius:8 }}>
                {ccTags.map(email => (<div key={email} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, background:'var(--accent-glow)', border:'1px solid rgba(99,102,241,0.2)', color:'var(--accent)' }}><Mail size={10}/><span>{email}</span><button type="button" onClick={() => removeCc(email)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', color:'var(--text-muted)' }}><X size={11}/></button></div>))}
              </div>
            ) : (
              <div style={{ marginTop:8, padding:'6px 10px', background:'var(--surface2)', borderRadius:6, fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>No additional recipients. Exit email will go to HR only.</div>
            )}
          </div>

          <div style={{ marginTop:14 }}>
            <label className="form-label">📝 Admin Notes&nbsp;<span style={{ fontWeight:400, color:'var(--text-muted)' }}>(optional — appears in exit email)</span></label>
            <textarea className="form-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Resigned, last day 10 May. Laptop handed over. All access removed." style={{ fontSize:12, resize:'vertical' }}/>
          </div>

          <div style={{ marginTop:14, padding:'10px 14px', background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, fontSize:12, color:'#854d0e', lineHeight:1.6 }}>
            <strong>⚠️ Note:</strong> Unchecked items appear as <strong>PENDING</strong> in the exit email.
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={deleting}>Cancel</button>
            <button className="btn btn-danger" onClick={handleConfirm} disabled={deleting} style={{ minWidth:200 }}>
              <Trash2 size={14}/>{deleting ? 'Deleting…' : 'Confirm & Delete Employee'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function Employees() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin' || user?.role === 'it_staff';

  const [activeTab,      setActiveTab]      = useState('employees');
  const [employees,      setEmployees]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [filter,         setFilter]         = useState('Active');
  
  // Page states
  const [viewEmp,        setViewEmp]        = useState(null);
  const [editEmp,        setEditEmp]        = useState(null);
  const [showAddPage,    setShowAddPage]    = useState(false);
  const [showBulkPage,   setShowBulkPage]   = useState(false);
  const [showSupportPage, setShowSupportPage] = useState(false);
  const listStateSnapshot = useRef({ search: '', filter: 'Active' });

  const [deleteConf,     setDeleteConf]     = useState(null);
  const [deleting,       setDeleting]       = useState(false);
  const [showDeleted,    setShowDeleted]    = useState(false);

  const filterRef = useRef(filter);
  const searchRef = useRef(search);
  useEffect(() => { filterRef.current = filter; }, [filter]);
  useEffect(() => { searchRef.current = search; }, [search]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (filterRef.current !== 'All') params.set('status', filterRef.current);
      if (searchRef.current) params.set('search', searchRef.current);
      const data = await apiFetch(`/employees?${params}`);
      setEmployees(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [filter, search, fetchEmployees]);

  // Open detail page
  const handleViewEmp = (emp) => {
    listStateSnapshot.current = { search, filter };
    setViewEmp(emp);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open edit page
  const handleEditEmp = (emp) => {
    listStateSnapshot.current = { search, filter };
    setEditEmp(emp);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Back to list from any page
  const handleBackToList = () => {
    const { search: prevSearch, filter: prevFilter } = listStateSnapshot.current;
    setSearch(prevSearch);
    setFilter(prevFilter);
    setViewEmp(null);
    setEditEmp(null);
    setShowAddPage(false);
    setShowBulkPage(false);
    setShowSupportPage(false);
  };

  // After saving from edit page, refresh employee data
  const handleEditSaved = async () => {
    await fetchEmployees();
  };

  const handleDelete = async ({ checklist, cc_emails_override }) => {
    if (!deleteConf) return;
    setDeleting(true);
    const empId = deleteConf.emp_id;
    setEmployees(prev => prev.filter(e => e.emp_id !== empId));
    setDeleteConf(null);
    try {
      await apiFetch(`/employees/${empId}`, { method: 'DELETE', body: JSON.stringify({ checklist: { ...checklist, cc_emails_override } }) });
      await fetchEmployees();
    } catch (err) {
      alert(err.message);
      await fetchEmployees();
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Emp ID','Name','DOJ','Level','Designation','Location','Mobile','Service Line','Client','Reporting Manager','Company Email','Suggested Email','Personal Email','Blood Group','DOB','Status','CC Emails','Portal URL'];
    const rows = employees.map(e => [e.emp_id,e.emp_name,e.doj_fmt||'',e.level||'',e.designation||'',e.location||'',e.mobile_no||'',e.service_line||'',e.client||'',e.reporting_manager||'',e.company_email||'',e.suggested_email||'',e.personal_email||'',e.blood_group||'',e.dob_fmt||'',e.status,e.cc_emails||'',e.portal_url||'']);
    const csv  = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`employees-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // Render detail page
  if (viewEmp) {
    return (
      <div className="fade-in">
        <EmployeeDetailPage
          emp={viewEmp}
          onBack={handleBackToList}
          onEdit={handleEditEmp}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  // Render edit page
  if (editEmp) {
    return (
      <div className="fade-in">
        <EmployeeEditPage
          emp={editEmp}
          onBack={handleBackToList}
          onSaved={handleEditSaved}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  // Render add employee page
  if (showAddPage) {
    return (
      <div className="fade-in">
        <AddEmployeePage
          onBack={handleBackToList}
          onSaved={fetchEmployees}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  // Render bulk import page
  if (showBulkPage) {
    return (
      <div className="fade-in">
        <BulkImportPage
          onBack={handleBackToList}
          onImport={fetchEmployees}
        />
      </div>
    );
  }

  // Render support contacts page
  if (showSupportPage) {
    return (
      <div className="fade-in">
        <SupportContactsPage
          onBack={handleBackToList}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  // ── Normal list view ───────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Employee Management</h1>
          <p>Manage employee records and IT support contacts</p>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {isAdmin && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowBulkPage(true)} style={{ color:'var(--accent)', borderColor:'var(--accent-border)' }}>
                <FileSpreadsheet size={14}/> Bulk Import
              </button>
              <button className="btn btn-secondary" onClick={() => setShowDeleted(true)} style={{ color:'var(--red)', borderColor:'var(--red-border)' }}>
                <Trash2 size={14}/> Deleted List
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={15}/> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={fetchEmployees}>
            <RefreshCw size={14}/>
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowAddPage(true)}>
              <Plus size={15}/> Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid var(--border)' }}>
        <button 
          className="btn" 
          onClick={() => setActiveTab('employees')} 
          style={{ 
            padding:'10px 20px', 
            border:'none', 
            background:'none', 
            cursor:'pointer', 
            fontWeight:500, 
            color: activeTab === 'employees' ? 'var(--accent)' : 'var(--text-muted)', 
            borderBottom: activeTab === 'employees' ? '2px solid var(--accent)' : 'none', 
            borderRadius:0 
          }}
        >
          <Users size={14} style={{ display:'inline', marginRight:8 }}/>
          Employees
        </button>
        <button 
          className="btn" 
          onClick={() => setShowSupportPage(true)} 
          style={{ 
            padding:'10px 20px', 
            border:'none', 
            background:'none', 
            cursor:'pointer', 
            fontWeight:500, 
            color: 'var(--text-muted)', 
            borderRadius:0 
          }}
        >
          <HelpCircle size={14} style={{ display:'inline', marginRight:8 }}/>
          IT Support Contacts
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        {[
          { label:'Total', value: employees.length, color:'var(--accent)' },
          { label:'Active', value: employees.filter(e => e.status === 'Active').length, color:'var(--green)' },
          { label:'Inactive', value: employees.filter(e => e.status === 'Inactive').length, color:'var(--red)' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding:'12px 20px', display:'flex', alignItems:'center', gap:12, minWidth:120 }}>
            <div style={{ fontSize:24, fontWeight:800, color:stat.color, fontFamily:'var(--mono)' }}>
              {stat.value}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex:1, maxWidth:360 }}>
          <Search size={15}/>
          <input 
            className="form-input" 
            placeholder="Search name, ID, email, designation…" 
            value={search} 
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="toggle-group">
          {['All','Active','Inactive'].map(s => (
            <button 
              key={s} 
              className={`toggle-btn ${filter === s ? 'active' : ''}`} 
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>
          {employees.length} employee{employees.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Employee Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Emp ID</th>
              <th>Name &amp; Designation</th>
              <th>DOJ</th>
              <th>Level</th>
              <th>Mobile</th>
              <th>Service Line</th>
              <th>Client</th>
              <th>Location</th>
              <th>Company Email</th>
              <th>Portal URL</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13}>
                  <div className="empty-state">
                    <div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading employees…</div>
                  </div>
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={13}>
                  <div className="empty-state">
                    <Users size={32} style={{ opacity:.3 }}/>
                    <p>No employees found</p>
                    {isAdmin && (
                      <button className="btn btn-primary" onClick={() => setShowAddPage(true)}>
                        <Plus size={14}/> Add First Employee
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr key={emp.emp_id}>
                  <td><EmpAvatar photo={emp.photo_url} name={emp.emp_name} size={36}/></td>
                  <td>
                    <span style={{ fontFamily:'var(--mono)', fontSize:12.5, color:'var(--accent)', fontWeight:700 }}>
                      {emp.emp_id}
                    </span>
                  </td>
                  <td>
                    <div
                      style={{ 
                        fontWeight:600, 
                        fontSize:13.5, 
                        color:'var(--accent)', 
                        cursor:'pointer', 
                        textDecoration:'underline', 
                        textDecorationColor:'transparent', 
                        transition:'text-decoration-color 0.15s' 
                      }}
                      onClick={() => handleViewEmp(emp)}
                      onMouseEnter={e => e.currentTarget.style.textDecorationColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.textDecorationColor = 'transparent'}
                      title="Click to view details"
                    >
                      {emp.emp_name}
                    </div>
                    {emp.designation && <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>{emp.designation}</div>}
                  </td>
                  <td style={{ fontFamily:'var(--mono)', fontSize:12 }}>{emp.doj_fmt || '—'}</td>
                  <td>
                    {emp.level ? (
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'var(--accent-glow)', color:'var(--accent)' }}>
                        {emp.level}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize:12.5 }}>{emp.mobile_no || '—'}</td>
                  <td style={{ fontSize:12.5 }}>{emp.service_line || '—'}</td>
                  <td style={{ fontSize:12.5 }}>{emp.client || '—'}</td>
                  <td style={{ fontSize:12.5 }}>{emp.location || '—'}</td>
                  <td style={{ fontSize:12, color:'var(--text-dim)' }}>{emp.company_email || '—'}</td>
                  <td style={{ fontSize:11, maxWidth:150, wordBreak:'break-all' }}>
                    {emp.portal_url ? (
                      <a href={emp.portal_url} target="_blank" rel="noopener noreferrer" style={{ color:'var(--accent)', textDecoration:'none', fontSize:11, display:'inline-flex', alignItems:'center', gap:3 }}>
                        <LinkIcon size={10}/> {emp.portal_url.substring(0,30)}{emp.portal_url.length > 30 ? '...' : ''}
                      </a>
                    ) : '—'}
                  </td>
                  <td><StatusBadge status={emp.status}/></td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleViewEmp(emp)}>
                        <Eye size={12}/> View
                      </button>
                      {isAdmin && (
                        <>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEditEmp(emp)} title="Edit">
                            <Edit2 size={12}/>
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => setDeleteConf(emp)} title="Delete permanently">
                            <Trash2 size={12}/>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showDeleted && <DeletedPanel onClose={() => setShowDeleted(false)}/>}
      {deleteConf && (
        <ExitChecklistModal 
          emp={deleteConf} 
          onClose={() => setDeleteConf(null)} 
          onConfirm={handleDelete} 
          deleting={deleting}
        />
      )}
    </div>
  );
}