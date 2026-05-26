import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import CCEmailInput from '../components/common/CCEmailInput';
import {
  Send, CheckSquare, Square, Truck, HandMetal,
  Camera, X, FileText, MapPin, Package, User, ImagePlus, Trash2,
  Search, ChevronDown, CheckCircle, Users, Sparkles,
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

const EMPTY = {
  empId: '', empName: '', empEmail: '', personalEmail: '', mobileNo: '',
  department: '', client: '', project: '',
  allocationDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().split('T')[0],
  deliveryMethod: 'hand',
  deliveryAddress: '',
  photoUrl: '',
  preparedBy: '',
};

// ── Employee Avatar ───────────────────────────────────────────────────────────
function EmpAvatar({ photo, name, size = 40 }) {
  if (photo) {
    return (
      <img src={photo} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: '2px solid var(--border)', flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--accent), #818cf8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ── Employee Search Dropdown (Portal-based) ───────────────────────────────────
function EmployeeDropdown({ employees, selectedEmp, onSelect, loading }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef();
  const dropRef    = useRef();
  const [dropStyle, setDropStyle] = useState({});

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999 });
  };

  useEffect(() => { if (open) updatePosition(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          dropRef.current    && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = employees.filter(e =>
    !search || [e.emp_id, e.emp_name, e.company_email, e.designation]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const dropdown = open ? ReactDOM.createPortal(
    <div ref={dropRef} style={{
      ...dropStyle,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', overflow: 'hidden',
    }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)' }}>
        <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input className="form-input"
          style={{ border: 'none', padding: '4px 0', fontSize: 13, background: 'transparent', outline: 'none' }}
          placeholder="Search name, ID, email…" value={search}
          onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus />
        {search && (
          <button type="button" onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
            <X size={12} />
          </button>
        )}
      </div>
      {search && (
        <div style={{ padding: '5px 12px', fontSize: 11, color: 'var(--text-muted)',
          background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </div>
      )}
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Search size={24} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
            No employees found
          </div>
        ) : filtered.map(emp => (
          <div key={emp.emp_id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer',
              background: selectedEmp?.emp_id === emp.emp_id ? 'var(--accent-glow)' : 'transparent',
              borderBottom: '1px solid var(--border)', transition: 'background .12s',
            }}
            onClick={() => { onSelect(emp); setOpen(false); setSearch(''); }}
            onMouseEnter={e => { if (selectedEmp?.emp_id !== emp.emp_id) e.currentTarget.style.background = 'var(--surface2)'; }}
            onMouseLeave={e => { if (selectedEmp?.emp_id !== emp.emp_id) e.currentTarget.style.background = 'transparent'; }}
          >
            <EmpAvatar photo={emp.photo_url} name={emp.emp_name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {emp.emp_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{emp.emp_id}</span>
                {emp.designation ? ` · ${emp.designation}` : ''}
                {emp.service_line ? ` · ${emp.service_line}` : ''}
              </div>
            </div>
            {emp.location && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap',
                background: 'var(--surface2)', padding: '2px 8px', borderRadius: 20,
                border: '1px solid var(--border)' }}>
                {emp.location}
              </span>
            )}
            {selectedEmp?.emp_id === emp.emp_id && (
              <CheckCircle size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div ref={triggerRef} className="form-input"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          justifyContent: 'space-between', minHeight: 44,
          border: open ? '1px solid var(--accent)' : undefined,
          background: open ? 'var(--accent-glow)' : undefined,
        }}
        onClick={() => setOpen(o => !o)}
      >
        {selectedEmp ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EmpAvatar photo={selectedEmp.photo_url} name={selectedEmp.emp_name} size={28} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{selectedEmp.emp_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {selectedEmp.emp_id}{selectedEmp.designation ? ` · ${selectedEmp.designation}` : ''}
              </div>
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {loading ? 'Loading employees…' : '-- Search or select employee --'}
          </span>
        )}
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </div>
      {dropdown}
    </>
  );
}

// ── Selected Employee Card ────────────────────────────────────────────────────
function SelectedEmployeeCard({ emp, onClear }) {
  if (!emp) return null;
  const fields = [
    ['Employee ID',       emp.emp_id,           true],
    ['Designation',       emp.designation,       false],
    ['Level',             emp.level,             false],
    ['Service Line',      emp.service_line,      false],
    ['Client',            emp.client,            false],
    ['Location',          emp.location,          false],
    ['Mobile',            emp.mobile_no,         false],
    ['Company Email',     emp.company_email,     false],
    ['Personal Email',    emp.personal_email,    false],
    ['Reporting Manager', emp.reporting_manager, false],
    ['Blood Group',       emp.blood_group,       false],
    ['DOJ',               emp.doj_fmt || emp.doj,false],
  ].filter(([, val]) => val);

  return (
    <div style={{
      border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
      background: 'var(--accent-glow)', overflow: 'hidden', marginTop: 12,
      animation: 'empCardIn .25s cubic-bezier(.22,1,.36,1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,.15)' }}>
        <EmpAvatar photo={emp.photo_url} name={emp.emp_name} size={56} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{emp.emp_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {[emp.emp_id, emp.designation, emp.service_line].filter(Boolean).join(' · ')}
          </div>
          <div style={{ marginTop: 6 }}><StatusBadge status={emp.status || 'Active'} /></div>
        </div>
        <button className="btn btn-icon btn-sm" onClick={onClear} title="Clear selection"
          style={{ alignSelf: 'flex-start' }}><X size={14} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', padding: '4px 0' }}>
        {fields.map(([label, val, mono]) => (
          <div key={label} style={{ padding: '6px 16px', borderBottom: '1px solid rgba(99,102,241,.08)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 1 }}>{label}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
              fontFamily: mono ? 'var(--mono)' : undefined }}>{val}</div>
          </div>
        ))}
      </div>
      <style>{`@keyframes empCardIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}

// ── Chatbot Pre-fill Banner ───────────────────────────────────────────────────
function ChatbotBanner({ assetId, onDismiss }) {
  if (!assetId) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(129,140,248,0.08))',
      border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius)',
      marginBottom: 16,
    }}>
      <Sparkles size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>
          AssetOps AI pre-filled asset&nbsp;
        </span>
        <code style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700,
          background: 'rgba(99,102,241,0.12)', padding: '1px 6px', borderRadius: 4,
          color: 'var(--accent)' }}>{assetId}</code>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>
          — verify and select an employee to continue.
        </span>
      </div>
      <button type="button" onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
        <X size={13} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function AllocateLaptop() {
  const { assets, allocateAsset, user } = useApp();
  const location = useLocation();
  const navigate  = useNavigate();
  const fileRef   = useRef();
  const damageRef = useRef();

  const [selectedAsset,     setSelectedAsset]     = useState('');
  const [selectedEmp,       setSelectedEmp]        = useState(null);
  const [form,              setForm]               = useState({ ...EMPTY, preparedBy: user?.name || '' });
  const [accessories,       setAccessories]        = useState([]);
  const [ccEmails,          setCCEmails]           = useState([]);
  const [saving,            setSaving]             = useState(false);
  const [photoPreview,      setPhotoPreview]       = useState('');
  const [damagePhotos,      setDamagePhotos]       = useState([]);
  const [employees,         setEmployees]          = useState([]);
  const [empLoading,        setEmpLoading]         = useState(true);
  const [stockItems,        setStockItems]         = useState([]);
  const [stockLoading,      setStockLoading]       = useState(true);
  const [chatbotAssetId,    setChatbotAssetId]     = useState('');   // ← chatbot pre-fill banner

  const stockAssets    = assets.filter(a => a.status === 'Stock');
  const asset          = assets.find(a => a.id === selectedAsset);
  const availableStock = stockItems.filter(s => s.quantity > 0);

  // ── Fetch employees ──
  useEffect(() => {
    apiFetch('/employees?status=Active&limit=500')
      .then(res => setEmployees(res.data || []))
      .catch(e => console.error('Employees fetch failed:', e.message))
      .finally(() => setEmpLoading(false));
  }, []);

  // ── Fetch accessories ──
  useEffect(() => {
    apiFetch('/accessories/stock')
      .then(res => setStockItems(res.data || []))
      .catch(e => console.error('Stock fetch failed:', e.message))
      .finally(() => setStockLoading(false));
  }, []);

  // ── Handle navigation state (chatbot pre-fill OR direct link) ──
  useEffect(() => {
    const state = location.state;
    if (!state) return;

    // Support both key names: prefilledAssetId (from chatbot) and assetId (legacy)
    const incomingAssetId = state.prefilledAssetId || state.assetId || '';

    if (incomingAssetId) {
      // Find by asset_id string OR by numeric id
      const found = assets.find(a =>
        a.asset_id === incomingAssetId ||
        String(a.id) === String(incomingAssetId) ||
        a.id === incomingAssetId
      );
      if (found) {
        setSelectedAsset(found.id);
        // Only show banner when coming from chatbot (prefilledAssetId key)
        if (state.prefilledAssetId) setChatbotAssetId(incomingAssetId);
      } else {
        // Assets may not be loaded yet — store raw ID, resolve below
        setSelectedAsset(incomingAssetId);
        if (state.prefilledAssetId) setChatbotAssetId(incomingAssetId);
      }
    }

    // Clear router state so refresh doesn't re-trigger
    window.history.replaceState({}, document.title);
  }, [location.state, assets]);

  // ── If selectedAsset is a string ID that didn't resolve yet, try again once assets load ──
  useEffect(() => {
    if (!selectedAsset || typeof selectedAsset !== 'string') return;
    // Already a numeric id? skip
    if (assets.find(a => a.id === selectedAsset)) return;
    const found = assets.find(a =>
      a.asset_id === selectedAsset || String(a.id) === String(selectedAsset)
    );
    if (found) setSelectedAsset(found.id);
  }, [assets, selectedAsset]);

  // ── Preparedby from user ──
  useEffect(() => {
    if (user?.name && !form.preparedBy) set('preparedBy', user.name);
  }, [user]);

  // ── Employee select ──
  const handleSelectEmployee = (emp) => {
    setSelectedEmp(emp);
    setPhotoPreview(emp.photo_url || '');
    setForm(f => ({
      ...f,
      empId:         emp.emp_id         || f.empId,
      empName:       emp.emp_name       || f.empName,
      empEmail:      emp.company_email  || f.empEmail,
      personalEmail: emp.personal_email || f.personalEmail,
      mobileNo:      emp.mobile_no      || f.mobileNo,
      department:    emp.service_line   || f.department,
      client:        emp.client         || f.client,
      project:       f.project,
      photoUrl:      emp.photo_url      || f.photoUrl,
    }));
  };

  const clearEmployee = () => {
    setSelectedEmp(null);
    setPhotoPreview('');
    setForm(f => ({
      ...f,
      empId: '', empName: '', empEmail: '', personalEmail: '',
      mobileNo: '', department: '', client: '', photoUrl: '',
    }));
  };

  const toggleAcc = (stockItem) => {
    setAccessories(prev => {
      const exists = prev.find(a => a.stockId === stockItem.id);
      if (exists) return prev.filter(a => a.stockId !== stockItem.id);
      return [...prev, { stockId: stockItem.id, name: stockItem.name, quantity: 1 }];
    });
  };
  const isSelected = (stockId) => accessories.some(a => a.stockId === stockId);
  const updateQty  = (stockId, qty, maxQty) => {
    const clamped = Math.max(1, Math.min(qty, maxQty));
    setAccessories(prev => prev.map(a => a.stockId === stockId ? { ...a, quantity: clamped } : a));
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPhotoPreview(ev.target.result); set('photoUrl', ev.target.result); };
    reader.readAsDataURL(file);
  };

  const handleDamagePhotos = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDamagePhotos(prev => prev.length < 6 ? [...prev, ev.target.result] : prev);
      };
      reader.readAsDataURL(file);
    });
    if (damageRef.current) damageRef.current.value = '';
  };
  const removeDamagePhoto = (idx) => setDamagePhotos(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      await allocateAsset(selectedAsset, {
        ...form,
        accessories:      accessories.map(a => `${a.name}${a.quantity > 1 ? ` x${a.quantity}` : ''}`),
        accessoryDetails: accessories,
        extra_ccs:        ccEmails,
        prepared_by:      form.preparedBy,
        damage_photos:    JSON.stringify(damagePhotos),
      });
      navigate('/allocation-list');
    } catch (_) { setSaving(false); }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Allocate Laptop</h1>
        <p>Assign a laptop from stock to an employee</p>
      </div>

      {/* ── Chatbot pre-fill banner ── */}
      <ChatbotBanner
        assetId={chatbotAssetId}
        onDismiss={() => setChatbotAssetId('')}
      />

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ══════════ LEFT COLUMN ══════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Select Asset */}
            <div className="card">
              <div className="section-title">
                Select Asset
                {chatbotAssetId && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600,
                    color: 'var(--accent)', background: 'rgba(99,102,241,0.1)',
                    padding: '2px 8px', borderRadius: 20, display: 'inline-flex',
                    alignItems: 'center', gap: 4 }}>
                    <Sparkles size={10} /> AI pre-filled
                  </span>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Asset Number *</label>
                <select className="form-select" required value={selectedAsset}
                  onChange={e => { setSelectedAsset(e.target.value); setChatbotAssetId(''); }}
                  style={chatbotAssetId ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : {}}>
                  <option value="">-- Select a laptop --</option>
                  {stockAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.asset_id || a.id} — {a.brand} {a.model} ({a.config})
                    </option>
                  ))}
                </select>
              </div>
              {asset && (
                <div style={{ marginTop: 8 }}>
                  {[
                    ['Asset Number',  asset.asset_id || asset.id, 'var(--accent)', 'var(--mono)'],
                    ['Serial Number', asset.serial,               null,            'var(--mono)'],
                    ['Brand / Model', `${asset.brand} ${asset.model}`],
                    ['Configuration', asset.config],
                    ['Warranty',      `${asset.warrantyStart} → ${asset.warrantyEnd}`],
                  ].map(([label, val, color, font]) => (
                    <div className="info-row" key={label}>
                      <span className="info-label">{label}</span>
                      <span className="info-value" style={{ color, fontFamily: font, fontSize: font ? 12 : undefined }}>
                        {val}
                      </span>
                    </div>
                  ))}
                  <div className="info-row">
                    <span className="info-label">Status</span>
                    <StatusBadge status={asset.status} />
                  </div>
                </div>
              )}
            </div>

            {/* Accessories */}
            <div className="card">
              <div className="section-title">
                <Package size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Accessories Included
                {accessories.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--green)',
                    background: 'var(--green-bg)', padding: '2px 8px', borderRadius: 20 }}>
                    {accessories.length} selected
                  </span>
                )}
              </div>
              {stockLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>Loading accessories…</div>
              ) : availableStock.length === 0 ? (
                <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 'var(--radius)',
                  fontSize: 13, color: 'var(--text-muted)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <Package size={20} style={{ marginBottom: 6, opacity: 0.4 }} /><br />No accessories in stock.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {availableStock.map(item => {
                    const selected = isSelected(item.id);
                    const selItem  = accessories.find(a => a.stockId === item.id);
                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        borderRadius: 'var(--radius)',
                        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        background: selected ? 'var(--accent-glow)' : 'var(--surface2)',
                        cursor: 'pointer', transition: 'all .2s',
                      }} onClick={() => toggleAcc(item)}>
                        <div style={{ flexShrink: 0 }}>
                          {selected ? <CheckSquare size={16} color="var(--accent)" /> : <Square size={16} style={{ opacity: 0.4 }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: selected ? 'var(--accent)' : 'var(--text)' }}>
                            {item.name}
                            {item.brand && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>{item.brand}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {item.quantity} in stock{item.location && ` · ${item.location}`}
                          </div>
                        </div>
                        {selected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={e => e.stopPropagation()}>
                            <button type="button" className="btn btn-icon" style={{ width: 24, height: 24, fontSize: 16 }}
                              onClick={() => updateQty(item.id, (selItem?.quantity || 1) - 1, item.quantity)}>−</button>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
                              {selItem?.quantity || 1}
                            </span>
                            <button type="button" className="btn btn-icon" style={{ width: 24, height: 24, fontSize: 16 }}
                              onClick={() => updateQty(item.id, (selItem?.quantity || 1) + 1, item.quantity)}>+</button>
                          </div>
                        )}
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, flexShrink: 0,
                          background: item.quantity < 3 ? 'rgba(251,191,36,.1)' : 'var(--green-bg)',
                          color: item.quantity < 3 ? '#f59e0b' : 'var(--green)',
                        }}>
                          {item.quantity < 3 ? 'Low' : 'In Stock'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Delivery Method */}
            <div className="card">
              <div className="section-title">
                <Truck size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Delivery Method
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {[
                  { value: 'hand',    label: 'Hand Delivery', icon: HandMetal, desc: 'Delivered in person at office' },
                  { value: 'courier', label: 'Courier',        icon: Truck,     desc: 'Shipped to employee address'  },
                ].map(opt => {
                  const Icon = opt.icon;
                  const sel  = form.deliveryMethod === opt.value;
                  return (
                    <label key={opt.value} style={{
                      flex: 1, display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                      borderRadius: 'var(--radius)',
                      border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                      background: sel ? 'var(--accent-glow)' : 'var(--surface2)',
                      cursor: 'pointer', transition: 'all .2s',
                    }}>
                      <input type="radio" name="delivery" value={opt.value} checked={sel}
                        onChange={() => set('deliveryMethod', opt.value)} style={{ display: 'none' }} />
                      <Icon size={18} color={sel ? 'var(--accent)' : 'var(--text-muted)'} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: sel ? 'var(--accent)' : 'var(--text)' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {form.deliveryMethod === 'courier' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Delivery Address *
                  </label>
                  <textarea className="form-textarea" required style={{ minHeight: 90 }}
                    value={form.deliveryAddress} onChange={e => set('deliveryAddress', e.target.value)}
                    placeholder="Full delivery address…" />
                </div>
              )}
            </div>

            {/* Condition / Damage Photos */}
            <div className="card">
              <div className="section-title">
                <ImagePlus size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Condition / Damage Photos
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  Optional · max 6
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Capture current condition before allocation (scratches, stickers, existing damage).
              </div>
              <input ref={damageRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={handleDamagePhotos} />
              {damagePhotos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  {damagePhotos.map((src, i) => (
                    <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden',
                      border: '1px solid var(--border)', aspectRatio: '1' }}>
                      <img src={src} alt={`Damage ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <button type="button" onClick={() => removeDamagePhoto(i)} style={{
                        position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,.85)',
                        border: 'none', borderRadius: '50%', width: 22, height: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#fff',
                      }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {damagePhotos.length < 6 && (
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => damageRef.current?.click()}
                  style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
                  <ImagePlus size={14} />
                  {damagePhotos.length === 0 ? 'Add Condition Photos' : `Add More Photos (${damagePhotos.length}/6)`}
                </button>
              )}
            </div>
          </div>

          {/* ══════════ RIGHT COLUMN ══════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Employee Selection */}
            <div className="card" style={{ overflow: 'visible' }}>
              <div className="section-title">
                <Users size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Select Employee
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 400, marginLeft: 8 }}>
                  Auto-fills all details
                </span>
              </div>
              <EmployeeDropdown
                employees={employees}
                selectedEmp={selectedEmp}
                onSelect={handleSelectEmployee}
                loading={empLoading}
              />
              <SelectedEmployeeCard emp={selectedEmp} onClear={clearEmployee} />
              {!selectedEmp && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--surface2)',
                  border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
                  fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Select an employee above to auto-fill all fields below
                </div>
              )}
            </div>

            {/* Employee Photo */}
            <div className="card">
              <div className="section-title">
                <Camera size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Employee Photo
                {selectedEmp?.photo_url && (
                  <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 400, marginLeft: 8 }}>
                    ✓ Auto-filled from employee record
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', background: 'var(--surface2)',
                  border: '2px dashed var(--border2)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                }} onClick={() => fileRef.current?.click()}>
                  {photoPreview
                    ? <img src={photoPreview} alt="Employee" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Camera size={24} color="var(--text-muted)" />
                  }
                </div>
                <div>
                  <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                    <Camera size={13} /> {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {photoPreview && (
                    <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }}
                      onClick={() => { setPhotoPreview(''); set('photoUrl', ''); if (fileRef.current) fileRef.current.value = ''; }}>
                      <X size={13} /> Remove
                    </button>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    Appears in allocation email &amp; QR card.
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Details */}
            <div className="card">
              <div className="section-title">
                Employee Details
                {selectedEmp && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                    Pre-filled — edit if needed
                  </span>
                )}
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Employee ID *</label>
                  <input className="form-input" required value={form.empId}
                    onChange={e => set('empId', e.target.value)} placeholder="EMP-1001"
                    style={selectedEmp ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : {}} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input className="form-input" type="tel" value={form.mobileNo}
                    onChange={e => set('mobileNo', e.target.value)} placeholder="+91 98765 43210"
                    style={selectedEmp?.mobile_no ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : {}} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Employee Name *</label>
                <input className="form-input" required value={form.empName}
                  onChange={e => set('empName', e.target.value)} placeholder="Jacob Thomas"
                  style={selectedEmp ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : {}} />
              </div>
              <div className="form-group">
                <label className="form-label">Work Email *</label>
                <input type="email" className="form-input" required value={form.empEmail}
                  onChange={e => set('empEmail', e.target.value)} placeholder="jacob@mindteck.com"
                  style={selectedEmp?.company_email ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : {}} />
              </div>
              <div className="form-group">
                <label className="form-label">Personal Email</label>
                <input type="email" className="form-input" value={form.personalEmail}
                  onChange={e => set('personalEmail', e.target.value)} placeholder="jacob@gmail.com"
                  style={selectedEmp?.personal_email ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : {}} />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Email also sent here</div>
              </div>
              <div className="form-group">
                <label className="form-label">Department / Service Line</label>
                <input className="form-input" value={form.department}
                  onChange={e => set('department', e.target.value)} placeholder="Engineering"
                  style={selectedEmp?.service_line ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : {}} />
              </div>
              <div className="section-title" style={{ marginTop: 8 }}>Project Details</div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Client</label>
                  <input className="form-input" value={form.client}
                    onChange={e => set('client', e.target.value)} placeholder="Client Name"
                    style={selectedEmp?.client ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : {}} />
                </div>
                <div className="form-group">
                  <label className="form-label">Project</label>
                  <input className="form-input" value={form.project}
                    onChange={e => set('project', e.target.value)} placeholder="Project Name" />
                </div>
              </div>
              <div className="section-title" style={{ marginTop: 8 }}>Allocation</div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Allocation Date *</label>
                  <input type="date" className="form-input" required value={form.allocationDate}
                    onChange={e => set('allocationDate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <User size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    Prepared By *
                  </label>
                  <input className="form-input" required value={form.preparedBy}
                    onChange={e => set('preparedBy', e.target.value)} placeholder="IT Staff name" />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    Auto-filled from your login
                  </div>
                </div>
              </div>
            </div>

            {/* CC Emails */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 10 }}>
                <FileText size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                CC Emails for Notification
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, padding: '8px 12px',
                background: 'rgba(79,142,247,.06)', border: '1px solid rgba(79,142,247,.15)', borderRadius: 'var(--radius)' }}>
                Allocation email + signed agreement DOCX will be sent to employee.<br />
                sysadmin and your account are always CC'd automatically.
              </div>
              <CCEmailInput ccEmails={ccEmails} onChange={setCCEmails} />
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }}
                onClick={() => navigate('/inventory')}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}
                disabled={!selectedAsset || saving}>
                <Send size={15} /> {saving ? 'Allocating…' : 'Allocate Laptop'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}