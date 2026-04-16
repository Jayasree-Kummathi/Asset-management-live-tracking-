import React, { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { Upload, FileText, Printer, CheckCircle, X, AlertTriangle, Package, Download, RefreshCw, Search } from 'lucide-react';

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

// ── Normalize a row from Excel/CSV ────────────────────────────────────────────
const normalizeRow = (row) => ({
  asset_id:       (row.asset_id || row['Asset ID'] || row['Asset No'] || '').toString().trim().toUpperCase(),
  serial:         (row.serial || row['Serial'] || row['Serial Number'] || '').toString().trim(),
  brand:          (row.brand || row['Brand'] || '').toString().trim(),
  model:          (row.model || row['Model'] || '').toString().trim(),
  config:         (row.config || row['Config'] || row['Configuration'] || '').toString().trim(),
  processor:      (row.processor || row['Processor'] || row['CPU'] || '').toString().trim(),
  ram:            (row.ram || row['RAM'] || row['Memory'] || '').toString().trim(),
  storage:        (row.storage || row['Storage'] || row['Disk'] || '').toString().trim(),
  purchase_date:  (row.purchase_date || row['Purchase Date'] || '').toString().trim(),
  warranty_start: (row.warranty_start || row['Warranty Start'] || '').toString().trim(),
  warranty_end:   (row.warranty_end || row['Warranty End'] || '').toString().trim(),
  vendor:         (row.vendor || row['Vendor'] || '').toString().trim(),
  location:       (row.location || row['Location'] || '').toString().trim(),
});

// ── Build QR data string ──────────────────────────────────────────────────────
const buildQRData = (a) => JSON.stringify({
  asset_id: a.asset_id || a.id, serial: a.serial, brand: a.brand, model: a.model,
  config: a.config, processor: a.processor, ram: a.ram, storage: a.storage,
  vendor: a.vendor, location: a.location,
});

// ── QR Label (screen display) ─────────────────────────────────────────────────
function QRLabel({ asset, size = 110 }) {
  const id = asset.asset_id || asset.id;
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      padding: 10, border: '1px solid #ccc', borderRadius: 8,
      background: '#fff', gap: 5, width: size + 28, fontFamily: 'monospace',
    }}>
      <QRCodeCanvas value={buildQRData(asset)} size={size} level="M" includeMargin={false} />
      <div style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'center' }}>{id}</div>
      <div style={{ fontSize: 9, color: '#555', textAlign: 'center' }}>{asset.brand} {asset.model}</div>
      <div style={{ fontSize: 9, color: '#777', textAlign: 'center' }}>S/N: {asset.serial}</div>
    </div>
  );
}

// ── Print QR labels (canvas → dataURL → print window with <img>) ──────────────
const printQRLabels = (assets) => {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  document.body.appendChild(holder);

  const wrappers = assets.map(asset => {
    const wrapper = document.createElement('div');
    holder.appendChild(wrapper);
    return { asset, wrapper };
  });

  import('react-dom/client').then(({ createRoot }) => {
    const roots = wrappers.map(({ asset, wrapper }) => {
      const root = createRoot(wrapper);
      root.render(
        React.createElement(QRCodeCanvas, {
          value: buildQRData(asset),
          size: 150, level: 'M', includeMargin: false,
        })
      );
      return { asset, wrapper };
    });

    setTimeout(() => {
      const labelData = roots.map(({ asset, wrapper }) => {
        const canvas = wrapper.querySelector('canvas');
        const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
        return { asset, dataUrl };
      });

      document.body.removeChild(holder);

      const id = (a) => a.asset_id || a.id;
      const labelsHTML = labelData.map(({ asset, dataUrl }) => `
        <div class="label">
          <img src="${dataUrl}" width="140" height="140" />
          <div class="asset-id">${id(asset)}</div>
          <div class="asset-sub">${asset.brand} ${asset.model}</div>
          <div class="asset-serial">S/N: ${asset.serial}</div>
          ${asset.config ? `<div class="asset-config">${asset.config}</div>` : ''}
        </div>
      `).join('');

      const win = window.open('', '_blank');
      if (!win) { alert('Please allow popups to print QR labels.'); return; }

      win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>QR Labels — Asset Management</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Courier New', monospace; padding: 10px; background: #fff; }
      .grid { display: flex; flex-wrap: wrap; gap: 8px; }
      .label {
        display: flex; flex-direction: column; align-items: center;
        padding: 8px 6px; border: 1px solid #aaa; border-radius: 6px;
        page-break-inside: avoid; background: #fff; width: 168px; gap: 3px;
      }
      .label img { display: block; }
      .asset-id { font-size: 11px; font-weight: 700; color: #000; text-align: center; margin-top: 3px; letter-spacing: 0.5px; }
      .asset-sub { font-size: 8.5px; color: #444; text-align: center; }
      .asset-serial { font-size: 8px; color: #666; text-align: center; }
      .asset-config { font-size: 7.5px; color: #888; text-align: center; }
      @media print {
        body { padding: 4px; }
        @page { margin: 8mm; size: A4 portrait; }
        .grid { gap: 6px; }
      }
    </style>
  </head>
  <body>
    <div class="grid">${labelsHTML}</div>
    <script>
      window.onload = function() { setTimeout(function() { window.print(); }, 500); };
    <\/script>
  </body>
</html>`);
      win.document.close();
    }, 300);
  });
};

// ── Download Excel Template ───────────────────────────────────────────────────
const downloadExcelTemplate = () => {
  const headers = ['asset_id','serial','brand','model','config','processor','ram','storage','purchase_date','warranty_start','warranty_end','vendor','location'];
  const sampleRows = [
    { asset_id:'LTB-301', serial:'DX201', brand:'Dell', model:'Latitude 5540', config:'i7 / 16GB / 512GB SSD', processor:'Intel i7-1355U', ram:'16GB DDR5', storage:'512GB NVMe SSD', purchase_date:'2024-01-10', warranty_start:'2024-01-10', warranty_end:'2027-01-10', vendor:'Dell India', location:'Bengaluru' },
    { asset_id:'LTB-302', serial:'DX202', brand:'HP', model:'ProBook 450', config:'i5 / 8GB / 256GB SSD', processor:'Intel i5-1335U', ram:'8GB DDR5', storage:'256GB SSD', purchase_date:'2024-02-01', warranty_start:'2024-02-01', warranty_end:'2027-02-01', vendor:'HP India', location:'Mumbai' },
    { asset_id:'LTB-303', serial:'LN203', brand:'Lenovo', model:'ThinkPad E14', config:'i5 / 16GB / 512GB SSD', processor:'Intel i5-1335U', ram:'16GB DDR5', storage:'512GB NVMe SSD', purchase_date:'2024-03-01', warranty_start:'2024-03-01', warranty_end:'2027-03-01', vendor:'Lenovo India', location:'Hyderabad' },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  ws['!cols'] = [{ wch:12 },{ wch:12 },{ wch:10 },{ wch:18 },{ wch:24 },{ wch:20 },{ wch:12 },{ wch:16 },{ wch:14 },{ wch:14 },{ wch:14 },{ wch:16 },{ wch:14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Assets');
  XLSX.writeFile(wb, 'asset_import_template.xlsx');
};

// ══════════════════════════════════════════════════════════════════════════════
// ── REPRINT QR TAB ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function ReprintQR({ allAssets }) {
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('All');

  const STATUS_OPTIONS = ['All', 'Stock', 'Allocated', 'Repair', 'Scrap'];

  // Filter assets based on search + status
  const filtered = allAssets.filter(a => {
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (a.id || '').toLowerCase().includes(q) ||
      (a.serial || '').toLowerCase().includes(q) ||
      (a.brand || '').toLowerCase().includes(q) ||
      (a.model || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelected(prev =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map(a => a.id))
    );
  };

  const selectedAssets = allAssets.filter(a => selected.has(a.id));

  // Normalize asset from AppContext shape to QR shape
  const toQRAsset = (a) => ({
    asset_id: a.id, serial: a.serial, brand: a.brand, model: a.model,
    config: a.config, processor: a.processor, ram: a.ram, storage: a.storage,
    vendor: a.vendor, location: a.location,
  });

  return (
    <div>
      {/* Info banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        marginBottom: 18, background: 'var(--accent-glow, rgba(99,102,241,0.08))',
        border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
        fontSize: 13, color: 'var(--text-muted)',
      }}>
        <RefreshCw size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span>
          QR sticker lost or damaged? Search for the laptop below, select it, and reprint its QR label.
          Works for <strong style={{ color: 'var(--text)' }}>any status</strong> — Stock, Allocated, Repair, etc.
        </span>
      </div>

      {/* Search + status filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} />
          <input
            className="form-input"
            placeholder="Search asset ID, serial, brand, model…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="toggle-group">
          {STATUS_OPTIONS.map(s => (
            <button key={s}
              className={`toggle-btn ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
              style={{ fontSize: 12, padding: '4px 10px' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Asset table */}
      <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 14 }} className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  style={{ accentColor: 'var(--accent)' }} />
              </th>
              <th>Asset ID</th><th>Serial</th><th>Brand / Model</th>
              <th>Config</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="empty-state"><p>No assets found</p></div>
              </td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} style={{ opacity: selected.has(a.id) ? 1 : 0.6 }}>
                <td>
                  <input type="checkbox" checked={selected.has(a.id)}
                    onChange={() => toggleSelect(a.id)}
                    style={{ accentColor: 'var(--accent)' }} />
                </td>
                <td><span className="asset-id">{a.id}</span></td>
                <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{a.serial}</span></td>
                <td>
                  <div style={{ fontWeight: 600 }}>{a.brand}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.model}</div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{a.config || '—'}</td>
                <td>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                    background: a.status === 'Stock' ? 'var(--green-bg)' : a.status === 'Allocated' ? 'var(--accent-glow)' : 'var(--surface2)',
                    color: a.status === 'Stock' ? 'var(--green)' : a.status === 'Allocated' ? 'var(--accent)' : 'var(--text-muted)',
                  }}>{a.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected preview */}
      {selected.size > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>
            QR Preview — {selected.size} selected
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14,
            background: 'var(--surface2)', borderRadius: 'var(--radius)',
            maxHeight: 280, overflowY: 'auto',
          }}>
            {selectedAssets.map(a => <QRLabel key={a.id} asset={toQRAsset(a)} size={100} />)}
          </div>
        </div>
      )}

      {/* Print button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {selected.size > 0 ? `${selected.size} label${selected.size > 1 ? 's' : ''} ready to print` : 'Select laptops above'}
        </div>
        <button
          className="btn btn-primary"
          disabled={selected.size === 0}
          onClick={() => printQRLabels(selectedAssets.map(toQRAsset))}>
          <Printer size={14} /> Print / Save as PDF
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function QRBulkImport({ onImported, onClose, allAssets = [], defaultTab = 'import' }) {
  const [activeTab, setActiveTab]   = useState(defaultTab); // ✅ opens on whichever tab was requested
  const [step, setStep]             = useState('import');
  const [assets, setAssets]         = useState([]);
  const [csvText, setCsvText]       = useState('');
  const [result, setResult]         = useState(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [selected, setSelected]     = useState(new Set());
  const fileInputRef                = useRef(null);

  const SAMPLE_CSV = `asset_id,serial,brand,model,config,processor,ram,storage,purchase_date,warranty_start,warranty_end,vendor,location
LTB-301,DX201,Dell,Latitude 5540,i7/16GB/512GB,Intel i7-1355U,16GB DDR5,512GB NVMe,2024-01-10,2024-01-10,2027-01-10,Dell India,Bengaluru
LTB-302,DX202,HP,ProBook 450,i5/8GB/256GB,Intel i5-1335U,8GB DDR5,256GB SSD,2024-02-01,2024-02-01,2027-02-01,HP India,Mumbai`;

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return normalizeRow(obj);
    }).filter(r => r.asset_id && r.serial && r.brand && r.model);
  };

  const parseExcel = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(rows.map(normalizeRow).filter(r => r.asset_id && r.serial && r.brand && r.model));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    try {
      let parsed = [];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) parsed = await parseExcel(file);
      else if (file.name.endsWith('.csv')) parsed = parseCSV(await file.text());
      if (!parsed.length) { setError('No valid rows found. Required columns: asset_id, serial, brand, model'); return; }
      setAssets(parsed);
      setSelected(new Set(parsed.map(a => a.asset_id)));
      setStep('preview');
    } catch (err) { setError('Failed to parse file: ' + err.message); }
    e.target.value = '';
  };

  const handleCSVParse = () => {
    setError('');
    const parsed = parseCSV(csvText);
    if (!parsed.length) { setError('No valid rows found. Required: asset_id, serial, brand, model'); return; }
    setAssets(parsed);
    setSelected(new Set(parsed.map(a => a.asset_id)));
    setStep('preview');
  };

  const handleImport = async () => {
    setSaving(true); setError('');
    try {
      const toImport = assets.filter(a => selected.has(a.asset_id));
      const data = await apiFetch('/assets/bulk', { method: 'POST', body: JSON.stringify({ assets: toImport }) });
      setResult(data.data);
      if (data.data.created.length > 0) {
        const createdIds = new Set(data.data.created);
        setAssets(prev => prev.filter(a => createdIds.has(a.asset_id)));
        onImported?.();
      }
      setStep('qr');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelected(prev => prev.size === assets.length ? new Set() : new Set(assets.map(a => a.asset_id)));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header">
          <h2 className="modal-title">
            <Package size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            {activeTab === 'import' && step === 'import'  && 'Import Laptops & Generate QR Codes'}
            {activeTab === 'import' && step === 'preview' && `Preview — ${assets.length} Laptops`}
            {activeTab === 'import' && step === 'qr'      && 'QR Labels Ready to Print'}
            {activeTab === 'reprint' && 'Reprint QR Labels'}
          </h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* ── Tab switcher ── */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
          padding: '0 24px', background: 'var(--surface)',
        }}>
          {[
            { key: 'import',  label: '📥 Import & Generate QR' },
            { key: 'reprint', label: '🔄 Reprint QR Labels' },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setStep('import'); }}
              style={{
                padding: '10px 18px', border: 'none', background: 'transparent',
                borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: activeTab === tab.key ? 700 : 400,
                fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body">

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* ── REPRINT TAB ── */}
          {activeTab === 'reprint' && (
            <ReprintQR allAssets={allAssets} />
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* ── IMPORT TAB ── */}
          {activeTab === 'import' && (
            <>
              {/* STEP 1: IMPORT */}
              {step === 'import' && (
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', marginBottom: 20,
                    background: 'var(--accent-glow, rgba(99,102,241,0.08))',
                    border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>📥 Step 1 — Download the Excel Template</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        Fill in asset details and upload below
                      </div>
                    </div>
                    <button className="btn btn-secondary" onClick={downloadExcelTemplate} style={{ flexShrink: 0 }}>
                      <Download size={14} /> Download Template
                    </button>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📤 Step 2 — Upload filled Excel / CSV</div>
                  <div style={{
                    border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                    padding: 22, textAlign: 'center', marginBottom: 20, cursor: 'pointer',
                    background: 'var(--surface2)',
                  }} onClick={() => fileInputRef.current?.click()}>
                    <Upload size={24} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Click to choose file or drag & drop</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Supports .xlsx, .xls, .csv</div>
                    <button className="btn btn-primary" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                      <Upload size={14} /> Choose File
                    </button>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                      style={{ display: 'none' }} onChange={handleFileUpload} />
                  </div>

                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>— or paste CSV directly —</div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="form-label">Paste CSV Data</label>
                      <button className="btn btn-secondary btn-sm" onClick={() => setCsvText(SAMPLE_CSV)}>
                        <FileText size={13} /> Load Sample
                      </button>
                    </div>
                    <textarea className="form-textarea"
                      style={{ minHeight: 110, fontFamily: 'var(--mono)', fontSize: 12 }}
                      value={csvText} onChange={e => setCsvText(e.target.value)}
                      placeholder="asset_id,serial,brand,model,config,...&#10;LTB-301,DX201,Dell,Latitude 5540,..." />
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Required: <code>asset_id, serial, brand, model</code> — all others optional. Date format: <code>YYYY-MM-DD</code>
                  </div>

                  {error && (
                    <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12,
                      padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 'var(--radius)' }}>
                      <AlertTriangle size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />{error}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={handleCSVParse} disabled={!csvText.trim()}>
                      <FileText size={14} /> Parse & Preview
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PREVIEW */}
              {step === 'preview' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      <strong style={{ color: 'var(--text)' }}>{selected.size}</strong> of {assets.length} selected
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
                        {selected.size === assets.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setStep('import')}>Back</button>
                    </div>
                  </div>

                  <div style={{ maxHeight: 380, overflowY: 'auto', marginBottom: 16 }} className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>
                            <input type="checkbox" checked={selected.size === assets.length}
                              onChange={toggleAll} style={{ accentColor: 'var(--accent)' }} />
                          </th>
                          <th>Asset ID</th><th>Serial</th><th>Brand / Model</th>
                          <th>Config</th><th>Processor</th><th>RAM</th><th>Storage</th><th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assets.map(a => (
                          <tr key={a.asset_id} style={{ opacity: selected.has(a.asset_id) ? 1 : 0.45 }}>
                            <td>
                              <input type="checkbox" checked={selected.has(a.asset_id)}
                                onChange={() => toggleSelect(a.asset_id)}
                                style={{ accentColor: 'var(--accent)' }} />
                            </td>
                            <td><span className="asset-id">{a.asset_id}</span></td>
                            <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{a.serial}</span></td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{a.brand}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.model}</div>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{a.config || '—'}</td>
                            <td style={{ fontSize: 12 }}>{a.processor || '—'}</td>
                            <td style={{ fontSize: 12 }}>{a.ram || '—'}</td>
                            <td style={{ fontSize: 12 }}>{a.storage || '—'}</td>
                            <td style={{ fontSize: 12 }}>{a.location || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {error && (
                    <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12,
                      padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 'var(--radius)' }}>
                      <AlertTriangle size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />{error}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => setStep('import')}>Back</button>
                    <button className="btn btn-primary" onClick={handleImport} disabled={saving || selected.size === 0}>
                      {saving ? 'Importing…' : `Import ${selected.size} Laptops & Generate QR Codes`}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: QR LABELS */}
              {step === 'qr' && (
                <div>
                  {result && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                      <div style={{ flex: 1, padding: '12px 16px', background: 'var(--green-bg)',
                        border: '1px solid rgba(52,211,153,.2)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{result.created.length}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Added to Stock ✅</div>
                      </div>
                      {result.failed.length > 0 && (
                        <div style={{ flex: 1, padding: '12px 16px', background: 'var(--red-bg)',
                          border: '1px solid rgba(248,113,113,.2)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)', fontFamily: 'var(--mono)' }}>{result.failed.length}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Failed</div>
                        </div>
                      )}
                    </div>
                  )}

                  {result?.failed?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      {result.failed.map((f, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--red)', marginBottom: 3 }}>{f.id}: {f.reason}</div>
                      ))}
                    </div>
                  )}

                  {assets.length > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          QR Labels — {assets.length} laptop{assets.length > 1 ? 's' : ''}
                          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                            Print and stick on laptops
                          </span>
                        </div>
                        <button className="btn btn-primary" onClick={() => printQRLabels(assets)}>
                          <Printer size={14} /> Print / Save as PDF
                        </button>
                      </div>

                      <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16,
                        background: 'var(--surface2)', borderRadius: 'var(--radius)',
                        maxHeight: 460, overflowY: 'auto', marginBottom: 16,
                      }}>
                        {assets.map(a => <QRLabel key={a.asset_id} asset={a} size={110} />)}
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={onClose}>
                      <CheckCircle size={14} /> Done
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}