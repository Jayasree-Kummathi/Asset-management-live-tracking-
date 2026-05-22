import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import QRBulkImport from './QRBulkImport';
import StatusBadge from '../components/common/StatusBadge';
import {
  Plus, Search, Send, Eye, X,
  Calendar, Cpu, Edit2, Trash2,
  Upload, FileText, CheckCircle,
  Camera, ScanLine, QrCode, RefreshCw,
  AlertTriangle, Clock, Download, ChevronDown,
  CheckSquare, Square, History,
  TrendingUp, Package, Wrench, Archive,
  Bell, XCircle, ArrowLeft, ChevronRight, Save
} from 'lucide-react';
import './Inventory.css';

const EMPTY_FORM = {
  id: '', serial: '', brand: '', model: '', config: '',
  processor: '', ram: '', storage: '',
  purchaseDate: '', warrantyStart: '', warrantyEnd: '',
  vendor: '', location: '', notes: ''
};

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const toDateOnly = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];
  const dmyMatch = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const mdyMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
};

const daysFromNow = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
};

const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...opts
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const exportToExcel = (assets, allocLookup) => {
  const headers = [
    'Asset No', 'Serial', 'Brand', 'Model', 'Configuration',
    'Processor', 'RAM', 'Storage', 'Status',
    'Purchase Date', 'Warranty Start', 'Warranty End', 'Vendor',
    'Allocated To', 'Employee ID', 'Department', 'Location', 'Notes'
  ];
  const rows = assets.map(a => {
    const alloc = allocLookup[a.id] || {};
    return [
      a.id, a.serial, a.brand, a.model, a.config || '',
      a.processor || '', a.ram || '', a.storage || '', a.status || 'Stock',
      a.purchaseDate || '', a.warrantyStart || '', a.warrantyEnd || '', a.vendor || '',
      alloc.empName || '', alloc.empId || '', alloc.department || '',
      a.location || '', a.notes || ''
    ];
  });
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `asset-inventory-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// ── Shared page header (breadcrumb + back) ─────────────────────────────────────
function PageHeader({ crumbs, onBack }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24, paddingBottom:16, borderBottom:'1px solid var(--border)' }}>
      <button className="btn btn-secondary" onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6 }}>
        <ArrowLeft size={15} /> Back
      </button>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-muted)', flexWrap:'wrap' }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={13} />}
            {c.onClick
              ? <span style={{ cursor:'pointer', color:'var(--accent)' }} onClick={c.onClick}>{c.label}</span>
              : <span style={{ color:'var(--text)', fontWeight:600, fontFamily: c.mono ? 'var(--mono)' : undefined }}>{c.label}</span>
            }
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── WARRANTY ALERTS ────────────────────────────────────────────────────────────
function WarrantyAlerts({ assets }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(false);
  const alerts = assets
    .filter(a => a.warrantyEnd)
    .map(a => ({ ...a, daysLeft: daysFromNow(a.warrantyEnd) }))
    .filter(a => a.daysLeft !== null && a.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .filter(a => !dismissed.has(a.id));
  if (alerts.length === 0) return null;
  const critical = alerts.filter(a => a.daysLeft < 0);
  const urgent   = alerts.filter(a => a.daysLeft >= 0 && a.daysLeft <= 30);
  const warning  = alerts.filter(a => a.daysLeft > 30);
  const shown    = expanded ? alerts : alerts.slice(0, 3);
  return (
    <div className="warranty-alert-banner">
      <div className="warranty-alert-header">
        <div className="warranty-alert-title">
          <Bell size={15} /><strong>Warranty Alerts</strong>
          <span className="warranty-alert-counts">
            {critical.length > 0 && <span className="wac-chip wac-expired">{critical.length} expired</span>}
            {urgent.length > 0   && <span className="wac-chip wac-urgent">{urgent.length} ≤30 days</span>}
            {warning.length > 0  && <span className="wac-chip wac-warn">{warning.length} ≤90 days</span>}
          </span>
        </div>
        <button className="btn btn-icon btn-sm" onClick={() => setDismissed(new Set(alerts.map(a => a.id)))}><X size={14} /></button>
      </div>
      <div className="warranty-alert-list">
        {shown.map(a => {
          const isExpired = a.daysLeft < 0;
          const isUrgent  = !isExpired && a.daysLeft <= 30;
          return (
            <div key={a.id} className={`warranty-alert-item ${isExpired ? 'wai-expired' : isUrgent ? 'wai-urgent' : 'wai-warn'}`}>
              <AlertTriangle size={13} />
              <span className="wai-id">{a.id}</span>
              <span className="wai-device">{a.brand} {a.model}</span>
              <span className="wai-date">{a.warrantyEnd}</span>
              <span className="wai-status">
                {isExpired ? `Expired ${Math.abs(a.daysLeft)}d ago` : a.daysLeft === 0 ? 'Expires today' : `${a.daysLeft}d left`}
              </span>
              <button className="btn btn-icon btn-xs" onClick={() => setDismissed(s => new Set([...s, a.id]))}><X size={11} /></button>
            </div>
          );
        })}
      </div>
      {alerts.length > 3 && (
        <button className="warranty-show-more" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `Show ${alerts.length - 3} more`}
          <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      )}
    </div>
  );
}

// ── ADD ASSET PAGE ─────────────────────────────────────────────────────────────
function AddAssetPage({ onBack, onSaved, addAsset }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanFlash, setScanFlash] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addAsset({
        ...form,
        purchaseDate: toDateOnly(form.purchaseDate),
        warrantyStart: toDateOnly(form.warrantyStart),
        warrantyEnd: toDateOnly(form.warrantyEnd)
      });
      if (onSaved) onSaved();
      onBack();
    } catch (_) {}
    finally { setSaving(false); }
  };

  const handleScanResult = (data) => {
    setShowScanner(false);
    setForm(f => ({
      ...f,
      id: data.asset_id || f.id,
      serial: data.serial || data.serial_number || f.serial,
      brand: data.brand || f.brand,
      model: data.model || f.model,
      config: data.config || data.configuration || f.config,
      processor: data.processor || data.cpu || f.processor,
      ram: data.ram || data.memory || f.ram,
      storage: data.storage || data.disk || f.storage,
      location: data.location || f.location,
      vendor: data.vendor || f.vendor
    }));
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 1500);
  };

  return (
    <div className="fade-in" style={{ animation: 'slideInPage 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInPage{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>

      <PageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Inventory', onClick: onBack },
          { label: 'Add New Asset' }
        ]}
      />

      {showScanner && <BarcodeScannerModal onResult={handleScanResult} onClose={() => setShowScanner(false)} />}

      <div className="card" style={{ padding: '28px 32px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ fontSize:17, fontWeight:700, margin:0 }}>
            <Plus size={16} style={{ verticalAlign:'middle', marginRight:8, color:'var(--accent)' }}/>
            Add New Asset
          </h2>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {scanFlash && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--green)', background:'var(--green-bg)', padding:'3px 10px', borderRadius:20 }}>
                <CheckCircle size={12}/> Fields filled from QR
              </span>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setShowScanner(true)}>
              <ScanLine size={14}/> Scan QR
            </button>
          </div>
        </div>

        <form onSubmit={handleAdd}>
          <div className="section-title">Basic Info</div>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Asset Number *</label>
              <input className={`form-input${scanFlash && form.id ? ' scan-filled' : ''}`} required value={form.id} onChange={e => set('id', e.target.value)} placeholder="AST0001" />
            </div>
            <div className="form-group">
              <label className="form-label">Serial Number *</label>
              <input className={`form-input${scanFlash && form.serial ? ' scan-filled' : ''}`} required value={form.serial} onChange={e => set('serial', e.target.value)} placeholder="SN00001" />
            </div>
            <div className="form-group">
              <label className="form-label">Brand *</label>
              <input className={`form-input${scanFlash && form.brand ? ' scan-filled' : ''}`} required value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Dell" />
            </div>
            <div className="form-group">
              <label className="form-label">Model *</label>
              <input className={`form-input${scanFlash && form.model ? ' scan-filled' : ''}`} required value={form.model} onChange={e => set('model', e.target.value)} placeholder="Latitude 5540" />
            </div>
            <div className="form-group">
              <label className="form-label">Configuration</label>
              <input className={`form-input${scanFlash && form.config ? ' scan-filled' : ''}`} value={form.config} onChange={e => set('config', e.target.value)} placeholder="i7 / 16GB / 512GB SSD" />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className={`form-input${scanFlash && form.location ? ' scan-filled' : ''}`} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Bengaluru" />
            </div>
          </div>

          <div className="section-title">Specifications</div>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Processor</label>
              <input className={`form-input${scanFlash && form.processor ? ' scan-filled' : ''}`} value={form.processor} onChange={e => set('processor', e.target.value)} placeholder="Intel i7-1355U" />
            </div>
            <div className="form-group">
              <label className="form-label">RAM</label>
              <input className={`form-input${scanFlash && form.ram ? ' scan-filled' : ''}`} value={form.ram} onChange={e => set('ram', e.target.value)} placeholder="16GB DDR5" />
            </div>
            <div className="form-group">
              <label className="form-label">Storage</label>
              <input className={`form-input${scanFlash && form.storage ? ' scan-filled' : ''}`} value={form.storage} onChange={e => set('storage', e.target.value)} placeholder="512GB NVMe SSD" />
            </div>
          </div>

          <div className="section-title">Purchase &amp; Warranty</div>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input type="date" className="form-input" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Warranty Start</label>
              <input type="date" className="form-input" value={form.warrantyStart} onChange={e => set('warrantyStart', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Warranty End</label>
              <input type="date" className="form-input" value={form.warrantyEnd} onChange={e => set('warrantyEnd', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Vendor</label>
              <input className="form-input" value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="Dell India" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" />
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8, paddingTop:16, borderTop:'1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Plus size={15}/> {saving ? 'Saving…' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ASSET DETAIL PAGE ──────────────────────────────────────────────────────────
function AssetDetailPage({ asset, allocLookup, onBack, onEdit, onHistory, isAdmin, navigate }) {
  const expired        = asset.warrantyEnd && new Date(asset.warrantyEnd) < new Date();
  const daysLeft       = daysFromNow(asset.warrantyEnd);
  const warrantyUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
  const alloc          = allocLookup[asset.id];
  const warrantyColor  = expired ? 'var(--red)' : warrantyUrgent ? '#f59e0b' : 'var(--green)';

  return (
    <div className="fade-in">
      <PageHeader
        onBack={onBack}
        crumbs={[
          { label: 'Inventory', onClick: onBack },
          { label: asset.id, mono: true }
        ]}
      />

      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ padding:'8px 16px', borderRadius:10, background:'var(--accent-glow)', border:'1px solid var(--accent)', fontFamily:'var(--mono)', fontSize:18, fontWeight:700, color:'var(--accent)' }}>
              {asset.id}
            </div>
            <div>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{asset.brand} {asset.model}</h2>
              <div style={{ fontSize:13, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>Serial: {asset.serial}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <StatusBadge status={asset.status} />
            <button className="btn btn-secondary btn-sm" onClick={onHistory}><History size={13}/> History</button>
            {isAdmin && <button className="btn btn-secondary btn-sm" onClick={onEdit}><Edit2 size={13}/> Edit</button>}
            {asset.status === 'Stock' && (
              <button className="btn btn-success btn-sm" onClick={() => navigate('/allocate', { state:{ assetId: asset.id } })}>
                <Send size={13}/> Allocate
              </button>
            )}
          </div>
        </div>
      </div>

      {(expired || warrantyUrgent) && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', marginBottom:20, background: expired ? 'var(--red-bg)' : 'rgba(251,191,36,.1)', border:`1px solid ${expired ? 'var(--red)' : '#f59e0b'}`, borderRadius:'var(--radius)', color: expired ? 'var(--red)' : '#f59e0b', fontWeight:600, fontSize:13 }}>
          <AlertTriangle size={16} />
          {expired ? `Warranty expired ${Math.abs(daysLeft)} days ago` : `Warranty expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — renew soon`}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="card">
            <div className="section-title"><Cpu size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>Specifications</div>
            <div className="info-row"><span className="info-label">Configuration</span><span className="info-value">{asset.config || '—'}</span></div>
            <div className="info-row"><span className="info-label">Processor</span><span className="info-value">{asset.processor || '—'}</span></div>
            <div className="info-row"><span className="info-label">RAM</span><span className="info-value">{asset.ram || '—'}</span></div>
            <div className="info-row"><span className="info-label">Storage</span><span className="info-value">{asset.storage || '—'}</span></div>
            <div className="info-row"><span className="info-label">Location</span><span className="info-value">{asset.location || '—'}</span></div>
          </div>
          <div className="card">
            <div className="section-title"><Send size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>Allocation</div>
            {alloc ? (
              <>
                <div className="info-row"><span className="info-label">Allocated To</span><span className="info-value" style={{ fontWeight:700 }}>{alloc.empName}</span></div>
                <div className="info-row"><span className="info-label">Employee ID</span><span className="info-value" style={{ fontFamily:'var(--mono)', fontSize:12 }}>{alloc.empId}</span></div>
                {alloc.department && <div className="info-row"><span className="info-label">Department</span><span className="info-value">{alloc.department}</span></div>}
              </>
            ) : <div style={{ fontSize:13, color:'var(--text-muted)', padding:'8px 0' }}>Not currently allocated</div>}
          </div>
          {asset.notes && (
            <div className="card">
              <div className="section-title">Notes</div>
              <div style={{ fontSize:13, color:'var(--text-dim)', lineHeight:1.6 }}>{asset.notes}</div>
            </div>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="card">
            <div className="section-title"><Calendar size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>Purchase &amp; Warranty</div>
            <div className="info-row"><span className="info-label">Purchase Date</span><span className="info-value" style={{ fontFamily:'var(--mono)', fontSize:12 }}>{asset.purchaseDate || '—'}</span></div>
            <div className="info-row"><span className="info-label">Vendor</span><span className="info-value">{asset.vendor || '—'}</span></div>
            <div className="info-row"><span className="info-label">Warranty Start</span><span className="info-value" style={{ fontFamily:'var(--mono)', fontSize:12 }}>{asset.warrantyStart || '—'}</span></div>
            <div className="info-row">
              <span className="info-label">Warranty End</span>
              <span className="info-value" style={{ fontFamily:'var(--mono)', fontSize:12, color:warrantyColor }}>
                {asset.warrantyEnd || '—'}
                {expired && <span style={{ fontSize:10, marginLeft:8, background:'var(--red-bg)', color:'var(--red)', padding:'1px 6px', borderRadius:4 }}>Expired</span>}
                {warrantyUrgent && !expired && <span style={{ fontSize:10, marginLeft:8, background:'rgba(251,191,36,.12)', color:'#f59e0b', padding:'1px 6px', borderRadius:4 }}>{daysLeft}d left</span>}
              </span>
            </div>
          </div>
          <div className="card">
            <div className="section-title">Quick Actions</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button className="btn btn-secondary" style={{ justifyContent:'flex-start' }} onClick={onHistory}><History size={14}/> View Activity History</button>
              {isAdmin && <button className="btn btn-secondary" style={{ justifyContent:'flex-start' }} onClick={onEdit}><Edit2 size={14}/> Edit Asset Details</button>}
              {asset.status === 'Stock' && (
                <button className="btn btn-success" style={{ justifyContent:'flex-start' }} onClick={() => navigate('/allocate', { state:{ assetId: asset.id } })}>
                  <Send size={14}/> Allocate to Employee
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop:28, paddingTop:20, borderTop:'1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={15}/> Back to Inventory</button>
      </div>
    </div>
  );
}

// ── ASSET EDIT PAGE ──────────────────────────────────────────────────────────
function AssetEditPage({ asset, onBack, onSaved }) {
  const [form, setForm] = useState({
    serial: asset.serial || '', brand: asset.brand || '', model: asset.model || '',
    config: asset.config || '', processor: asset.processor || '', ram: asset.ram || '',
    storage: asset.storage || '', purchaseDate: asset.purchaseDate || '',
    warrantyStart: asset.warrantyStart || '', warrantyEnd: asset.warrantyEnd || '',
    vendor: asset.vendor || '', location: asset.location || '', notes: asset.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch(`/assets/${asset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          serial: form.serial, brand: form.brand, model: form.model, config: form.config,
          processor: form.processor, ram: form.ram, storage: form.storage,
          purchase_date: toDateOnly(form.purchaseDate), warranty_start: toDateOnly(form.warrantyStart),
          warranty_end: toDateOnly(form.warrantyEnd), vendor: form.vendor,
          location: form.location, notes: form.notes
        })
      });
      if (onSaved) onSaved();
      onBack();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ animation: 'slideInPage 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInPage{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <PageHeader onBack={onBack} crumbs={[{ label:'Inventory', onClick: onBack }, { label: asset.id, mono:true, onClick: onBack }, { label:'Edit Asset' }]} />

      <div className="card" style={{ padding:'28px 32px' }}>
        <form onSubmit={handleSave}>
          <div className="section-title">Basic Info</div>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Asset Number</label>
              <input className="form-input" value={asset.id} disabled style={{ opacity:0.6, background:'var(--surface2)' }}/>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Asset ID cannot be changed</div>
            </div>
            <div className="form-group"><label className="form-label">Serial *</label><input className="form-input" required value={form.serial} onChange={e => setField('serial', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Brand *</label><input className="form-input" required value={form.brand} onChange={e => setField('brand', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Model *</label><input className="form-input" required value={form.model} onChange={e => setField('model', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Configuration</label><input className="form-input" value={form.config} onChange={e => setField('config', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={e => setField('location', e.target.value)}/></div>
          </div>
          <div className="section-title">Specifications</div>
          <div className="form-grid form-grid-3">
            <div className="form-group"><label className="form-label">Processor</label><input className="form-input" value={form.processor} onChange={e => setField('processor', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">RAM</label><input className="form-input" value={form.ram} onChange={e => setField('ram', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Storage</label><input className="form-input" value={form.storage} onChange={e => setField('storage', e.target.value)}/></div>
          </div>
          <div className="section-title">Purchase &amp; Warranty</div>
          <div className="form-grid form-grid-3">
            <div className="form-group"><label className="form-label">Purchase Date</label><input type="date" className="form-input" value={form.purchaseDate} onChange={e => setField('purchaseDate', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Warranty Start</label><input type="date" className="form-input" value={form.warrantyStart} onChange={e => setField('warrantyStart', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Warranty End</label><input type="date" className="form-input" value={form.warrantyEnd} onChange={e => setField('warrantyEnd', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Vendor</label><input className="form-input" value={form.vendor} onChange={e => setField('vendor', e.target.value)}/></div>
          </div>
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)}/></div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8, paddingTop:16, borderTop:'1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}><Save size={14}/> {saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ASSET HISTORY PAGE ─────────────────────────────────────────────────────────
function AssetHistoryPage({ asset, onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const data = await apiFetch(`/audit?asset_id=${asset.id}&limit=100`); setHistory(data.data || []); }
      catch { setHistory([]); }
      finally { setLoading(false); }
    })();
  }, [asset.id]);

  const ACTION_META = {
    ASSET_ADDED:           { color:'var(--green)',       label:'Added',       icon:<Package size={13}/>,      bg:'rgba(52,211,153,0.1)' },
    ASSET_UPDATED:         { color:'var(--accent)',      label:'Updated',     icon:<Edit2 size={13}/>,        bg:'rgba(99,102,241,0.1)' },
    ASSET_ALLOCATED:       { color:'#818cf8',            label:'Allocated',   icon:<Send size={13}/>,         bg:'rgba(129,140,248,0.1)' },
    ASSET_RECEIVED:        { color:'var(--green)',       label:'Received',    icon:<RefreshCw size={13}/>,    bg:'rgba(52,211,153,0.1)' },
    ASSET_SENT_FOR_REPAIR: { color:'#f59e0b',            label:'Sent Repair', icon:<Wrench size={13}/>,       bg:'rgba(251,191,36,0.1)' },
    ASSET_REPAIRED:        { color:'var(--green)',       label:'Repaired',    icon:<CheckCircle size={13}/>,  bg:'rgba(52,211,153,0.1)' },
    ASSET_SCRAPPED:        { color:'var(--red)',         label:'Scrapped',    icon:<Archive size={13}/>,      bg:'rgba(248,113,113,0.1)' },
    ASSET_DELETED:         { color:'var(--red)',         label:'Deleted',     icon:<Trash2 size={13}/>,       bg:'rgba(248,113,113,0.1)' },
    DEFAULT:               { color:'var(--text-muted)', label:'Event',       icon:<Clock size={13}/>,        bg:'var(--surface2)' },
  };
  const getMeta  = (action) => ACTION_META[action] || ACTION_META.DEFAULT;
  const relTime  = (d) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff/60000), hrs = Math.floor(diff/3600000), days = Math.floor(diff/86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  };
  const groupedHistory = history.reduce((acc, log) => {
    const date = log.created_at ? new Date(log.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <div className="fade-in" style={{ animation:'slideInPage 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`
        @keyframes slideInPage{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
        .history-timeline{display:flex;flex-direction:column;gap:0}
        .history-item{display:flex;gap:14px;animation:invFadeIn 0.25s ease both}
        .history-line-wrap{display:flex;flex-direction:column;align-items:center;width:32px;flex-shrink:0}
        .history-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .history-connector{width:2px;flex:1;min-height:16px;background:var(--border);margin:4px 0}
        .history-content{flex:1;padding-bottom:18px}
        .history-content-top{display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap}
        .history-event-label{font-size:12px;font-weight:700}
        .history-by{font-size:11px;color:var(--text-muted)}
        .history-time{font-size:11px;color:var(--text-muted);margin-left:auto}
        .history-detail{font-size:12.5px;color:var(--text-dim);line-height:1.45;margin-bottom:3px}
        .history-timestamp{font-size:11px;color:var(--text-muted);font-family:var(--mono)}
        .history-group-date{display:flex;align-items:center;gap:10px;margin:16px 0 8px 0;padding:0 0 0 42px}
        .history-group-date span{font-size:12px;font-weight:600;color:var(--text-muted);background:var(--surface2);padding:4px 12px;border-radius:20px}
        @keyframes invFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
      `}</style>

      <PageHeader onBack={onBack} crumbs={[{ label:'Inventory', onClick: onBack }, { label: asset.id, mono:true, onClick: onBack }, { label:'Activity History' }]} />

      <div className="card" style={{ padding:'24px 28px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <History size={20} style={{ color:'var(--accent)' }}/>
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, margin:0 }}>Activity History</h2>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{asset.id} · {asset.brand} {asset.model}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height:72, borderRadius:8, background:'var(--surface2)', animation:'shimmer 1.4s infinite', animationDelay:`${i*80}ms` }}/>)}
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state"><Clock size={32} style={{ opacity:0.3 }}/><p>No history recorded for this asset</p></div>
        ) : (
          <div className="history-timeline">
            {Object.entries(groupedHistory).map(([date, logs]) => (
              <div key={date}>
                <div className="history-group-date"><span>{date}</span></div>
                {logs.map((log, idx) => {
                  const meta = getMeta(log.action);
                  return (
                    <div key={log.id || idx} className="history-item" style={{ animationDelay:`${idx*45}ms` }}>
                      <div className="history-line-wrap">
                        <div className="history-dot" style={{ background:`${meta.color}18`, color:meta.color, border:`1.5px solid ${meta.color}` }}>{meta.icon}</div>
                        {idx < logs.length - 1 && <div className="history-connector"/>}
                      </div>
                      <div className="history-content">
                        <div className="history-content-top">
                          <span className="history-event-label" style={{ color:meta.color }}>{meta.label}</span>
                          <span className="history-by">by {log.performed_by || 'System'}</span>
                          <span className="history-time">{relTime(log.created_at)}</span>
                        </div>
                        <div className="history-detail">{log.detail || '—'}</div>
                        <div className="history-timestamp">
                          {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onBack}>Back to Asset</button>
        </div>
      </div>
    </div>
  );
}

// ── BULK IMPORT PAGE ───────────────────────────────────────────────────────────
function BulkImportPage({ onBack, onImported }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [result,  setResult]  = useState(null);
  const [saving,  setSaving]  = useState(false);

  const SAMPLE = `asset_id,serial,brand,model,config,processor,ram,storage,purchase_date,warranty_start,warranty_end,vendor,location\nLTB-280,DX100,Dell,Latitude 5540,i7 / 16GB / 512GB SSD,Intel i7-1355U,16GB DDR5,512GB NVMe,2024-01-10,2024-01-10,2027-01-10,Dell India,Bengaluru`;

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  };

  const handleParse  = () => { setPreview(parseCSV(csvText)); setResult(null); };
  const handleImport = async () => {
    setSaving(true);
    try {
      const sanitized = preview.map(row => ({
        ...row,
        purchase_date:   toDateOnly(row.purchase_date),
        warranty_start:  toDateOnly(row.warranty_start),
        warranty_end:    toDateOnly(row.warranty_end)
      }));
      const data = await apiFetch('/assets/bulk', { method:'POST', body: JSON.stringify({ assets: sanitized }) });
      setResult(data.data);
      if (data.data.created.length > 0) onImported();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ animation:'slideInPage 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInPage{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <PageHeader onBack={onBack} crumbs={[{ label:'Inventory', onClick: onBack }, { label:'Bulk Import Assets' }]} />

      <div className="card" style={{ padding:'28px 32px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <Upload size={18} style={{ color:'var(--accent)' }}/>
          <h2 style={{ fontSize:17, fontWeight:700, margin:0 }}>Bulk Import Assets</h2>
        </div>

        {result ? (
          <div>
            <div style={{ display:'flex', gap:16, marginBottom:20 }}>
              <div style={{ flex:1, padding:24, background:'var(--green-bg)', border:'1px solid rgba(52,211,153,.2)', borderRadius:'var(--radius)', textAlign:'center' }}>
                <div style={{ fontSize:36, fontWeight:800, color:'var(--green)', fontFamily:'var(--mono)' }}>{result.created.length}</div>
                <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Created Successfully</div>
              </div>
              <div style={{ flex:1, padding:24, background:'var(--red-bg)', border:'1px solid rgba(248,113,113,.2)', borderRadius:'var(--radius)', textAlign:'center' }}>
                <div style={{ fontSize:36, fontWeight:800, color:'var(--red)', fontFamily:'var(--mono)' }}>{result.failed.length}</div>
                <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Failed</div>
              </div>
            </div>
            {result.failed.map((f, i) => <div key={i} style={{ fontSize:12, color:'var(--red)', marginBottom:4 }}>{f.id}: {f.reason}</div>)}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:24, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={onBack}>Back to Inventory</button>
              <button className="btn btn-primary" onClick={() => { setResult(null); setPreview([]); setCsvText(''); }}>Import More</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <label className="form-label">Paste CSV Data</label>
                <button className="btn btn-secondary btn-sm" onClick={() => setCsvText(SAMPLE)}><FileText size={13}/> Load Sample</button>
              </div>
              <textarea
                className="form-textarea"
                style={{ minHeight:200, fontFamily:'var(--mono)', fontSize:12 }}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="asset_id,serial,brand,model,config,processor,ram,storage,purchase_date,warranty_start,warranty_end,vendor,location"
              />
            </div>

            {preview.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:'var(--text-muted)' }}>
                  Preview — <span style={{ color:'var(--accent)', fontFamily:'var(--mono)' }}>{preview.length}</span> rows
                </div>
                <div style={{ maxHeight:240, overflowY:'auto' }} className="table-wrap">
                  <table>
                    <thead><tr><th>Asset ID</th><th>Serial</th><th>Brand</th><th>Model</th><th>Location</th></tr></thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)' }}>{r.asset_id}</td>
                          <td style={{ fontFamily:'var(--mono)', fontSize:12 }}>{r.serial}</td>
                          <td>{r.brand}</td><td>{r.model}</td><td>{r.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
              <button className="btn btn-secondary" onClick={handleParse} disabled={!csvText.trim()}><FileText size={14}/> Parse CSV</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={preview.length === 0 || saving}>
                <Upload size={14}/> {saving ? 'Importing…' : `Import ${preview.length > 0 ? preview.length + ' ' : ''}Assets`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── QR IMPORT PAGE (wraps existing QRBulkImport component inline) ──────────────
function QRImportPage({ onBack, onImported, allAssets, defaultTab }) {
  return (
    <div className="fade-in" style={{ animation:'slideInPage 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInPage{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <PageHeader
        onBack={onBack}
        crumbs={[
          { label:'Inventory', onClick: onBack },
          { label: defaultTab === 'reprint' ? 'Reprint QR Codes' : 'Import & QR Codes' }
        ]}
      />
      {/* QRBulkImport renders its own card/UI — pass an inline-friendly noop for onClose */}
      <QRBulkImport
        onImported={onImported}
        onClose={onBack}
        allAssets={allAssets}
        defaultTab={defaultTab}
        inline={true}
      />
    </div>
  );
}

// ── BULK STATUS PAGE ───────────────────────────────────────────────────────────
function BulkStatusPage({ action, selectedIds, onBack, onDone }) {
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);

  const META = {
    repair: { label:'Send to Repair', color:'#f59e0b', bg:'rgba(251,191,36,.12)', icon:<Wrench size={18}/>, inputLabel:'Issue / Reason for Repair *', inputHint:'e.g. Screen cracked, keyboard not working' },
    scrap:  { label:'Scrap Assets',   color:'var(--red)', bg:'var(--red-bg)',      icon:<Archive size={18}/>, inputLabel:'Reason for Scrapping *',        inputHint:'e.g. Motherboard failure — beyond economical repair' },
  };
  const m = META[action] || {};

  const handleConfirm = async () => {
    setLoading(true);
    const failed = [], succeeded = [];
    try {
      const today = new Date().toISOString().split('T')[0];
      await Promise.all([...selectedIds].map(async id => {
        try {
          if (action === 'repair') {
            await apiFetch('/repairs', { method:'POST', body: JSON.stringify({ asset_id: id, issue: reason, repair_date: today }) });
          } else {
            await apiFetch('/scraps', { method:'POST', body: JSON.stringify({ asset_id: id, reason }) });
          }
          succeeded.push(id);
        } catch (e) { failed.push({ id, reason: e.message }); }
      }));
      setResult({ succeeded, failed });
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fade-in" style={{ animation:'slideInPage 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInPage{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <PageHeader onBack={onBack} crumbs={[{ label:'Inventory', onClick: onBack }, { label: m.label }]} />

      <div className="card" style={{ padding:'28px 32px', maxWidth:640 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <span style={{ color: m.color }}>{m.icon}</span>
          <h2 style={{ fontSize:17, fontWeight:700, margin:0 }}>{m.label}</h2>
        </div>

        {result ? (
          <div>
            <div style={{ display:'flex', gap:16, marginBottom:20 }}>
              <div style={{ flex:1, padding:20, background:'var(--green-bg)', border:'1px solid rgba(52,211,153,.2)', borderRadius:'var(--radius)', textAlign:'center' }}>
                <div style={{ fontSize:32, fontWeight:800, color:'var(--green)', fontFamily:'var(--mono)' }}>{result.succeeded.length}</div>
                <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>
                  {action === 'repair' ? 'Sent for Repair' : 'Scrapped'}
                </div>
              </div>
              {result.failed.length > 0 && (
                <div style={{ flex:1, padding:20, background:'var(--red-bg)', border:'1px solid rgba(248,113,113,.2)', borderRadius:'var(--radius)', textAlign:'center' }}>
                  <div style={{ fontSize:32, fontWeight:800, color:'var(--red)', fontFamily:'var(--mono)' }}>{result.failed.length}</div>
                  <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Failed</div>
                </div>
              )}
            </div>
            {result.failed.map((f, i) => (
              <div key={i} style={{ fontSize:12, color:'var(--red)', marginBottom:4 }}>{f.id}: {f.reason}</div>
            ))}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:24, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <button className="btn btn-primary" onClick={onDone}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding:'16px 18px', background: m.bg, border:`1px solid ${m.color}33`, borderRadius:'var(--radius)', marginBottom:24, display:'flex', gap:14, alignItems:'flex-start' }}>
              <span style={{ color: m.color, marginTop:2 }}>{m.icon}</span>
              <div style={{ fontSize:13 }}>
                <strong style={{ fontFamily:'var(--mono)', fontSize:15 }}>{selectedIds.size}</strong> asset{selectedIds.size !== 1 ? 's' : ''} will be marked as{' '}
                <strong style={{ color: m.color }}>{action === 'repair' ? 'In Repair' : 'Scrap'}</strong>.
                <div style={{ color:'var(--text-muted)', marginTop:6, fontSize:12 }}>
                  {action === 'repair'
                    ? 'A repair record will be created for each asset in the Repair Assets page.'
                    : 'A scrap record will be created for each asset in the Scrap Assets page.'}
                </div>
                <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:5 }}>
                  {[...selectedIds].map(id => (
                    <span key={id} style={{ fontFamily:'var(--mono)', fontSize:11, background:'var(--surface2)', padding:'2px 8px', borderRadius:4, color:'var(--text-dim)' }}>{id}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom:24 }}>
              <label className="form-label">{m.inputLabel}</label>
              <textarea className="form-textarea" style={{ minHeight:100 }} placeholder={m.inputHint} value={reason} onChange={e => setReason(e.target.value)}/>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
              <button
                className={`btn ${action === 'scrap' ? 'btn-danger' : 'btn-primary'}`}
                style={action === 'repair' ? { background:'#f59e0b', borderColor:'#f59e0b' } : {}}
                onClick={handleConfirm}
                disabled={loading || !reason.trim()}
              >
                {loading ? 'Processing…' : m.label}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── DELETE CONFIRM PAGE ────────────────────────────────────────────────────────
function DeleteConfirmPage({ asset, onBack, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/assets/${asset.id}`, { method:'DELETE' });
      onDeleted();
    } catch (err) { alert(err.message); }
    finally { setDeleting(false); }
  };

  return (
    <div className="fade-in" style={{ animation:'slideInPage 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>
      <style>{`@keyframes slideInPage{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <PageHeader onBack={onBack} crumbs={[{ label:'Inventory', onClick: onBack }, { label:'Delete Asset' }]} />

      <div className="card" style={{ padding:'28px 32px', maxWidth:520 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <span style={{ color:'var(--red)' }}><Trash2 size={20}/></span>
          <h2 style={{ fontSize:17, fontWeight:700, margin:0 }}>Delete Asset</h2>
        </div>

        <div style={{ padding:'16px 18px', background:'var(--red-bg)', border:'1px solid rgba(248,113,113,.2)', borderRadius:'var(--radius)', marginBottom:24 }}>
          <div style={{ fontWeight:700, color:'var(--red)', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
            <AlertTriangle size={15}/> This action is permanent
          </div>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>
            You are about to delete asset{' '}
            <strong style={{ color:'var(--text)', fontFamily:'var(--mono)' }}>{asset.id}</strong>{' '}
            ({asset.brand} {asset.model}).
          </div>
          {asset.status === 'Allocated' && (
            <div style={{ color:'var(--red)', marginTop:12, fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
              <AlertTriangle size={14}/> Cannot delete — this asset is currently allocated. Receive it first.
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting || asset.status === 'Allocated'}>
            <Trash2 size={14}/> {deleting ? 'Deleting…' : 'Delete Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BARCODE SCANNER (kept as a floating overlay, not a page — it needs camera) ──
function BarcodeScannerModal({ onResult, onClose }) {
  const videoRef = useRef(null), streamRef = useRef(null), rafRef = useRef(null), scannedRef = useRef(false);
  const [error, setError] = useState(''), [status, setStatus] = useState('Starting camera…');
  useEffect(() => { startScan(); return () => stopCamera(); }, []);
  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };
  const parseScanResult = (text) => {
    if (scannedRef.current) return; scannedRef.current = true; stopCamera();
    let data = {};
    try { data = JSON.parse(text); }
    catch { try { const p = new URLSearchParams(text); for (const [k,v] of p.entries()) data[k]=v; if (!Object.keys(data).length) throw new Error(); } catch { data = { serial: text }; } }
    onResult(data);
  };
  const startScan = async () => {
    setError(''); scannedRef.current = false; setStatus('Starting camera…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setStatus('Align QR code in the frame'); startDetection(); }
    } catch (e) {
      if (e.name === 'NotAllowedError') setError('Camera permission denied.');
      else if (e.name === 'NotFoundError') setError('No camera found on this device.');
      else setError(`Camera error: ${e.message}`);
    }
  };
  const startDetection = () => {
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({ formats:['qr_code','code_128','code_39','ean_13','data_matrix'] });
      const detect = async () => { if (!videoRef.current || scannedRef.current) return; try { const b = await detector.detect(videoRef.current); if (b.length > 0) { parseScanResult(b[0].rawValue); return; } } catch (_) {} rafRef.current = requestAnimationFrame(detect); };
      rafRef.current = requestAnimationFrame(detect); return;
    }
    if (window.ZXing) { runZxing(); return; }
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js';
    s.onload = () => { if (window.ZXing) runZxing(); else setError('QR scanner failed to load.'); };
    s.onerror = () => setError('QR scanner failed to load.'); document.head.appendChild(s);
  };
  const runZxing = () => {
    try {
      const cr = new window.ZXing.BrowserQRCodeReader(new Map());
      cr.decodeFromVideoElement(videoRef.current).then(r => { if (r && !scannedRef.current) parseScanResult(r.getText()); }).catch(() => { if (!scannedRef.current) setError('QR scanning failed.'); });
    } catch { setError('QR scanner could not start.'); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><ScanLine size={16} style={{ marginRight:8, verticalAlign:'middle' }}/>Scan Laptop QR Code</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          {error ? (
            <div style={{ padding:'20px 16px', textAlign:'center' }}>
              <div style={{ marginBottom:12, color:'var(--red)', fontSize:14 }}>{error}</div>
              <button className="btn btn-secondary" onClick={() => { setError(''); startScan(); }}><Camera size={14}/> Retry</button>
            </div>
          ) : (
            <>
              <div style={{ position:'relative', borderRadius:10, overflow:'hidden', background:'#000', aspectRatio:'4/3', marginBottom:14 }}>
                <video ref={videoRef} muted playsInline style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)' }}/>
                  <div style={{ position:'relative', zIndex:1, width:200, height:200, border:'2px solid var(--accent,#6366f1)', borderRadius:12, boxShadow:'0 0 0 2000px rgba(0,0,0,0.45)' }}>
                    {[{top:-2,left:-2,borderRight:'none',borderBottom:'none'},{top:-2,right:-2,borderLeft:'none',borderBottom:'none'},{bottom:-2,left:-2,borderRight:'none',borderTop:'none'},{bottom:-2,right:-2,borderLeft:'none',borderTop:'none'}].map((s,i) => (
                      <div key={i} style={{ position:'absolute', width:20, height:20, border:'3px solid var(--accent,#6366f1)', borderRadius:4, ...s }}/>
                    ))}
                    <div style={{ position:'absolute', left:8, right:8, height:2, background:'var(--accent,#6366f1)', opacity:0.8, animation:'scanline 1.8s ease-in-out infinite' }}/>
                  </div>
                </div>
              </div>
              <p style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, margin:'0 0 8px' }}>{status}</p>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes scanline{0%{top:8px;}50%{top:calc(100% - 10px);}100%{top:8px;}}`}</style>
    </div>
  );
}

// ── MAIN INVENTORY PAGE ────────────────────────────────────────────────────────
export default function Inventory() {
  const { assets, allocations, addAsset, refetch } = useApp();
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const isAdmin   = user?.role === 'admin';

  const allocLookup = React.useMemo(() => {
    const map = {};
    (allocations || []).forEach(a => { if (a.status === 'Active' && a.assetId) map[a.assetId] = { empName: a.empName, empId: a.empId, department: a.department }; });
    return map;
  }, [allocations]);

  // ── Active page state ──────────────────────────────────────────────────────
  // page: null | 'add' | 'view' | 'edit' | 'history' | 'bulkImport' | 'qrImport' | 'bulkStatus' | 'delete'
  const [page,        setPage]       = useState(null);
  const [pageAsset,   setPageAsset]  = useState(null);   // for view/edit/history/delete
  const [qrTab,       setQrTab]      = useState('import');
  const [bulkAction,  setBulkAction] = useState(null);   // 'repair' | 'scrap'

  const [search,      setSearch]     = useState('');
  const [filter,      setFilter]     = useState('All');
  const [selected,    setSelected]   = useState(new Set());
  const listSnapshot  = useRef({ search:'', filter:'All' });

  const goPage = (p, asset = null) => {
    listSnapshot.current = { search, filter };
    setPage(p);
    setPageAsset(asset);
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const goBack = () => {
    const { search: s, filter: f } = listSnapshot.current;
    setSearch(s); setFilter(f);
    setPage(null); setPageAsset(null); setBulkAction(null);
  };

  const goBackAndRefetch = async () => {
    await refetch();
    goBack();
  };

  const filtered = assets.filter(a => {
    const ms = !search || [a.id, a.serial, a.brand, a.model, a.config, a.location, a.vendor].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const mf = filter === 'All' || a.status === filter;
    return ms && mf;
  });

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll    = () => setSelected(new Set(filtered.map(a => a.id)));
  const clearAll     = () => setSelected(new Set());
  const allSelected  = filtered.length > 0 && filtered.every(a => selected.has(a.id));
  const someSelected = filtered.some(a => selected.has(a.id)) && !allSelected;

  const handleBulkAction = (action) => {
    if (action === 'export') { exportToExcel(assets.filter(a => selected.has(a.id)), allocLookup); clearAll(); return; }
    listSnapshot.current = { search, filter };
    setBulkAction(action);
    setPage('bulkStatus');
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const warrantyBadge = (warrantyEnd) => {
    const d = daysFromNow(warrantyEnd);
    if (d === null) return <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text-muted)' }}>—</span>;
    if (d < 0)   return <span className="warranty-chip wchip-expired">{warrantyEnd} <span className="wchip-label">Expired</span></span>;
    if (d <= 30) return <span className="warranty-chip wchip-urgent">{warrantyEnd} <span className="wchip-label">{d}d</span></span>;
    if (d <= 90) return <span className="warranty-chip wchip-warn">{warrantyEnd} <span className="wchip-label">{d}d</span></span>;
    return <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text-dim)' }}>{warrantyEnd}</span>;
  };

  // ── Page routing ───────────────────────────────────────────────────────────
  if (page === 'add') {
    return <AddAssetPage onBack={goBack} onSaved={refetch} addAsset={addAsset} />;
  }
  if (page === 'view' && pageAsset) {
    return (
      <AssetDetailPage
        asset={pageAsset}
        allocLookup={allocLookup}
        onBack={goBack}
        onEdit={() => goPage('edit', pageAsset)}
        onHistory={() => goPage('history', pageAsset)}
        isAdmin={isAdmin}
        navigate={navigate}
      />
    );
  }
  if (page === 'edit' && pageAsset) {
    return <AssetEditPage asset={pageAsset} onBack={goBack} onSaved={refetch} />;
  }
  if (page === 'history' && pageAsset) {
    return <AssetHistoryPage asset={pageAsset} onBack={goBack} />;
  }
  if (page === 'bulkImport') {
    return <BulkImportPage onBack={goBack} onImported={refetch} />;
  }
  if (page === 'qrImport') {
    return <QRImportPage onBack={goBack} onImported={refetch} allAssets={assets} defaultTab={qrTab} />;
  }
  if (page === 'bulkStatus') {
    return (
      <BulkStatusPage
        action={bulkAction}
        selectedIds={selected}
        onBack={goBack}
        onDone={() => { clearAll(); goBackAndRefetch(); }}
      />
    );
  }
  if (page === 'delete' && pageAsset) {
    return (
      <DeleteConfirmPage
        asset={pageAsset}
        onBack={goBack}
        onDeleted={() => { goBack(); refetch(); }}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div><h1>Asset Inventory</h1><p>Manage all laptops and equipment</p></div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button className="btn btn-secondary" onClick={() => exportToExcel(filtered, allocLookup)}><Download size={15}/> Export</button>
          {isAdmin && (
            <>
              <button className="btn btn-secondary" onClick={() => goPage('bulkImport')}><Upload size={15}/> Bulk Import</button>
              <button className="btn btn-secondary" onClick={() => { setQrTab('import'); goPage('qrImport'); }} style={{ borderColor:'var(--accent)', color:'var(--accent)' }}>
                <QrCode size={15}/> Import &amp; QR
              </button>
              <button className="btn btn-secondary" onClick={() => { setQrTab('reprint'); goPage('qrImport'); }} style={{ borderColor:'var(--green)', color:'var(--green)' }}>
                <RefreshCw size={15}/> Reprint QR
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={() => goPage('add')}><Plus size={15}/> Add Asset</button>
        </div>
      </div>

      <StatsRow assets={assets}/>
      <WarrantyAlerts assets={assets}/>
      <BrandModelBreakdown assets={assets}/>

      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex:1, maxWidth:340 }}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search asset, serial, model, location…" value={search} onChange={e => { setSearch(e.target.value); clearAll(); }}/>
        </div>
        <div className="toggle-group">
          {['All','Stock','Allocated','Repair','Scrap'].map(s => (
            <button key={s} className={`toggle-btn ${filter===s?'active':''}`} onClick={() => { setFilter(s); clearAll(); }}>{s}</button>
          ))}
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{filtered.length} asset{filtered.length!==1?'s':''}</div>
      </div>

      <BulkActionBar selected={selected} total={filtered.length} onSelectAll={selectAll} onClearAll={clearAll} onBulkAction={handleBulkAction} isAdmin={isAdmin}/>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width:36 }}>
                <button className="checkbox-btn" onClick={allSelected ? clearAll : selectAll}>
                  {allSelected
                    ? <CheckSquare size={15} style={{ color:'var(--accent)' }}/>
                    : someSelected
                      ? <CheckSquare size={15} style={{ color:'var(--accent)', opacity:0.5 }}/>
                      : <Square size={15} style={{ color:'var(--text-muted)' }}/>}
                </button>
              </th>
              <th>Asset No</th><th>Serial</th><th>Brand / Model</th>
              <th>Configuration</th><th>Warranty End</th>
              <th>Allocated To</th><th>Location</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10}><div className="empty-state"><p>No assets found</p></div></td></tr>
            ) : filtered.map(a => {
              const isSel = selected.has(a.id);
              return (
                <tr key={a.id} className={isSel ? 'row-selected' : ''}>
                  <td><button className="checkbox-btn" onClick={() => toggleSelect(a.id)}>{isSel ? <CheckSquare size={15} style={{ color:'var(--accent)' }}/> : <Square size={15} style={{ color:'var(--text-muted)' }}/>}</button></td>
                  <td><span className="asset-id">{a.id}</span></td>
                  <td><span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{a.serial}</span></td>
                  <td><div style={{ fontWeight:600 }}>{a.brand}</div><div style={{ fontSize:12, color:'var(--text-muted)' }}>{a.model}</div></td>
                  <td style={{ fontSize:12.5, color:'var(--text-dim)' }}>{a.config}</td>
                  <td>{warrantyBadge(a.warrantyEnd)}</td>
                  <td>
                    {allocLookup[a.id] ? (
                      <div>
                        <div style={{ fontWeight:600, fontSize:12.5 }}>{allocLookup[a.id].empName}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{allocLookup[a.id].empId}{allocLookup[a.id].department ? ` · ${allocLookup[a.id].department}` : ''}</div>
                      </div>
                    ) : <span style={{ fontSize:12, color:'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ fontSize:12.5 }}>{a.location || '—'}</td>
                  <td><StatusBadge status={a.status}/></td>
                  <td>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {a.status === 'Stock' && (
                        <button className="btn btn-sm btn-success" onClick={() => navigate('/allocate', { state:{ assetId: a.id } })}><Send size={12}/> Allocate</button>
                      )}
                      <button className="btn btn-sm btn-secondary" onClick={() => goPage('view', a)}><Eye size={12}/> View</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => goPage('history', a)} title="History"><History size={12}/></button>
                      {isAdmin && (
                        <>
                          <button className="btn btn-sm btn-secondary" onClick={() => goPage('edit', a)} title="Edit"><Edit2 size={12}/></button>
                          <button className="btn btn-sm btn-danger" onClick={() => goPage('delete', a)} title="Delete"><Trash2 size={12}/></button>
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

      <style>{`
        .scan-filled{border-color:var(--green,#34d399)!important;background:var(--green-bg,rgba(52,211,153,0.08))!important;transition:border-color .3s,background .3s}
        .row-selected{background:var(--accent-glow,rgba(99,102,241,0.06))!important}
        .checkbox-btn{background:none;border:none;cursor:pointer;padding:2px;display:flex;align-items:center;color:var(--text-muted)}
        .checkbox-btn:hover{color:var(--accent)}
      `}</style>
    </div>
  );
}

// ── STATS ROW ──────────────────────────────────────────────────────────────────
function StatsRow({ assets }) {
  const counts = assets.reduce((acc, a) => { const s = a.status || 'Stock'; acc[s] = (acc[s]||0)+1; return acc; }, {});
  const expiringSoon = assets.filter(a => { const d = daysFromNow(a.warrantyEnd); return d !== null && d >= 0 && d <= 30; }).length;
  const stats = [
    { label:'Total Assets',  value: assets.length,         icon:<CheckCircle size={16}/>,    color:'var(--accent)', alertClass:'' },
    { label:'In Stock',      value: counts.Stock || 0,     icon:<CheckCircle size={16}/>,    color:'var(--green)',  alertClass: (counts.Stock||0) > 0 && (counts.Stock||0) < 5 ? 'stat-card-alert-green blink-fast' : '' },
    { label:'Allocated',     value: counts.Allocated || 0, icon:<Send size={16}/>,           color:'#818cf8',       alertClass: (counts.Allocated||0) > 0 ? 'stat-card-alert-blue' : '' },
    { label:'In Repair',     value: counts.Repair || 0,    icon:<Wrench size={16}/>,         color:'#f59e0b',       alertClass: (counts.Repair||0) > 0 ? 'stat-card-alert-amber' : '' },
    { label:'Expiring ≤30d', value: expiringSoon,          icon:<AlertTriangle size={16}/>,  color:'var(--red)',    alertClass: expiringSoon > 0 ? 'stat-card-alert-red blink-fast' : '' },
  ];
  return (
    <div className="stats-row">
      {stats.map(s => (
        <div key={s.label} className={`stat-card ${s.alertClass}`}>
          <div className="stat-icon" style={{ color:s.color }}>{s.icon}</div>
          <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── BRAND MODEL BREAKDOWN ──────────────────────────────────────────────────────
function BrandModelBreakdown({ assets }) {
  const [expanded, setExpanded] = React.useState({});
  const STATUS_STYLE = {
    Stock:     { bg:'var(--green-bg)',                       color:'var(--green)' },
    Allocated: { bg:'rgba(79,142,247,.13)',                  color:'var(--accent)' },
    Repair:    { bg:'rgba(251,191,36,.13)',                  color:'#f59e0b' },
    Scrap:     { bg:'var(--red-bg,rgba(248,113,113,.1))',    color:'var(--red,#f87171)' },
  };
  const grouped = assets.reduce((acc, a) => {
    const brand = a.brand || 'Unknown', model = a.model || 'Unknown';
    if (!acc[brand]) acc[brand] = { total:0, models:{} };
    if (!acc[brand].models[model]) acc[brand].models[model] = { Stock:0, Allocated:0, Repair:0, Scrap:0, total:0 };
    acc[brand].total++;
    const s = a.status || 'Stock';
    acc[brand].models[model][s] = (acc[brand].models[model][s]||0)+1;
    acc[brand].models[model].total++;
    return acc;
  }, {});
  const toggle    = (brand) => setExpanded(e => ({ ...e, [brand]: !e[brand] }));
  const allExpanded = Object.keys(grouped).every(b => expanded[b]);
  const toggleAll = () => { if (allExpanded) setExpanded({}); else setExpanded(Object.fromEntries(Object.keys(grouped).map(b => [b,true]))); };
  if (Object.keys(grouped).length === 0) return null;
  const StatusPill = ({ status, count }) => {
    if (!count) return null;
    const s = STATUS_STYLE[status] || { bg:'var(--surface2)', color:'var(--text-muted)' };
    return <span className="bmd-pill" style={{ fontSize:11, padding:'2px 9px', borderRadius:20, fontWeight:700, background:s.bg, color:s.color, whiteSpace:'nowrap' }}>{status}: {count}</span>;
  };
  const sortedBrands = Object.entries(grouped).sort((a,b) => b[1].total - a[1].total);
  return (
    <div className="card bmd-card">
      <div className="bmd-header">
        <div className="section-title" style={{ margin:0 }}>
          <TrendingUp size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>Brand &amp; Model Breakdown
        </div>
        <button className="btn btn-sm btn-secondary" onClick={toggleAll} style={{ fontSize:12 }}>{allExpanded ? 'Collapse All' : 'Expand All'}</button>
      </div>
      <div className="bmd-list">
        {sortedBrands.map(([brand, data], brandIdx) => {
          const isOpen = !!expanded[brand];
          const brandStock     = Object.values(data.models).reduce((s,m) => s+(m.Stock||0),0);
          const brandAllocated = Object.values(data.models).reduce((s,m) => s+(m.Allocated||0),0);
          const brandRepair    = Object.values(data.models).reduce((s,m) => s+(m.Repair||0),0);
          const brandScrap     = Object.values(data.models).reduce((s,m) => s+(m.Scrap||0),0);
          return (
            <div key={brand} className="bmd-brand-wrap" style={{ animationDelay:`${brandIdx*55}ms` }}>
              <div className={`bmd-brand-row${isOpen?' bmd-brand-open':''}`} onClick={() => toggle(brand)}>
                <div className="bmd-arrow"><ChevronDown size={15} style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.22s' }}/></div>
                <div className="bmd-brand-label"><span className="bmd-brand-name">{brand}</span><span className="bmd-model-count">{Object.keys(data.models).length} model{Object.keys(data.models).length!==1?'s':''}</span></div>
                <div className="bmd-pills">
                  <StatusPill status="Stock" count={brandStock}/><StatusPill status="Allocated" count={brandAllocated}/>
                  <StatusPill status="Repair" count={brandRepair}/><StatusPill status="Scrap" count={brandScrap}/>
                </div>
                <div className="bmd-total-badge">{data.total}</div>
              </div>
              {isOpen && (
                <div className="bmd-models-wrap">
                  {Object.entries(data.models).sort((a,b) => b[1].total-a[1].total).map(([model, counts], modelIdx, arr) => (
                    <div key={model} className="bmd-model-row" style={{ animationDelay:`${modelIdx*38}ms`, borderBottom: modelIdx < arr.length-1 ? '1px solid var(--border)' : 'none' }}>
                      <div className="bmd-model-label"><span className="bmd-tree-char">└</span><span className="bmd-model-name">{model}</span></div>
                      <div className="bmd-pills">
                        <StatusPill status="Stock" count={counts.Stock}/><StatusPill status="Allocated" count={counts.Allocated}/>
                        <StatusPill status="Repair" count={counts.Repair}/><StatusPill status="Scrap" count={counts.Scrap}/>
                      </div>
                      <div className="bmd-model-total">{counts.total} unit{counts.total!==1?'s':''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BULK ACTION BAR ────────────────────────────────────────────────────────────
function BulkActionBar({ selected, total, onSelectAll, onClearAll, onBulkAction, isAdmin }) {
  const count = selected.size;
  if (count === 0) return null;
  return (
    <div className="bulk-action-bar">
      <div className="bulk-action-left">
        <button className="btn btn-icon btn-sm" onClick={onClearAll}><XCircle size={15}/></button>
        <span className="bulk-count"><strong>{count}</strong> selected</span>
        {count < total && <button className="btn-link" onClick={onSelectAll}>Select all {total}</button>}
      </div>
      <div className="bulk-action-right">
        <button className="btn btn-sm btn-secondary" onClick={() => onBulkAction('export')}><Download size={13}/> Export Selected</button>
        {isAdmin && (
          <>
            <button className="btn btn-sm btn-secondary" style={{ borderColor:'#f59e0b', color:'#f59e0b' }} onClick={() => onBulkAction('repair')}><Wrench size={13}/> Send to Repair</button>
            <button className="btn btn-sm btn-danger" onClick={() => onBulkAction('scrap')}><Archive size={13}/> Scrap</button>
          </>
        )}
      </div>
    </div>
  );
}