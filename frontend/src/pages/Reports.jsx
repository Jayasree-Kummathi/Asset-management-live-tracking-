import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import {
  Download, FileText, Package, Send, Wrench, Trash2,
  FileSpreadsheet
} from 'lucide-react';

const COLORS = ['#34d399','#4f8ef7','#fbbf24','#f87171','#a78bfa'];

// ── Tooltip style (theme-aware via CSS vars) ─────────────────────────────────
const TT = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: 13
  },
  cursor: { fill: 'rgba(128,128,128,0.06)' }
};

// ── CSV Export helper ─────────────────────────────────────────────────────────
const downloadCSV = (rows, headers, filename) => {
  const escape = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── Excel (XLSX) export using SheetJS via CDN ─────────────────────────────────
const downloadXLSX = async (sheets, filename) => {
  // Dynamically load SheetJS if not already loaded
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const XLSX = window.XLSX;
  const wb   = XLSX.utils.book_new();

  sheets.forEach(({ name, headers, rows }) => {
    // Build array-of-arrays: header row + data rows
    const aoa = [
      headers,
      ...rows.map(r => headers.map(h => {
        const v = r[h];
        return v === null || v === undefined ? '' : v;
      }))
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths — auto-size based on max content length
    const colWidths = headers.map((h, ci) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map(r => String(r[h] ?? '').length)
      );
      return { wch: Math.min(maxLen + 4, 40) };
    });
    ws['!cols'] = colWidths;

    // Style header row (bold + background) via cell metadata
    headers.forEach((_, ci) => {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (!ws[cellAddr]) return;
      ws[cellAddr].s = {
        font:    { bold: true, color: { rgb: 'FFFFFF' } },
        fill:    { fgColor: { rgb: '1B5E3F' } },
        alignment: { horizontal: 'center' }
      };
    });

    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  XLSX.writeFile(wb, filename);
};

export default function Reports() {
  const { assets, allocations, repairs, scraps, stats } = useApp();
  const [downloading, setDownloading] = useState('');

  // ── CSV Exports ──────────────────────────────────────────────────────────────
  const exportAssets = () => {
    setDownloading('assets');
    const rows = assets.map(a => ({
      asset_id: a.id, serial: a.serial, brand: a.brand, model: a.model,
      config: a.config, processor: a.processor, ram: a.ram, storage: a.storage,
      purchase_date: a.purchaseDate, warranty_start: a.warrantyStart,
      warranty_end: a.warrantyEnd, vendor: a.vendor, location: a.location,
      status: a.status, notes: a.notes,
    }));
    downloadCSV(rows,
      ['asset_id','serial','brand','model','config','processor','ram','storage',
       'purchase_date','warranty_start','warranty_end','vendor','location','status','notes'],
      `assets_report_${new Date().toISOString().split('T')[0]}.csv`
    );
    setTimeout(() => setDownloading(''), 800);
  };

  const exportAllocations = () => {
    setDownloading('allocations');
    const rows = allocations.map(a => ({
      allocation_id: a.id, asset_id: a.assetId, emp_id: a.empId,
      emp_name: a.empName, emp_email: a.empEmail, department: a.department,
      client: a.client, project: a.project,
      allocation_date: a.allocationDate, status: a.status,
      accessories: (a.accessories || []).join('; '),
    }));
    downloadCSV(rows,
      ['allocation_id','asset_id','emp_id','emp_name','emp_email','department',
       'client','project','allocation_date','status','accessories'],
      `allocations_report_${new Date().toISOString().split('T')[0]}.csv`
    );
    setTimeout(() => setDownloading(''), 800);
  };

  const exportRepairs = () => {
    setDownloading('repairs');
    const rows = repairs.map(r => ({
      repair_id: r.id, asset_id: r.assetId, issue: r.issue,
      vendor: r.vendor, repair_date: r.repairDate,
      estimated_return: r.estimatedReturn, status: r.status, notes: r.notes,
    }));
    downloadCSV(rows,
      ['repair_id','asset_id','issue','vendor','repair_date','estimated_return','status','notes'],
      `repairs_report_${new Date().toISOString().split('T')[0]}.csv`
    );
    setTimeout(() => setDownloading(''), 800);
  };

  const exportScraps = () => {
    setDownloading('scraps');
    const rows = scraps.map(s => ({
      scrap_id: s.id, asset_id: s.assetId, model: s.model,
      scrap_date: s.scrapDate, reason: s.reason, approved_by: s.approvedBy,
    }));
    downloadCSV(rows,
      ['scrap_id','asset_id','model','scrap_date','reason','approved_by'],
      `scraps_report_${new Date().toISOString().split('T')[0]}.csv`
    );
    setTimeout(() => setDownloading(''), 800);
  };

  const exportWarranty = () => {
    setDownloading('warranty');
    const today = new Date();
    const in90  = new Date(); in90.setDate(in90.getDate() + 90);
    const rows = assets
      .filter(a => a.status !== 'Scrap')
      .map(a => ({
        asset_id: a.id, serial: a.serial, brand: a.brand, model: a.model,
        warranty_end: a.warrantyEnd, status: a.status,
        warranty_status: !a.warrantyEnd ? 'Unknown'
          : new Date(a.warrantyEnd) < today  ? 'EXPIRED'
          : new Date(a.warrantyEnd) <= in90   ? 'Expiring Soon'
          : 'Valid',
      }))
      .sort((a, b) => (a.warranty_end || '').localeCompare(b.warranty_end || ''));
    downloadCSV(rows,
      ['asset_id','serial','brand','model','warranty_end','status','warranty_status'],
      `warranty_report_${new Date().toISOString().split('T')[0]}.csv`
    );
    setTimeout(() => setDownloading(''), 800);
  };

  // ── EXCEL: Stock Available Report (multi-sheet) ───────────────────────────
  const exportStockExcel = async () => {
    setDownloading('stock_excel');
    try {
      const today = new Date();
      const in90  = new Date(); in90.setDate(in90.getDate() + 90);

      // Sheet 1 — Stock Available (status = 'Stock' / 'Available')
      const stockAssets = assets.filter(a =>
        a.status === 'Stock' || a.status === 'Available' || a.status === 'stock'
      );
      const stockRows = stockAssets.map(a => ({
        'Asset ID':      a.id,
        'Serial No':     a.serial      || '',
        'Brand':         a.brand       || '',
        'Model':         a.model       || '',
        'Processor':     a.processor   || '',
        'RAM':           a.ram         || '',
        'Storage':       a.storage     || '',
        'Config':        a.config      || '',
        'Location':      a.location    || '',
        'Vendor':        a.vendor      || '',
        'Purchase Date': a.purchaseDate|| '',
        'Warranty End':  a.warrantyEnd || '',
        'Warranty Status': !a.warrantyEnd ? 'Unknown'
          : new Date(a.warrantyEnd) < today ? 'EXPIRED'
          : new Date(a.warrantyEnd) <= in90  ? 'Expiring Soon'
          : 'Valid',
        'Notes':         a.notes       || '',
      }));

      // Sheet 2 — All Assets Summary
      const allRows = assets.map(a => ({
        'Asset ID':      a.id,
        'Serial No':     a.serial      || '',
        'Brand':         a.brand       || '',
        'Model':         a.model       || '',
        'Processor':     a.processor   || '',
        'RAM':           a.ram         || '',
        'Storage':       a.storage     || '',
        'Status':        a.status      || '',
        'Location':      a.location    || '',
        'Vendor':        a.vendor      || '',
        'Purchase Date': a.purchaseDate|| '',
        'Warranty End':  a.warrantyEnd || '',
        'Notes':         a.notes       || '',
      }));

      // Sheet 3 — Status Summary (pivot)
      const statusCounts = assets.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});
      const summaryRows = Object.entries(statusCounts).map(([status, count]) => ({
        'Status':      status,
        'Count':       count,
        'Percentage':  `${Math.round((count / assets.length) * 100)}%`,
      }));
      // Add totals row
      summaryRows.push({
        'Status': 'TOTAL',
        'Count':  assets.length,
        'Percentage': '100%',
      });

      // Sheet 4 — Brand-wise breakdown
      const brandCounts = assets.reduce((acc, a) => {
        if (!acc[a.brand]) acc[a.brand] = { Stock:0, Allocated:0, Repair:0, Scrap:0, Other:0 };
        const key = ['Stock','Available'].includes(a.status) ? 'Stock'
          : a.status === 'Allocated' ? 'Allocated'
          : a.status === 'Repair'    ? 'Repair'
          : a.status === 'Scrap'     ? 'Scrap'
          : 'Other';
        acc[a.brand][key]++;
        return acc;
      }, {});
      const brandRows = Object.entries(brandCounts).map(([brand, counts]) => ({
        'Brand':     brand,
        'In Stock':  counts.Stock,
        'Allocated': counts.Allocated,
        'Repair':    counts.Repair,
        'Scrap':     counts.Scrap,
        'Other':     counts.Other,
        'Total':     Object.values(counts).reduce((s, v) => s + v, 0),
      }));

      await downloadXLSX(
        [
          {
            name: 'Stock Available',
            headers: Object.keys(stockRows[0] || {
              'Asset ID':'','Serial No':'','Brand':'','Model':'','Processor':'',
              'RAM':'','Storage':'','Config':'','Location':'','Vendor':'',
              'Purchase Date':'','Warranty End':'','Warranty Status':'','Notes':''
            }),
            rows: stockRows,
          },
          {
            name: 'All Assets',
            headers: ['Asset ID','Serial No','Brand','Model','Processor','RAM',
              'Storage','Status','Location','Vendor','Purchase Date','Warranty End','Notes'],
            rows: allRows,
          },
          {
            name: 'Status Summary',
            headers: ['Status','Count','Percentage'],
            rows: summaryRows,
          },
          {
            name: 'Brand Breakdown',
            headers: ['Brand','In Stock','Allocated','Repair','Scrap','Other','Total'],
            rows: brandRows,
          },
        ],
        `stock_report_${new Date().toISOString().split('T')[0]}.xlsx`
      );
    } catch (err) {
      console.error('Excel export error:', err);
      alert('Excel export failed. Please try again.');
    } finally {
      setTimeout(() => setDownloading(''), 800);
    }
  };

  // ── Chart data ──────────────────────────────────────────────────────────────
  const brandData = Object.entries(
    assets.reduce((acc, a) => ({ ...acc, [a.brand]: (acc[a.brand] || 0) + 1 }), {})
  ).map(([name, count]) => ({ name, count }));

  const statusData = [
    { name: 'Stock',     value: stats.stock },
    { name: 'Allocated', value: stats.allocated },
    { name: 'Repair',    value: stats.repair },
    { name: 'Scrap',     value: stats.scrap },
  ];

  const monthlyData = [
    { month: 'Oct', allocated: 1, received: 0 },
    { month: 'Nov', allocated: 2, received: 1 },
    { month: 'Dec', allocated: 2, received: 1 },
    { month: 'Jan', allocated: 1, received: 1 },
    { month: 'Feb',
      allocated: allocations.filter(a => a.status === 'Active').length,
      received:  allocations.filter(a => a.status !== 'Active').length
    },
  ];

  const today   = new Date();
  const in90    = new Date(); in90.setDate(in90.getDate() + 90);
  const expired = assets.filter(a => a.warrantyEnd && new Date(a.warrantyEnd) < today && a.status !== 'Scrap').length;
  const expSoon = assets.filter(a => a.warrantyEnd && new Date(a.warrantyEnd) >= today && new Date(a.warrantyEnd) <= in90).length;
  const stockCount = assets.filter(a => a.status === 'Stock' || a.status === 'Available').length;

  const reportCards = [
    {
      key:   'stock_excel',
      label: 'Stock Available',
      icon:  FileSpreadsheet,
      count: stockCount,
      desc:  'Excel: stock, all assets, brand & status sheets',
      fn:    exportStockExcel,
      isExcel: true,
      accent: '#22c55e',
    },
    {
      key:   'assets',
      label: 'All Assets',
      icon:  Package,
      count: stats.total,
      desc:  'Full inventory with specs & warranty',
      fn:    exportAssets,
    },
    {
      key:   'allocations',
      label: 'Allocations',
      icon:  Send,
      count: allocations.length,
      desc:  'All allocation history',
      fn:    exportAllocations,
    },
    {
      key:   'repairs',
      label: 'Repair Records',
      icon:  Wrench,
      count: repairs.length,
      desc:  'All repair history',
      fn:    exportRepairs,
    },
    {
      key:   'scraps',
      label: 'Scrapped Assets',
      icon:  Trash2,
      count: scraps.length,
      desc:  'End-of-life asset records',
      fn:    exportScraps,
    },
    {
      key:   'warranty',
      label: 'Warranty Report',
      icon:  FileText,
      count: `${expired} exp.`,
      desc:  'Warranty status for all active assets',
      fn:    exportWarranty,
    },
  ];

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div className="page-header page-header-row">
        <div>
          <h1>Reports</h1>
          <p>Analytics and downloadable reports</p>
        </div>
        <button className="btn btn-secondary" onClick={exportAssets}>
          <Download size={15}/> Export All Assets
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Assets',     val: stats.total,     color: 'var(--accent)' },
          { label: 'In Stock',         val: stockCount,      color: 'var(--green)'  },
          { label: 'Utilization Rate', val: `${Math.round((stats.allocated / Math.max(stats.total, 1)) * 100)}%`, color: 'var(--accent)' },
          { label: 'Warranty Expired', val: expired,         color: 'var(--red)'    },
          { label: 'Expiring in 90d',  val: expSoon,         color: 'var(--amber)'  },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: 'var(--mono)' }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Download report cards ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Download Reports</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
          {reportCards.map(r => {
            const Icon      = r.icon;
            const isLoading = downloading === r.key;
            const isExcel   = r.isExcel;
            return (
              <div
                key={r.key}
                className={`card report-card ${isExcel ? 'report-card-excel' : ''}`}
                style={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={r.fn}
              >
                {isExcel && (
                  <div className="excel-badge">XLSX</div>
                )}
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: isExcel ? 'rgba(34,197,94,0.12)' : 'var(--surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 10px'
                }}>
                  <Icon size={18} color={isExcel ? '#22c55e' : 'var(--accent)'}/>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{r.label}</div>
                <div style={{
                  fontSize: 18, fontWeight: 800,
                  color: isExcel ? '#22c55e' : 'var(--accent)',
                  fontFamily: 'var(--mono)', margin: '4px 0'
                }}>{r.count}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>{r.desc}</div>
                <button
                  className={`btn btn-sm ${isExcel ? 'btn-excel' : 'btn-secondary'}`}
                  style={{ width: '100%' }}
                  disabled={isLoading}
                >
                  {isExcel ? <FileSpreadsheet size={12}/> : <Download size={12}/>}
                  {' '}{isLoading ? 'Generating…' : isExcel ? 'Download XLSX' : 'Download CSV'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Charts row 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="section-title">Monthly Activity</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <Tooltip {...TT}/>
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }}/>
              <Line type="monotone" dataKey="allocated" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 4 }} name="Allocated"/>
              <Line type="monotone" dataKey="received"  stroke="#22c55e"       strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }}        name="Received"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">Asset Status Distribution</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ResponsiveContainer width="60%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="value" paddingAngle={3}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i]}/>)}
                </Pie>
                <Tooltip {...TT}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {statusData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i], flexShrink: 0 }}/>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)', flex: 1 }}>{d.name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts row 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="section-title">Assets by Brand</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={brandData} barSize={36}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <Tooltip {...TT}/>
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {brandData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">Warranty Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0' }}>
            {[
              { label: 'Valid (>90 days)',       count: assets.filter(a => a.warrantyEnd && new Date(a.warrantyEnd) > in90 && a.status !== 'Scrap').length, color: 'var(--green)', bg: 'var(--green-bg)' },
              { label: 'Expiring Soon (<90d)',   count: expSoon,  color: 'var(--amber)', bg: 'var(--amber-bg)' },
              { label: 'Expired',                count: expired,  color: 'var(--red)',   bg: 'var(--red-bg)'   },
              { label: 'No Warranty Info',       count: assets.filter(a => !a.warrantyEnd && a.status !== 'Scrap').length, color: 'var(--text-muted)', bg: 'var(--surface2)' },
            ].map(w => (
              <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: w.bg, border: `1px solid ${w.color}33`, borderRadius: 'var(--radius)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: w.color, flexShrink: 0 }}/>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{w.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: w.color, fontFamily: 'var(--mono)' }}>{w.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}