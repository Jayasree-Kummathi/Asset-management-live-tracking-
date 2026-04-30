import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, LogOut, Send, RotateCcw, Wrench, Trash2,
  Plus, RefreshCw, Upload, ArrowLeftRight, CheckCircle,
  AlertTriangle, Package, Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Topbar.css';

const titles = {
  '/dashboard':         'Dashboard',
  '/inventory':         'Asset Inventory',
  '/allocate':          'Allocate Laptop',
  '/allocation-list':   'Allocation List',
  '/receive':           'Receive Laptop',
  '/swap':              'Swap Laptop',
  '/repair':            'Repair Assets',
  '/scrap':             'Scrap Assets',
  '/reports':           'Reports',
  '/audit':             'Audit Logs',
  '/users':             'Manage Users',
  '/accessories':       'Accessory Requests',
  '/acceptance-tracker':'Acceptance Tracker',
  '/my-dashboard':      'My Dashboard',
  '/my-laptop':         'My Laptop',
  '/network-assets':    'Network Assets',
};

/* ── Map audit action → icon + color + friendly label ── */
const ACTION_META = {
  ASSET_ADDED:          { icon: Plus,          color: '#34d399', label: 'Asset Added' },
  ASSET_UPDATED:        { icon: RefreshCw,     color: '#60a5fa', label: 'Asset Updated' },
  ASSET_ALLOCATED:      { icon: Send,          color: '#818cf8', label: 'Allocated' },
  ASSET_RECEIVED:       { icon: RotateCcw,     color: '#34d399', label: 'Received Back' },
  ASSET_SWAPPED:        { icon: ArrowLeftRight, color: '#f59e0b', label: 'Swapped' },
  ASSET_REPAIRED:       { icon: Wrench,        color: '#f59e0b', label: 'Repair' },
  ASSET_SENT_FOR_REPAIR:{ icon: Wrench,        color: '#f59e0b', label: 'Sent for Repair' },
  ASSET_SCRAPPED:       { icon: Trash2,        color: '#f87171', label: 'Scrapped' },
  ASSET_DELETED:        { icon: Trash2,        color: '#f87171', label: 'Deleted' },
  BULK_ASSET_IMPORT:    { icon: Upload,        color: '#818cf8', label: 'Bulk Import' },
  ACCEPTANCE_SIGNED:    { icon: CheckCircle,   color: '#34d399', label: 'Acceptance Signed' },
  ACCESSORY_REQUESTED:  { icon: Package,       color: '#60a5fa', label: 'Accessory Request' },
  ACCESSORY_APPROVED:   { icon: CheckCircle,   color: '#34d399', label: 'Accessory Approved' },
  DEFAULT:              { icon: AlertTriangle,  color: '#94a3b8', label: 'Event' },
};

const getMeta = (action) => ACTION_META[action] || ACTION_META.DEFAULT;

/* ── Format relative time ── */
const relativeTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Topbar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  const title = titles[location.pathname] || 'Asset Management';

  const [now,          setNow]          = React.useState(new Date());
  const [isNotifOpen,  setIsNotifOpen]  = React.useState(false);
  const [logs,         setLogs]         = React.useState([]);
  const [loading,      setLoading]      = React.useState(false);
  const [readIds,      setReadIds]      = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_read') || '[]')); }
    catch { return new Set(); }
  });
  const notifRef    = React.useRef(null);
  const pollRef     = React.useRef(null);
  const prevCountRef = React.useRef(0);

  /* ── Clock ── */
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  /* ── Click outside to close ── */
  React.useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))
        setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Fetch audit logs (latest 30) ── */
  const fetchLogs = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API}/audit?limit=30&page=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.data || data.logs || [];
      setLogs(rows);

      // Browser notification if count jumped
      if (prevCountRef.current > 0 && rows.length > prevCountRef.current) {
        const newest = rows[0];
        if (newest && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(`AssetOps — ${getMeta(newest.action).label}`, {
            body: newest.detail || '',
            icon: '/favicon.ico',
          });
        }
      }
      prevCountRef.current = rows.length;
    } catch (_) {}
  }, []);

  /* ── Initial fetch + polling every 30s ── */
  React.useEffect(() => {
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchLogs, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchLogs]);

  /* ── Persist read IDs ── */
  React.useEffect(() => {
    localStorage.setItem('notif_read', JSON.stringify([...readIds]));
  }, [readIds]);

  /* ── Unread = in logs but not in readIds ── */
  const unreadCount = logs.filter(l => !readIds.has(l.id)).length;

  const markRead    = (id) => setReadIds(s => new Set([...s, id]));
  const markAllRead = () => setReadIds(new Set(logs.map(l => l.id)));

  const handleOpen = () => {
    setIsNotifOpen(o => !o);
    // Request browser notification permission on first open
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const handleLogout = async () => {
    try { await logout(); navigate('/'); }
    catch (err) { console.error('Logout error:', err); }
  };

  const rb = {
    admin:    { label: 'Admin',    color: 'var(--accent)', bg: 'var(--accent-glow)' },
    it_staff: { label: 'IT Staff', color: 'var(--green)',  bg: 'var(--green-bg)'   },
    employee: { label: 'Employee', color: 'var(--amber)',  bg: 'var(--amber-bg)'   },
  }[user?.role] || { label: 'Employee', color: 'var(--amber)', bg: 'var(--amber-bg)' };

  /* ── Group logs by Today / Yesterday / Older ── */
  const grouped = React.useMemo(() => {
    const today     = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const groups    = { Today: [], Yesterday: [], Older: [] };
    logs.forEach(l => {
      const d = new Date(l.created_at); d.setHours(0,0,0,0);
      if      (d >= today)     groups.Today.push(l);
      else if (d >= yesterday) groups.Yesterday.push(l);
      else                     groups.Older.push(l);
    });
    return groups;
  }, [logs]);

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-right">

        {/* Role badge */}
        <div style={{ padding:'4px 10px', borderRadius:20, background:rb.bg, fontSize:12, fontWeight:600, color:rb.color }}>
          {rb.label}
        </div>

        {/* Date */}
        <div className="topbar-date">
          {now.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
        </div>

        {/* ── Notifications ── */}
        <div className="notif-wrapper" ref={notifRef}>
          <button
            type="button"
            className={`btn btn-icon topbar-notif ${isNotifOpen ? 'notif-open' : ''}`}
            onClick={handleOpen}
            aria-label={`Notifications, ${unreadCount} unread`}
          >
            <Bell size={15}/>
            {unreadCount > 0 && (
              <span className="notif-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="notif-menu">
              {/* Header */}
              <div className="notif-menu-header">
                <div className="notif-menu-title">
                  <Bell size={13}/>
                  Notifications
                  {unreadCount > 0 && <span className="notif-count-pill">{unreadCount} new</span>}
                </div>
                <div className="notif-header-actions">
                  <button className="btn-text" onClick={fetchLogs} title="Refresh">
                    <RefreshCw size={11}/>
                  </button>
                  {unreadCount > 0 && (
                    <button className="btn-text" onClick={markAllRead}>Mark all read</button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="notif-scroll">
                {loading && logs.length === 0 ? (
                  <div className="notif-loading">
                    {[1,2,3].map(i => <div key={i} className="notif-skeleton" style={{ animationDelay:`${i*80}ms` }}/>)}
                  </div>
                ) : logs.length === 0 ? (
                  <div className="notif-empty">
                    <Bell size={28} style={{ opacity:0.2, marginBottom:8 }}/>
                    <p>No activity yet</p>
                    <span>Events will appear here as you use the system</span>
                  </div>
                ) : (
                  Object.entries(grouped).map(([group, items]) => {
                    if (!items.length) return null;
                    return (
                      <div key={group}>
                        <div className="notif-group-label">{group}</div>
                        {items.map(log => {
                          const meta    = getMeta(log.action);
                          const Icon    = meta.icon;
                          const isRead  = readIds.has(log.id);
                          return (
                            <div
                              key={log.id}
                              className={`notif-item-new ${isRead ? 'notif-item-new--read' : ''}`}
                              onClick={() => markRead(log.id)}
                            >
                              {/* Icon dot */}
                              <div className="notif-icon" style={{ background:`${meta.color}18`, color:meta.color }}>
                                <Icon size={13}/>
                              </div>

                              {/* Content */}
                              <div className="notif-content">
                                <div className="notif-content__top">
                                  <span className="notif-action-label" style={{ color:meta.color }}>
                                    {meta.label}
                                  </span>
                                  {log.asset_id && (
                                    <span className="notif-asset-id">{log.asset_id}</span>
                                  )}
                                </div>
                                <div className="notif-detail">{log.detail || '—'}</div>
                                <div className="notif-footer">
                                  <span className="notif-by">by {log.performed_by || 'System'}</span>
                                  <span className="notif-time">
                                    <Clock size={10}/> {relativeTime(log.created_at)}
                                  </span>
                                </div>
                              </div>

                              {/* Unread dot */}
                              {!isRead && <div className="notif-unread-dot"/>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {logs.length > 0 && (
                <div className="notif-menu-footer">
                  <button className="btn-text" onClick={() => { navigate('/audit'); setIsNotifOpen(false); }}>
                    View full audit log →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logout */}
        <button type="button" className="btn btn-icon topbar-logout" onClick={handleLogout} title="Logout">
          <LogOut size={15}/>
        </button>
      </div>
    </header>
  );
}