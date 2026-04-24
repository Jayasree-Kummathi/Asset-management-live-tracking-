import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import { Search, Download, RefreshCw, Eye, X, User, Laptop, Briefcase, Calendar, Package, Wrench } from 'lucide-react';
import { toDateStr } from '../utils/dataUtils';
import * as XLSX from 'xlsx';

// ── View Allocation Modal ─────────────────────────────────────────────────────
function ViewAllocationModal({ allocation, asset, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'var(--accent-glow)', border: '2px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: 'var(--accent)',
            }}>
              {allocation.empName?.[0] || '?'}
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>{allocation.empName}</h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {allocation.empId}{allocation.department ? ` · ${allocation.department}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge status={allocation.status} />
            <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="modal-body">

          {/* ── Prepared / Allocated By ── */}
          <div style={{
            padding: '14px 16px', marginBottom: 20,
            background: 'rgba(79,142,247,.07)',
            border: '1px solid rgba(79,142,247,.25)',
            borderRadius: 'var(--radius)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Prepared &amp; Allocated By
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <User size={16} color="var(--accent)" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  {allocation.preparedBy || allocation.prepared_by
                    || allocation.allocatedBy || allocation.allocated_by || '—'}
                </div>
                {(allocation.allocatedByEmail || allocation.allocated_by_email) && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {allocation.allocatedByEmail || allocation.allocated_by_email}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Asset Details ── */}
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Laptop size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            Asset Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 18 }}>
            <div className="info-row">
              <span className="info-label">Asset ID</span>
              <span className="info-value" style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700 }}>
                {allocation.assetId}
              </span>
            </div>
            <div className="info-row"><span className="info-label">Status</span><StatusBadge status={allocation.status} /></div>
            <div className="info-row">
              <span className="info-label">Brand / Model</span>
              <span className="info-value">{asset ? `${asset.brand} ${asset.model}` : '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Serial</span>
              <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{asset?.serial || '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Configuration</span>
              <span className="info-value">{asset?.config || '—'}</span>
            </div>
          </div>

          {/* ── Allocation Info ── */}
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Briefcase size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            Allocation Info
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 18 }}>
            <div className="info-row"><span className="info-label">Project</span><span className="info-value">{allocation.project || '—'}</span></div>
            <div className="info-row"><span className="info-label">Client</span><span className="info-value">{allocation.client || '—'}</span></div>
            <div className="info-row">
              <span className="info-label">Work Email</span>
              <span className="info-value" style={{ fontSize: 12 }}>{allocation.empEmail || '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Mobile</span>
              <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                {allocation.mobileNo || allocation.mobile_no || '—'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Allocation Date</span>
              <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                {toDateStr(allocation.allocationDate) || '—'}
              </span>
            </div>
            {(allocation.returnDate || allocation.return_date) && (
              <div className="info-row">
                <span className="info-label">Return Date</span>
                <span className="info-value" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {toDateStr(allocation.returnDate || allocation.return_date)}
                </span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">Delivery</span>
              <span className="info-value" style={{ textTransform: 'capitalize' }}>
                {allocation.deliveryMethod || allocation.delivery_method || 'Hand'}
              </span>
            </div>
          </div>

          {/* ── Accessories ── */}
          {allocation.accessories?.length > 0 && (
            <>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Package size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
                Accessories
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                {allocation.accessories.map((acc, i) => (
                  <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20,
                    background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                    {acc}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* ── Preparation Details ── */}
          {(allocation.preparedBy || allocation.prepared_by) && (
            <>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wrench size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
                Preparation
              </div>
              <div className="info-row" style={{ marginBottom: 18 }}>
                <span className="info-label">Configured By</span>
                <span className="info-value" style={{ fontWeight: 600 }}>
                  {allocation.preparedBy || allocation.prepared_by}
                </span>
              </div>
            </>
          )}

          {/* ── Damage / Condition Photos ── */}
          {(() => {
            let photos = [];
            try { photos = JSON.parse(allocation.damagePhotos || allocation.damage_photos || '[]'); } catch (_) {}
            return photos.length > 0 ? (
              <>
                <div className="section-title" style={{ marginBottom: 10 }}>Condition Photos</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
                  {photos.map((src, i) => (
                    <img key={i} src={src} alt={`Condition ${i + 1}`}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover',
                        borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => window.open(src, '_blank')}
                    />
                  ))}
                </div>
              </>
            ) : null;
          })()}

          {/* ── Issue Images (legacy) ── */}
          {(allocation.issueImages || allocation.issue_images)?.length > 0 && (
            <>
              <div className="section-title" style={{ marginBottom: 10 }}>Issue Images</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                {(allocation.issueImages || allocation.issue_images).map((img, i) => (
                  <img key={i} src={img} alt={`Issue ${i + 1}`}
                    style={{ width: 110, height: 82, objectFit: 'cover',
                      borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => window.open(img, '_blank')}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Notes ── */}
          {allocation.notes && (
            <div style={{ padding: '10px 14px', background: 'var(--surface2)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: 8 }}>Notes:</span>
              {allocation.notes}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main AllocationList ───────────────────────────────────────────────────────
export default function AllocationList() {
  const { allocations, assets } = useApp();
  const navigate = useNavigate();
  const [search,    setSearch]   = useState('');
  const [filter,    setFilter]   = useState('Active');
  const [viewAlloc, setViewAlloc] = useState(null);

  const filtered = allocations.filter(a => {
    const matchFilter = filter === 'All' || a.status === filter;
    const matchSearch = !search || [a.empId, a.empName, a.assetId, a.project, a.client]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const getAsset = (id) => assets.find(a => a.id === id);

  const handleExportToExcel = () => {
    if (!filtered.length) { alert('No data to export'); return; }
    const exportData = filtered.map(a => {
      const asset = getAsset(a.assetId);
      return {
        'Allocation ID': a.id,
        'Employee ID': a.empId,
        'Employee Name': a.empName,
        'Department': a.department || '—',
        'Asset ID': a.assetId,
        'Model': asset?.model || '—',
        'Brand': asset?.brand || '—',
        'Serial Number': asset?.serial || '—',
        'Project': a.project || '—',
        'Client': a.client || '—',
        'Allocation Date': toDateStr(a.allocationDate) || '—',
        'Accessories': a.accessories?.join(', ') || '—',
        'Prepared By': a.preparedBy || a.prepared_by || '—',
        'Allocated By': a.allocatedBy || a.allocated_by || '—',
        'Status': a.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch:15 },{ wch:12 },{ wch:25 },{ wch:15 },{ wch:12 },
      { wch:20 },{ wch:12 },{ wch:15 },{ wch:20 },{ wch:20 },
      { wch:15 },{ wch:30 },{ wch:20 },{ wch:20 },{ wch:12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Allocations');
    XLSX.writeFile(wb, `Allocations_${filter}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="fade-in">
      <div className="page-header page-header-row">
        <div>
          <h1>Allocation List</h1>
          <p>All current and past laptop allocations</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExportToExcel}>
          <Download size={15} /> Export
        </button>
      </div>

      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
          <Search size={15} />
          <input className="form-input" placeholder="Search employee, asset, project…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="toggle-group">
          {['All', 'Active', 'Returned', 'Swapped'].map(s => (
            <button key={s} className={`toggle-btn ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Alloc ID</th>
              <th>Employee</th>
              <th>Asset</th>
              <th>Model</th>
              <th>Project</th>
              <th>Prepared By</th>
              <th>Alloc Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9}><div className="empty-state"><p>No allocations found</p></div></td></tr>
            ) : filtered.map(a => {
              const asset = getAsset(a.assetId);
              // ✅ Show actual IT staff name — prepared_by takes priority
              const staffName = a.preparedBy || a.prepared_by || a.allocatedBy || a.allocated_by || '—';
              return (
                <tr key={a.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{a.id}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.empName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {a.empId}{a.department ? ` · ${a.department}` : ''}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>
                      {a.assetId}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{asset?.model || '—'}</td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{a.project || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.client}</div>
                  </td>
                  {/* ✅ FIXED — shows actual staff name from prepared_by */}
                  <td>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{staffName}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{toDateStr(a.allocationDate) || '—'}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setViewAlloc(a)}>
                        <Eye size={12} /> View
                      </button>
                      {a.status === 'Active' && (
                        <>
                          <button className="btn btn-sm btn-secondary"
                            onClick={() => navigate('/receive', { state: { allocationId: a.id } })}>
                            Receive
                          </button>
                          <button className="btn btn-sm btn-secondary"
                            onClick={() => navigate('/swap', { state: { allocationId: a.id } })}>
                            <RefreshCw size={12} /> Swap
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

      {viewAlloc && (
        <ViewAllocationModal
          allocation={viewAlloc}
          asset={getAsset(viewAlloc.assetId)}
          onClose={() => setViewAlloc(null)}
        />
      )}
    </div>
  );
}