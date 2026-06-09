import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BG_IMAGE from '../assets/home.png';

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.lp-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
  background: #040e28;
  font-family: 'DM Sans', sans-serif;
}

.lp-bg {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: left center;
  z-index: 0;
}

.lp-overlay {
  position: fixed;
  inset: 0;
  background: linear-gradient(
    120deg,
    rgba(4, 14, 40, 0.52) 0%,
    rgba(8, 28, 72, 0.38) 55%,
    rgba(4, 14, 40, 0.48) 100%
  );
  z-index: 1;
}

.lp-card {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(40px) saturate(2);
  -webkit-backdrop-filter: blur(40px) saturate(2);
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  padding: 48px 40px 40px;
  box-shadow:
    0 48px 96px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

/* superadmin card gets a purple tint border */
.lp-card.is-superadmin {
  border-color: rgba(167, 139, 250, 0.45);
  box-shadow:
    0 48px 96px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(167, 139, 250, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.lp-badge {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(46, 204, 113, 0.14);
  border: 1px solid rgba(46, 204, 113, 0.32);
  border-radius: 20px;
  padding: 4px 11px;
  font-size: 10px;
  font-weight: 600;
  color: rgba(90, 230, 150, 0.95);
  letter-spacing: 0.6px;
}

/* superadmin badge — purple */
.lp-badge.is-superadmin {
  background: rgba(124, 58, 237, 0.18);
  border-color: rgba(167, 139, 250, 0.4);
  color: rgba(196, 181, 253, 0.95);
}

.lp-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2ecc71;
  animation: lp-blink 2s ease-in-out infinite;
}

.lp-pulse.is-superadmin {
  background: #a78bfa;
}

@keyframes lp-blink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.3; transform: scale(0.85); }
}

.lp-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 26px;
}

.lp-brand-icon {
  width: 42px;
  height: 42px;
  background: linear-gradient(145deg, #1e8a58, #0c4f30);
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(14, 100, 55, 0.55);
  flex-shrink: 0;
}

/* superadmin icon — purple gradient */
.lp-brand-icon.is-superadmin {
  background: linear-gradient(145deg, #7c3aed, #4c1d95);
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.55);
}

.lp-brand-name {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.025em;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
}

.lp-heading {
  font-family: 'Fraunces', serif;
  font-size: 31px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin-bottom: 4px;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}

.lp-sub {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.62);
  text-align: center;
  margin-bottom: 26px;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
}

/* superadmin role banner shown below subtitle */
.lp-role-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: -16px 0 20px;
  padding: 8px 16px;
  background: rgba(124, 58, 237, 0.12);
  border: 1px solid rgba(167, 139, 250, 0.25);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(196, 181, 253, 0.95);
  letter-spacing: 0.4px;
}

.lp-role-banner-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a78bfa;
  flex-shrink: 0;
  animation: lp-blink 2s ease-in-out infinite;
}

.lp-field { margin-bottom: 13px; }

.lp-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: rgba(19, 1, 1, 0.86);
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-bottom: 6px;
}

.lp-input-wrap { position: relative; }

.lp-input {
  width: 100%;
  padding: 13px 16px;
  background: rgba(255, 255, 255, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 13px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: #fff;
  outline: none;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}

.lp-input::placeholder { color: rgba(255, 255, 255, 0.35); }

.lp-input:focus {
  border-color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.16);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08);
}

/* superadmin input focus — purple glow */
.is-superadmin .lp-input:focus {
  border-color: rgba(167, 139, 250, 0.6);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
}

.lp-eye {
  position: absolute;
  right: 13px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.45);
  padding: 0;
  line-height: 0;
  transition: color 0.2s;
}
.lp-eye:hover { color: #fff; }

.lp-forgot {
  display: block;
  text-align: right;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.50);
  cursor: pointer;
  margin-top: 5px;
  margin-bottom: 20px;
  transition: color 0.2s;
  background: none;
  border: none;
  font-family: 'DM Sans', sans-serif;
  width: 100%;
}
.lp-forgot:hover { color: #fff; }

.lp-error {
  background: rgba(220, 60, 60, 0.15);
  border: 1px solid rgba(220, 60, 60, 0.32);
  color: #ff8585;
  padding: 10px 14px;
  border-radius: 11px;
  font-size: 13px;
  margin-bottom: 12px;
  text-align: center;
}

.lp-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #1e9460, #0d5c3a);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.015em;
  box-shadow: 0 8px 26px rgba(12, 80, 50, 0.6);
  position: relative;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 22px;
}

/* superadmin button — purple */
.lp-btn.is-superadmin {
  background: linear-gradient(135deg, #7c3aed, #4c1d95);
  box-shadow: 0 8px 26px rgba(124, 58, 237, 0.55);
}

.lp-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.18), transparent);
  pointer-events: none;
}

.lp-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 14px 34px rgba(12, 80, 50, 0.70);
}
.lp-btn.is-superadmin:hover:not(:disabled) {
  box-shadow: 0 14px 34px rgba(124, 58, 237, 0.70);
}
.lp-btn:active:not(:disabled) { transform: translateY(0); }
.lp-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.lp-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.30);
  border-top-color: #fff;
  border-radius: 50%;
  animation: lp-spin 0.7s linear infinite;
  margin: 0 auto;
}
@keyframes lp-spin { to { transform: rotate(360deg); } }

.lp-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.lp-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.15); }
.lp-divider-text { font-size: 11px; color: rgba(255,255,255,0.35); white-space: nowrap; }

@media (max-width: 480px) {
  .lp-card    { padding: 38px 24px 32px; }
  .lp-heading { font-size: 26px; }
}
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form,     setForm]     = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // ── Detect superadmin email as user types ─────────────────────────────────
  const isSuperAdmin = form.email.toLowerCase().includes('superadmin');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const success = await login(form.email, form.password);
      if (success) {
        const raw  = localStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : null;
        // superadmin and admin/it_staff all go to /dashboard
        navigate(user?.role === 'employee' ? '/my-dashboard' : '/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>

      <div className="lp-root">

        {/* Background image */}
        <img className="lp-bg" src={BG_IMAGE} alt="" aria-hidden="true" />

        {/* Overlay */}
        <div className="lp-overlay" />

        {/* Card — purple tint when superadmin email detected */}
        <div className={`lp-card ${isSuperAdmin ? 'is-superadmin' : ''}`}>

          {/* Badge — changes colour for superadmin */}
          <div className={`lp-badge ${isSuperAdmin ? 'is-superadmin' : ''}`}>
            <div className={`lp-pulse ${isSuperAdmin ? 'is-superadmin' : ''}`} />
            {isSuperAdmin ? 'SUPER ADMIN' : 'SECURED'}
          </div>

          {/* Brand icon — purple for superadmin */}
          <div className="lp-brand">
            <div className={`lp-brand-icon ${isSuperAdmin ? 'is-superadmin' : ''}`}>
              {isSuperAdmin ? (
                /* Crown / globe icon for superadmin */
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="1.8" opacity="0.7"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="#fff" strokeWidth="1.8" opacity="0.9"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                  <rect x="2"  y="2"  width="7" height="7" rx="1.5" fill="#fff" />
                  <rect x="11" y="2"  width="7" height="7" rx="1.5" fill="#fff" opacity=".75" />
                  <rect x="2"  y="11" width="7" height="7" rx="1.5" fill="#fff" opacity=".75" />
                  <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#fff" opacity=".5"  />
                </svg>
              )}
            </div>
            <span className="lp-brand-name">AssetOps</span>
          </div>

          <h1 className="lp-heading">
            {isSuperAdmin ? 'Super Admin' : 'Sign in'}
          </h1>
          <p className="lp-sub">Mindteck Asset Management</p>

          {/* Role banner — only visible for superadmin */}
          {isSuperAdmin && (
            <div className="lp-role-banner">
              <div className="lp-role-banner-dot" />
              🌐 Global Access — All 18 Countries
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div className="lp-field">
              <label className="lp-label">Email Address</label>
              <div className="lp-input-wrap">
                <input
                  className="lp-input"
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  required
                  autoComplete="email"
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            {/* Password */}
            <div className="lp-field">
              <label className="lp-label">Password</label>
              <div className="lp-input-wrap">
                <input
                  className="lp-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  required
                  style={{ paddingRight: 42 }}
                  autoComplete="current-password"
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  className="lp-eye"
                  onClick={() => setShowPass(s => !s)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="button" className="lp-forgot">Forgot password?</button>

            {error && <div className="lp-error">{error}</div>}

            <button
              type="submit"
              className={`lp-btn ${isSuperAdmin ? 'is-superadmin' : ''}`}
              disabled={loading}
            >
              {loading
                ? <div className="lp-spinner" />
                : isSuperAdmin
                  ? '🌐 Sign In as Super Admin →'
                  : 'Sign In →'
              }
            </button>

          </form>

          <div className="lp-divider">
            <div className="lp-divider-line" />
            <span className="lp-divider-text">Mindteck IT · AssetOps v2.0</span>
            <div className="lp-divider-line" />
          </div>

        </div>
      </div>
    </>
  );
}