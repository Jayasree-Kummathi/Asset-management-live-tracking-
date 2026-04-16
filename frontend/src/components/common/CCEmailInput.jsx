import React, { useState } from 'react';
import { Plus, X, Mail } from 'lucide-react';

/**
 * Reusable CC email adder
 * Props: ccEmails (string[]), onChange (fn)
 */
export default function CCEmailInput({ ccEmails, onChange }) {
  const [input, setInput] = useState('');

  const addEmail = () => {
    const email = input.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (ccEmails.includes(email)) { setInput(''); return; }
    onChange([...ccEmails, email]);
    setInput('');
  };

  const removeEmail = (email) => onChange(ccEmails.filter(e => e !== email));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addEmail(); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Add CC email…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            type="email"
          />
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addEmail}>
          <Plus size={14} /> Add
        </button>
      </div>

      {/* sysadmin always shown */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 20,
          background: 'rgba(79,142,247,.08)', border: '1px solid rgba(79,142,247,.2)',
          fontSize: 12.5, color: 'var(--accent)',
        }}>
          <Mail size={11} />
          sysadmin@mindteck.us
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>(auto)</span>
        </div>

        {ccEmails.map(email => (
          <div key={email} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 20,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            fontSize: 12.5, color: 'var(--text-dim)',
          }}>
            <Mail size={11} color="var(--text-muted)" />
            {email}
            <button type="button" onClick={() => removeEmail(email)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
