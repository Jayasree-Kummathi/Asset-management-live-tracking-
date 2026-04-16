import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Download,
  Repeat,
  Wrench,
  Trash2
} from 'lucide-react';

/* ---------- Helpers ---------- */
const formatTime = (date) => new Date(date).toLocaleString();

const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
};

/* ---------- Parse Detail ---------- */
const parseDetail = (detail = '') => {
  const assetMatch = detail.match(/(LTB-\d+)/i);
  const empMatch = detail.match(/to (.*?) \((.*?)\)/i);

  return {
    assetId: assetMatch ? assetMatch[1] : '',
    empName: empMatch ? empMatch[1] : '',
    empId: empMatch ? empMatch[2] : ''
  };
};

/* ---------- Type Colors + Icons ---------- */
const typeColors = {
  allocate: {
    color: 'var(--accent)',
    bg: 'var(--accent-glow)',
    label: 'Allocate',
    icon: <Download size={14} />
  },
  receive: {
    color: 'var(--green)',
    bg: 'var(--green-bg)',
    label: 'Receive',
    icon: <RefreshCw size={14} />
  },
  swap: {
    color: 'var(--purple)',
    bg: 'var(--purple-bg)',
    label: 'Swap',
    icon: <Repeat size={14} />
  },
  repair: {
    color: 'var(--amber)',
    bg: 'var(--amber-bg)',
    label: 'Repair',
    icon: <Wrench size={14} />
  },
  scrap: {
    color: 'var(--red)',
    bg: 'var(--red-bg)',
    label: 'Scrap',
    icon: <Trash2 size={14} />
  },
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  /* ---------- Fetch Logs ---------- */
  useEffect(() => {
    const token = localStorage.getItem('token');

    fetch('http://localhost:5000/api/audit', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        console.log("AUDIT LOGS:", data);

        if (data.success && Array.isArray(data.data)) {
          const normalized = data.data.map(log => {
            let type = log.type;

            if (!type) {
              if (log.action.includes('SWAP')) type = 'swap';
              else if (log.action.includes('RECEIVE')) type = 'receive';
              else if (log.action.includes('REPAIR')) type = 'repair';
              else if (log.action.includes('SCRAP')) type = 'scrap';
              else type = 'allocate';
            }

            return {
              ...log,
              type: type.toLowerCase()
            };
          });

          setLogs(normalized);
        } else {
          setLogs([]);
        }
      })
      .catch(err => {
        console.error("API ERROR:", err);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  /* ---------- Filter ---------- */
  const filtered = logs.filter(l => {
    const matchFilter =
      filter === 'All' || l.type === filter.toLowerCase();

    const matchSearch =
      !search ||
      [l.action, l.detail, l.performed_by]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase());

    return matchFilter && matchSearch;
  });

  return (
    <div className="fade-in">

      {/* Header */}
      <div className="page-header page-header-row">
        <div>
          <h1>Audit Logs</h1>
          <p>Complete history of all system actions</p>
        </div>

        <div style={{
          padding: '8px 14px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: 13
        }}>
          <ClipboardList size={14} style={{ marginRight: 6 }} />
          {logs.length} total events
        </div>
      </div>

      {/* Toolbar */}
      <div className="inv-toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
          <Search size={15} />
          <input
            className="form-input"
            placeholder="Search action, asset, user…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="toggle-group">
          {['All', 'Allocate', 'Receive', 'Swap', 'Repair', 'Scrap'].map(s => (
            <button
              key={s}
              className={`toggle-btn ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Logs */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">
            <p>Loading logs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={32} />
            <p>No log entries found</p>
          </div>
        ) : (
          filtered.map((log, i) => {
            const cfg = typeColors[log.type] || typeColors.allocate;
            const parsed = parseDetail(log.detail);

            return (
              <div key={i} style={{
                display: 'flex',
                gap: 16,
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)'
              }}>

                {/* Badge */}
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: cfg.bg,
                  color: cfg.color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  {cfg.icon}
                  {cfg.label}
                </span>

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {log.action.replaceAll('_', ' ')}
                  </div>

                  {/* Asset */}
                  <div style={{ fontSize: 12.5, marginTop: 4 }}>
                    💻 <b>{parsed.assetId}</b>
                  </div>

                  {/* Employee */}
                  {parsed.empName && (
                    <div style={{ fontSize: 12.5 }}>
                      👤 {parsed.empName} ({parsed.empId})
                    </div>
                  )}

                  {/* Detail */}
                  <div style={{ fontSize: 11.5, opacity: 0.7 }}>
                    {log.detail}
                  </div>
                </div>

                {/* Meta */}
                <div style={{ textAlign: 'right' }}>
                  <div>{log.performed_by}</div>
                  <div style={{ fontSize: 12 }}>
                    {formatTime(log.created_at)}
                    <div style={{ fontSize: 10 }}>
                      {timeAgo(log.created_at)}
                    </div>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}