import React from 'react';
import {
  MapPin, Cpu, UploadCloud,
  LayoutDashboard, Package, Send, List, Download,
  RefreshCw, Wrench, Trash2, BarChart3, ClipboardList,
  LogOut, ChevronRight, Users, Laptop, ShoppingCart, CheckSquare,
  Network
} from 'lucide-react';

import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const adminNav = [
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Inventory',         icon: Package,         path: '/inventory' },
  { label: 'Allocate Laptop',   icon: Send,            path: '/allocate' },
  { label: 'Allocation List',   icon: List,            path: '/allocation-list' },
  { label: 'Receive Laptop',    icon: Download,        path: '/receive' },
  { label: 'Swap Laptop',       icon: RefreshCw,       path: '/swap' },
  { label: 'Accessory Requests',icon: ShoppingCart,    path: '/accessories' },
  { label: 'Acceptance Tracker',icon: CheckSquare,     path: '/acceptance-tracker' },
  { label: 'Network Assets',    icon: Network,         path: '/network-assets' },
  { label: 'Repair Assets',     icon: Wrench,          path: '/repair' },
  { label: 'Scrap Assets',      icon: Trash2,          path: '/scrap' },
  { label: 'Reports',           icon: BarChart3,       path: '/reports' },
  { label: 'Audit Logs',        icon: ClipboardList,   path: '/audit' },
  { label: 'Live Tracking',     icon: MapPin,          path: '/live-tracking' },
  { label: 'Manage Users',      icon: Users,           path: '/users' },

  // ✅ NEW ITEMS
  { label: 'Agent Manager',     icon: Cpu,             path: '/agent-manager' },
  { label: 'Software Push',     icon: UploadCloud,     path: '/softwarepush' },
];

const itStaffNav = [
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Inventory',         icon: Package,         path: '/inventory' },
  { label: 'Allocate Laptop',   icon: Send,            path: '/allocate' },
  { label: 'Allocation List',   icon: List,            path: '/allocation-list' },
  { label: 'Receive Laptop',    icon: Download,        path: '/receive' },
  { label: 'Swap Laptop',       icon: RefreshCw,       path: '/swap' },
  { label: 'Accessory Requests',icon: ShoppingCart,    path: '/accessories' },
  { label: 'Acceptance Tracker',icon: CheckSquare,     path: '/acceptance-tracker' },
  { label: 'Network Assets',    icon: Network,         path: '/network-assets' },
];

const employeeNav = [
  { label: 'My Dashboard',   icon: LayoutDashboard, path: '/my-dashboard' },
  { label: 'My Laptop',      icon: Laptop,          path: '/my-laptop' },
];

const roleLabels = {
  admin:    'Administrator',
  it_staff: 'IT Staff',
  employee: 'Employee',
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const role    = user?.role || 'employee';
  const navItems = role === 'admin' ? adminNav : role === 'it_staff' ? itStaffNav : employeeNav;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/'); // Redirect to homepage after logout
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo"><Cpu size={18} /></div>
        <div>
          <div className="sidebar-brand-name">Mindteck AssetOps</div>
          <div className="sidebar-brand-sub">Management System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">Navigation</div>
        {navItems.map(item => {
          const Icon   = item.icon;
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`sidebar-item ${active ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {active && <ChevronRight size={14} className="sidebar-item-arrow" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div>
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">{roleLabels[role] || role}</div>
          </div>
        </div>
        <button 
          className="btn btn-icon" 
          onClick={handleLogout} 
          title="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}