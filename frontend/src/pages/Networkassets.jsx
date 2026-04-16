import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Search, Upload, Edit2, Trash2, X, Download,
  Server, Wifi, Printer, Shield, Radio, RefreshCw, FileText
} from 'lucide-react';
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

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

const TYPES = [
  { id: 'Switch',   label: 'HP Switches',   icon: Radio,   color: '#2563eb' },
  { id: 'Server',   label: 'Rack Servers',  icon: Server,  color: '#7c3aed' },
  { id: 'Router',   label: 'WiFi Routers',  icon: Wifi,    color: '#059669' },
  { id: 'Printer',  label: 'Printers',      icon: Printer, color: '#d97706' },
  { id: 'Firewall', label: 'Firewalls',     icon: Shield,  color: '#dc2626' },
];

const STATUSES = ['In Use', 'Not In Use', 'In Stock', 'Decommissioned', 'Repair'];

const EMPTY_FORM = {
  asset_id:'', asset_type:'Switch', make:'', model:'', asset_owner:'IT',
  serial_number:'', ip_address:'', subnet:'', location:'',
  warranty_start:'', warranty_end:'', warranty_status:'',
  status:'In Use', used_for:'', remarks:'', brand:'',
  cartridge_no:'', rent_or_own:'', allocated_dept:'', his_status:'', notes:'',
};

const COLS = {
  Switch:   ['asset_id','make','model','serial_number','ip_address','subnet','location','warranty_status','status'],
  Server:   ['asset_id','make','model','serial_number','location','warranty_start','warranty_end','used_for','status','remarks'],
  Router:   ['asset_id','brand','model','serial_number','location','warranty_start','warranty_end','status'],
  Printer:  ['asset_id','make','model','serial_number','cartridge_no','rent_or_own','allocated_dept','ip_address','status'],
  Firewall: ['asset_id','make','model','serial_number','location','warranty_start','warranty_end','his_status','status'],
};

const LABELS = {
  asset_id:'Asset No', make:'Make', model:'Model', brand:'Brand',
  serial_number:'Serial No', ip_address:'IP Address', subnet:'Subnet',
  location:'Location', warranty_status:'Warranty', warranty_start:'Warranty Start',
  warranty_end:'Warranty End', status:'Status', used_for:'Used For',
  remarks:'Remarks', cartridge_no:'Cartridge No', rent_or_own:'Rent/Own',
  allocated_dept:'Allocated To', his_status:'HIS Status',
};

function StatusPill({ status }) {
  const colors = {
    'In Use':        { bg:'#d1fae5', color:'#065f46' },
    'Not In Use':    { bg:'#fee2e2', color:'#991b1b' },
    'In Stock':      { bg:'#dbeafe', color:'#1e40af' },
    'Decommissioned':{ bg:'#f3f4f6', color:'#374151' },
    'Repair':        { bg:'#fef3c7', color:'#92400e' },
  };
  const s = colors[status] || { bg:'#f3f4f6', color:'#374151' };
  return (
    <span style={{ ...s, padding:'2px 10px', borderRadius:20, fontSize:11.5, fontWeight:700, display:'inline-block' }}>
      {status}
    </span>
  );
}

// ── Edit / Create Modal ───────────────────────────────────────────────────────
function AssetModal({ initial, assetType, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, asset_type: assetType, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial?.id;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/network-assets/${initial.id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await apiFetch('/network-assets', { method: 'POST', body: JSON.stringify(form) });
      }
      onSaved(); onClose();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const fields = {
    Switch:   [['asset_id','Asset ID *','LTB-SW/001'],['make','Make','HP'],['model','Model','A5120-48G'],['serial_number','Serial Number','CN3BBY...'],['ip_address','IP Address','172.16.30.11'],['subnet','Subnet','255.255.255.0'],['location','Location','Bangalore'],['warranty_status','Warranty Status','lifetime warranty'],['status','Status','In Use']],
    Server:   [['asset_id','Asset ID *','S-60'],['make','Make','HP'],['model','Model','Tower Proliant ML150G6'],['serial_number','Serial Number',''],['location','Location','Bangalore'],['warranty_start','Warranty Start',''],['warranty_end','Warranty End',''],['used_for','Used For','mail server'],['status','Status'],['remarks','Remarks','']],
    Router:   [['asset_id','Asset ID *','WR-32'],['brand','Brand','Aruba'],['model','Model','AP-515'],['serial_number','S/N','CNQ3LBN2ZH'],['location','Location','Bangalore'],['warranty_start','Warranty Start',''],['warranty_end','Warranty End',''],['status','Status']],
    Printer:  [['asset_id','Asset ID *','PRT-001'],['make','Make','Canon'],['model','Model','iR-ADV 4525'],['serial_number','Serial Number','XWH01306'],['cartridge_no','Cartridge No',''],['rent_or_own','Rent/Own','indigo'],['allocated_dept','Allocated To Dept','HR'],['ip_address','IP Address',''],['status','Status']],
    Firewall: [['asset_id','Asset ID *','MIND/FW-01'],['make','Make','Sophos'],['model','Model','XG450'],['serial_number','Serial Number',''],['location','Location','BANGALORE AMR'],['warranty_start','Warranty Start',''],['warranty_end','Warranty End',''],['his_status','HIS Status','EOL'],['status','Status']],
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit' : 'Add'} {assetType}</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSave}>
            <div className="form-grid form-grid-2">
              {(fields[assetType] || fields.Switch).map(([key, label, placeholder]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  {key === 'status' ? (
                    <select className="form-select" value={form[key]||'In Use'} onChange={e=>set(key,e.target.value)}>
                      {STATUSES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  ) : (key.includes('start')||key.includes('end')) ? (
                    <input type="date" className="form-input" value={form[key]||''} onChange={e=>set(key,e.target.value)}/>
                  ) : (
                    <input className="form-input" value={form[key]||''} onChange={e=>set(key,e.target.value)} placeholder={placeholder||''}/>
                  )}
                </div>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes||''} onChange={e=>set('notes',e.target.value)}/>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Asset')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Excel Import Modal ────────────────────────────────────────────────────────
function ImportModal({ assetType, onClose, onImported }) {
  const fileRef    = useRef();
  const [rows,     setRows]     = useState([]);
  const [result,   setResult]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const [sheets,   setSheets]   = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [workbook, setWorkbook] = useState(null);

  // ── Step 1: Read file, show sheet selector ──────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRows([]);
    setParseMsg('');
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb   = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheets(wb.SheetNames);
        setSelectedSheets([wb.SheetNames[0]]);
        setParseMsg(`📋 Found ${wb.SheetNames.length} sheet(s). Select which to import then click "Parse".`);
      } catch (err) {
        setParseMsg('❌ Error reading file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Step 2: Parse selected sheets ──────────────────────────────────────
  const handleParse = () => {
    if (!workbook || !selectedSheets.length) return;

    const allRows = [];
    let currentModel = '';

    selectedSheets.forEach((sheetName) => {
      const ws        = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      console.log(`📄 Sheet: ${sheetName}`, sheetData);
      if (sheetData.length < 2) return;

      let headerIndex = -1;
      let colMap      = {};
      currentModel    = '';

      // ── Find header row ─────────────────────────────────────────────
      for (let i = 0; i < Math.min(5, sheetData.length); i++) {
        const row    = sheetData[i];
        const rowStr = row.map(c => c?.toString().toLowerCase().trim() || '');
        const nonEmpty = rowStr.filter(c => c.length > 0);
        if (nonEmpty.length < 2) continue;

        const isHeader = rowStr.some(c =>
          c.includes('asset')    || c.includes('serial')   ||
          c.includes('make')     || c.includes('model')    ||
          c.includes('brand')    || c.includes('location') ||
          c.includes('warranty') || c.includes('wifi')     ||
          c.includes('network')  || c.includes('switch')
        );

        if (isHeader) {
          headerIndex = i;
          colMap = {};

          row.forEach((cell, idx) => {
            const key = cell?.toString().toLowerCase().trim() || '';
            if (!key) return;

            // Asset ID
            if (key === 'asset number'         || key === 'asset no'   ||
                key === 'asset id'             || key === 'wifi network device' ||
                key === 'printer asset number')              colMap.asset_id        = idx;

            // Make / Brand
            if (key === 'make')                              colMap.make            = idx;
            if (key === 'brand')                             colMap.brand           = idx;

            // Model
            if (key === 'model')                             colMap.model           = idx;

            // Serial
            if (key === 'serial number' || key === 's/n' ||
                key === 'sn'            || key === 'serial no') colMap.serial_number = idx;

            // Location
            if (key === 'location' || key === 'site')        colMap.location        = idx;

            // IP
            if (key === 'ip address' || key === 'ip')        colMap.ip_address      = idx;

            // Subnet
            if (key === 'subnet')                            colMap.subnet          = idx;

            // Status / HIS
            if (key === 'status')                            colMap.status_raw      = idx;
            if (key === 'his' || key === 'his status')       colMap.his_status      = idx;

            // Warranty
            if (key === 'warranty start date' || key === 'warranty start' ||
                key === 'warranty from')                     colMap.warranty_start  = idx;
            if (key === 'warranty end date'   || key === 'warranty end'  ||
                key === 'warranty to'         || key === 'warranty expiry') colMap.warranty_end = idx;
            if (key === 'warranty status'     || key === 'warranty'      ||
                key === 'warranty period')                   colMap.warranty_status = idx;

            // Used For / Remarks
            if (key === 'used for' || key === 'purpose')     colMap.used_for        = idx;
            if (key.includes('remark'))                      colMap.remarks         = idx;

            // Printer specific
            if (key.includes('cartridge'))                   colMap.cartridge_no    = idx;
            if (key.includes('rent') || key === 'rent/own printer' ||
                key === 'own/rent')                          colMap.rent_or_own     = idx;
            if (key.includes('allocated') || key === 'allocated to' ||
                key === 'allocated dept'  || key === 'department')  colMap.allocated_dept = idx;
          });

          console.log(`✅ Headers in "${sheetName}" (row ${i}):`, JSON.stringify(colMap));
          break;
        }
      }

      if (headerIndex === -1 || Object.keys(colMap).length === 0) {
        console.warn(`⚠️ No valid headers in sheet: ${sheetName}`);
        return;
      }

      // ── Parse data rows ─────────────────────────────────────────────
      for (let i = headerIndex + 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.every(c => !c || c.toString().trim() === '')) continue;

        const get = (key) =>
          colMap[key] !== undefined
            ? (row[colMap[key]] || '').toString().trim()
            : '';

        const assetRaw  = get('asset_id');
        const serialRaw = get('serial_number');
        const makeRaw   = get('make');
        const modelRaw  = get('model');
        const brandRaw  = get('brand');

        // Detect Switch model section header rows (colored rows with no asset/serial)
        if (assetType === 'Switch' && !assetRaw && !serialRaw) {
          const rowText = row.filter(c => c && c.toString().trim()).join(' ').trim();
          if (rowText && rowText.length > 3) {
            currentModel = rowText;
            console.log(`🔖 Switch model section: ${currentModel}`);
          }
          continue;
        }

        // Skip completely empty rows
        if (!assetRaw && !serialRaw && !makeRaw && !brandRaw && !modelRaw) continue;

        // ── Auto-detect make ──
        let make = makeRaw || brandRaw || '';
        if (!make) {
          const searchStr = (modelRaw + ' ' + assetRaw + ' ' + currentModel).toLowerCase();
          if (searchStr.includes('sophos'))                       make = 'Sophos';
          else if (searchStr.includes('fortinet') ||
                   searchStr.includes('fortigate'))               make = 'Fortinet';
          else if (searchStr.includes('cisco'))                   make = 'Cisco';
          else if (searchStr.includes('palo'))                    make = 'Palo Alto';
          else if (searchStr.includes('juniper'))                 make = 'Juniper';
          else if (searchStr.includes('aruba'))                   make = 'Aruba';
          else if (searchStr.includes('tp-link') ||
                   searchStr.includes('tp link'))                 make = 'TP-Link';
          else if (searchStr.includes('ubiquiti'))                make = 'Ubiquiti';
          else if (searchStr.includes('hp')      ||
                   searchStr.includes('a5120')   ||
                   searchStr.includes('a5500')   ||
                   searchStr.includes('proliant'))                make = 'HP';
          else if (searchStr.includes('canon')   ||
                   searchStr.includes('ir-adv'))                  make = 'Canon';
          else if (searchStr.includes('dell')    ||
                   searchStr.includes('poweredge'))               make = 'Dell';
          else if (searchStr.includes('emc'))                     make = 'EMC';
        }

        // For Switches: use section header as model if no model column
        const resolvedModel = modelRaw || (assetType === 'Switch' ? currentModel : '') || '';

        // ── Validate asset_id ──
        const blacklist = ['indigo','rental','own','it','admin'];
        const isValidId = assetRaw && !blacklist.includes(assetRaw.toLowerCase());

        const prefixMap = {
          Switch: 'SW', Server: 'SRV', Router: 'WR', Printer: 'PRT', Firewall: 'FW',
        };
        const prefix = prefixMap[assetType] || 'AST';

        const assetId = isValidId
          ? assetRaw
          : serialRaw
            ? `${prefix}-${serialRaw}`
            : `${prefix}-${sheetName.substring(0,3).toUpperCase()}-${i}`;

        // ── Clean IP ──
        const cleanIP = get('ip_address')
          .replace(/^https?:\/\//i, '')
          .replace(/:\d+\/?$/, '')
          .trim();

        // ── Parse dates ──
        const cleanDate = (val) => {
          if (!val) return '';
          const str = val.toString().trim();
          if (!str) return '';

          // Excel serial number
          if (!isNaN(str) && Number(str) > 1000) {
            const d = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
            return d.toISOString().split('T')[0];
          }

          const months = {
            jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
            jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
          };

          // "01-Apr-21" or "01-Mar-2025"
          const dmy = str.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{2,4})$/);
          if (dmy) {
            const [, d, m, y] = dmy;
            const yr = y.length === 2 ? (Number(y) > 50 ? `19${y}` : `20${y}`) : y;
            return `${yr}-${months[m.toLowerCase()] || '01'}-${d.padStart(2,'0')}`;
          }

          // "Nov-23" or "Apr-25" (month-year only)
          const my = str.match(/^([A-Za-z]{3})[-\/](\d{2,4})$/);
          if (my) {
            const [, m, y] = my;
            const yr = y.length === 2 ? `20${y}` : y;
            return `${yr}-${months[m.toLowerCase()] || '01'}-01`;
          }

          // Invalid date text
          if (isNaN(Date.parse(str))) return '';

          return str;
        };

        // ── Resolve status ──
        const hisRaw    = get('his_status');
        const statusRaw = get('status_raw');

        const resolveStatus = (s) => {
          const sl = (s || '').toLowerCase();
          if (sl === 'in stock' || sl === 'instock')                return 'In Stock';
          if (sl === 'in use'   || sl === 'active' || sl === 'inuse') return 'In Use';
          if (sl === 'eol'      || sl === 'end of life' ||
              sl === 'not in use')                                    return 'Not In Use';
          if (sl === 'decommissioned')                               return 'Decommissioned';
          if (sl === 'repair')                                        return 'Repair';
          return 'In Use';
        };

        const isOutOfWarranty = (v) =>
          (v || '').toLowerCase().includes('out of warranty') ||
          (v || '').toLowerCase().includes('out-of-warranty');

        const warrantyStartRaw = get('warranty_start');
        const warrantyEndRaw   = get('warranty_end');

        const record = {
          asset_id:        assetId,
          asset_type:      assetType,
          make:            make,
          model:           resolvedModel,
          serial_number:   serialRaw,
          ip_address:      cleanIP,
          subnet:          get('subnet'),
          location:        get('location') || sheetName,
          status:          resolveStatus(statusRaw || hisRaw),
          warranty_start:  isOutOfWarranty(warrantyStartRaw) ? '' : cleanDate(warrantyStartRaw),
          warranty_end:    isOutOfWarranty(warrantyEndRaw)   ? '' : cleanDate(warrantyEndRaw),
          warranty_status: get('warranty_status') ||
                           (isOutOfWarranty(warrantyStartRaw) ? 'Out Of Warranty' : ''),
          used_for:        get('used_for'),
          remarks:         get('remarks'),
          brand:           brandRaw,
          cartridge_no:    get('cartridge_no'),
          rent_or_own:     get('rent_or_own'),
          allocated_dept:  get('allocated_dept'),
          his_status:      hisRaw || statusRaw,
          notes:           `Imported from sheet: ${sheetName}`,
        };

        console.log(`Row ${i} →`, record);
        allRows.push(record);
      }
    });

    console.log('🚀 Final allRows:', allRows);

    if (!allRows.length) {
      setParseMsg('❌ No valid data found. Check console for details.');
      return;
    }

    setRows(allRows);
    setParseMsg(`✅ ${allRows.length} record(s) ready from: ${selectedSheets.join(', ')}`);
  };

  // ── Step 3: Bulk import ─────────────────────────────────────────────────
  const handleImport = async () => {
    if (!rows.length) return;
    setSaving(true);
    try {
      const assetsToImport = rows.map(row => ({
        asset_id:        row.asset_id        || '',
        asset_type:      row.asset_type      || assetType,
        make:            row.make            || '',
        model:           row.model           || '',
        serial_number:   row.serial_number   || '',
        ip_address:      row.ip_address      || '',
        subnet:          row.subnet          || '',
        allocated_dept:  row.allocated_dept  || '',
        rent_or_own:     row.rent_or_own     || '',
        status:          row.status          || 'In Use',
        location:        row.location        || '',
        cartridge_no:    row.cartridge_no    || '',
        used_for:        row.used_for        || '',
        remarks:         row.remarks         || '',
        notes:           row.notes           || '',
        warranty_start:  row.warranty_start  || '',
        warranty_end:    row.warranty_end    || '',
        warranty_status: row.warranty_status || '',
        his_status:      row.his_status      || '',
        brand:           row.brand           || '',
      }));

      const data = await apiFetch('/network-assets/bulk', {
        method: 'POST',
        body: JSON.stringify({ assets: assetsToImport }),
      });

      setResult(data.data);
      onImported();
    } catch (err) {
      console.error('Import error:', err);
      setParseMsg('❌ Import failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSheet = (name) => {
    setSelectedSheets(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
    setRows([]);
    setParseMsg(p => p.startsWith('✅') ? '' : p);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Import {assetType}s from Excel</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="modal-body">
          {result ? (
            <div>
              <div style={{ display:'flex', gap:16, marginBottom:20 }}>
                <div style={{ flex:1, textAlign:'center', padding:20, background:'#d1fae5', borderRadius:'var(--radius)' }}>
                  <div style={{ fontSize:28, fontWeight:800, color:'#065f46' }}>{result.created?.length || 0}</div>
                  <div style={{ fontSize:13, color:'#374151' }}>Imported</div>
                </div>
                <div style={{ flex:1, textAlign:'center', padding:20, background:'#fee2e2', borderRadius:'var(--radius)' }}>
                  <div style={{ fontSize:28, fontWeight:800, color:'#991b1b' }}>{result.failed?.length || 0}</div>
                  <div style={{ fontSize:13, color:'#374151' }}>Failed</div>
                </div>
              </div>
              {result.failed?.map((f, i) => (
                <div key={i} style={{ fontSize:12, color:'#dc2626', marginBottom:4 }}>
                  {f.id}: {f.reason}
                </div>
              ))}
              <button className="btn btn-primary" style={{ width:'100%', marginTop:16 }} onClick={onClose}>
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Upload area */}
              <div
                style={{ padding:'20px', border:'2px dashed var(--border2)', borderRadius:'var(--radius)', textAlign:'center', cursor:'pointer', marginBottom:16 }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleFile}/>
                <Upload size={32} color="var(--text-muted)" style={{ display:'block', margin:'0 auto 8px' }}/>
                <div style={{ fontWeight:600, marginBottom:4 }}>Click to upload Excel file</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>Supports .xlsx, .xls, .csv</div>
              </div>

              {/* Sheet selector */}
              {sheets.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>
                    Select sheet(s) to import:
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                    {sheets.map(name => (
                      <button
                        key={name}
                        onClick={() => toggleSheet(name)}
                        style={{
                          padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600,
                          border: selectedSheets.includes(name) ? '2px solid #2563eb' : '2px solid var(--border)',
                          background: selectedSheets.includes(name) ? '#dbeafe' : 'var(--surface2)',
                          color: selectedSheets.includes(name) ? '#1e40af' : 'var(--text-dim)',
                          cursor:'pointer',
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ width:'100%' }}
                    onClick={handleParse}
                    disabled={!selectedSheets.length}
                  >
                    <FileText size={14}/> Parse Selected Sheet(s)
                  </button>
                </div>
              )}

              {/* Status message */}
              {parseMsg && (
                <div style={{
                  fontSize:13, fontWeight:600, marginBottom:12,
                  color: parseMsg.startsWith('❌') ? '#dc2626'
                       : parseMsg.startsWith('✅') ? '#059669'
                       : '#92400e',
                  padding:'10px 14px',
                  background: parseMsg.startsWith('❌') ? '#fee2e2'
                            : parseMsg.startsWith('✅') ? '#d1fae5'
                            : '#fef3c7',
                  borderRadius:'var(--radius)',
                }}>
                  {parseMsg}
                </div>
              )}

              {/* Preview table */}
              {rows.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ maxHeight:260, overflowY:'auto' }} className="table-wrap">
                    <table style={{ width:'100%', fontSize:12 }}>
                      <thead>
                        <tr>
                          {['asset_id','make','model','serial_number','location','status'].map(k => (
                            <th key={k} style={{ padding:'8px', textAlign:'left', background:'#f9fafb' }}>
                              {LABELS[k] || k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 15).map((r, i) => (
                          <tr key={i}>
                            {['asset_id','make','model','serial_number','location','status'].map((k, j) => (
                              <td key={j} style={{ padding:'8px', borderTop:'1px solid #e5e7eb' }}>
                                {r[k] ? String(r[k]).substring(0, 35) : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 15 && (
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:8 }}>
                      ...and {rows.length - 15} more rows
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={!rows.length || saving}
                  onClick={handleImport}
                >
                  <Upload size={14}/> {saving ? 'Importing…' : `Import ${rows.length} Rows`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NetworkAssets() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab,  setActiveTab]  = useState('Switch');
  const [assets,     setAssets]     = useState([]);
  const [stats,      setStats]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [statusFlt,  setStatusFlt]  = useState('All');
  const [showAdd,    setShowAdd]    = useState(false);
  const [editAsset,  setEditAsset]  = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [deleteConf, setDeleteConf] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const [assetsRes, statsRes] = await Promise.all([
        apiFetch(`/network-assets?type=${activeTab}`),
        apiFetch('/network-assets/stats'),
      ]);
      setAssets(assetsRes.data);
      setStats(statsRes.data);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAssets(); }, [activeTab]);

  const filtered = assets.filter(a => {
    const ms = !search || [a.asset_id, a.make, a.model, a.serial_number, a.location, a.brand]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const mf = statusFlt === 'All' || a.status === statusFlt;
    return ms && mf;
  });

  // ── Export to Excel function ─────────────────────────────────────────────
  const handleExportToExcel = () => {
    if (!filtered.length) {
      alert('No data to export');
      return;
    }

    // Prepare data for export
    const exportData = filtered.map(asset => {
      const row = {};
      const cols = COLS[activeTab] || COLS.Switch;
      
      cols.forEach(col => {
        let value = asset[col];
        
        // Format dates
        if ((col === 'warranty_start' || col === 'warranty_end') && value) {
          value = value.split('T')[0];
        }
        
        // Format status display
        if (col === 'status' && value) {
          // Keep as is for Excel
        }
        
        row[LABELS[col] || col] = value || '';
      });
      
      // Add additional fields for completeness
      if (activeTab === 'Switch') {
        row['Brand'] = asset.brand || '';
      }
      if (activeTab === 'Server') {
        row['Remarks'] = asset.remarks || '';
      }
      if (activeTab === 'Firewall') {
        row['HIS Status'] = asset.his_status || '';
      }
      
      return row;
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-size columns (optional)
    const maxWidth = 20;
    ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wch: maxWidth }));
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    
    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `${activeTab}_Assets_${date}.xlsx`;
    
    // Download file
    XLSX.writeFile(wb, filename);
  };

  const handleDelete = async () => {
    try {
      await apiFetch(`/network-assets/${deleteConf.id}`, { method: 'DELETE' });
      setDeleteConf(null);
      fetchAssets();
    } catch(e){ alert(e.message); }
  };

  const cols = COLS[activeTab] || COLS.Switch;
  const typeConf = TYPES.find(t => t.id === activeTab);
  const TypeIcon = typeConf?.icon || Server;
  const typeColor = typeConf?.color || 'var(--accent)';

  const statMap = {
    Switch:   stats.switches,
    Server:   stats.servers,
    Router:   stats.routers,
    Printer:  stats.printers,
    Firewall: stats.firewalls,
  };

  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Network Assets</h1>
          <p>Switches, Servers, Routers, Printers, Firewalls</p>
        </div>
        {isAdmin && (
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-secondary" onClick={handleExportToExcel}>
              <Download size={15}/> Export Excel
            </button>
            <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
              <Upload size={15}/> Import Excel
            </button>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={15}/> Add {activeTab}
            </button>
          </div>
        )}
      </div>

      {/* Type tabs */}
      <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap' }}>
        {TYPES.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button key={t.id}
              onClick={() => { setActiveTab(t.id); setSearch(''); setStatusFlt('All'); }}
              style={{
                display:'flex', alignItems:'center', gap:8, padding:'10px 18px',
                borderRadius:'var(--radius-lg)', border:`1px solid ${active ? t.color : 'var(--border)'}`,
                background: active ? `${t.color}18` : 'var(--surface2)',
                color: active ? t.color : 'var(--text-dim)', fontWeight:600, fontSize:13,
                cursor:'pointer', transition:'all .18s',
              }}>
              <Icon size={16}/>
              {t.label}
              <span style={{
                background: active ? t.color : 'var(--border)',
                color: active ? '#fff' : 'var(--text-muted)',
                padding:'1px 8px', borderRadius:20, fontSize:11, fontWeight:700,
              }}>
                {statMap[t.id] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex:1, maxWidth:340 }}>
          <Search size={15}/>
          <input className="form-input" placeholder={`Search ${activeTab}s…`}
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="toggle-group">
          {['All', ...STATUSES].map(s => (
            <button key={s} className={`toggle-btn ${statusFlt===s?'active':''}`}
              onClick={() => setStatusFlt(s)}>
              {s}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAssets}>
          <RefreshCw size={13}/>
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {cols.map(c => <th key={c}>{LABELS[c]||c}</th>)}
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length + (isAdmin?1:0)}>
                <div className="empty-state"><p>Loading…</p></div>
               </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={cols.length + (isAdmin?1:0)}>
                <div className="empty-state">
                  <TypeIcon size={32} color={typeColor}/>
                  <p>No {activeTab}s found</p>
                </div>
               </td></tr>
            ) : filtered.map(a => (
              <tr key={a.id}>
                {cols.map(c => (
                  <td key={c} style={{ fontSize: 12.5 }}>
                    {c === 'asset_id'
                      ? <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:typeColor, fontSize:12 }}>{a[c]}</span>
                      : c === 'status'
                        ? <StatusPill status={a[c]}/>
                        : c === 'serial_number'
                          ? <span style={{ fontFamily:'var(--mono)', fontSize:11 }}>{a[c]}</span>
                          : (c === 'warranty_start' || c === 'warranty_end')
                            ? <span style={{ fontFamily:'var(--mono)', fontSize:11, color: a[c] && new Date(a[c]) < new Date() ? 'var(--red)' : 'var(--text-dim)' }}>
                                {a[c] ? String(a[c]).split('T')[0] : '—'}
                              </span>
                            : <span style={{ color:'var(--text-dim)' }}>{a[c]||'—'}</span>
                    }
                   </td>
                ))}
                {isAdmin && (
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditAsset(a)}>
                        <Edit2 size={12}/>
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteConf(a)}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                   </td>
                )}
               </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showAdd    && <AssetModal assetType={activeTab} onClose={()=>setShowAdd(false)} onSaved={fetchAssets}/>}
      {editAsset  && <AssetModal initial={editAsset} assetType={activeTab} onClose={()=>setEditAsset(null)} onSaved={fetchAssets}/>}
      {showImport && <ImportModal assetType={activeTab} onClose={()=>setShowImport(false)} onImported={fetchAssets}/>}

      {/* Delete confirm */}
      {deleteConf && (
        <div className="modal-overlay" onClick={()=>setDeleteConf(null)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete {activeTab}</h2>
              <button className="btn btn-icon" onClick={()=>setDeleteConf(null)}><X size={16}/></button>
            </div>
            <div className="modal-body">
              <div style={{ background:'var(--red-bg)', border:'1px solid rgba(248,113,113,.2)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:20 }}>
                <div style={{ fontWeight:600, color:'var(--red)', marginBottom:4 }}>Permanently delete?</div>
                <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                  <strong>{deleteConf.asset_id}</strong> — {deleteConf.make} {deleteConf.model}
                </div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button className="btn btn-secondary" onClick={()=>setDeleteConf(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDelete}>
                  <Trash2 size={14}/> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}