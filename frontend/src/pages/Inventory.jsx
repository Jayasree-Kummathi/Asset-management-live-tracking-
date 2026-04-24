import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import QRBulkImport from './QRBulkImport';
import StatusBadge from '../components/common/StatusBadge';
import {
  Plus, Search, Send, Eye, X,
  Calendar, MapPin, Cpu, Edit2, Trash2,
  Upload, FileText, CheckCircle,
  Camera, ScanLine, QrCode, RefreshCw,
} from 'lucide-react';
import './Inventory.css';

const EMPTY_FORM = {
  id: '', serial: '', brand: '', model: '', config: '',
  processor: '', ram: '', storage: '',
  purchaseDate: '', warrantyStart: '', warrantyEnd: '',
  vendor: '', location: '', notes: ''
};

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...opts
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

// ── Brand / Model Breakdown ───────────────────────────────────────────────────
function BrandModelBreakdown({ assets }) {
  const [expanded, setExpanded] = React.useState({});

  const STATUS_STYLE = {
    Stock:     { bg: 'var(--green-bg)',                    color: 'var(--green)' },
    Allocated: { bg: 'rgba(79,142,247,.13)',               color: 'var(--accent)' },
    Repair:    { bg: 'rgba(251,191,36,.13)',               color: '#f59e0b' },
    Scrap:     { bg: 'var(--red-bg,rgba(248,113,113,.1))', color: 'var(--red,#f87171)' },
  };

  const grouped = assets.reduce((acc, a) => {
    const brand = a.brand || 'Unknown';
    const model = a.model || 'Unknown';
    if (!acc[brand]) acc[brand] = { total: 0, models: {} };
    if (!acc[brand].models[model])
      acc[brand].models[model] = { Stock: 0, Allocated: 0, Repair: 0, Scrap: 0, total: 0 };
    acc[brand].total++;
    const s = a.status || 'Stock';
    acc[brand].models[model][s] = (acc[brand].models[model][s] || 0) + 1;
    acc[brand].models[model].total++;
    return acc;
  }, {});

  const toggle    = (brand) => setExpanded(e => ({ ...e, [brand]: !e[brand] }));
  const allExpanded = Object.keys(grouped).every(b => expanded[b]);
  const toggleAll = () => {
    if (allExpanded) setExpanded({});
    else setExpanded(Object.fromEntries(Object.keys(grouped).map(b => [b, true])));
  };

  if (Object.keys(grouped).length === 0) return null;

  const StatusPill = ({ status, count }) => {
    if (!count) return null;
    const s = STATUS_STYLE[status] || { bg: 'var(--surface2)', color: 'var(--text-muted)' };
    return (
      <span
        className="bmd-pill"
        style={{
          fontSize: 11, padding: '2px 9px', borderRadius: 20, fontWeight: 700,
          background: s.bg, color: s.color, whiteSpace: 'nowrap', cursor: 'default',
        }}
      >
        {status}: {count}
      </span>
    );
  };

  const sortedBrands = Object.entries(grouped).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="card bmd-card">
      {/* ── Header ── */}
      <div className="bmd-header">
        <div className="section-title" style={{ margin: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          Brand &amp; Model Breakdown
        </div>
        <button className="btn btn-sm btn-secondary" onClick={toggleAll} style={{ fontSize: 12 }}>
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* ── Brand rows ── */}
      <div className="bmd-list">
        {sortedBrands.map(([brand, data], brandIdx) => {
          const isOpen        = !!expanded[brand];
          const brandStock     = Object.values(data.models).reduce((s, m) => s + (m.Stock     || 0), 0);
          const brandAllocated = Object.values(data.models).reduce((s, m) => s + (m.Allocated || 0), 0);
          const brandRepair    = Object.values(data.models).reduce((s, m) => s + (m.Repair    || 0), 0);
          const brandScrap     = Object.values(data.models).reduce((s, m) => s + (m.Scrap     || 0), 0);

          return (
            <div
              key={brand}
              className="bmd-brand-wrap"
              style={{ animationDelay: `${brandIdx * 55}ms` }}
            >
              {/* Brand header */}
              <div
                className={`bmd-brand-row${isOpen ? ' bmd-brand-open' : ''}`}
                onClick={() => toggle(brand)}
              >
                {/* Rotating arrow */}
                <div
                  className="bmd-arrow"
                  style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>

                {/* Brand name + model count */}
                <div className="bmd-brand-label">
                  <span className="bmd-brand-name">{brand}</span>
                  <span className="bmd-model-count">
                    {Object.keys(data.models).length} model{Object.keys(data.models).length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Status pills */}
                <div className="bmd-pills">
                  <StatusPill status="Stock"     count={brandStock} />
                  <StatusPill status="Allocated" count={brandAllocated} />
                  <StatusPill status="Repair"    count={brandRepair} />
                  <StatusPill status="Scrap"     count={brandScrap} />
                </div>

                {/* Total badge */}
                <div className="bmd-total-badge">{data.total}</div>
              </div>

              {/* Model rows — animate open */}
              {isOpen && (
                <div className="bmd-models-wrap">
                  {Object.entries(data.models)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([model, counts], modelIdx, arr) => (
                      <div
                        key={model}
                        className="bmd-model-row"
                        style={{
                          animationDelay: `${modelIdx * 38}ms`,
                          borderBottom: modelIdx < arr.length - 1
                            ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        {/* Tree connector + name */}
                        <div className="bmd-model-label">
                          <span className="bmd-tree-char">└</span>
                          <span className="bmd-model-name">{model}</span>
                        </div>

                        {/* Per-model pills */}
                        <div className="bmd-pills">
                          <StatusPill status="Stock"     count={counts.Stock} />
                          <StatusPill status="Allocated" count={counts.Allocated} />
                          <StatusPill status="Repair"    count={counts.Repair} />
                          <StatusPill status="Scrap"     count={counts.Scrap} />
                        </div>

                        {/* Model total */}
                        <div className="bmd-model-total">
                          {counts.total} unit{counts.total !== 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Keyframes injected once */}
      <style>{`
        /* ── Brand/Model Breakdown ── */
        .bmd-card  { margin-bottom: 20px; }
        .bmd-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .bmd-list  { display:flex; flex-direction:column; gap:8px; }

        /* Brand wrapper — slide-in on mount */
        @keyframes bmdSlideIn {
          from { opacity:0; transform:translateX(-20px); }
          to   { opacity:1; transform:translateX(0); }
        }
        .bmd-brand-wrap {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          animation: bmdSlideIn 0.32s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* Brand header row */
        .bmd-brand-row {
          display:flex; align-items:center; gap:10px;
          padding:11px 14px; cursor:pointer; user-select:none;
          background: transparent;
          border-bottom: 2px solid transparent;
          transition: background 0.15s ease, border-color 0.22s ease, box-shadow 0.15s ease;
        }
        .bmd-brand-row:hover {
          background: var(--surface2);
          box-shadow: inset 3px 0 0 var(--accent);
        }
        .bmd-brand-open {
          background: var(--surface2) !important;
          border-bottom-color: var(--accent) !important;
        }

        /* Rotating arrow */
        .bmd-arrow {
          flex-shrink:0; color:var(--accent);
          display:flex; align-items:center;
          transition: transform 0.22s cubic-bezier(0.22,1,0.36,1);
        }

        /* Brand label */
        .bmd-brand-label { flex:1; display:flex; align-items:baseline; gap:8px; }
        .bmd-brand-name  { font-weight:700; font-size:14px; }
        .bmd-model-count { font-size:12px; color:var(--text-muted); }

        /* Pills row */
        .bmd-pills { display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end; }
        .bmd-pill  { transition: transform 0.15s, box-shadow 0.15s; }
        .bmd-pill:hover { transform:scale(1.08); box-shadow:0 2px 8px rgba(0,0,0,.15); }

        /* Total badge */
        .bmd-total-badge {
          flex-shrink:0; min-width:32px; text-align:center;
          font-size:12px; font-weight:800; color:var(--accent);
          font-family:var(--mono); margin-left:6px;
          background:var(--accent-glow,rgba(99,102,241,0.1));
          padding:2px 8px; border-radius:20px;
        }

        /* Models expand animation */
        @keyframes bmdExpand {
          from { opacity:0; max-height:0; transform:translateY(-6px); }
          to   { opacity:1; max-height:1200px; transform:translateY(0); }
        }
        .bmd-models-wrap {
          border-top: 1px solid var(--border);
          overflow: hidden;
          animation: bmdExpand 0.28s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* Individual model row */
        @keyframes bmdModelIn {
          from { opacity:0; transform:translateX(-12px); }
          to   { opacity:1; transform:translateX(0); }
        }
        .bmd-model-row {
          display:flex; align-items:center; gap:10px;
          padding:9px 14px 9px 42px;
          background: var(--surface);
          animation: bmdModelIn 0.24s cubic-bezier(0.22,1,0.36,1) both;
          transition: background 0.12s ease;
        }
        .bmd-model-row:hover { background: var(--surface2); }

        /* Model label */
        .bmd-model-label { flex:1; display:flex; align-items:center; gap:6px;
                           font-size:13px; color:var(--text-dim); }
        .bmd-tree-char   { opacity:0.35; font-size:15px; color:var(--accent);
                           font-weight:700; line-height:1; }
        .bmd-model-name  { font-weight:500; }
        .bmd-model-total { flex-shrink:0; font-size:12px; color:var(--text-muted);
                           font-family:var(--mono); min-width:52px; text-align:right; }
      `}</style>
    </div>
  );
}

// ── Barcode Scanner Modal ─────────────────────────────────────────────────────
function BarcodeScannerModal({ onResult, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const scannedRef = useRef(false);
  const [error, setError]   = useState('');
  const [status, setStatus] = useState('Starting camera…');

  useEffect(() => { startScan(); return () => stopCamera(); }, []);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const parseScanResult = (text) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    stopCamera();
    let data = {};
    try { data = JSON.parse(text); }
    catch {
      try {
        const params = new URLSearchParams(text);
        for (const [k, v] of params.entries()) data[k] = v;
        if (!Object.keys(data).length) throw new Error();
      } catch { data = { serial: text }; }
    }
    onResult(data);
  };

  const startScan = async () => {
    setError(''); scannedRef.current = false; setStatus('Starting camera…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('Align QR code in the frame');
        startDetection();
      }
    } catch (e) {
      if (e.name === 'NotAllowedError') setError('Camera permission denied. Please allow camera access and try again.');
      else if (e.name === 'NotFoundError') setError('No camera found on this device.');
      else setError(`Camera error: ${e.message}`);
    }
  };

  const startDetection = () => {
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix']
      });
      const detect = async () => {
        if (!videoRef.current || scannedRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) { parseScanResult(barcodes[0].rawValue); return; }
        } catch (_) {}
        rafRef.current = requestAnimationFrame(detect);
      };
      rafRef.current = requestAnimationFrame(detect);
      return;
    }
    loadZxing();
  };

  const loadZxing = () => {
    if (window.ZXing) { runZxing(); return; }
    const tryLoad = (src, onFail) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => { if (window.ZXing) runZxing(); else onFail(); };
      script.onerror = onFail;
      document.head.appendChild(script);
    };
    tryLoad(
      'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js',
      () => tryLoad(
        'https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js',
        () => setError('QR scanner failed to load. Please use Chrome on desktop.')
      )
    );
  };

  const runZxing = () => {
    try {
      const codeReader = new window.ZXing.BrowserQRCodeReader(new Map());
      codeReader.decodeFromVideoElement(videoRef.current)
        .then(result => { if (result && !scannedRef.current) parseScanResult(result.getText()); })
        .catch(() => { if (!scannedRef.current) setError('QR scanning failed. Try Chrome for best results.'); });
    } catch {
      setError('QR scanner could not start. Use Chrome for best results.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <ScanLine size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Scan Laptop QR Code
          </h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {error ? (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ marginBottom: 12, color: 'var(--red)', fontSize: 14 }}>{error}</div>
              <button className="btn btn-secondary" onClick={() => { setError(''); startScan(); }}>
                <Camera size={14} /> Retry
              </button>
            </div>
          ) : (
            <>
              <div style={{
                position: 'relative', borderRadius: 10, overflow: 'hidden',
                background: '#000', aspectRatio: '4/3', marginBottom: 14,
              }}>
                <video ref={videoRef} muted playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
                  <div style={{
                    position: 'relative', zIndex: 1, width: 200, height: 200,
                    border: '2px solid var(--accent,#6366f1)', borderRadius: 12,
                    boxShadow: '0 0 0 2000px rgba(0,0,0,0.45)',
                  }}>
                    {[
                      { top: -2, left: -2, borderRight: 'none', borderBottom: 'none' },
                      { top: -2, right: -2, borderLeft: 'none', borderBottom: 'none' },
                      { bottom: -2, left: -2, borderRight: 'none', borderTop: 'none' },
                      { bottom: -2, right: -2, borderLeft: 'none', borderTop: 'none' },
                    ].map((s, i) => (
                      <div key={i} style={{
                        position: 'absolute', width: 20, height: 20,
                        border: '3px solid var(--accent,#6366f1)', borderRadius: 4, ...s,
                      }} />
                    ))}
                    <div style={{
                      position: 'absolute', left: 8, right: 8, height: 2,
                      background: 'var(--accent,#6366f1)', opacity: 0.8,
                      animation: 'scanline 1.8s ease-in-out infinite',
                    }} />
                  </div>
                </div>
              </div>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, margin: '0 0 8px' }}>{status}</p>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Works best with Chrome on Android or desktop Chrome
              </p>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes scanline{0%{top:8px;}50%{top:calc(100% - 10px);}100%{top:8px;}}`}</style>
    </div>
  );
}

// ── View Modal ────────────────────────────────────────────────────────────────
function ViewModal({ asset, onClose }) {
  const expired = asset.warrantyEnd && new Date(asset.warrantyEnd) < new Date();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'var(--accent-glow)', border: '1px solid var(--accent)',
              fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)',
            }}>{asset.id}</div>
            <div>
              <h2 className="modal-title">{asset.brand} {asset.model}</h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Serial: <span style={{ fontFamily: 'var(--mono)' }}>{asset.serial}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge status={asset.status} />
            <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div className="section-title">
            <Cpu size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Specifications
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px', marginBottom: 20 }}>
            <div className="info-row"><span className="info-label">Configuration</span><span className="info-value">{asset.config || '—'}</span></div>
            <div className="info-row"><span className="info-label">Processor</span><span className="info-value">{asset.processor || '—'}</span></div>
            <div className="info-row"><span className="info-label">RAM</span><span className="info-value">{asset.ram || '—'}</span></div>
            <div className="info-row"><span className="info-label">Storage</span><span className="info-value">{asset.storage || '—'}</span></div>
          </div>
          <div className="section-title">
            <Calendar size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Purchase &amp; Warranty
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px', marginBottom: 20 }}>
            <div className="info-row"><span className="info-label">Purchase Date</span><span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{asset.purchaseDate || '—'}</span></div>
            <div className="info-row"><span className="info-label">Vendor</span><span className="info-value">{asset.vendor || '—'}</span></div>
            <div className="info-row"><span className="info-label">Warranty Start</span><span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{asset.warrantyStart || '—'}</span></div>
            <div className="info-row">
              <span className="info-label">Warranty End</span>
              <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: expired ? 'var(--red)' : 'var(--green)' }}>
                {asset.warrantyEnd || '—'}
                {expired && (
                  <span style={{ fontSize: 10, marginLeft: 8, background: 'var(--red-bg)', color: 'var(--red)', padding: '1px 6px', borderRadius: 4 }}>
                    Expired
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="section-title">
            <MapPin size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Location &amp; Notes
          </div>
          <div className="info-row"><span className="info-label">Location</span><span className="info-value">{asset.location || '—'}</span></div>
          {asset.notes && <div className="info-row"><span className="info-label">Notes</span><span className="info-value">{asset.notes}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ asset, onClose, onSaved }) {
  const [form, setForm] = useState({
    serial: asset.serial, brand: asset.brand, model: asset.model,
    config: asset.config || '', processor: asset.processor || '', ram: asset.ram || '',
    storage: asset.storage || '', purchaseDate: asset.purchaseDate || '',
    warrantyStart: asset.warrantyStart || '', warrantyEnd: asset.warrantyEnd || '',
    vendor: asset.vendor || '', location: asset.location || '', notes: asset.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch(`/assets/${asset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          serial: form.serial, brand: form.brand, model: form.model,
          config: form.config, processor: form.processor, ram: form.ram,
          storage: form.storage,
          purchase_date:  form.purchaseDate  || null,
          warranty_start: form.warrantyStart || null,
          warranty_end:   form.warrantyEnd   || null,
          vendor: form.vendor, location: form.location, notes: form.notes,
        }),
      });
      onSaved(); onClose();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Asset — {asset.id}</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSave}>
            <div className="section-title">Basic Info</div>
            <div className="form-grid form-grid-3">
              <div className="form-group"><label className="form-label">Serial *</label><input className="form-input" required value={form.serial} onChange={e => set('serial', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Brand *</label><input className="form-input" required value={form.brand} onChange={e => set('brand', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Model *</label><input className="form-input" required value={form.model} onChange={e => set('model', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Configuration</label><input className="form-input" value={form.config} onChange={e => set('config', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={e => set('location', e.target.value)} /></div>
            </div>
            <div className="section-title">Specifications</div>
            <div className="form-grid form-grid-3">
              <div className="form-group"><label className="form-label">Processor</label><input className="form-input" value={form.processor} onChange={e => set('processor', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">RAM</label><input className="form-input" value={form.ram} onChange={e => set('ram', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Storage</label><input className="form-input" value={form.storage} onChange={e => set('storage', e.target.value)} /></div>
            </div>
            <div className="section-title">Purchase &amp; Warranty</div>
            <div className="form-grid form-grid-3">
              <div className="form-group"><label className="form-label">Purchase Date</label><input type="date" className="form-input" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Warranty Start</label><input type="date" className="form-input" value={form.warrantyStart} onChange={e => set('warrantyStart', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Warranty End</label><input type="date" className="form-input" value={form.warrantyEnd} onChange={e => set('warrantyEnd', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Vendor</label><input className="form-input" value={form.vendor} onChange={e => set('vendor', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Edit2 size={14} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Import Modal ─────────────────────────────────────────────────────────
function BulkImportModal({ onClose, onImported }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [result,  setResult]  = useState(null);
  const [saving,  setSaving]  = useState(false);

  const SAMPLE = `asset_id,serial,brand,model,config,processor,ram,storage,purchase_date,warranty_start,warranty_end,vendor,location
LTB-280,DX100,Dell,Latitude 5540,i7 / 16GB / 512GB SSD,Intel i7-1355U,16GB DDR5,512GB NVMe,2024-01-10,2024-01-10,2027-01-10,Dell India,Bengaluru
LTB-281,DX101,HP,EliteBook 840,i5 / 8GB / 256GB SSD,Intel i5-1335U,8GB DDR5,256GB SSD,2024-02-01,2024-02-01,2027-02-01,HP India,Mumbai`;

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  };

  const handleParse  = () => { setPreview(parseCSV(csvText)); setResult(null); };
  const handleImport = async () => {
    setSaving(true);
    try {
      const data = await apiFetch('/assets/bulk', { method: 'POST', body: JSON.stringify({ assets: preview }) });
      setResult(data.data);
      if (data.data.created.length > 0) onImported();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Bulk Import Assets</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {result ? (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1, padding: 16, background: 'var(--green-bg)', border: '1px solid rgba(52,211,153,.2)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{result.created.length}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Created Successfully</div>
                </div>
                <div style={{ flex: 1, padding: 16, background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--red)', fontFamily: 'var(--mono)' }}>{result.failed.length}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Failed</div>
                </div>
              </div>
              {result.created.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Created:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.created.map(id => (
                      <span key={id} style={{ background: 'var(--green-bg)', color: 'var(--green)', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--mono)' }}>{id}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.failed.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Failed:</div>
                  {result.failed.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--red)', marginBottom: 4 }}>{f.id}: {f.reason}</div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button className="btn btn-primary" onClick={onClose}>Done</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label">Paste CSV Data</label>
                  <button className="btn btn-secondary btn-sm" onClick={() => setCsvText(SAMPLE)}>
                    <FileText size={13} /> Load Sample
                  </button>
                </div>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 160, fontFamily: 'var(--mono)', fontSize: 12 }}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder="asset_id,serial,brand,model,..."
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Required: <code>asset_id, serial, brand, model</code> — others optional.
              </div>
              {preview.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Preview — {preview.length} rows</div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }} className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Asset ID</th><th>Serial</th><th>Brand</th><th>Model</th><th>Config</th><th>Location</th></tr>
                      </thead>
                      <tbody>
                        {preview.map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{r.asset_id}</td>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.serial}</td>
                            <td>{r.brand}</td>
                            <td>{r.model}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{r.config}</td>
                            <td style={{ fontSize: 12 }}>{r.location}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={handleParse} disabled={!csvText.trim()}>
                  <FileText size={14} /> Parse CSV
                </button>
                <button className="btn btn-primary" onClick={handleImport} disabled={preview.length === 0 || saving}>
                  <Upload size={14} /> {saving ? 'Importing…' : `Import ${preview.length} Assets`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Inventory Page ───────────────────────────────────────────────────────
export default function Inventory() {
  const { assets, allocations, addAsset, refetch } = useApp();
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const isAdmin    = user?.role === 'admin';

  // assetId → active allocation info
  const allocLookup = React.useMemo(() => {
    const map = {};
    (allocations || []).forEach(a => {
      if (a.status === 'Active' && a.assetId)
        map[a.assetId] = { empName: a.empName, empId: a.empId, department: a.department };
    });
    return map;
  }, [allocations]);

  const [search,       setSearch]      = useState('');
  const [filter,       setFilter]      = useState('All');
  const [showAdd,      setShowAdd]     = useState(false);
  const [showBulk,     setShowBulk]    = useState(false);
  const [showQRImport, setShowQRImport] = useState(false);
  const [qrDefaultTab, setQrDefaultTab] = useState('import');
  const [showScanner,  setShowScanner]  = useState(false);
  const [viewAsset,    setViewAsset]    = useState(null);
  const [editAsset,    setEditAsset]    = useState(null);
  const [deleteConf,   setDeleteConf]   = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [scanFlash,    setScanFlash]    = useState(false);

  const openQRModal = (tab) => { setQrDefaultTab(tab); setShowQRImport(true); };

  const filtered = assets.filter(a => {
    const ms = !search || [a.id, a.serial, a.brand, a.model, a.config]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const mf = filter === 'All' || a.status === filter;
    return ms && mf;
  });

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await addAsset(form); setForm(EMPTY_FORM); setShowAdd(false); }
    catch (_) {}
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConf) return;
    setDeleting(true);
    try {
      await apiFetch(`/assets/${deleteConf.id}`, { method: 'DELETE' });
      setDeleteConf(null); refetch();
    } catch (err) { alert(err.message); }
    finally { setDeleting(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleScanResult = (data) => {
    setShowScanner(false);
    setForm(f => ({
      ...f,
      id:        data.asset_id    || f.id,
      serial:    data.serial      || data.serial_number || f.serial,
      brand:     data.brand       || f.brand,
      model:     data.model       || f.model,
      config:    data.config      || data.configuration || f.config,
      processor: data.processor   || data.cpu           || f.processor,
      ram:       data.ram         || data.memory        || f.ram,
      storage:   data.storage     || data.disk          || f.storage,
      location:  data.location    || f.location,
      vendor:    data.vendor      || f.vendor,
    }));
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 1500);
    setShowAdd(true);
  };

  return (
    <div className="fade-in">
      {/* ── Page header ── */}
      <div className="page-header page-header-row">
        <div><h1>Asset Inventory</h1><p>Manage all laptops and equipment</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isAdmin && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowBulk(true)}>
                <Upload size={15} /> Bulk Import
              </button>
              <button className="btn btn-secondary"
                onClick={() => openQRModal('import')}
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                <QrCode size={15} /> Import &amp; QR
              </button>
              <button className="btn btn-secondary"
                onClick={() => openQRModal('reprint')}
                style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
                <RefreshCw size={15} /> Reprint QR
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={15} /> Add Asset
          </button>
        </div>
      </div>

      {/* ── Brand / Model Breakdown ── */}
      <BrandModelBreakdown assets={assets} />

      {/* ── Toolbar ── */}
      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
          <Search size={15} />
          <input className="form-input" placeholder="Search asset, serial, model…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="toggle-group">
          {['All', 'Stock', 'Allocated', 'Repair', 'Scrap'].map(s => (
            <button key={s}
              className={`toggle-btn ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Asset No</th><th>Serial</th><th>Brand / Model</th>
              <th>Configuration</th><th>Warranty End</th>
              <th>Allocated To</th><th>Location</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9}><div className="empty-state"><p>No assets found</p></div></td></tr>
            ) : filtered.map(a => {
              const expired = a.warrantyEnd && new Date(a.warrantyEnd) < new Date();
              return (
                <tr key={a.id}>
                  <td><span className="asset-id">{a.id}</span></td>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{a.serial}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.brand}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.model}</div>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{a.config}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: expired ? 'var(--red)' : 'var(--text-dim)' }}>
                      {a.warrantyEnd || '—'}
                    </span>
                  </td>
                  <td>
                    {allocLookup[a.id] ? (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{allocLookup[a.id].empName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {allocLookup[a.id].empId}
                          {allocLookup[a.id].department ? ` · ${allocLookup[a.id].department}` : ''}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{a.location || '—'}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {a.status === 'Stock' && (
                        <button className="btn btn-sm btn-success"
                          onClick={() => navigate('/allocate', { state: { assetId: a.id } })}>
                          <Send size={12} /> Allocate
                        </button>
                      )}
                      <button className="btn btn-sm btn-secondary" onClick={() => setViewAsset(a)}>
                        <Eye size={12} /> View
                      </button>
                      {isAdmin && (
                        <>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditAsset(a)} title="Edit">
                            <Edit2 size={12} />
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => setDeleteConf(a)} title="Delete">
                            <Trash2 size={12} />
                          </button>
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

      {/* ── Modals ── */}
      {viewAsset   && <ViewModal asset={viewAsset} onClose={() => setViewAsset(null)} />}
      {editAsset   && <EditModal asset={editAsset} onClose={() => setEditAsset(null)} onSaved={refetch} />}
      {showBulk    && <BulkImportModal onClose={() => setShowBulk(false)} onImported={refetch} />}
      {showScanner && <BarcodeScannerModal onResult={handleScanResult} onClose={() => setShowScanner(false)} />}

      {showQRImport && (
        <QRBulkImport
          onImported={refetch}
          onClose={() => setShowQRImport(false)}
          allAssets={assets}
          defaultTab={qrDefaultTab}
        />
      )}

      {/* ── Delete confirm ── */}
      {deleteConf && (
        <div className="modal-overlay" onClick={() => setDeleteConf(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Asset</h2>
              <button className="btn btn-icon" onClick={() => setDeleteConf(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '14px 16px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--radius)', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>This action is permanent</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Delete asset <strong style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{deleteConf.id}</strong> ({deleteConf.brand} {deleteConf.model})?
                  {deleteConf.status === 'Allocated' && (
                    <div style={{ color: 'var(--red)', marginTop: 8, fontWeight: 600 }}>
                      Cannot delete — this asset is currently allocated. Receive it first.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setDeleteConf(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDelete}
                  disabled={deleting || deleteConf.status === 'Allocated'}>
                  <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete Asset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Asset Modal ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 className="modal-title">Add New Asset</h2>
                {scanFlash && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, color: 'var(--green)', background: 'var(--green-bg)',
                    padding: '3px 10px', borderRadius: 20, animation: 'invFadeIn 0.3s ease',
                  }}>
                    <CheckCircle size={12} /> Fields filled from QR
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary"
                  onClick={(e) => { e.stopPropagation(); setShowAdd(false); setShowScanner(true); }}>
                  <ScanLine size={14} /> Scan QR
                </button>
                <button className="btn btn-icon" onClick={() => setShowAdd(false)}><X size={16} /></button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', marginBottom: 18,
                background: 'var(--accent-glow,rgba(99,102,241,0.08))',
                border: '1px solid var(--accent,#6366f1)',
                borderRadius: 'var(--radius,8px)', fontSize: 13, color: 'var(--text-muted)',
              }}>
                <Camera size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span>Have a QR sticker on the laptop? Tap <strong style={{ color: 'var(--text)' }}>Scan QR</strong> to auto-fill all fields instantly.</span>
              </div>
              <form onSubmit={handleAdd}>
                <div className="section-title">Basic Info</div>
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Asset Number *</label>
                    <input className={`form-input${scanFlash && form.id ? ' scan-filled' : ''}`}
                      required value={form.id} onChange={e => set('id', e.target.value)} placeholder="LTB-276" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Serial Number *</label>
                    <input className={`form-input${scanFlash && form.serial ? ' scan-filled' : ''}`}
                      required value={form.serial} onChange={e => set('serial', e.target.value)} placeholder="DX91" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Brand *</label>
                    <input className={`form-input${scanFlash && form.brand ? ' scan-filled' : ''}`}
                      required value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Dell" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Model *</label>
                    <input className={`form-input${scanFlash && form.model ? ' scan-filled' : ''}`}
                      required value={form.model} onChange={e => set('model', e.target.value)} placeholder="Latitude 5540" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Configuration</label>
                    <input className={`form-input${scanFlash && form.config ? ' scan-filled' : ''}`}
                      value={form.config} onChange={e => set('config', e.target.value)} placeholder="i7 / 16GB / 512GB SSD" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input className={`form-input${scanFlash && form.location ? ' scan-filled' : ''}`}
                      value={form.location} onChange={e => set('location', e.target.value)} placeholder="Bengaluru" />
                  </div>
                </div>
                <div className="section-title">Specifications</div>
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Processor</label>
                    <input className={`form-input${scanFlash && form.processor ? ' scan-filled' : ''}`}
                      value={form.processor} onChange={e => set('processor', e.target.value)} placeholder="Intel i7-1355U" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">RAM</label>
                    <input className={`form-input${scanFlash && form.ram ? ' scan-filled' : ''}`}
                      value={form.ram} onChange={e => set('ram', e.target.value)} placeholder="16GB DDR5" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Storage</label>
                    <input className={`form-input${scanFlash && form.storage ? ' scan-filled' : ''}`}
                      value={form.storage} onChange={e => set('storage', e.target.value)} placeholder="512GB NVMe SSD" />
                  </div>
                </div>
                <div className="section-title">Purchase &amp; Warranty</div>
                <div className="form-grid form-grid-3">
                  <div className="form-group"><label className="form-label">Purchase Date</label><input type="date" className="form-input" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Warranty Start</label><input type="date" className="form-input" value={form.warrantyStart} onChange={e => set('warrantyStart', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Warranty End</label><input type="date" className="form-input" value={form.warrantyEnd} onChange={e => set('warrantyEnd', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Vendor</label><input className="form-input" value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="Dell India" /></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes}
                    onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <Plus size={15} /> {saving ? 'Saving…' : 'Add Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scan-filled {
          border-color: var(--green,#34d399) !important;
          background: var(--green-bg,rgba(52,211,153,0.08)) !important;
          transition: border-color 0.3s, background 0.3s;
        }
        @keyframes invFadeIn  { from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);} }
        @keyframes scanline   { 0%{top:8px;}50%{top:calc(100% - 10px);}100%{top:8px;} }
      `}</style>
    </div>
  );
}