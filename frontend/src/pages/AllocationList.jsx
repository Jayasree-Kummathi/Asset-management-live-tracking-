import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import { Search, Download, RefreshCw } from 'lucide-react';
import { toDateStr, fmtDate } from '../utils/dataUtils';
import * as XLSX from 'xlsx';

export default function AllocationList() {
  const { allocations, assets } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Active');

  const filtered = allocations.filter(a => {
    const matchFilter = filter === 'All' || a.status === filter;
    const matchSearch = !search || [a.empId, a.empName, a.assetId, a.project, a.client]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const getAsset = (id) => assets.find(a => a.id === id);

  // Export to Excel function
  const handleExportToExcel = () => {
    if (!filtered.length) {
      alert('No data to export');
      return;
    }

    // Prepare data for export
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
        'Status': a.status,
      };
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-size columns (optional - set width)
    ws['!cols'] = [
      { wch: 15 }, // Allocation ID
      { wch: 12 }, // Employee ID
      { wch: 25 }, // Employee Name
      { wch: 15 }, // Department
      { wch: 12 }, // Asset ID
      { wch: 20 }, // Model
      { wch: 12 }, // Brand
      { wch: 15 }, // Serial Number
      { wch: 20 }, // Project
      { wch: 20 }, // Client
      { wch: 15 }, // Allocation Date
      { wch: 30 }, // Accessories
      { wch: 12 }, // Status
    ];
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Allocations');
    
    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `Allocations_${filter}_${date}.xlsx`;
    
    // Download file
    XLSX.writeFile(wb, filename);
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
              <th>Alloc ID</th><th>Employee</th><th>Asset</th>
              <th>Model</th><th>Project</th>
              <th>Alloc Date</th><th>Accessories</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9}><div className="empty-state"><p>No allocations found</p></div></td></tr>
            ) : filtered.map(a => {
              const asset = getAsset(a.assetId);
              return (
                <tr key={a.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{a.id}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.empName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.empId} · {a.department}</div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>{a.assetId}</span>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{asset?.model || '—'}</td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{a.project || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.client}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {toDateStr(a.allocationDate) || '—'}
                  </td>
                  <td>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {a.accessories?.join(', ') || '—'}
                    </div>
                  </td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    {a.status === 'Active' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary"
                          onClick={() => navigate('/receive', { state: { allocationId: a.id } })}>
                          Receive
                        </button>
                        <button className="btn btn-sm btn-secondary"
                          onClick={() => navigate('/swap', { state: { allocationId: a.id } })}>
                          <RefreshCw size={12} /> Swap
                        </button>
                      </div>
                    )}
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