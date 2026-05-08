import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Key, Plus, X, Search, Edit2, Trash2, User, Users,
  CheckCircle, AlertTriangle, Clock, Download, RefreshCw,
  ChevronDown, ChevronRight, Package, Star, Zap, Shield,
  MoreHorizontal, Mail, Calendar, Tag, ExternalLink, FileSpreadsheet, FileText, Globe
} from 'lucide-react';
import './Licensemanagement.css';

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

// ✅ Download file with authentication token
const downloadFile = async (url, filename) => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No authentication token found. Please login again.');
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error('Download error:', error);
    alert('Failed to download file: ' + error.message);
  }
};

// ── Preset license catalog ────────────────────────────────────────────────────
const LICENSE_CATALOG = [
  { name: 'Microsoft 365',     category: 'Productivity', icon: '📦', color: '#0078d4' },
  { name: 'Microsoft Office',  category: 'Productivity', icon: '📝', color: '#d83b01' },
  { name: 'VS Code',           category: 'Development',  icon: '💻', color: '#007acc' },
  { name: 'GitHub Copilot',    category: 'AI / Dev',     icon: '🤖', color: '#6e40c9' },
  { name: 'ChatGPT Plus',      category: 'AI',           icon: '🧠', color: '#10a37f' },
  { name: 'Claude Pro',        category: 'AI',           icon: '⚡', color: '#cc785c' },
  { name: 'Notion',            category: 'Productivity', icon: '📓', color: '#000000' },
  { name: 'Slack',             category: 'Communication',icon: '💬', color: '#4a154b' },
  { name: 'Zoom',              category: 'Communication',icon: '🎥', color: '#2d8cff' },
  { name: 'Jira',              category: 'Project Mgmt', icon: '🗂️', color: '#0052cc' },
  { name: 'Confluence',        category: 'Project Mgmt', icon: '📚', color: '#0052cc' },
  { name: 'Figma',             category: 'Design',       icon: '🎨', color: '#f24e1e' },
  { name: 'Adobe CC',          category: 'Design',       icon: '🖌️', color: '#ff0000' },
  { name: 'SQL Server',        category: 'Database',     icon: '🗄️', color: '#cc2927' },
  { name: 'MySQL Workbench',   category: 'Database',     icon: '🐬', color: '#00758f' },
  { name: 'Postman',           category: 'Development',  icon: '📮', color: '#ff6c37' },
  { name: 'Docker Desktop',    category: 'Development',  icon: '🐳', color: '#2496ed' },
  { name: 'AWS Console',       category: 'Cloud',        icon: '☁️', color: '#ff9900' },
  { name: 'Azure Portal',      category: 'Cloud',        icon: '🌩️', color: '#0089d6' },
  { name: 'Google Workspace',  category: 'Productivity', icon: '🔵', color: '#4285f4' },
  { name: 'Antivirus',         category: 'Security',     icon: '🛡️', color: '#00b140' },
  { name: 'VPN',               category: 'Security',     icon: '🔒', color: '#6366f1' },
];

const CATEGORIES = ['All', 'Productivity', 'Development', 'AI', 'Communication', 'Project Mgmt', 'Design', 'Database', 'Cloud', 'Security', 'Custom'];

const EMPTY_LICENSE_FORM = {
  name: '', category: '', icon: '🔑', color: '#6366f1',
  totalSeats: 1, licenseKey: '', expiryDate: '', vendor: '',
  cost: '', notes: '', autoAssign: false, isCustom: false,
};

const EMPTY_ASSIGN_FORM = {
  empId: '', empName: '', empEmail: '', department: '',
};

// ── Utility ───────────────────────────────────────────────────────────────────
const daysLeft = (d) => {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
};
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-CA') : '—';

// ── Report Modal ──────────────────────────────────────────────────────────────
function ReportModal({ onClose }) {
  const [format, setFormat] = useState('excel');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const url = `${API}/licenses/report/excel?format=${format === 'excel' ? 'summary' : 'detailed'}`;
      const filename = `license-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadFile(url, filename);
      onClose();
    } catch (err) {
      alert('Failed to generate report: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="lic-overlay" onClick={onClose}>
      <div className="lic-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="lic-modal-header">
          <div className="lic-modal-title">
            <FileSpreadsheet size={16} />
            Export License Report
          </div>
          <button className="lic-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="lic-modal-body">
          <div className="lic-section-label">Report Format</div>
          <div className="lic-format-options">
            <button 
              className={`lic-format-btn ${format === 'excel' ? 'active' : ''}`}
              onClick={() => setFormat('excel')}
            >
              <FileSpreadsheet size={18} />
              Excel (.xlsx)
              <small>Multi-sheet detailed report</small>
            </button>
            <button 
              className={`lic-format-btn ${format === 'csv' ? 'active' : ''}`}
              onClick={() => setFormat('csv')}
            >
              <FileText size={18} />
              Summary View
              <small>License summary with allocations</small>
            </button>
          </div>

          <div className="lic-info-box">
            <Shield size={14} />
            <span>The report includes: License summary, employee allocations, department breakdown, expiry status, and usage statistics</span>
          </div>

          <div className="lic-modal-actions">
            <button className="lic-btn lic-btn-secondary" onClick={onClose}>Cancel</button>
            <button className="lic-btn lic-btn-primary" onClick={handleGenerate} disabled={generating}>
              <Download size={14} />
              {generating ? 'Generating...' : `Generate Report`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── License Card ──────────────────────────────────────────────────────────────
function LicenseCard({ license, onExpand, expanded, onEdit, onDelete, onAssign, onRevoke, isAdmin }) {
  const days   = daysLeft(license.expiry_date);
  const used   = license.assignments?.length || 0;
  const total  = license.total_seats || 0;
  const pct    = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const full   = total > 0 && used >= total;

  const expiryColor = days === null ? 'var(--text-muted)'
    : days < 0   ? 'var(--red)'
    : days <= 30 ? '#f59e0b'
    : 'var(--green)';

  return (
    <div className={`lic-card${expanded ? ' lic-card-expanded' : ''}${full ? ' lic-card-full' : ''}${license.is_custom ? ' lic-card-custom' : ''}`}>
      <div className="lic-card-header" onClick={onExpand}>
        <div className="lic-card-icon" style={{ background: license.color + '20', border: `1.5px solid ${license.color}40` }}>
          <span style={{ fontSize: 22 }}>{license.icon}</span>
        </div>
        <div className="lic-card-info">
          <div className="lic-card-name">
            {license.name}
            {license.is_custom && <span className="lic-custom-badge">Custom</span>}
          </div>
          <div className="lic-card-meta">
            <span className="lic-category-tag">{license.category || 'Uncategorized'}</span>
            {license.vendor && <span className="lic-vendor">{license.vendor}</span>}
          </div>
        </div>
        <div className="lic-card-stats">
          <div className="lic-seat-info">
            <span className="lic-seat-used" style={{ color: full ? 'var(--red)' : 'var(--accent)' }}>{used}</span>
            <span className="lic-seat-sep">/</span>
            <span className="lic-seat-total">{total > 0 ? total : '∞'}</span>
            <span className="lic-seat-label">seats</span>
          </div>
          {license.expiry_date && (
            <div className="lic-expiry" style={{ color: expiryColor }}>
              <Clock size={11} />
              {days === null ? 'No expiry' : days < 0 ? `Expired` : days === 0 ? 'Today' : `${days}d`}
            </div>
          )}
        </div>
        {total > 0 && (
          <div className="lic-seat-bar-wrap">
            <div className="lic-seat-bar">
              <div className="lic-seat-fill"
                style={{ width: `${pct}%`, background: full ? 'var(--red)' : pct > 80 ? '#f59e0b' : 'var(--accent)' }} />
            </div>
          </div>
        )}
        <div className="lic-card-actions" onClick={e => e.stopPropagation()}>
          {isAdmin && !full && (
            <button className="lic-btn lic-btn-sm lic-btn-primary" onClick={onAssign}>
              <Plus size={12} /> Assign
            </button>
          )}
          {isAdmin && (
            <>
              <button className="lic-icon-btn" onClick={onEdit} title="Edit"><Edit2 size={13} /></button>
              <button className="lic-icon-btn lic-icon-danger" onClick={onDelete} title="Delete"><Trash2 size={13} /></button>
            </>
          )}
          <div className="lic-expand-arrow" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="lic-assignees">
          <div className="lic-assignees-header">
            <Users size={13} />
            <span>{used} Assigned User{used !== 1 ? 's' : ''}</span>
            {license.auto_assign && (
              <span className="lic-auto-badge"><Zap size={10} /> Auto-assign</span>
            )}
          </div>
          {used === 0 ? (
            <div className="lic-no-assignees">No users assigned yet</div>
          ) : (
            <div className="lic-assignee-list">
              {license.assignments.map(a => (
                <div key={a.id} className="lic-assignee-row">
                  <div className="lic-assignee-avatar">{a.emp_name?.[0] || '?'}</div>
                  <div className="lic-assignee-info">
                    <div className="lic-assignee-name">{a.emp_name}</div>
                    <div className="lic-assignee-meta">
                      {a.emp_id}{a.department ? ` · ${a.department}` : ''}
                      {a.emp_email && <span className="lic-assignee-email"> · {a.emp_email}</span>}
                    </div>
                  </div>
                  <div className="lic-assignee-date">{fmt(a.assigned_at)}</div>
                  {isAdmin && (
                    <button className="lic-icon-btn lic-icon-danger" title="Revoke"
                      onClick={() => onRevoke(a.id)}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add / Edit License Modal ──────────────────────────────────────────────────
function LicenseModal({ editing, onClose, onSaved }) {
  const [form, setForm]   = useState(editing ? {
    name:       editing.name,
    category:   editing.category || '',
    icon:       editing.icon || '🔑',
    color:      editing.color || '#6366f1',
    totalSeats: editing.total_seats || 1,
    licenseKey: editing.license_key || '',
    expiryDate: editing.expiry_date?.split('T')[0] || '',
    vendor:     editing.vendor || '',
    cost:       editing.cost || '',
    notes:      editing.notes || '',
    autoAssign: editing.auto_assign || false,
    isCustom:   editing.is_custom || false,
  } : EMPTY_LICENSE_FORM);
  const [saving, setSaving] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:        form.name,
        category:    form.category,
        icon:        form.icon,
        color:       form.color,
        total_seats: Number(form.totalSeats) || 0,
        license_key: form.licenseKey,
        expiry_date: form.expiryDate || null,
        vendor:      form.vendor,
        cost:        form.cost,
        notes:       form.notes,
        auto_assign: form.autoAssign,
        is_custom:   form.isCustom,
      };
      if (editing) {
        await apiFetch(`/licenses/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/licenses', { method: 'POST', body: JSON.stringify(payload) });
      }
      onSaved();
      onClose();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const pickCatalog = (item) => {
    set('name', item.name);
    set('category', item.category);
    set('icon', item.icon);
    set('color', item.color);
    set('isCustom', false);
    setShowCatalog(false);
  };

  return (
    <div className="lic-overlay" onClick={onClose}>
      <div className="lic-modal" onClick={e => e.stopPropagation()}>
        <div className="lic-modal-header">
          <div className="lic-modal-title"><Key size={16} />{editing ? 'Edit License' : 'Add License'}</div>
          <button className="lic-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="lic-modal-body">
          <form onSubmit={handleSubmit}>
            {!editing && (
              <>
                <div className="lic-catalog-wrap">
                  <button type="button" className="lic-btn lic-btn-secondary lic-btn-sm"
                    onClick={() => setShowCatalog(s => !s)}>
                    <Star size={13} /> Quick Pick from Catalog
                    <ChevronDown size={13} style={{ transform: showCatalog ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
                  </button>
                  {showCatalog && (
                    <div className="lic-catalog-grid">
                      {LICENSE_CATALOG.map(item => (
                        <button key={item.name} type="button"
                          className="lic-catalog-item"
                          onClick={() => pickCatalog(item)}>
                          <span style={{ fontSize: 18 }}>{item.icon}</span>
                          <span>{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <label className="lic-toggle-row" style={{ marginBottom: 16 }}>
                  <div className={`lic-toggle-switch${form.isCustom ? ' active' : ''}`}
                    onClick={() => set('isCustom', !form.isCustom)}>
                    <div className="lic-toggle-knob" />
                  </div>
                  <div>
                    <div className="lic-toggle-label"><Globe size={13} /> Create Custom License</div>
                    <div className="lic-toggle-desc">For new tools, software, or resources not in the catalog</div>
                  </div>
                </label>
              </>
            )}

            <div className="lic-form-row">
              <div className="lic-form-group" style={{ flex: '0 0 72px' }}>
                <label>Icon</label>
                <input className="lic-input lic-emoji-input" value={form.icon}
                  onChange={e => set('icon', e.target.value)} maxLength={4} />
              </div>
              <div className="lic-form-group" style={{ flex: '0 0 72px' }}>
                <label>Color</label>
                <input type="color" className="lic-input lic-color-input"
                  value={form.color} onChange={e => set('color', e.target.value)} />
              </div>
              <div className="lic-form-group" style={{ flex: 1 }}>
                <label>License Name *</label>
                <input required className="lic-input" value={form.name}
                  onChange={e => set('name', e.target.value)} 
                  placeholder={form.isCustom ? "e.g., New Custom Tool" : "e.g., ChatGPT Plus"} />
              </div>
            </div>

            <div className="lic-form-grid2">
              <div className="lic-form-group">
                <label>Category</label>
                <input className="lic-input" list="lic-cats" value={form.category}
                  onChange={e => set('category', e.target.value)} placeholder="AI / Dev / Design / Custom..." />
                <datalist id="lic-cats">
                  {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="lic-form-group">
                <label>Vendor</label>
                <input className="lic-input" value={form.vendor}
                  onChange={e => set('vendor', e.target.value)} placeholder="Microsoft, OpenAI, Internal..." />
              </div>
              <div className="lic-form-group">
                <label>Total Seats <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(0 = unlimited)</span></label>
                <input type="number" min="0" className="lic-input" value={form.totalSeats}
                  onChange={e => set('totalSeats', e.target.value)} />
              </div>
              <div className="lic-form-group">
                <label>Expiry Date</label>
                <input type="date" className="lic-input" value={form.expiryDate}
                  onChange={e => set('expiryDate', e.target.value)} />
              </div>
              <div className="lic-form-group">
                <label>Cost / Month (₹)</label>
                <input className="lic-input" value={form.cost}
                  onChange={e => set('cost', e.target.value)} placeholder="e.g. 1500" />
              </div>
              <div className="lic-form-group">
                <label>License Key</label>
                <input className="lic-input" value={form.licenseKey}
                  onChange={e => set('licenseKey', e.target.value)} placeholder="XXXX-XXXX-XXXX" />
              </div>
            </div>

            <div className="lic-form-group">
              <label>Notes</label>
              <textarea className="lic-textarea" value={form.notes} rows={2}
                onChange={e => set('notes', e.target.value)} 
                placeholder={form.isCustom ? "Describe this custom tool, its purpose, and access instructions..." : "Renewal info, login details, etc."} />
            </div>

            <label className="lic-toggle-row">
              <div className={`lic-toggle-switch${form.autoAssign ? ' active' : ''}`}
                onClick={() => set('autoAssign', !form.autoAssign)}>
                <div className="lic-toggle-knob" />
              </div>
              <div>
                <div className="lic-toggle-label"><Zap size={13} /> Auto-assign to new employees</div>
                <div className="lic-toggle-desc">When a new employee is added, this license is automatically assigned</div>
              </div>
            </label>

            <div className="lic-modal-actions">
              <button type="button" className="lic-btn lic-btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="lic-btn lic-btn-primary" disabled={saving}>
                <Key size={14} /> {saving ? 'Saving…' : editing ? 'Update License' : 'Add License'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Assign Modal ──────────────────────────────────────────────────────────────
function AssignModal({ license, employees, onClose, onAssigned }) {
  const [mode, setMode]     = useState('employee');
  const [empId, setEmpId]   = useState('');
  const [manual, setManual] = useState({ ...EMPTY_ASSIGN_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const existingIds = new Set(license.assignments?.map(a => a.emp_id) || []);

  const filteredEmps = employees.filter(e =>
    !existingIds.has(e.emp_id) &&
    (!search || [e.emp_name, e.emp_id, e.emp_email, e.department]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = mode === 'employee'
        ? (() => {
            const emp = employees.find(e => e.emp_id === empId);
            return { emp_id: emp.emp_id, emp_name: emp.emp_name, emp_email: emp.emp_email, department: emp.department };
          })()
        : manual;
      await apiFetch(`/licenses/${license.id}/assign`, { method: 'POST', body: JSON.stringify(payload) });
      onAssigned();
      onClose();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="lic-overlay" onClick={onClose}>
      <div className="lic-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="lic-modal-header">
          <div className="lic-modal-title">
            <span style={{ fontSize: 18 }}>{license.icon}</span>
            Assign — {license.name}
            {license.is_custom && <span className="lic-custom-badge" style={{ marginLeft: 8 }}>Custom</span>}
          </div>
          <button className="lic-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="lic-modal-body">
          <div className="lic-mode-tabs">
            <button className={`lic-mode-tab${mode === 'employee' ? ' active' : ''}`}
              onClick={() => setMode('employee')}>
              <Users size={13} /> From Employee List
            </button>
            <button className={`lic-mode-tab${mode === 'manual' ? ' active' : ''}`}
              onClick={() => setMode('manual')}>
              <User size={13} /> Manual Entry
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'employee' ? (
              <>
                <div className="lic-search-box">
                  <Search size={13} />
                  <input placeholder="Search employee…" value={search}
                    onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="lic-emp-list">
                  {filteredEmps.length === 0 ? (
                    <div className="lic-emp-empty">No employees found or all already assigned</div>
                  ) : filteredEmps.map(emp => (
                    <label key={emp.emp_id} className={`lic-emp-item${empId === emp.emp_id ? ' selected' : ''}`}>
                      <input type="radio" name="emp" value={emp.emp_id}
                        checked={empId === emp.emp_id}
                        onChange={() => setEmpId(emp.emp_id)} />
                      <div className="lic-emp-avatar">{emp.emp_name?.[0]}</div>
                      <div>
                        <div className="lic-emp-name">{emp.emp_name}</div>
                        <div className="lic-emp-meta">{emp.emp_id}{emp.department ? ` · ${emp.department}` : ''}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <div className="lic-form-grid2" style={{ marginTop: 12 }}>
                <div className="lic-form-group">
                  <label>Employee ID *</label>
                  <input required className="lic-input" value={manual.empId}
                    onChange={e => setManual(f => ({ ...f, empId: e.target.value }))} placeholder="EMP-001" />
                </div>
                <div className="lic-form-group">
                  <label>Full Name *</label>
                  <input required className="lic-input" value={manual.empName}
                    onChange={e => setManual(f => ({ ...f, empName: e.target.value }))} placeholder="John Doe" />
                </div>
                <div className="lic-form-group">
                  <label>Email</label>
                  <input type="email" className="lic-input" value={manual.empEmail}
                    onChange={e => setManual(f => ({ ...f, empEmail: e.target.value }))} placeholder="john@company.com" />
                </div>
                <div className="lic-form-group">
                  <label>Department</label>
                  <input className="lic-input" value={manual.department}
                    onChange={e => setManual(f => ({ ...f, department: e.target.value }))} placeholder="Engineering" />
                </div>
              </div>
            )}

            <div className="lic-modal-actions">
              <button type="button" className="lic-btn lic-btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="lic-btn lic-btn-primary"
                disabled={saving || (mode === 'employee' && !empId)}>
                <Plus size={14} /> {saving ? 'Assigning…' : 'Assign License'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Employee View Modal ───────────────────────────────────────────────────────
function EmployeeLicensesModal({ employee, licenses, onClose }) {
  const myLicenses = licenses.filter(l =>
    l.assignments?.some(a => a.emp_id === employee.emp_id)
  );
  return (
    <div className="lic-overlay" onClick={onClose}>
      <div className="lic-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="lic-modal-header">
          <div className="lic-modal-title">
            <div className="lic-emp-avatar-lg">{employee.emp_name?.[0]}</div>
            {employee.emp_name}'s Licenses
          </div>
          <button className="lic-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="lic-modal-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            {employee.emp_id} · {employee.department || 'No department'} · {employee.emp_email || ''}
          </div>
          {myLicenses.length === 0 ? (
            <div className="lic-no-assignees">No licenses assigned</div>
          ) : (
            <div className="lic-emp-license-list">
              {myLicenses.map(l => (
                <div key={l.id} className="lic-emp-license-item">
                  <span style={{ fontSize: 22 }}>{l.icon}</span>
                  <div>
                    <div className="lic-emp-license-name">
                      {l.name}
                      {l.is_custom && <span className="lic-custom-badge" style={{ marginLeft: 6, fontSize: 9 }}>Custom</span>}
                    </div>
                    <div className="lic-emp-license-cat">{l.category}</div>
                  </div>
                  {l.expiry_date && (
                    <div className="lic-emp-license-expiry" style={{
                      color: daysLeft(l.expiry_date) < 0 ? 'var(--red)'
                           : daysLeft(l.expiry_date) <= 30 ? '#f59e0b' : 'var(--green)'
                    }}>
                      <Clock size={11} /> {fmt(l.expiry_date)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="lic-modal-actions">
            <button className="lic-btn lic-btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LicenseManagement() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [licenses,   setLicenses]   = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('All');
  const [expanded,   setExpanded]   = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [assigning,  setAssigning]  = useState(null);
  const [viewEmp,    setViewEmp]    = useState(null);
  const [activeTab,  setActiveTab]  = useState('licenses');
  const [empSearch,  setEmpSearch]  = useState('');

  const fetchAll = useCallback(async () => {
  setLoading(true);
  try {
    const [licRes, empRes] = await Promise.all([
      apiFetch('/licenses'),
      apiFetch('/licenses/employees'),
    ]);
    
    // ✅ Ensure licenses have assignments array
    const licensesData = (licRes.data || []).map(license => ({
      ...license,
      assignments: license.assignments || []
    }));
    
    setLicenses(licensesData);
    setEmployees(empRes.data || []);
  } catch (err) { 
    console.error('Fetch error:', err);
  } finally { 
    setLoading(false); 
  }
}, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this license? All assignments will be removed.')) return;
    try { await apiFetch(`/licenses/${id}`, { method: 'DELETE' }); fetchAll(); }
    catch (err) { alert(err.message); }
  };

  const handleRevoke = async (assignmentId) => {
    if (!window.confirm('Revoke this license assignment?')) return;
    try { await apiFetch(`/licenses/assignments/${assignmentId}`, { method: 'DELETE' }); fetchAll(); }
    catch (err) { alert(err.message); }
  };

  // ✅ Fixed: Download with authentication
  const handleQuickExport = async () => {
    try {
      const url = `${API}/licenses/report/excel?format=summary`;
      const filename = `license-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadFile(url, filename);
      setShowExportMenu(false);
    } catch (err) {
      alert('Failed to export: ' + err.message);
    }
  };

  const totalAssignments = licenses.reduce((s, l) => s + (l.assignments?.length || 0), 0);
  const expiringSoon     = licenses.filter(l => { const d = daysLeft(l.expiry_date); return d !== null && d >= 0 && d <= 30; }).length;
  const expired          = licenses.filter(l => { const d = daysLeft(l.expiry_date); return d !== null && d < 0; }).length;
  const totalCost        = licenses.reduce((s, l) => s + (parseFloat(l.cost) || 0), 0);
  const customLicenses   = licenses.filter(l => l.is_custom).length;

  const filteredLicenses = licenses.filter(l => {
    const ms = !search || [l.name, l.category, l.vendor].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const mc = catFilter === 'All' || l.category === catFilter;
    return ms && mc;
  });

  const usedCategories = ['All', ...new Set(licenses.map(l => l.category).filter(Boolean))];

  const filteredEmployees = employees.filter(e =>
  e && (!empSearch || [e.emp_name, e.emp_id, e.emp_email, e.department]
    .some(v => v && v.toLowerCase().includes(empSearch.toLowerCase())))
);

  return (
    <div className="lic-page fade-in">
      <div className="lic-page-header">
        <div className="lic-header-left">
          <div className="lic-header-icon"><Key size={22} /></div>
          <div>
            <h1>License Management</h1>
            <p>Track software licenses and assignments across your team</p>
          </div>
        </div>
        {isAdmin && (
          <div className="lic-header-actions">
            <div className="lic-export-dropdown">
              <button 
                className="lic-btn lic-btn-secondary"
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                <Download size={15} /> Export <ChevronDown size={14} />
              </button>
              {showExportMenu && (
                <div className="lic-dropdown-menu">
                  <button onClick={handleQuickExport}>
                    <FileSpreadsheet size={14} /> Quick Excel Export
                  </button>
                  <button onClick={() => { setShowReport(true); setShowExportMenu(false); }}>
                    <Download size={14} /> Advanced Report Options
                  </button>
                </div>
              )}
            </div>
            <button className="lic-btn lic-btn-primary" onClick={() => { setEditing(null); setShowAdd(true); }}>
              <Plus size={15} /> Add License
            </button>
          </div>
        )}
      </div>

      <div className="lic-stats">
        {[
          { label: 'Total Licenses', value: licenses.length,   color: 'blue'  },
          { label: 'Assignments',    value: totalAssignments,   color: 'green' },
          { label: 'Custom Licenses', value: customLicenses,    color: 'purple' },
          { label: 'Expiring ≤30d',  value: expiringSoon,       color: 'amber', pulse: expiringSoon > 0 },
          { label: 'Expired',        value: expired,            color: 'red',   pulse: expired > 0 },
          { label: 'Monthly Cost',   value: totalCost > 0 ? `₹${totalCost.toLocaleString()}` : '—', color: 'teal' },
        ].map((s, i) => (
          <div key={s.label} className={`lic-stat lic-stat-${s.color}${s.pulse ? ' lic-stat-pulse' : ''}`}
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="lic-stat-value">{s.value}</div>
            <div className="lic-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {(expiringSoon > 0 || expired > 0) && (
        <div className={`lic-alert${expired > 0 ? ' lic-alert-red' : ''}`}>
          <AlertTriangle size={14} />
          {expired > 0 && <strong>{expired} license{expired !== 1 ? 's' : ''} expired</strong>}
          {expired > 0 && expiringSoon > 0 && ' · '}
          {expiringSoon > 0 && <span>{expiringSoon} expiring within 30 days</span>}
          — renew soon to avoid service disruption.
        </div>
      )}

      <div className="lic-tabs">
        <button className={`lic-tab${activeTab === 'licenses' ? ' active' : ''}`}
          onClick={() => setActiveTab('licenses')}>
          <Key size={14} /> Licenses <span className="lic-tab-count">{licenses.length}</span>
        </button>
        <button className={`lic-tab${activeTab === 'employees' ? ' active' : ''}`}
          onClick={() => setActiveTab('employees')}>
          <Users size={14} /> Employees <span className="lic-tab-count">{employees.length}</span>
        </button>
      </div>

      {activeTab === 'licenses' && (
        <>
          <div className="lic-toolbar">
            <div className="lic-search">
              <Search size={14} />
              <input placeholder="Search license, vendor, category…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="lic-cat-pills">
              {usedCategories.map(c => (
                <button key={c}
                  className={`lic-cat-pill${catFilter === c ? ' active' : ''}`}
                  onClick={() => setCatFilter(c)}>{c}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="lic-loading">
              {[...Array(4)].map((_, i) => <div key={i} className="lic-skeleton" style={{ animationDelay: `${i * 80}ms` }} />)}
            </div>
          ) : filteredLicenses.length === 0 ? (
            <div className="lic-empty">
              <Key size={44} />
              <p>No licenses found</p>
              {isAdmin && (
                <button className="lic-btn lic-btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={14} /> Add First License
                </button>
              )}
            </div>
          ) : (
            <div className="lic-card-list">
              {filteredLicenses.map(l => (
                <LicenseCard
                  key={l.id}
                  license={l}
                  expanded={expanded === l.id}
                  onExpand={() => setExpanded(expanded === l.id ? null : l.id)}
                  onEdit={() => { setEditing(l); setShowAdd(true); }}
                  onDelete={() => handleDelete(l.id)}
                  onAssign={() => setAssigning(l)}
                  onRevoke={handleRevoke}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'employees' && (
        <>
          <div className="lic-toolbar">
            <div className="lic-search">
              <Search size={14} />
              <input placeholder="Search employee, ID, department…"
                value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
            </div>
          </div>

          {loading ? (
            <div className="lic-loading">
              {[...Array(5)].map((_, i) => <div key={i} className="lic-skeleton" style={{ animationDelay: `${i * 60}ms` }} />)}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="lic-empty">
              <Users size={44} />
              <p>No employees found</p>
            </div>
          ) : (
            <div className="lic-emp-table-wrap">
              <table className="lic-emp-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Licenses Assigned</th>
                    <th>License List</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const myLicenses = licenses.filter(l => {
                      return l.assignments && Array.isArray(l.assignments) && 
                        l.assignments.some(a => a && a.emp_id === emp.emp_id);
                    });
                    
                    return (
                      <tr key={emp.emp_id}>
                        <td>
                          <div className="lic-emp-cell">
                            <div className="lic-assignee-avatar">{emp.emp_name?.[0] || '?'}</div>
                            <div>
                              <div className="lic-assignee-name">{emp.emp_name || 'Unknown'}</div>
                              <div className="lic-assignee-meta">{emp.emp_id || '—'} · {emp.emp_email || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{emp.department || '—'}</td>
                        <td>
                          <span className="lic-count-badge">{myLicenses.length}</span>
                        </td>
                        <td>
                          <div className="lic-license-icons">
                            {myLicenses.slice(0, 6).map(l => (
                              <span key={l.id} title={l.name}
                                className="lic-mini-icon"
                                style={{ background: l.color + '20', border: `1px solid ${l.color}40` }}>
                                {l.icon}
                              </span>
                            ))}
                            {myLicenses.length > 6 && (
                              <span className="lic-mini-more">+{myLicenses.length - 6}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <button className="lic-btn lic-btn-sm lic-btn-secondary"
                            onClick={() => setViewEmp(emp)}>
                            <ExternalLink size={12} /> View All
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <LicenseModal
          editing={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={fetchAll}
        />
      )}
      {assigning && (
        <AssignModal
          license={assigning}
          employees={employees}
          onClose={() => setAssigning(null)}
          onAssigned={fetchAll}
        />
      )}
      {viewEmp && (
        <EmployeeLicensesModal
          employee={viewEmp}
          licenses={licenses}
          onClose={() => setViewEmp(null)}
        />
      )}
      {showReport && (
        <ReportModal onClose={() => setShowReport(false)} />
      )}
    </div>
  )};