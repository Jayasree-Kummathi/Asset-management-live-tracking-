// frontend/src/components/common/AIChatbot.jsx
// v10 — Added: comprehensive cross-table name search
//       (employee directory + allocations + audit logs + accessories + acceptance tokens)
//       Everything else unchanged from v9.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, Sparkles, User, Minimize2, Maximize2,
  Trash2, Copy, Check, RefreshCw, ArrowRight,
  Search, AlertCircle, CheckCircle2, Upload, Edit2, Eye,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`Failed: ${path} (${res.status})`);
  return res.json();
};

const toArr = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  const keys = ['data','results','items','records','assets','employees','licenses',
    'allocations','repairs','scraps','deleted','networkAssets','network_assets',
    'accessories','users','acceptanceTracker','acceptance_tracker'];
  for (const k of keys) { if (Array.isArray(val[k])) return val[k]; }
  const found = Object.values(val).find(v => Array.isArray(v));
  return found || [];
};

// ── Page chip config ──────────────────────────────────────────────────────────
const PAGE_CHIPS = {
  dashboard:  ['overview','show alerts','pending laptop returns','asset status'],
  receive:    ['who has laptop','pending returns','active allocations','receive laptop'],
  swap:       ['active allocations','swap laptop','available stock','employee summary'],
  allocate:   ['available stock','employee summary','how to allocate','asset status'],
  repair:     ['under repair','repair count','repair status','scrap count'],
  employees:  ['employee summary','active employees','pending returns','employee count'],
  inventory:  ['asset status','low stock','warranty status','all assets'],
  licenses:   ['license usage','expiring licenses','full licenses','license count'],
  network:    ['network assets','wifi routers','rack servers','switches'],
  audit:      ['audit logs','recent actions','allocation history'],
  allocations:['active allocations','who has laptop','pending returns','allocation history'],
  default:    ['overview','asset status','employee summary','show alerts','pending laptop returns','license usage'],
};
const PAGE_LABELS = {
  dashboard:'Dashboard', receive:'Receive Laptop', swap:'Swap Laptop',
  allocate:'Allocate Laptop', repair:'Repair Assets', employees:'Employees',
  inventory:'Inventory', licenses:'Licenses', network:'Network Assets',
  audit:'Audit Logs', allocations:'Allocation List',
};
const CHIP_META = {
  'overview':'Full overview','asset status':'Asset status','employee summary':'Employee summary',
  'license usage':'License usage','repair status':'Repair status','show alerts':'Show alerts',
  'pending laptop returns':'Pending returns','network assets':'Network assets',
  'who has laptop':'Who has laptops','pending returns':'Pending returns',
  'active allocations':'Active allocations','receive laptop':'How to receive',
  'swap laptop':'How to swap','available stock':'Available stock',
  'how to allocate':'How to allocate','under repair':'Under repair',
  'repair count':'Repair count','scrap count':'Scrap count',
  'active employees':'Active employees','employee count':'Employee count',
  'low stock':'Low stock','warranty status':'Warranty status','all assets':'All assets',
  'expiring licenses':'Expiring licenses','full licenses':'Full licenses',
  'license count':'License count','wifi routers':'WiFi Routers',
  'rack servers':'Rack Servers','switches':'Switches',
  'audit logs':'Audit logs','recent actions':'Recent actions',
  'allocation history':'Allocation history',
};

const REQUIRED_EMP_FIELDS = [
  { key:'empId',         label:'Employee ID',       type:'text'  },
  { key:'name',          label:'Full Name',          type:'text'  },
  { key:'designation',   label:'Designation',        type:'text'  },
  { key:'level',         label:'Level / Grade',      type:'text'  },
  { key:'location',      label:'Location',           type:'text'  },
  { key:'doj',           label:'Date of Joining',    type:'date'  },
  { key:'mobile',        label:'Mobile No',          type:'text'  },
  { key:'suggestedEmail',label:'Company Email',      type:'email' },
  { key:'personalEmail', label:'Personal Email',     type:'email' },
  { key:'serviceLine',   label:'Service Line',       type:'text'  },
  { key:'client',        label:'Client',             type:'text'  },
  { key:'manager',       label:'Reporting Manager',  type:'text'  },
  { key:'bloodGroup',    label:'Blood Group',        type:'text'  },
  { key:'dob',           label:'Date of Birth',      type:'date'  },
];

function fmtDate(d) {
  if (!d) return '—';
  try { const p = new Date(d); if (!isNaN(p)) return p.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); } catch {}
  return String(d);
}

function looksLikeEmpId(s)     { return /^[A-Z]{1,6}\d{1,8}$/i.test(s.trim()) && !s.includes('-'); }
function looksLikeAssetId(s)   { const t = s.trim(); return /^[A-Z]{2,6}-?\d{1,6}$/i.test(t) && /\d/.test(t) && /[A-Z]/i.test(t); }
function looksLikeExcelPaste(r){ return r.includes('\t') && r.split('\t').length >= 4; }

const HEADER_MAP = {
  empId:['eid','emp id','employee id','empid','employeeid'],
  name:['name','emp name','employee name','empname'],
  doj:['doj','date of joining','date of join','joining date','join date'],
  level:['level','grade'],designation:['designation','title','role','position'],
  location:['location','city','office','base'],
  mobile:['mobile','phone','contact','mobile no','mobile number','phone no'],
  serviceLine:['service line','sl','practice','vertical','bu','business unit','service line & department'],
  client:['client','account','customer'],
  manager:['manager','reporting manager','reporting to','rm'],
  suggestedEmail:['suggested email','suggested email id','company email','work email','official email','email id'],
  personalEmail:['personal email','personal email id','gmail','yahoo','private email'],
  bloodGroup:['blood group','blood','bg','blood type'],
  dob:['dob','date of birth','birth date','birthdate'],cif:['cif'],
};
const MONTH_MAP={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};

function normalizeDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) { const mm=MONTH_MAP[m[2].toLowerCase()]; if(!mm)return s; const yy=m[3].length===2?(parseInt(m[3])>50?`19${m[3]}`:`20${m[3]}`):m[3]; return `${yy}-${mm}-${m[1].padStart(2,'0')}`; }
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;
  return s;
}
function matchHeader(cell) {
  const c = cell.toLowerCase().trim();
  for (const [field,aliases] of Object.entries(HEADER_MAP)) { if(aliases.some(a=>c===a||c.includes(a)||a.includes(c)))return field; }
  return null;
}
function parseExcelPaste(raw) {
  const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if (!lines.length) return null;

  const HEADER_KEYWORDS = ['name','id','eid','email','date','doj','dob','designation','level',
    'location','mobile','service','department','manager','suggested','personal','blood','cif','client'];
  const isHeaderRow = (line) => {
    const cells = line.split('\t').map(c=>c.trim().toLowerCase());
    return cells.filter(c => HEADER_KEYWORDS.some(kw => c.includes(kw))).length >= 2;
  };

  let headerLine = -1;
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    if (isHeaderRow(lines[i]) && headerLine === -1) headerLine = i;
  }

  let combinedHeader = '';
  let dataStart = headerLine + 1;
  if (headerLine >= 0 && lines[headerLine+1] && isHeaderRow(lines[headerLine+1])) {
    const h1cells = lines[headerLine].split('\t');
    const h2cells = lines[headerLine+1].split('\t');
    const maxLen  = Math.max(h1cells.length, h2cells.length);
    const merged  = Array.from({length:maxLen}, (_,i) => {
      const h1 = (h1cells[i]||'').trim();
      const h2 = (h2cells[i]||'').replace(/^[&\s]+/,'').trim();
      return h1 && h2 ? `${h1} ${h2}`.trim() : h1 || h2;
    });
    combinedHeader = merged.join('\t');
    dataStart = headerLine + 2;
  } else if (headerLine >= 0) {
    combinedHeader = lines[headerLine];
    dataStart = headerLine + 1;
  } else {
    combinedHeader = lines[0];
    dataStart = 1;
  }

  const colMap = {};
  combinedHeader.split('\t').forEach((cell, idx) => {
    const f = matchHeader(cell.trim());
    if (f && !(f in colMap)) colMap[f] = idx;
  });

  const dataLineStr = lines.slice(dataStart).find(line =>
    line.split('\t').filter(c => c.trim()).length >= 3
  );
  if (!dataLineStr) return null;
  const cells = dataLineStr.split('\t').map(c => c.trim());
  const byCol = f => (f in colMap && cells[colMap[f]] && cells[colMap[f]] !== '—') ? cells[colMap[f]] : null;

  return {
    empId:         byCol('empId')?.toUpperCase() || '',
    name:          byCol('name') || '',
    doj:           normalizeDate(byCol('doj')) || '',
    dob:           normalizeDate(byCol('dob')) || '',
    level:         byCol('level') || '',
    designation:   byCol('designation') || '',
    location:      byCol('location') || '',
    mobile:        byCol('mobile') || '',
    serviceLine:   byCol('serviceLine') || '',
    client:        byCol('client') || '',
    manager:       byCol('manager') || '',
    suggestedEmail:byCol('suggestedEmail') || '',
    personalEmail: byCol('personalEmail') || '',
    bloodGroup:    byCol('bloodGroup') || '',
    cif:           byCol('cif') || '',
  };
}
function getMissingFields(parsed) {
  return REQUIRED_EMP_FIELDS.filter(f => !parsed[f.key] || parsed[f.key].trim() === '');
}

function findAllocForAsset(allocations, assetId) {
  if (!allocations || !assetId) return null;
  const id = (assetId||'').toUpperCase();
  return allocations.find(a =>
    (a.status==='Active'||a.status==='active') &&
    ((a.asset_id||'').toUpperCase()===id || (a.assetId||'').toUpperCase()===id)
  ) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW: COMPREHENSIVE PERSON CARD — cross-table name search result
// ═══════════════════════════════════════════════════════════════════════════════
function ComprehensivePersonCard({ name, employee, allocations, auditLogs, accessories, acceptanceTokens, onReceive, onSwap }) {
  const [tab, setTab] = useState('overview');
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const tabStyle = (active) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', border: 'none',
    background: active ? '#6366f1' : 'transparent',
    color: active ? '#fff' : '#6b7280',
    transition: 'all 0.15s',
  });

  const activeAllocs = allocations.filter(a => a.status === 'Active' || a.status === 'active');
  const returnedAllocs = allocations.filter(a => a.status === 'Returned' || a.status === 'Swapped');

  return (
    <div style={{ marginTop: 10, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e7eb)', borderRadius: 12, overflow: 'hidden', fontSize: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'linear-gradient(135deg,#f8faff,#eff2ff)', borderBottom: '1px solid var(--border,#e5e7eb)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: employee ? 'linear-gradient(135deg,#6366f1,#818cf8)' : 'linear-gradient(135deg,#f59e0b,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff' }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {employee ? `${employee.emp_id} · ${employee.designation || '—'}` : 'Found in allocation records'}
          </div>
        </div>
        {employee && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: employee.status === 'Active' ? '#dcfce7' : '#fee2e2', color: employee.status === 'Active' ? '#15803d' : '#dc2626' }}>
            {employee.status}
          </span>
        )}
      </div>

      {/* Summary badges row */}
      <div style={{ display: 'flex', gap: 6, padding: '7px 12px', flexWrap: 'wrap', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
        {activeAllocs.length > 0 && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', fontWeight: 600 }}>
            💻 {activeAllocs.length} active laptop{activeAllocs.length > 1 ? 's' : ''}
          </span>
        )}
        {returnedAllocs.length > 0 && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', fontWeight: 600 }}>
            🔄 {returnedAllocs.length} returned
          </span>
        )}
        {auditLogs.length > 0 && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', fontWeight: 600 }}>
            📋 {auditLogs.length} activity log{auditLogs.length > 1 ? 's' : ''}
          </span>
        )}
        {accessories.length > 0 && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', fontWeight: 600 }}>
            🎧 {accessories.length} accessory record{accessories.length > 1 ? 's' : ''}
          </span>
        )}
        {acceptanceTokens.length > 0 && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f5f3ff', color: '#5b21b6', border: '1px solid #c4b5fd', fontWeight: 600 }}>
            ✅ {acceptanceTokens.length} acceptance record{acceptanceTokens.length > 1 ? 's' : ''}
          </span>
        )}
        {!employee && <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74', fontWeight: 600 }}>⚠️ Not in employee directory</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '5px 10px', borderBottom: '1px solid #f3f4f6', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <button style={tabStyle(tab === 'overview')} onClick={() => setTab('overview')}>Overview</button>
        {allocations.length > 0 && <button style={tabStyle(tab === 'laptops')} onClick={() => setTab('laptops')}>💻 Laptops ({allocations.length})</button>}
        {auditLogs.length > 0 && <button style={tabStyle(tab === 'activity')} onClick={() => setTab('activity')}>📋 Activity ({auditLogs.length})</button>}
        {accessories.length > 0 && <button style={tabStyle(tab === 'accessories')} onClick={() => setTab('accessories')}>🎧 Accessories ({accessories.length})</button>}
        {acceptanceTokens.length > 0 && <button style={tabStyle(tab === 'tokens')} onClick={() => setTab('tokens')}>✅ Acceptance ({acceptanceTokens.length})</button>}
      </div>

      {/* ── TAB: Overview (employee profile) ── */}
      {tab === 'overview' && (
        <div>
          {employee ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '8px 12px', gap: '2px 12px' }}>
              {[
                ['Level', employee.level],
                ['Service Line', employee.service_line],
                ['Location', employee.location],
                ['Client', employee.client],
                ['Manager', employee.reporting_manager],
                ['DOJ', fmtDate(employee.doj)],
                ['DOB', fmtDate(employee.dob)],
                ['Blood Group', employee.blood_group],
                ['Mobile', employee.mobile_no],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{label}</div>
                  <div style={{ fontWeight: 500, color: '#374151' }}>{val || '—'}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>Company Email</div>
                <div style={{ fontWeight: 500, color: '#374151' }}>{employee.company_email || employee.suggested_email || '—'}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px', color: '#6b7280', fontSize: 11, background: '#fff7ed', borderBottom: '1px solid #f3f4f6' }}>
              ⚠️ <strong style={{ color: '#c2410c' }}>{name}</strong> is not registered in the employee directory,
              but they appear in {allocations.length > 0 ? 'allocation records' : ''}{auditLogs.length > 0 ? (allocations.length > 0 ? ' and audit logs' : 'audit logs') : ''}.
              Check the tabs above for details.
            </div>
          )}

          {/* Show active laptops in overview tab as quick reference */}
          {activeAllocs.length > 0 && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>💻 Currently Allocated Laptop(s)</div>
              {activeAllocs.map((a, i) => (
                <div key={i} style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>{a.asset_id || a.assetId}</strong> — {a.brand || ''} {a.model || ''} · Since {fmtDate(a.allocation_date || a.allocationDate)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => onReceive && onReceive(a, null)}
                      style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: '#dbeafe', border: '1px solid #93c5fd', color: '#1d4ed8' }}>
                      Receive
                    </button>
                    <button onClick={() => onSwap && onSwap(a)}
                      style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151' }}>
                      Swap
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Laptops / Allocations ── */}
      {tab === 'laptops' && (
        <div style={{ padding: '8px 12px' }}>
          {allocations.length === 0 && <div style={{ color: '#6b7280', fontSize: 11, padding: '8px 0' }}>No allocation records found.</div>}
          {allocations.map((a, i) => {
            const isActive = a.status === 'Active' || a.status === 'active';
            return (
              <div key={i} style={{ padding: '8px', borderRadius: 8, background: isActive ? '#eff6ff' : '#f9fafb', border: `1px solid ${isActive ? '#93c5fd' : '#e5e7eb'}`, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontSize: 12, color: '#1d4ed8' }}>{a.asset_id || a.assetId}</strong>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: isActive ? '#dbeafe' : '#f3f4f6', color: isActive ? '#1d4ed8' : '#6b7280' }}>
                    {a.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#374151', marginBottom: 2 }}>
                  {a.brand || ''} {a.model || ''}{a.department ? ` · ${a.department}` : ''}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: isActive ? 8 : 0 }}>
                  Allocated: {fmtDate(a.allocation_date || a.allocationDate)}
                  {(a.return_date || a.returnDate) ? ` · Returned: ${fmtDate(a.return_date || a.returnDate)}` : ''}
                </div>
                {isActive && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onReceive && onReceive(a, null)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#dbeafe', border: '1px solid #93c5fd', color: '#1d4ed8' }}>
                      <ArrowRight size={10} /> Receive Back
                    </button>
                    <button onClick={() => onSwap && onSwap(a)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151' }}>
                      Swap
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: Audit Activity ── */}
      {tab === 'activity' && (
        <div style={{ padding: '8px 12px' }}>
          {auditLogs.length === 0 && <div style={{ color: '#6b7280', fontSize: 11, padding: '8px 0' }}>No audit log entries found.</div>}
          {auditLogs.map((log, i) => (
            <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: '#fafafa', border: '1px solid #f3f4f6', marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{log.action}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{log.detail}</div>
                  {log.asset_id && <div style={{ fontSize: 10, color: '#6366f1', marginTop: 2 }}>Asset: {log.asset_id}</div>}
                  {log.performed_by && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>By: {log.performed_by}</div>}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {fmtDate(log.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Accessories ── */}
      {tab === 'accessories' && (
        <div style={{ padding: '8px 12px' }}>
          {accessories.length === 0 && <div style={{ color: '#6b7280', fontSize: 11, padding: '8px 0' }}>No accessory records found.</div>}
          {accessories.map((acc, i) => (
            <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: '#15803d' }}>{acc.item_name}</div>
              <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>
                Qty: {acc.quantity} · Status: {acc.status}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                Date: {fmtDate(acc.allocation_date)}
                {acc.asset_id ? ` · Asset: ${acc.asset_id}` : ''}
                {acc.department ? ` · Dept: ${acc.department}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Acceptance Tokens ── */}
      {tab === 'tokens' && (
        <div style={{ padding: '8px 12px' }}>
          {acceptanceTokens.length === 0 && <div style={{ color: '#6b7280', fontSize: 11, padding: '8px 0' }}>No acceptance records found.</div>}
          {acceptanceTokens.map((t, i) => (
            <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: t.status === 'accepted' ? '#f0fdf4' : '#fef9c3', border: `1px solid ${t.status === 'accepted' ? '#86efac' : '#fde047'}`, marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Asset: {t.asset_id}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    Status: {t.status}{t.has_damage ? ' · ⚠️ Damage reported' : ''}
                  </div>
                  {t.damage_desc && <div style={{ fontSize: 10, color: '#92400e', marginTop: 2 }}>{t.damage_desc}</div>}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{fmtDate(t.submitted_at || t.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE CARD (existing employee from DB)
// ═══════════════════════════════════════════════════════════════════════════════
function EmployeeCard({ emp, allocations, licenses }) {
  const ea = (allocations||[]).filter(a=>(a.emp_id||a.empId)===emp.emp_id&&(a.status==='Active'||a.status==='active'));
  const el = (licenses||[]).filter(l=>l.assignments?.some(a=>a.emp_id===emp.emp_id));
  const initials=(emp.emp_name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  return (
    <div style={{ marginTop:10, background:'var(--surface,#fff)', border:'1px solid var(--border,#e5e7eb)', borderRadius:12, overflow:'hidden', fontSize:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'linear-gradient(135deg,#f8faff,#eff2ff)', borderBottom:'1px solid var(--border,#e5e7eb)' }}>
        <div style={{ width:38, height:38, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#6366f1,#818cf8)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, color:'#fff' }}>{initials}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#111827' }}>{emp.emp_name}</div>
          <div style={{ color:'#6b7280', fontSize:11 }}>{emp.emp_id} · {emp.designation||'—'}</div>
        </div>
        <span style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20, background:emp.status==='Active'?'#dcfce7':'#fee2e2', color:emp.status==='Active'?'#15803d':'#dc2626' }}>{emp.status||'Unknown'}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', padding:'8px 12px', gap:'2px 12px' }}>
        {[['Level',emp.level],['Service Line',emp.service_line],['Location',emp.location],['Client',emp.client],['Manager',emp.reporting_manager],['DOJ',fmtDate(emp.doj||emp.doj_fmt)],['DOB',fmtDate(emp.dob||emp.dob_fmt)],['Blood Group',emp.blood_group],['Mobile',emp.mobile_no]].map(([label,val])=>(
          <div key={label} style={{ padding:'3px 0', borderBottom:'1px solid #f3f4f6' }}>
            <div style={{ fontSize:10, color:'#9ca3af' }}>{label}</div>
            <div style={{ fontWeight:500, color:'#374151', wordBreak:'break-word' }}>{val||'—'}</div>
          </div>
        ))}
        <div style={{ gridColumn:'1/-1', padding:'3px 0', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ fontSize:10, color:'#9ca3af' }}>Company Email</div>
          <div style={{ fontWeight:500, color:'#374151' }}>{emp.company_email||'—'}</div>
        </div>
      </div>
      {ea.length>0&&(
        <div style={{ padding:'8px 12px', borderTop:'1px solid #f3f4f6', background:'#fafafa' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#6366f1', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>💻 Laptop</div>
          {ea.map(a=>(
            <div key={a.asset_id||a.assetId} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'#eff6ff', color:'#1d4ed8', marginBottom:3 }}>
              <strong>{a.asset_id||a.assetId}</strong> — {a.brand||''} {a.model||''} · Since {fmtDate(a.allocation_date||a.allocationDate)}
            </div>
          ))}
        </div>
      )}
      {el.length>0&&(
        <div style={{ padding:'8px 12px', borderTop:'1px solid #f3f4f6', background:'#fafafa' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#6366f1', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>🔑 Licenses ({el.length})</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {el.map(l=><span key={l.name} style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#f3f4f6', color:'#374151', border:'1px solid #e5e7eb' }}>{l.name}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW EMPLOYEE PREVIEW CARD
// ═══════════════════════════════════════════════════════════════════════════════
function NewEmployeePreviewCard({ parsed, onConfirm, onEdit, onCancel }) {
  const initials = (parsed.name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  const fields = [
    ['Employee ID',    parsed.empId],
    ['Designation',    parsed.designation],
    ['Level',          parsed.level],
    ['Location',       parsed.location],
    ['Date of Joining',parsed.doj ? fmtDate(parsed.doj) : null],
    ['Date of Birth',  parsed.dob ? fmtDate(parsed.dob) : null],
    ['Mobile',         parsed.mobile],
    ['Service Line',   parsed.serviceLine],
    ['Client',         parsed.client],
    ['Manager',        parsed.manager],
    ['Blood Group',    parsed.bloodGroup],
  ].filter(([,v]) => v);

  const missing = getMissingFields(parsed);

  return (
    <div style={{ marginTop:10, background:'var(--surface,#fff)', border:'1px solid #86efac', borderRadius:12, overflow:'hidden', fontSize:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderBottom:'1px solid #86efac' }}>
        <div style={{ width:40, height:40, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#22c55e,#16a34a)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, color:'#fff' }}>{initials}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#14532d' }}>{parsed.name || '—'}</div>
          <div style={{ fontSize:11, color:'#166534' }}>{parsed.empId || '?'} · {parsed.designation || '—'}</div>
        </div>
        <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'#dcfce7', color:'#15803d', border:'1px solid #86efac' }}>New Employee</span>
      </div>
      <div style={{ padding:'8px 12px', borderBottom:'1px solid #f0fdf4', background:'#fafafa' }}>
        <div style={{ fontSize:10, color:'#9ca3af', marginBottom:2 }}>Company Email</div>
        <div style={{ fontWeight:600, color:'#374151', fontSize:12 }}>{parsed.suggestedEmail || '—'}</div>
        {parsed.personalEmail && <>
          <div style={{ fontSize:10, color:'#9ca3af', marginTop:4, marginBottom:2 }}>Personal Email</div>
          <div style={{ fontWeight:500, color:'#374151', fontSize:11 }}>{parsed.personalEmail}</div>
        </>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', padding:'8px 12px', gap:'2px 12px' }}>
        {fields.map(([label, val]) => (
          <div key={label} style={{ padding:'3px 0', borderBottom:'1px solid #f3f4f6' }}>
            <div style={{ fontSize:10, color:'#9ca3af' }}>{label}</div>
            <div style={{ fontWeight:500, color:'#374151' }}>{val}</div>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div style={{ margin:'8px 12px', padding:'8px 10px', background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, fontSize:11, color:'#854d0e' }}>
          <strong>⚠️ {missing.length} field(s) missing:</strong> {missing.map(f=>f.label).join(', ')}
          <div style={{ marginTop:4, fontSize:10, color:'#92400e' }}>Click "Edit &amp; Fill" to complete before adding.</div>
        </div>
      )}
      <div style={{ display:'flex', gap:8, padding:'10px 12px', borderTop:'1px solid #f0fdf4', background:'#fafafa', flexWrap:'wrap' }}>
        <button onClick={onConfirm}
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 14px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', color:'#fff', boxShadow:'0 2px 8px rgba(34,197,94,0.4)' }}>
          <ArrowRight size={12}/> Open Add Employee Form
        </button>
        <button onClick={onEdit}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', background:'#eff2ff', border:'1px solid #c7d2fe', color:'#4338ca' }}>
          <Edit2 size={11}/> Edit &amp; Fill
        </button>
        <button onClick={onCancel}
          style={{ padding:'8px 12px', borderRadius:20, border:'1px solid #e5e7eb', background:'transparent', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE EDITOR
// ═══════════════════════════════════════════════════════════════════════════════
function InlineEmployeeEditor({ parsed, onConfirm, onCancel }) {
  const [values, setValues] = useState({ ...parsed });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoRef = useRef(null);

  const handleChange = (key, val) => setValues(prev => ({ ...prev, [key]: val }));
  const handlePhoto = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setPhotoFile(file);
    const r = new FileReader(); r.onload = ev => setPhotoPreview(ev.target.result); r.readAsDataURL(file);
  };

  const allRequired = REQUIRED_EMP_FIELDS.every(f => (values[f.key]||'').trim() !== '');

  return (
    <div style={{ marginTop:10, background:'var(--surface,#fff)', border:'1px solid #fbbf24', borderRadius:12, overflow:'hidden', fontSize:12 }}>
      <div style={{ padding:'10px 12px', background:'linear-gradient(135deg,#fffbeb,#fef3c7)', borderBottom:'1px solid #fbbf24', display:'flex', alignItems:'center', gap:8 }}>
        <Edit2 size={14} color="#d97706"/>
        <div>
          <div style={{ fontWeight:700, fontSize:12, color:'#92400e' }}>Edit Employee Details</div>
          <div style={{ fontSize:10, color:'#b45309' }}>Fill all required fields before adding</div>
        </div>
      </div>
      <div style={{ padding:'10px 12px' }}>
        <div style={{ marginBottom:12, padding:'10px', border:'1px dashed #d1d5db', borderRadius:8, background:'#fafafa' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#374151', marginBottom:6 }}>📷 Employee Photo (optional)</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {photoPreview
              ? <img src={photoPreview} alt="preview" style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover', border:'2px solid #6366f1' }}/>
              : <div style={{ width:48, height:48, borderRadius:'50%', background:'#e0e7ff', display:'flex', alignItems:'center', justifyContent:'center' }}><User size={22} color="#6366f1"/></div>}
            <button onClick={()=>photoRef.current?.click()} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, border:'1px solid #6366f1', background:'#eff0fe', color:'#4f46e5', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              <Upload size={11}/> {photoPreview?'Change':'Upload Photo'}
            </button>
          </div>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:'none' }}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 12px', marginBottom:12 }}>
          {REQUIRED_EMP_FIELDS.map(f => {
            const isEmpty = !(values[f.key]||'').trim();
            return (
              <div key={f.key}>
                <label style={{ fontSize:10, color:'#374151', fontWeight:600, display:'block', marginBottom:3 }}>
                  {f.label} <span style={{ color:'#dc2626' }}>*</span>
                </label>
                <input
                  type={f.type}
                  value={values[f.key]||''}
                  onChange={e=>handleChange(f.key,e.target.value)}
                  placeholder={f.label}
                  style={{ width:'100%', boxSizing:'border-box', padding:'5px 8px', border:`1px solid ${isEmpty?'#fca5a5':'#86efac'}`, borderRadius:6, fontSize:11, fontFamily:'inherit', outline:'none', background:'#fafafa' }}
                />
              </div>
            );
          })}
          {[
            {key:'suggestedEmail', label:'Company Email', type:'email'},
            {key:'personalEmail', label:'Personal Email', type:'email'},
          ].map(f=>(
            <div key={f.key}>
              <label style={{ fontSize:10, color:'#374151', fontWeight:600, display:'block', marginBottom:3 }}>{f.label}</label>
              <input type={f.type} value={values[f.key]||''} onChange={e=>handleChange(f.key,e.target.value)} placeholder={f.label}
                style={{ width:'100%', boxSizing:'border-box', padding:'5px 8px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:11, fontFamily:'inherit', outline:'none', background:'#fafafa' }}/>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>onConfirm(values, photoFile)} disabled={!allRequired}
            style={{ flex:1, padding:'8px', borderRadius:20, border:'none', fontWeight:700, fontSize:12, cursor:allRequired?'pointer':'not-allowed', background:allRequired?'linear-gradient(135deg,#6366f1,#818cf8)':'#e5e7eb', color:allRequired?'#fff':'#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <CheckCircle2 size={13}/> Open Add Employee Form
          </button>
          <button onClick={onCancel} style={{ padding:'8px 16px', borderRadius:20, border:'1px solid #e5e7eb', background:'transparent', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALLOCATION CARD
// ═══════════════════════════════════════════════════════════════════════════════
function AllocationCard({ allocations, onReceive, onSwap }) {
  if (!allocations || !allocations.length) return null;
  return (
    <div style={{ marginTop:10, background:'var(--surface,#fff)', border:'1px solid #93c5fd', borderRadius:12, overflow:'hidden', fontSize:12 }}>
      <div style={{ padding:'8px 12px', background:'linear-gradient(135deg,#eff6ff,#dbeafe)', borderBottom:'1px solid #93c5fd', fontSize:10, fontWeight:700, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:'0.06em' }}>
        💼 Active Allocations ({allocations.length})
      </div>
      {allocations.map((a, i) => (
        <div key={i} style={{ padding:'8px 12px', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <strong style={{ fontSize:12, color:'#1d4ed8' }}>{a.asset_id||a.assetId}</strong>
            <span style={{ fontSize:11, color:'#374151' }}>→ {a.emp_name||a.empName}</span>
            <span style={{ fontSize:10, color:'#6b7280' }}>({a.emp_id||a.empId})</span>
          </div>
          <div style={{ fontSize:11, color:'#6b7280', marginBottom:6 }}>
            {a.brand||''} {a.model||''} · Since {fmtDate(a.allocation_date||a.allocationDate)}
            {a.department ? ` · ${a.department}` : ''}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>onReceive&&onReceive(a)}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:14, fontSize:11, fontWeight:600, cursor:'pointer', background:'#dbeafe', border:'1px solid #93c5fd', color:'#1d4ed8' }}>
              <ArrowRight size={10}/> Receive
            </button>
            <button onClick={()=>onSwap&&onSwap(a)}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:14, fontSize:11, fontWeight:600, cursor:'pointer', background:'#f3f4f6', border:'1px solid #e5e7eb', color:'#374151' }}>
              Swap
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET CARD
// ═══════════════════════════════════════════════════════════════════════════════
function AssetCard({ asset, allocations, onAllocate, onReceive }) {
  const alloc = findAllocForAsset(allocations, asset.asset_id || asset.id);
  const isStock     = asset.status === 'Stock';
  const isAllocated = asset.status === 'Allocated';
  const statusColor = {
    Stock:     { bg:'#dcfce7', color:'#15803d' },
    Allocated: { bg:'#dbeafe', color:'#1d4ed8' },
    Repair:    { bg:'#fef9c3', color:'#92400e' },
    Scrap:     { bg:'#fee2e2', color:'#dc2626' },
  }[asset.status] || { bg:'#f3f4f6', color:'#374151' };

  return (
    <div style={{ marginTop:10, background:'var(--surface,#fff)',
      border:`1px solid ${isStock?'#86efac':isAllocated?'#93c5fd':'var(--border,#e5e7eb)'}`,
      borderRadius:12, overflow:'hidden', fontSize:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
        background:'linear-gradient(135deg,#f8faff,#eff2ff)', borderBottom:'1px solid var(--border,#e5e7eb)' }}>
        <div style={{ width:38, height:38, borderRadius:8, flexShrink:0,
          background:'#e0e7ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>💻</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#111827' }}>{asset.asset_id||asset.id}</div>
          <div style={{ color:'#6b7280', fontSize:11 }}>{asset.brand||'—'} {asset.model||''}</div>
        </div>
        <span style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20,
          background:statusColor.bg, color:statusColor.color }}>{asset.status}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', padding:'8px 12px', gap:'2px 12px' }}>
        {[
          ['Serial No',    asset.serial],
          ['Config',       asset.config],
          ['Processor',    asset.processor],
          ['RAM',          asset.ram],
          ['Storage',      asset.storage],
          ['Location',     asset.location],
          ['Warranty End', fmtDate(asset.warranty_end)],
        ].map(([label,val])=>(
          <div key={label} style={{ padding:'3px 0', borderBottom:'1px solid #f3f4f6' }}>
            <div style={{ fontSize:10, color:'#9ca3af' }}>{label}</div>
            <div style={{ fontWeight:500, color:'#374151' }}>{val||'—'}</div>
          </div>
        ))}
      </div>
      <div style={{ padding:'8px 12px', borderTop:'1px solid #f3f4f6', background:'#fafafa' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#6366f1', marginBottom:4,
          textTransform:'uppercase', letterSpacing:'0.06em' }}>Current Allocation</div>
        {alloc
          ? <div style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'#eff6ff', color:'#1d4ed8' }}>
              <strong>{alloc.emp_name||alloc.empName}</strong> ({alloc.emp_id||alloc.empId})
              {alloc.department ? ` · ${alloc.department}` : ''}
              {' · Since '}{fmtDate(alloc.allocation_date||alloc.allocationDate)}
            </div>
          : <div style={{ fontSize:11, color:'#15803d' }}>✅ Available in stock — not allocated</div>
        }
      </div>
      {isStock && (
        <div style={{ padding:'10px 12px', borderTop:'1px solid #86efac', background:'#f0fdf4' }}>
          <div style={{ fontSize:11, color:'#15803d', marginBottom:8 }}>
            🟢 This laptop is <strong>available in stock</strong>. Would you like to allocate it?
          </div>
          <button onClick={()=>onAllocate&&onAllocate(asset.asset_id||asset.id)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px',
              borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
              background:'linear-gradient(135deg,#22c55e,#16a34a)',
              border:'none', color:'#fff', boxShadow:'0 2px 8px rgba(34,197,94,0.4)' }}>
            <ArrowRight size={13}/> Allocate This Laptop
          </button>
        </div>
      )}
      {isAllocated && (
        <div style={{ padding:'10px 12px', borderTop:'1px solid #93c5fd', background:'#eff6ff' }}>
          <div style={{ fontSize:11, color:'#1d4ed8', marginBottom:8 }}>
            🔵 This laptop is currently with <strong>{alloc?.emp_name||alloc?.empName||'an employee'}</strong>. Would you like to receive it back?
          </div>
          <button onClick={()=>onReceive&&onReceive(alloc, asset)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px',
              borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
              background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',
              border:'none', color:'#fff', boxShadow:'0 2px 8px rgba(59,130,246,0.4)' }}>
            <ArrowRight size={13}/> Receive This Laptop
          </button>
        </div>
      )}
    </div>
  );
}

// ── Search Dropdown ───────────────────────────────────────────────────────────
function SearchDropdown({ results, onSelect, visible }) {
  if (!visible||!results) return null;
  const { employees=[],assets=[] } = results;
  if (!employees.length&&!assets.length) return null;
  return (
    <div style={{ position:'absolute', bottom:'100%', left:0, right:0, marginBottom:4, background:'var(--surface,#fff)', border:'1px solid var(--border,#e5e7eb)', borderRadius:10, maxHeight:200, overflowY:'auto', boxShadow:'0 -4px 20px rgba(0,0,0,0.12)', zIndex:100 }}>
      {employees.length>0&&(<>
        <div style={{ padding:'5px 10px 2px', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em' }}>Employees</div>
        {employees.map(e=>(
          <div key={e.emp_id} onClick={()=>onSelect(e.emp_id,'employee')}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', cursor:'pointer', borderTop:'1px solid #f3f4f6' }}
            onMouseEnter={ev=>ev.currentTarget.style.background='#f8fafc'}
            onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
            <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#6366f1,#818cf8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>
              {(e.emp_name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:12, color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.emp_name}</div>
              <div style={{ fontSize:10, color:'#6b7280' }}>{e.emp_id} · {e.designation||'—'}</div>
            </div>
            <span style={{ fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:20, flexShrink:0, background:e.status==='Active'?'#dcfce7':'#fee2e2', color:e.status==='Active'?'#15803d':'#dc2626' }}>{e.status}</span>
          </div>
        ))}
      </>)}
      {assets.length>0&&(<>
        <div style={{ padding:'5px 10px 2px', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em' }}>Assets</div>
        {assets.map(a=>(
          <div key={a.asset_id} onClick={()=>onSelect(a.asset_id,'asset')}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', cursor:'pointer', borderTop:'1px solid #f3f4f6' }}
            onMouseEnter={ev=>ev.currentTarget.style.background='#f8fafc'}
            onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
            <div style={{ width:26, height:26, borderRadius:6, flexShrink:0, background:'#e0e7ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>💻</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:12, color:'#111827' }}>{a.asset_id}</div>
              <div style={{ fontSize:10, color:'#6b7280' }}>{a.brand||'—'} {a.model||''}</div>
            </div>
            <span style={{ fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:20, flexShrink:0, background:a.status==='Stock'?'#dcfce7':a.status==='Allocated'?'#dbeafe':'#fee2e2', color:a.status==='Stock'?'#15803d':a.status==='Allocated'?'#1d4ed8':'#dc2626' }}>{a.status}</span>
          </div>
        ))}
      </>)}
    </div>
  );
}

// ── RenderText ────────────────────────────────────────────────────────────────
function RenderText({ text, isUser }) {
  const lines=(text||'').split('\n');
  return (
    <div style={{ fontSize:12.5, lineHeight:1.7, color:isUser?'#fff':'var(--text,#111827)' }}>
      {lines.map((line,i)=>{
        if(line==='')return<div key={i} style={{ height:4 }}/>;
        if(line.startsWith('## '))return<div key={i} style={{ fontWeight:800, fontSize:10, color:isUser?'rgba(255,255,255,0.75)':'#6366f1', textTransform:'uppercase', letterSpacing:'0.07em', marginTop:10, marginBottom:3 }}>{line.replace('## ','')}</div>;
        const parsed=line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part,j)=>{
          if(part.startsWith('**')&&part.endsWith('**'))return<strong key={j} style={{ fontWeight:700 }}>{part.slice(2,-2)}</strong>;
          if(part.startsWith('`')&&part.endsWith('`'))return<code key={j} style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, background:isUser?'rgba(255,255,255,0.2)':'rgba(99,102,241,0.1)', color:isUser?'#fff':'#6366f1', padding:'1px 5px', borderRadius:4 }}>{part.slice(1,-1)}</code>;
          return part;
        });
        if(line.startsWith('• ')||line.startsWith('- '))return<div key={i} style={{ display:'flex', gap:7, marginBottom:2, paddingLeft:2 }}><span style={{ color:isUser?'rgba(255,255,255,0.6)':'#6366f1', flexShrink:0 }}>•</span><span>{parsed.map(p=>typeof p==='string'?p.replace(/^[•\-] /,''):p)}</span></div>;
        return<div key={i} style={{ marginBottom:1 }}>{parsed}</div>;
      })}
    </div>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────────
function Bubble({ msg, db, onAllocate, onReceive, onSwap, onConfirmNewEmployee, onEditNewEmployee }) {
  const [copied,setCopied]=useState(false);
  const isUser=msg.role==='user';
  return (
    <div style={{ display:'flex', flexDirection:isUser?'row-reverse':'row', alignItems:'flex-start', gap:8, marginBottom:14 }}>
      <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background:isUser?'linear-gradient(135deg,#6366f1,#818cf8)':'linear-gradient(135deg,#0f172a,#1e293b)', border:'2px solid rgba(99,102,241,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {isUser?<User size={11} color="#fff"/>:<Sparkles size={11} color="#818cf8"/>}
      </div>
      <div style={{ maxWidth:'82%', position:'relative' }}>
        <div style={{ padding:'8px 12px', borderRadius:isUser?'14px 3px 14px 14px':'3px 14px 14px 14px', background:isUser?'linear-gradient(135deg,#6366f1,#818cf8)':'var(--surface,#fff)', border:isUser?'none':'1px solid var(--border,#e5e7eb)', boxShadow:isUser?'0 3px 10px rgba(99,102,241,0.3)':'0 2px 6px rgba(0,0,0,0.05)' }}>
          <RenderText text={msg.content} isUser={isUser}/>

          {/* Existing employee from DB */}
          {!isUser&&msg.empCard&&(
            <EmployeeCard emp={msg.empCard} allocations={toArr(db?.allocations)} licenses={toArr(db?.licenses)}/>
          )}

          {/* Asset card */}
          {!isUser&&msg.assetCard&&(
            <AssetCard
              asset={msg.assetCard}
              allocations={toArr(db?.allocations)}
              onAllocate={onAllocate}
              onReceive={onReceive}
            />
          )}

          {/* NEW: Comprehensive person card (cross-table name search) */}
          {!isUser&&msg.comprehensiveCard&&(
            <ComprehensivePersonCard
              name={msg.comprehensiveCard.name}
              employee={msg.comprehensiveCard.employee}
              allocations={msg.comprehensiveCard.allocations || []}
              auditLogs={msg.comprehensiveCard.auditLogs || []}
              accessories={msg.comprehensiveCard.accessories || []}
              acceptanceTokens={msg.comprehensiveCard.acceptanceTokens || []}
              onReceive={onReceive}
              onSwap={onSwap}
            />
          )}

          {/* NEW: Preview of parsed Excel employee (before adding) */}
          {!isUser&&msg.newEmpPreview&&!msg.editMode&&(
            <NewEmployeePreviewCard
              parsed={msg.newEmpPreview}
              onConfirm={()=>onConfirmNewEmployee&&onConfirmNewEmployee(msg.newEmpPreview, null)}
              onEdit={()=>onEditNewEmployee&&onEditNewEmployee(msg.id)}
              onCancel={()=>{}}
            />
          )}

          {/* Inline editor (edit mode) */}
          {!isUser&&msg.newEmpPreview&&msg.editMode&&(
            <InlineEmployeeEditor
              parsed={msg.newEmpPreview}
              onConfirm={(completed, photoFile)=>onConfirmNewEmployee&&onConfirmNewEmployee(completed, photoFile)}
              onCancel={()=>onEditNewEmployee&&onEditNewEmployee(msg.id, false)}
            />
          )}

          {/* Allocation cards */}
          {!isUser&&msg.allocationCards&&(
            <AllocationCard
              allocations={msg.allocationCards}
              onReceive={(a)=>onReceive&&onReceive(a, null)}
              onSwap={(a)=>onSwap&&onSwap(a)}
            />
          )}

          {!isUser&&msg.actions?.length>0&&(
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
              {msg.actions.map((a,i)=>(
                <button key={i} onClick={a.fn} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:20, fontSize:11.5, fontWeight:600, cursor:'pointer', background:'linear-gradient(135deg,#6366f1,#818cf8)', border:'none', color:'#fff', boxShadow:'0 2px 8px rgba(99,102,241,0.35)' }}>
                  <ArrowRight size={10}/> {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {!isUser&&(
          <button onClick={()=>{navigator.clipboard.writeText(msg.content);setCopied(true);setTimeout(()=>setCopied(false),1600);}} style={{ position:'absolute', top:6, right:-26, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', opacity:0.45, padding:2, display:'flex', transition:'opacity 0.15s' }} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.45}>
            {copied?<Check size={12} color="#34d399"/>:<Copy size={12}/>}
          </button>
        )}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
      <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#0f172a,#1e293b)', border:'2px solid rgba(99,102,241,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}><Sparkles size={11} color="#818cf8"/></div>
      <div style={{ padding:'9px 13px', borderRadius:'3px 14px 14px 14px', background:'var(--surface,#fff)', border:'1px solid var(--border,#e5e7eb)', display:'flex', alignItems:'center', gap:5 }}>
        {[0,1,2].map(i=><div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#6366f1', animation:'aiDot 1.2s infinite ease-in-out', animationDelay:`${i*0.18}s`}}/>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYWORD COMMANDS — used to avoid mis-triggering name search
// ═══════════════════════════════════════════════════════════════════════════════
const KEYWORD_CMD_RE = /^(hi|hello|hey|help|start|hii|helo|overview|asset status|employee summary|license usage|repair status|show alerts|pending laptop returns|pending returns|active allocations|audit logs|recent actions|allocation history|network assets|all assets|low stock|warranty status|expiring licenses|full licenses|license count|switches|rack servers|wifi routers|under repair|repair count|scrap count|active employees|employee count|repair|scrap|network|license|asset|employee|staff|overview|dashboard|summary)/i;

// ═══════════════════════════════════════════════════════════════════════════════
// THINK — query handler
// ═══════════════════════════════════════════════════════════════════════════════
async function think(rawQuery, db, navigate) {
  const assets      = toArr(db.assets);
  const employees   = toArr(db.employees);
  const allocations = toArr(db.allocations);
  const q = rawQuery.trim().toLowerCase();

  // ── 1. Excel paste ──
  if (looksLikeExcelPaste(rawQuery)) {
    const p = parseExcelPaste(rawQuery);
    if (!p) return { content:'❌ Could not parse. Copy header row + data row directly from Excel.' };
    const match = p.empId ? employees.find(e=>e.emp_id?.toUpperCase()===p.empId.toUpperCase()) : null;
    if (match) return { content:`## ✅ Already in System\n\nEmployee **${p.empId}** already exists as **${match.emp_name}**.`, empCard:match };
    const missing = getMissingFields(p);
    return {
      content: missing.length > 0
        ? `## 📋 Parsed Employee\n\n⚠️ **${missing.length} field(s) missing.** Review below and click "Edit & Fill" to complete before adding.`
        : `## 📋 Parsed Employee\n\nAll required fields found. Review the details below and click **"Open Add Employee Form"** to proceed.`,
      newEmpPreview: p,
      id: Date.now(),
    };
  }

  // ── 2. Allocation queries ──
  const isAllocQuery = /\b(alloc|who has|who's using|assigned|given|laptop.*to|employee.*laptop)\b/i.test(rawQuery);
  const isActiveAllocQuery = /\bactive alloc/i.test(rawQuery) || q === 'active allocations';

  if (isActiveAllocQuery || isAllocQuery) {
    const active = allocations.filter(a => a.status==='Active'||a.status==='active');
    if (active.length === 0) return { content:'No active allocations found in the database.' };

    const empMatch = employees.find(e =>
      rawQuery.toLowerCase().includes(e.emp_name?.toLowerCase()) ||
      rawQuery.toUpperCase().includes(e.emp_id?.toUpperCase())
    );
    if (empMatch) {
      const empAllocs = active.filter(a => (a.emp_id||a.empId) === empMatch.emp_id);
      if (!empAllocs.length) return { content:`**${empMatch.emp_name}** has no active laptop allocation.`, empCard: empMatch };
      return {
        content: `**${empMatch.emp_name}** has ${empAllocs.length} active laptop allocation${empAllocs.length>1?'s':''}:`,
        empCard: empMatch,
        allocationCards: empAllocs,
      };
    }

    return {
      content: `## 💼 Active Allocations (${active.length})\n\nShowing first ${Math.min(active.length,10)} allocation${active.length>1?'s':''}:`,
      allocationCards: active.slice(0, 10),
    };
  }

  // ── 3. Pending returns query ──
  if (/pending.*return|exited.*laptop|offboard.*laptop/i.test(rawQuery)) {
    const deleted = toArr(db.deleted || []);
    const deletedWithAlloc = deleted.filter(e => {
      const eid = e.emp_id;
      return allocations.some(a => (a.emp_id||a.empId)===eid && (a.status==='Active'||a.status==='active'));
    });
    if (!deletedWithAlloc.length) return { content:'✅ No pending laptop returns — all exited employees have returned their laptops.' };
    return {
      content: `## ⚠️ Pending Laptop Returns (${deletedWithAlloc.length})\n\nThese exited employees still have active allocations:\n` +
        deletedWithAlloc.map(e=>`• **${e.emp_name}** (${e.emp_id}) — exited ${e.deleted_at ? fmtDate(e.deleted_at) : 'recently'}`).join('\n'),
    };
  }

  // ── 4. Asset ID → instant card ──
  const normId = s=>(s||'').toUpperCase().replace(/-/g,'');
  const ait = rawQuery.trim().split(/\s+/).filter(t=>looksLikeAssetId(t));
  if (ait.length>0) {
    const sn=ait[0].toUpperCase(),snNorm=normId(sn);
    const a = assets.find(x=>x.asset_id?.toUpperCase()===sn||normId(x.asset_id)===snNorm);
    if (a) return { content:`Asset **${a.asset_id}** — ${a.brand||''} ${a.model||''} (${a.status}):`, assetCard:a };
  }

  // ── 5. Employee ID → instant card ──
  const eit = rawQuery.trim().split(/\s+/).filter(t=>looksLikeEmpId(t));
  if (eit.length>0) {
    const eid=eit[0].toUpperCase();
    const e = employees.find(x=>x.emp_id?.toUpperCase()===eid);
    if (e) {
      const empAllocs = allocations.filter(a=>(a.emp_id||a.empId)===e.emp_id&&(a.status==='Active'||a.status==='active'));
      return {
        content:`Found **${e.emp_name}** — full details:`,
        empCard:e,
        ...(empAllocs.length ? { allocationCards: empAllocs } : {}),
      };
    }
  }

  // ── 6. Greeting ──
  if (/^(hi|hello|hey|help|start|hii|helo|what can you|capabilities)[\s!?]*$/i.test(rawQuery.trim())) {
    return { content:`## 👋 Hi! I'm AssetOps AI\n\nI have **live access** to your entire database.\n\n## INSTANT LOOKUPS\n• Type any **employee name** → auto-suggest dropdown\n• Type **employee ID** (e.g. \`IBE2897\`) → full profile + allocations\n• Type **asset ID** (e.g. \`LTB-78\`) → full asset card with CTA\n• Ask **"active allocations"** → see all active laptop assignments\n\n## PASTE EXCEL ROW\nCopy header + data row → I parse all fields, show a preview card, let you edit before adding!\n\n## REPORTS\n*"overview"*, *"asset status"*, *"active allocations"*, *"pending returns"*` };
  }

  // ── 6b. Cross-table name search ──────────────────────────────────────────
  // Triggers for any name-like query (2+ words, or 3+ chars with no digits/dashes)
  // that isn't a keyword command or ID.
  const isNameLike = (() => {
    const s = rawQuery.trim();
    if (looksLikeEmpId(s)) return false;
    if (looksLikeAssetId(s)) return false;
    if (KEYWORD_CMD_RE.test(s)) return false;
    if (looksLikeExcelPaste(s)) return false;
    const words = s.split(/\s+/);
    // Multi-word with no special chars → very likely a name
    if (words.length >= 2 && !/[\/\-_@]/.test(s)) return true;
    // Single word, alpha only, 3+ chars → could be a name
    if (words.length === 1 && /^[A-Za-z]{3,}$/.test(s)) return true;
    return false;
  })();

  if (isNameLike) {
    const searchQ = rawQuery.trim().toLowerCase();
    const words   = searchQ.split(/\s+/);

    // Match helper — all words must appear somewhere in the target string
    const matches = (target) => {
      if (!target) return false;
      const t = target.toLowerCase();
      return words.every(w => t.includes(w));
    };

    // 1. Search employees table
    const matchedEmployee = employees.find(e => matches(e.emp_name)) || null;

    // 2. Search ALL allocations (active + returned) by emp_name
    const matchedAllocs = toArr(db.allocations).filter(a =>
      matches(a.emp_name || a.empName || '')
    );

    // 3. Search audit_logs by detail or performed_by
    const matchedLogs = toArr(db.auditLogs || []).filter(log =>
      matches(log.performed_by || '') || matches(log.detail || '')
    ).slice(0, 10);

    // 4. Search accessory_allocations by emp_name
    const matchedAccessories = toArr(db.accessories).filter(a =>
      matches(a.emp_name || '')
    );

    // 5. Search acceptance_tokens by emp_name
    const matchedTokens = toArr(db.acceptanceTracker || []).filter(t =>
      matches(t.emp_name || '')
    );

    // If nothing found at all — fall through to AI
    if (!matchedEmployee && matchedAllocs.length === 0 && matchedLogs.length === 0 && matchedAccessories.length === 0 && matchedTokens.length === 0) {
      // Fall through to AI fallback below
    } else {
      // Determine canonical display name
      const displayName =
        matchedEmployee?.emp_name ||
        matchedAllocs[0]?.emp_name || matchedAllocs[0]?.empName ||
        matchedAccessories[0]?.emp_name ||
        matchedTokens[0]?.emp_name ||
        rawQuery.trim();

      const parts = [];
      if (matchedEmployee) parts.push('✅ In employee directory');
      else parts.push('⚠️ Not in employee directory');
      if (matchedAllocs.length) parts.push(`${matchedAllocs.length} allocation record${matchedAllocs.length > 1 ? 's' : ''}`);
      if (matchedLogs.length) parts.push(`${matchedLogs.length} activity log${matchedLogs.length > 1 ? 's' : ''}`);
      if (matchedAccessories.length) parts.push(`${matchedAccessories.length} accessory record${matchedAccessories.length > 1 ? 's' : ''}`);
      if (matchedTokens.length) parts.push(`${matchedTokens.length} acceptance record${matchedTokens.length > 1 ? 's' : ''}`);

      return {
        content: `## 🔍 Records for "${displayName}"\n\n${parts.join(' · ')}`,
        comprehensiveCard: {
          name: displayName,
          employee: matchedEmployee,
          allocations: matchedAllocs,
          auditLogs: matchedLogs,
          accessories: matchedAccessories,
          acceptanceTokens: matchedTokens,
        },
      };
    }
  }

  // ── 7. AI fallback via backend ──
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/chatbot/ask`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
      body: JSON.stringify({ message: rawQuery }),
    });
    if (!res.ok) throw new Error('API error '+res.status);
    const data = await res.json();
    return { content: data.reply || 'No response.' };
  } catch (err) {
    console.error('[chatbot] ask failed:', err);
    return { content:`❌ Could not reach the AI service.\n\nTry: employee name/ID, asset ID, or "active allocations".` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AIChatbot({ currentPage = 'default' }) {
  const navigate = useNavigate();

  const [open, setOpen]           = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages]   = useState([{
    id: 0,
    role:'assistant',
    content:`## 👋 Hi! I'm AssetOps AI\n\nType an employee name for instant suggestions, paste an Excel row to preview before adding, or ask about allocations!`,
  }]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [db, setDb]               = useState({});
  const [searchResults, setSearchResults] = useState(null);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);

  const pageKey  = PAGE_LABELS[currentPage] ? currentPage : 'default';
  const chipKeys = PAGE_CHIPS[pageKey] || PAGE_CHIPS.default;

  const handleAllocate = useCallback((assetId) => {
    setOpen(false);
    navigate('/allocate', { state: { prefilledAssetId: assetId } });
  }, [navigate]);

  const handleReceive = useCallback((alloc, asset) => {
    setOpen(false);
    navigate('/receive', {
      state: {
        allocationId: alloc?.id || alloc?.dbId || alloc?.alloc_id,
        assetId:      asset?.asset_id || asset?.id || alloc?.asset_id || alloc?.assetId,
        empId:        alloc?.emp_id   || alloc?.empId,
        empName:      alloc?.emp_name || alloc?.empName,
      }
    });
  }, [navigate]);

const handleSwap = useCallback((alloc) => {
  setOpen(false);
  // Ensure we have the allocation object with all required fields
  const allocId = alloc?.id || alloc?.dbId || alloc?.alloc_id;
  const assetId = alloc?.asset_id || alloc?.assetId;
  const empId = alloc?.emp_id || alloc?.empId;
  const empName = alloc?.emp_name || alloc?.empName;
  
  console.log('[Chatbot] Navigating to swap with:', { allocId, assetId, empId, empName });
  
  navigate('/swap', { 
    state: { 
      prefillAllocationId: allocId,
      prefillAssetId: assetId,
      prefillEmpId: empId,
      prefillEmpName: empName,
    }
  });
}, [navigate]);

  const handleConfirmNewEmployee = useCallback((empData, photoFile) => {
    setOpen(false);
    const addPayload = {
      emp_id:            empData.empId         || '',
      emp_name:          empData.name          || '',
      doj:               empData.doj           || '',
      dob:               empData.dob           || '',
      level:             empData.level         || '',
      designation:       empData.designation   || '',
      location:          empData.location      || '',
      mobile_no:         empData.mobile        || '',
      service_line:      empData.serviceLine   || '',
      client:            empData.client        || '',
      reporting_manager: empData.manager       || '',
      suggested_email:   empData.suggestedEmail|| '',
      personal_email:    empData.personalEmail || '',
      blood_group:       empData.bloodGroup    || '',
      company_email:     empData.suggestedEmail|| '',
      notes:             empData.cif ? `CIF: ${empData.cif}` : '',
    };
    navigate('/employees', { state: { addEmployee: addPayload, photoFile } });
  }, [navigate]);

  const handleEditNewEmployee = useCallback((msgId, forceEdit) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return { ...m, editMode: forceEdit !== undefined ? forceEdit : !m.editMode };
    }));
  }, []);

  // ── Load DB (also fetches audit logs now) ──
  const loadDb = useCallback(() => {
    Promise.allSettled([
      apiFetch('/assets'),
      apiFetch('/employees'),
      apiFetch('/licenses'),
      apiFetch('/allocations'),
      apiFetch('/repairs'),
      apiFetch('/scraps'),
      apiFetch('/employees/deleted'),
      apiFetch('/network-assets'),
      apiFetch('/accessories'),
      apiFetch('/acceptance-tracker'),
      apiFetch('/users'),
      apiFetch('/audit-logs?limit=200'),  // ← fetch audit logs for name search
    ]).then(async ([assets,employees,licenses,allocations,repairs,scraps,deleted,networkAssets,accessories,acceptanceTracker,users,auditLogs]) => {
      let deletedArr = toArr(deleted.value);
      if (!deletedArr.length && deleted.status==='rejected') { try { deletedArr=toArr(await apiFetch('/employees?status=Inactive')); } catch{} }
      if (!deletedArr.length) { try { deletedArr=toArr(await apiFetch('/deleted-employees')); } catch{} }
      setDb({
        assets:toArr(assets.value),
        employees:toArr(employees.value),
        licenses:toArr(licenses.value),
        allocations:toArr(allocations.value),
        repairs:toArr(repairs.value),
        scraps:toArr(scraps.value),
        deleted:deletedArr,
        networkAssets:toArr(networkAssets.value),
        accessories:toArr(accessories.value),
        acceptanceTracker:toArr(acceptanceTracker.value),
        users:toArr(users.value),
        auditLogs:toArr(auditLogs.value),  // ← stored for name search
      });
    });
  }, []);

  useEffect(()=>{ if(!open||Object.keys(db).length>0)return; loadDb(); },[open,loadDb]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[messages,loading]);

  useEffect(()=>{
    const handler=(e)=>{ if(dropdownRef.current&&!dropdownRef.current.contains(e.target)&&inputRef.current&&!inputRef.current.contains(e.target))setShowDropdown(false); };
    document.addEventListener('mousedown',handler);
    return()=>document.removeEventListener('mousedown',handler);
  },[]);

  const handleInputChange=(e)=>{
    const val=e.target.value; setInput(val);
    if(searchTimeout)clearTimeout(searchTimeout);
    if(val.trim().length<2){setShowDropdown(false);setSearchResults(null);return;}
    const t=setTimeout(()=>{
      const q2=val.trim().toLowerCase();
      const emps=toArr(db.employees).filter(e=>e.emp_name?.toLowerCase().includes(q2)||e.emp_id?.toLowerCase().startsWith(q2)).slice(0,6);
      const assets2=toArr(db.assets).filter(a=>a.asset_id?.toLowerCase().startsWith(q2)||a.serial?.toLowerCase()===q2).slice(0,4);
      if(emps.length||assets2.length){setSearchResults({employees:emps,assets:assets2});setShowDropdown(true);}
      else setShowDropdown(false);
    },200);
    setSearchTimeout(t);
  };

  const handleDropdownSelect=(id)=>{setShowDropdown(false);setSearchResults(null);setInput('');send(id);};

  const send=useCallback(async(text)=>{
    const q=(text||input).trim();
    if(!q||loading)return;
    setInput('');setShowDropdown(false);
    const msgId = Date.now();
    setMessages(prev=>[...prev,{id:msgId, role:'user',content:q}]);
    setLoading(true);
    const result=await think(q,db,navigate);
    setMessages(prev=>[...prev,{id:msgId+1, role:'assistant',...result}]);
    setLoading(false);
  },[input,loading,db,navigate]);

  const handleKey=e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();setShowDropdown(false);send();}
    if(e.key==='Escape')setShowDropdown(false);
  };

  useEffect(()=>{
    const id='aiDotStyle';
    if(!document.getElementById(id)){const s=document.createElement('style');s.id=id;s.textContent=`@keyframes aiDot{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`;document.head.appendChild(s);}
  },[]);

  return (
    <>
      {!open&&(
        <button onClick={()=>setOpen(true)} title="AssetOps AI"
          style={{ position:'fixed', bottom:24, right:24, zIndex:9999, width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer', background:'linear-gradient(135deg,#6366f1,#818cf8)', boxShadow:'0 4px 20px rgba(99,102,241,0.55)', display:'flex', alignItems:'center', justifyContent:'center', transition:'transform 0.15s, box-shadow 0.15s' }}
          onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.08)';e.currentTarget.style.boxShadow='0 6px 24px rgba(99,102,241,0.7)';}}
          onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='0 4px 20px rgba(99,102,241,0.55)';}}
        ><Sparkles size={22} color="#fff"/></button>
      )}

      {open&&(
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, width:420, height:minimized?52:620, borderRadius:16, overflow:'hidden', background:'var(--surface,#fff)', border:'1px solid var(--border,#e5e7eb)', boxShadow:'0 8px 40px rgba(0,0,0,0.18)', display:'flex', flexDirection:'column', transition:'height 0.25s ease' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', flexShrink:0, background:'linear-gradient(135deg,#0f172a,#1e293b)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Sparkles size={15} color="#818cf8"/>
              <span style={{ fontWeight:700, fontSize:13.5, color:'#f1f5f9' }}>AssetOps AI</span>
              <span style={{ fontSize:9, fontWeight:600, letterSpacing:'0.05em', background:'rgba(99,102,241,0.35)', color:'#a5b4fc', padding:'2px 7px', borderRadius:10 }}>LIVE</span>
              {pageKey!=='default'&&<span style={{ fontSize:9, fontWeight:600, background:'rgba(251,191,36,0.2)', color:'#fbbf24', padding:'2px 7px', borderRadius:10 }}>{PAGE_LABELS[pageKey]}</span>}
            </div>
            <div style={{ display:'flex', gap:2 }}>
              {[
                { title:'Clear', icon:<Trash2 size={14}/>, onClick:()=>{setMessages([{id:0,role:'assistant',content:'Chat cleared! How can I help?'}]);setDb({});loadDb();}, hoverColor:'#f1f5f9' },
                { title:'Refresh', icon:<RefreshCw size={14}/>, onClick:()=>{setDb({});loadDb();}, hoverColor:'#f1f5f9' },
                { title:minimized?'Expand':'Minimize', icon:minimized?<Maximize2 size={14}/>:<Minimize2 size={14}/>, onClick:()=>setMinimized(v=>!v), hoverColor:'#f1f5f9' },
                { title:'Close', icon:<X size={14}/>, onClick:()=>{setOpen(false);setMinimized(false);}, hoverColor:'#f87171' },
              ].map((btn,i)=>(
                <button key={i} onClick={btn.onClick} title={btn.title}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:5, display:'flex', borderRadius:6 }}
                  onMouseEnter={e=>e.currentTarget.style.color=btn.hoverColor}
                  onMouseLeave={e=>e.currentTarget.style.color='#94a3b8'}
                >{btn.icon}</button>
              ))}
            </div>
          </div>

          {!minimized&&(
            <>
              {/* Chips */}
              <div style={{ display:'flex', gap:6, padding:'7px 10px', overflowX:'auto', flexShrink:0, borderBottom:'1px solid var(--border,#e5e7eb)', scrollbarWidth:'none' }}>
                {chipKeys.map(key=>(
                  <button key={key} onClick={()=>send(key)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, whiteSpace:'nowrap', fontSize:11, fontWeight:600, cursor:'pointer', background:'var(--surface2,#f8fafc)', border:'1px solid var(--border,#e5e7eb)', color:'var(--text-muted,#64748b)', transition:'all 0.15s' }}
                    onMouseEnter={e=>{e.currentTarget.style.background='#6366f1';e.currentTarget.style.color='#fff';e.currentTarget.style.borderColor='#6366f1';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='var(--surface2,#f8fafc)';e.currentTarget.style.color='var(--text-muted,#64748b)';e.currentTarget.style.borderColor='var(--border,#e5e7eb)';}}
                  >{CHIP_META[key]||key}</button>
                ))}
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding:'12px 12px 4px', scrollbarWidth:'thin', scrollbarColor:'#e5e7eb transparent' }}>
                {messages.map((m,i)=>(
                  <Bubble
                    key={i}
                    msg={m}
                    db={db}
                    onAllocate={handleAllocate}
                    onReceive={handleReceive}
                    onSwap={handleSwap}
                    onConfirmNewEmployee={handleConfirmNewEmployee}
                    onEditNewEmployee={handleEditNewEmployee}
                  />
                ))}
                {loading&&<Typing/>}
                <div ref={bottomRef}/>
              </div>

              {/* Input */}
              <div style={{ padding:'10px 12px', flexShrink:0, borderTop:'1px solid var(--border,#e5e7eb)', background:'var(--surface,#fff)', position:'relative' }}>
                <div ref={dropdownRef}>
                  <SearchDropdown results={searchResults} onSelect={handleDropdownSelect} visible={showDropdown}/>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <div style={{ flex:1, position:'relative' }}>
                    <Search size={13} color="#9ca3af" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                    <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKey}
                      onFocus={()=>{if(searchResults)setShowDropdown(true);}}
                      placeholder="Type name, ID, ask about allocations…" rows={1}
                      style={{ width:'100%', resize:'none', boxSizing:'border-box', border:'1px solid var(--border,#e5e7eb)', borderRadius:10, padding:'7px 11px 7px 30px', fontSize:13, fontFamily:'inherit', outline:'none', background:'var(--surface2,#f8fafc)', color:'var(--text,#111827)', lineHeight:1.5, transition:'border-color 0.15s' }}
                      onFocusCapture={e=>e.target.style.borderColor='#6366f1'}
                      onBlur={e=>e.target.style.borderColor='var(--border,#e5e7eb)'}
                    />
                  </div>
                  <button onClick={()=>send()} disabled={!input.trim()||loading}
                    style={{ width:36, height:36, borderRadius:10, border:'none', cursor:input.trim()&&!loading?'pointer':'not-allowed', background:input.trim()&&!loading?'linear-gradient(135deg,#6366f1,#818cf8)':'var(--border,#e5e7eb)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, alignSelf:'flex-end', transition:'background 0.2s, transform 0.1s', boxShadow:input.trim()&&!loading?'0 2px 8px rgba(99,102,241,0.4)':'none' }}
                    onMouseEnter={e=>{if(input.trim()&&!loading)e.currentTarget.style.transform='scale(1.08)';}}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
                  ><Send size={15} color={input.trim()&&!loading?'#fff':'#94a3b8'}/></button>
                </div>
                <div style={{ fontSize:10, color:'#9ca3af', marginTop:4 }}>Live DB · Type a name to search all records · Paste Excel row to preview</div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}