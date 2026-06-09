import React, { useState, useEffect } from 'react';
import {
  Mail, Server, Lock, User, Send, CheckCircle,
  AlertTriangle, Loader, Eye, EyeOff, Save, RefreshCw,
  ArrowLeft, Settings, Shield, Zap,
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const PRESETS = {
  office365: {
    label: 'Office 365',
    host: 'smtp.office365.com',
    port: '587',
    secure: false,
  },
  gmail: {
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: '587',
    secure: false,
  },
  outlook: {
    label: 'Outlook',
    host: 'smtp-mail.outlook.com',
    port: '587',
    secure: false,
  },
  sendgrid: {
    label: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: '587',
    secure: false,
  },
  custom: {
    label: 'Custom',
    host: '',
    port: '587',
    secure: false,
  },
};

export default function SmtpSettings() {
  const [form, setForm] = useState({
    host: 'smtp.office365.com',
    port: '587',
    secure: false,
    user: '',
    pass: '',
    from: '',
    sysadmin: '',
  });
  const [preset,       setPreset]       = useState('office365');
  const [showPass,     setShowPass]     = useState(false);
  const [loadState,    setLoadState]    = useState('loading'); // loading | ready | error
  const [saveState,    setSaveState]    = useState('idle');    // idle | saving | saved | error
  const [testState,    setTestState]    = useState('idle');    // idle | sending | sent | error
  const [testEmail,    setTestEmail]    = useState('');
  const [testMsg,      setTestMsg]      = useState('');
  const [saveMsg,      setSaveMsg]      = useState('');
  const [showTest,     setShowTest]     = useState(false);

  // Load current SMTP config on mount
  useEffect(() => {
    apiFetch('/settings/smtp')
      .then(data => {
        setForm({
          host:      data.host      || 'smtp.office365.com',
          port:      String(data.port || '587'),
          secure:    data.secure    || false,
          user:      data.user      || '',
          pass:      data.pass      || '',
          from:      data.from      || '',
          sysadmin:  data.sysadmin  || '',
        });
        // detect preset
        const matched = Object.entries(PRESETS).find(([, v]) => v.host === (data.host || ''));
        setPreset(matched ? matched[0] : 'custom');
        setLoadState('ready');
      })
      .catch(() => setLoadState('ready')); // still show form even if load fails
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const applyPreset = (key) => {
    setPreset(key);
    if (key !== 'custom') {
      setForm(f => ({ ...f, host: PRESETS[key].host, port: String(PRESETS[key].port), secure: PRESETS[key].secure }));
    }
  };

  const handleSave = async () => {
    setSaveState('saving');
    setSaveMsg('');
    try {
      await apiFetch('/settings/smtp', {
        method: 'POST',
        body: JSON.stringify({
          host:     form.host,
          port:     Number(form.port),
          secure:   form.secure,
          user:     form.user,
          pass:     form.pass,
          from:     form.from,
          sysadmin: form.sysadmin,
        }),
      });
      setSaveState('saved');
      setSaveMsg('SMTP settings saved successfully.');
      setTimeout(() => setSaveState('idle'), 4000);
    } catch (e) {
      setSaveMsg(e.message);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 5000);
    }
  };

  const handleTest = async () => {
    if (!testEmail) return;
    setTestState('sending');
    setTestMsg('');
    try {
      await apiFetch('/settings/smtp/test', {
        method: 'POST',
        body: JSON.stringify({ to: testEmail }),
      });
      setTestState('sent');
      setTestMsg(`Test email sent to ${testEmail}`);
      setTimeout(() => setTestState('idle'), 6000);
    } catch (e) {
      setTestMsg(e.message);
      setTestState('error');
      setTimeout(() => setTestState('idle'), 5000);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
    fontFamily: 'inherit',
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, display: 'block',
  };

  if (loadState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 10, color: 'var(--text-muted)' }}>
        <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading SMTP settings…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: 720 }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(79,142,247,.12)', border: '1px solid rgba(79,142,247,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={18} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>SMTP Configuration</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 48 }}>
          Configure outgoing email settings for audit confirmations, allocation notices, and system alerts.
        </p>
      </div>

      {/* ── Provider presets ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          Email Provider
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: preset === key ? 'var(--accent)' : 'var(--surface2)',
                color: preset === key ? '#fff' : 'var(--text-muted)',
                border: preset === key ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Server settings ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          <Server size={13} /> Server Settings
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>SMTP Host</label>
            <input
              style={inputStyle}
              placeholder="smtp.office365.com"
              value={form.host}
              onChange={e => set('host', e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Port</label>
            <input
              style={inputStyle}
              placeholder="587"
              value={form.port}
              onChange={e => set('port', e.target.value)}
            />
          </div>
        </div>

        {/* Secure toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderRadius: 8,
          background: 'var(--surface2)', border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={15} color="var(--accent)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>SSL / TLS</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {form.secure ? 'Port 465 — direct SSL connection' : 'Port 587 — STARTTLS upgrade (recommended)'}
              </div>
            </div>
          </div>
          <button
            onClick={() => set('secure', !form.secure)}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: form.secure ? 'var(--accent)' : 'var(--border)',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: form.secure ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>

      {/* ── Authentication ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          <Lock size={13} /> Authentication
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email / Username</label>
          <div style={{ position: 'relative' }}>
            <User size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              style={{ ...inputStyle, paddingLeft: 34 }}
              placeholder="it-dept@mindteck.com"
              value={form.user}
              onChange={e => set('user', e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Password / App Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type={showPass ? 'text' : 'password'}
              style={{ ...inputStyle, paddingLeft: 34, paddingRight: 38 }}
              placeholder="••••••••••••••"
              value={form.pass}
              onChange={e => set('pass', e.target.value)}
            />
            <button
              onClick={() => setShowPass(v => !v)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2,
              }}
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>
            For Office 365 with MFA, use an App Password generated from your Microsoft account.
          </div>
        </div>
      </div>

      {/* ── From / Sysadmin ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          <Settings size={13} /> Sender & CC Settings
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>From Name & Address</label>
          <input
            style={inputStyle}
            placeholder={`AssetOps <it-dept@mindteck.com>`}
            value={form.from}
            onChange={e => set('from', e.target.value)}
          />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>
            Format: <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>Display Name {'<email@domain.com>'}</code>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Sysadmin CC Email <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <input
            style={inputStyle}
            placeholder="sysadmin@mindteck.com"
            value={form.sysadmin}
            onChange={e => set('sysadmin', e.target.value)}
          />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>
            If set, this address is CC'd on every allocation, receive, and swap email.
          </div>
        </div>
      </div>

      {/* ── Save result banner ── */}
      {saveState === 'saved' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', marginBottom: 14, borderRadius: 8,
          background: 'rgba(34,197,94,.10)', border: '1px solid rgba(34,197,94,.3)',
        }}>
          <CheckCircle size={15} color="#22c55e" />
          <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>{saveMsg}</span>
        </div>
      )}
      {saveState === 'error' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', marginBottom: 14, borderRadius: 8,
          background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.3)',
        }}>
          <AlertTriangle size={15} color="#ef4444" />
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>{saveMsg}</span>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saveState === 'saving'}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {saveState === 'saving'
            ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
            : <><Save size={14} /> Save Settings</>}
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => setShowTest(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Zap size={14} /> {showTest ? 'Hide Test' : 'Send Test Email'}
        </button>
      </div>

      {/* ── Test email panel ── */}
      {showTest && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Send Test Email
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Uses the settings currently saved on the server to send a test email.
            Save your settings first before running the test.
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Send test to</label>
              <div style={{ position: 'relative' }}>
                <Send size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 32 }}
                  placeholder="your@email.com"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleTest}
              disabled={testState === 'sending' || !testEmail}
              style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
            >
              {testState === 'sending'
                ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
                : <><Send size={13} /> Send Test</>}
            </button>
          </div>

          {testMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
              padding: '10px 14px', borderRadius: 8,
              background: testState === 'sent' ? 'rgba(34,197,94,.10)' : 'rgba(239,68,68,.10)',
              border: `1px solid ${testState === 'sent' ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
            }}>
              {testState === 'sent'
                ? <CheckCircle size={14} color="#22c55e" />
                : <AlertTriangle size={14} color="#ef4444" />}
              <span style={{ fontSize: 12.5, fontWeight: 600, color: testState === 'sent' ? '#22c55e' : '#ef4444' }}>
                {testMsg}
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 2px rgba(79,142,247,.15); }
      `}</style>
    </div>
  );
}