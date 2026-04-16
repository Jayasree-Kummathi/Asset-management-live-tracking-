import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Topbar.css';

const titles = {
  '/dashboard':       'Dashboard',
  '/inventory':       'Asset Inventory',
  '/allocate':        'Allocate Laptop',
  '/allocation-list': 'Allocation List',
  '/receive':         'Receive Laptop',
  '/swap':            'Swap Laptop',
  '/repair':          'Repair Assets',
  '/scrap':           'Scrap Assets',
  '/reports':         'Reports',
  '/audit':           'Audit Logs',
  '/users':             'Manage Users',
  '/accessories':       'Accessory Requests',
  '/acceptance-tracker':'Acceptance Tracker',
  '/my-dashboard':    'My Dashboard',
  '/my-laptop':       'My Laptop',
  '/network-assets':  'Network Assets',
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const title = titles[location.pathname] || 'Asset Management';
  const [now, setNow] = React.useState(new Date());
  
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/'); // Redirect to homepage after logout
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const roleBadge = {
    admin:    { label: 'Admin',    color: 'var(--accent)',  bg: 'var(--accent-glow)' },
    it_staff: { label: 'IT Staff', color: 'var(--green)',   bg: 'var(--green-bg)' },
    employee: { label: 'Employee', color: 'var(--amber)',   bg: 'var(--amber-bg)' },
  };
  const rb = roleBadge[user?.role] || roleBadge.employee;

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-right">
        <div style={{ padding: '4px 10px', borderRadius: 20, background: rb.bg, fontSize: 12, fontWeight: 600, color: rb.color }}>
          {rb.label}
        </div>
        <div className="topbar-date">
          {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        <button className="btn btn-icon topbar-notif">
          <Bell size={15} />
          <span className="notif-dot" />
        </button>
        <button 
          className="btn btn-icon topbar-logout" 
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}