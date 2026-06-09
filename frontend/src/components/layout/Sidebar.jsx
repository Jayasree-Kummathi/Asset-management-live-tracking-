import React from 'react';
import {
  MapPin, Cpu, UploadCloud,
  LayoutDashboard, Package, Send, List, Download,
  RefreshCw, Wrench, Trash2, BarChart3, ClipboardList,
  LogOut, ChevronRight, Users, Laptop, ShoppingCart, CheckSquare,
  Network, Shield, Key, Globe, UserCheck, Mail,
} from 'lucide-react';

import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

// ── Nav item pools ────────────────────────────────────────────────────────────

// Shared: admin + it_staff + superadmin
const opsNav = [
  { label: 'Dashboard',          icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Inventory',          icon: Package,         path: '/inventory' },
  { label: 'Allocate Laptop',    icon: Send,            path: '/allocate' },
  { label: 'Allocation List',    icon: List,            path: '/allocation-list' },
  { label: 'Receive Laptop',     icon: Download,        path: '/receive' },
  { label: 'Swap Laptop',        icon: RefreshCw,       path: '/swap' },
  { label: 'Accessory Requests', icon: ShoppingCart,    path: '/accessories' },
  { label: 'Acceptance Tracker', icon: CheckSquare,     path: '/acceptance-tracker' },
  { label: 'Network Assets',     icon: Network,         path: '/network-assets' },
  { label: 'Employees',          icon: UserCheck,       path: '/employees' },
];

// Shared: admin + superadmin
const mgmtNav = [
  { label: 'Repair Assets',  icon: Wrench,        path: '/repair' },
  { label: 'Scrap Assets',   icon: Trash2,        path: '/scrap' },
  { label: 'Reports',        icon: BarChart3,     path: '/reports' },
  { label: 'Audit Logs',     icon: ClipboardList, path: '/audit' },
  { label: 'Manage Users',   icon: Users,         path: '/users' },
  { label: 'Licenses',       icon: Key,           path: '/licenses' },
  { label: 'SMTP Settings',  icon: Mail,          path: '/settings/smtp' },
];

// SuperAdmin ONLY
const superOnlyNav = [
  { label: 'Live Tracking',  icon: MapPin,      path: '/live-tracking' },
  { label: 'Agent Manager',  icon: Cpu,         path: '/agent-manager' },
  { label: 'Software Push',  icon: UploadCloud, path: '/softwarepush' },
  { label: 'Access Control', icon: Shield,      path: '/access-control' },
];

// IT Staff flat list
const itStaffNav = [
  { label: 'Dashboard',          icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Inventory',          icon: Package,         path: '/inventory' },
  { label: 'Allocate Laptop',    icon: Send,            path: '/allocate' },
  { label: 'Allocation List',    icon: List,            path: '/allocation-list' },
  { label: 'Receive Laptop',     icon: Download,        path: '/receive' },
  { label: 'Swap Laptop',        icon: RefreshCw,       path: '/swap' },
  { label: 'Accessory Requests', icon: ShoppingCart,    path: '/accessories' },
  { label: 'Acceptance Tracker', icon: CheckSquare,     path: '/acceptance-tracker' },
  { label: 'Network Assets',     icon: Network,         path: '/network-assets' },
  { label: 'Employees',          icon: UserCheck,       path: '/employees' },
];

// Employee flat list
const employeeNav = [
  { label: 'My Dashboard', icon: LayoutDashboard, path: '/my-dashboard' },
  { label: 'My Laptop',    icon: Laptop,          path: '/my-laptop' },
];

// ── Role config ───────────────────────────────────────────────────────────────
const roleConfig = {
  superadmin: { label: 'Super Admin',   color: '#a78bfa', bg: 'rgba(124,58,237,0.15)', border: 'rgba(167,139,250,0.3)' },
  admin:      { label: 'Administrator', color: 'var(--accent)', bg: 'var(--accent-glow)', border: 'rgba(99,102,241,0.2)' },
  it_staff:   { label: 'IT Staff',      color: 'var(--green)',  bg: 'var(--green-bg)',   border: 'rgba(52,211,153,0.2)' },
  employee:   { label: 'Employee',      color: 'var(--text-muted)', bg: 'var(--surface2)', border: 'var(--border)' },
};

// ── NavGroup ──────────────────────────────────────────────────────────────────
function NavGroup({ label, items, location, navigate, isSuperAdmin }) {
  return (
    <>
      <div className="sidebar-nav-label" style={{ marginTop: 10 }}>{label}</div>
      {items.map(item => {
        const Icon   = item.icon;
        const active = location.pathname === item.path;
        return (
          <button
            key={item.path}
            className={`sidebar-item ${active ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            style={active && isSuperAdmin ? {
              background: 'rgba(124,58,237,0.18)',
              borderColor: 'rgba(167,139,250,0.35)',
              color: '#c4b5fd',
            } : {}}
          >
            <Icon size={16} />
            <span>{item.label}</span>
            {active && <ChevronRight size={14} className="sidebar-item-arrow" />}
          </button>
        );
      })}
    </>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const role         = user?.role || 'employee';
  const rc           = roleConfig[role] || roleConfig.employee;
  const isSuperAdmin = role === 'superadmin';
  const isAdmin      = role === 'admin';
  const isItStaff    = role === 'it_staff';

  const handleLogout = async () => {
    try { await logout(); navigate('/'); }
    catch (e) { console.error('Logout error:', e); }
  };

  const renderNav = () => {
    if (role === 'employee') {
      return <NavGroup label="Navigation" items={employeeNav} location={location} navigate={navigate} isSuperAdmin={false} />;
    }
    if (isItStaff) {
      return <NavGroup label="Navigation" items={itStaffNav} location={location} navigate={navigate} isSuperAdmin={false} />;
    }
    if (isAdmin) {
      return (
        <>
          <NavGroup label="Operations" items={opsNav}  location={location} navigate={navigate} isSuperAdmin={false} />
          <NavGroup label="Management" items={mgmtNav} location={location} navigate={navigate} isSuperAdmin={false} />
        </>
      );
    }
    // superadmin
    return (
      <>
        <NavGroup label="Operations" items={opsNav}        location={location} navigate={navigate} isSuperAdmin />
        <NavGroup label="Management" items={mgmtNav}       location={location} navigate={navigate} isSuperAdmin />
        <NavGroup label="System"     items={superOnlyNav}  location={location} navigate={navigate} isSuperAdmin />
      </>
    );
  };

  return (
    <aside className="sidebar">

      {/* ── Brand ── */}
      <div className="sidebar-brand">
        <div className="sidebar-logo" style={isSuperAdmin ? {
          background: 'linear-gradient(145deg,#7c3aed,#4c1d95)',
          boxShadow: '0 4px 14px rgba(124,58,237,0.5)',
        } : {}}>
          {isSuperAdmin ? <Globe size={18} /> : <Cpu size={16} />}
        </div>
        <div>
          <div className="sidebar-brand-name">Mindteck AssetOps</div>
          <div className="sidebar-brand-sub">
            {isSuperAdmin ? '🌐 Global Management' : 'Management System'}
          </div>
        </div>
      </div>

      {/* ── Role banner ── */}
      {isSuperAdmin && (
        <div style={{
          margin: '0 12px 8px', padding: '8px 12px',
          background: 'rgba(124,58,237,0.12)',
          border: '1px solid rgba(167,139,250,0.25)',
          borderRadius: 10, display: 'flex', alignItems: 'center',
          gap: 7, fontSize: 11, color: '#c4b5fd', fontWeight: 600,
        }}>
          <Globe size={12} style={{ flexShrink: 0 }} />
          All Countries · Full Access
        </div>
      )}
      {isAdmin && (
        <div style={{
          margin: '0 12px 8px', padding: '8px 12px',
          background: 'rgba(79,142,247,0.10)',
          border: '1px solid rgba(79,142,247,0.25)',
          borderRadius: 10, display: 'flex', alignItems: 'center',
          gap: 7, fontSize: 11, color: 'var(--accent)', fontWeight: 600,
        }}>
          <Shield size={12} style={{ flexShrink: 0 }} />
          Administrator · Full Management
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="sidebar-nav">
        {renderNav()}
      </nav>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{
            background: isSuperAdmin ? 'linear-gradient(135deg,#7c3aed,#4c1d95)' : undefined,
            boxShadow:  isSuperAdmin ? '0 0 0 2px rgba(167,139,250,0.4)' : undefined,
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sidebar-user-name">{user?.name}</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 2, padding: '1px 7px', borderRadius: 20,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
            }}>
              {isSuperAdmin && <Globe size={9} />}
              {rc.label}
            </div>
            {!isSuperAdmin && user?.location && (
              <div style={{
                marginTop: 3, fontSize: 10, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <MapPin size={9} />{user.location}
              </div>
            )}
          </div>
        </div>
        <button className="btn btn-icon" onClick={handleLogout} title="Logout">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}