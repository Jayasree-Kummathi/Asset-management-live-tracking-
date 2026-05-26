import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';

import Sidebar        from './components/layout/Sidebar';
import Topbar         from './components/layout/Topbar';
import ToastContainer from './components/common/Toast';
import AIChatbot from './components/common/AIChatbot';

import Login             from './pages/Login';
import Homepage          from './pages/Homepage';
import Dashboard         from './pages/Dashboard';
import Inventory         from './pages/Inventory';
import AllocateLaptop    from './pages/AllocateLaptop';
import AllocationList    from './pages/AllocationList';
import ReceiveLaptop     from './pages/ReceiveLaptop';
import SwapLaptop        from './pages/SwapLaptop';
import RepairAssets      from './pages/RepairAssets';
import ScrapAssets       from './pages/ScrapAssets';
import Reports           from './pages/Reports';
import AuditLogs         from './pages/AuditLogs';
import ManageUsers       from './pages/ManageUsers';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AcceptancePage    from './pages/AcceptancePage';
import AcceptanceTracker from './pages/AcceptanceTracker';
import AccessoryRequests from './pages/AccessoryRequests';
import NetworkAssets     from './pages/Networkassets';
import LiveTracking      from './pages/LiveTracking';
import AgentManager      from './pages/AgentManager';
import SoftwarePush      from './pages/Softwarepush';
import AccessControl     from './pages/Accesscontrol';
import LicenseManagement from './pages/Licensemanagement';
import Employees         from './pages/Employees';
import './styles/global.css';

// ── Role guard ────────────────────────────────────────────────────────────────
function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// ── Layout for logged-in users ────────────────────────────────────────────────
function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0d0f14',
      color: '#4f8ef7', fontFamily: 'monospace', fontSize: 14,
    }}>
      Loading…
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  const isEmployee = user.role === 'employee';

  return (
    <AppProvider>
      <div className="app-layout">
        <Sidebar />
        <div className="main-area">
          <Topbar />
          <div className="page-content">
            <Routes>
              {/* ── Employee-only ───────────────────────────────────────── */}
              <Route path="/my-dashboard" element={<EmployeeDashboard />} />
              <Route path="/my-laptop"    element={<EmployeeDashboard />} />

              {/* ── Admin + IT Staff ────────────────────────────────────── */}
              <Route path="/dashboard" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <Dashboard />
                </RequireRole>
              } />
              <Route path="/inventory" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <Inventory />
                </RequireRole>
              } />
              <Route path="/allocate" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <AllocateLaptop />
                </RequireRole>
              } />
              <Route path="/allocation-list" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <AllocationList />
                </RequireRole>
              } />
              <Route path="/receive" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <ReceiveLaptop />
                </RequireRole>
              } />
              <Route path="/swap" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <SwapLaptop />
                </RequireRole>
              } />
              <Route path="/accessories" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <AccessoryRequests />
                </RequireRole>
              } />
              <Route path="/acceptance-tracker" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <AcceptanceTracker />
                </RequireRole>
              } />
              <Route path="/network-assets" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <NetworkAssets />
                </RequireRole>
              } />
              <Route path="/live-tracking" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <LiveTracking />
                </RequireRole>
              } />

              {/* ── Employees — Admin + IT Staff ────────────────────────── */}
              <Route path="/employees" element={
                <RequireRole roles={['admin', 'it_staff']}>
                  <Employees />
                </RequireRole>
              } />

              {/* ── Admin only ──────────────────────────────────────────── */}
              <Route path="/repair" element={
                <RequireRole roles={['admin']}>
                  <RepairAssets />
                </RequireRole>
              } />
              <Route path="/scrap" element={
                <RequireRole roles={['admin']}>
                  <ScrapAssets />
                </RequireRole>
              } />
              <Route path="/reports" element={
                <RequireRole roles={['admin']}>
                  <Reports />
                </RequireRole>
              } />
              <Route path="/audit" element={
                <RequireRole roles={['admin']}>
                  <AuditLogs />
                </RequireRole>
              } />
              <Route path="/users" element={
                <RequireRole roles={['admin']}>
                  <ManageUsers />
                </RequireRole>
              } />
              <Route path="/agent-manager" element={
                <RequireRole roles={['admin']}>
                  <AgentManager />
                </RequireRole>
              } />
              <Route path="/softwarepush" element={
                <RequireRole roles={['admin']}>
                  <SoftwarePush />
                </RequireRole>
              } />
              <Route path="/licenses" element={
                <RequireRole roles={['admin']}>
                  <LicenseManagement />
                </RequireRole>
              } />
              <Route path="/access-control" element={
                <RequireRole roles={['admin']}>
                  <AccessControl />
                </RequireRole>
              } />

              {/* ── Default redirect ────────────────────────────────────── */}
              <Route path="*" element={
                <Navigate to={isEmployee ? '/my-dashboard' : '/dashboard'} replace />
              } />
            </Routes>
          </div>
        </div>
        <ToastContainer />
      </div>
      {/* AI Chatbot - appears on all pages when user is logged in */}
      <AIChatbot />
    </AppProvider>
  );
}

// ── Login wrapper ─────────────────────────────────────────────────────────────
function LoginWrapper() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (user.role === 'employee') return <Navigate to="/my-dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <Login />;
}

// ── Root app ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/"              element={<Homepage />} />
            <Route path="/login"         element={<LoginWrapper />} />
            <Route path="/accept/:token" element={<AcceptancePage />} />
            <Route path="/*"             element={<ProtectedLayout />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}