import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Homepage.css';
import logoSrc from '../assets/mindteck_logo.png';

// ── API base ──────────────────────────────────────────────────────────────────
const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Fetch team members from backend (public — no auth needed) ─────────────────
const fetchTeamMembers = async () => {
  try {
    const res  = await fetch(`${API}/team-members`);
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
};

// ── Static data ───────────────────────────────────────────────────────────────
const FEATURES = [
  { icon:'📦', cls:'fi-gr', accent:'hp-fc1', title:'Asset Inventory',   desc:'Full register with serial numbers, specs, warranty dates. Laptops, Desktops, Servers, Switches, Routers, Printers, Firewalls — all in one place.' },
  { icon:'📤', cls:'fi-bl', accent:'hp-fc2', title:'Laptop Allocation',  desc:'Assign with department, project, client context. Upload employee photo. Hand delivery or courier with address. Auto-send signed agreement DOCX.' },
  { icon:'🔄', cls:'fi-am', accent:'hp-fc3', title:'4-Step Swap Wizard', desc:'Replace faulty devices end-to-end. Search employee, review old laptop, pick replacement, document issue — all in one guided flow.' },
  { icon:'✅', cls:'fi-pu', accent:'hp-fc4', title:'Acceptance Portal',   desc:'Employee clicks email link, confirms receipt or reports damage with photos. IT sees all responses in the Acceptance Tracker.' },
  { icon:'🖥️', cls:'fi-cy', accent:'hp-fc5', title:'Network Assets',     desc:'HP Switches, Rack Servers, WiFi Routers, Printers, Firewalls. Import directly from your Excel sheets with auto-mapped columns.' },
  { icon:'📊', cls:'fi-re', accent:'hp-fc6', title:'Reports & Audit',    desc:'CSV exports, warranty expiry alerts, brand breakdowns, utilization rates, and a complete immutable audit trail of every action.' },
];

const PIPELINE = [
  { icon:'💻', cls:'p-stock',  label:'Add to\nInventory' },
  { icon:'📤', cls:'p-alloc',  label:'Allocate to\nEmployee' },
  { icon:'🔄', cls:'p-track',  label:'Track &\nSwap' },
  { icon:'🔧', cls:'p-repair', label:'Repair\nQueue' },
  { icon:'✅', cls:'p-accept', label:'Acceptance\nTracker' },
  { icon:'🗑️', cls:'p-scrap',  label:'Scrap &\nDispose' },
];

const TECH = [
  { label:'React 18',        color:'#61dafb' },
  { label:'Node.js',         color:'#68a063' },
  { label:'PostgreSQL',      color:'#4169e1' },
  { label:'Express.js',      color:'#68b58c' },
  { label:'JWT Auth',        color:'#e97627' },
  { label:'Nodemailer',      color:'#2ecc71' },
  { label:'React Router v6', color:'#f43f5e' },
  { label:'Recharts',        color:'#8b5cf6' },
  { label:'XLSX Import',     color:'#22c55e' },
  { label:'Bcryptjs',        color:'#94a3b8' },
];

const TICKER_ITEMS = [
  { dot:'#2ecc71', text:'LTB-280 allocated to Pravieen MK' },
  { dot:'#3b82f6', text:'LTB-273 returned — Good condition' },
  { dot:'#f59e0b', text:'Monitor allocated to Anusha IBE2754' },
  { dot:'#a78bfa', text:'Acceptance confirmed — LTB-272 Jacob Thomas' },
  { dot:'#06b6d4', text:'HP Switch SW/001 — Lifetime warranty' },
  { dot:'#ef4444', text:'PowerEdge R760xs warranty ends Mar 2030' },
  { dot:'#2ecc71', text:'Laptop Agreement signed — Dixita Dhiman' },
  { dot:'#f59e0b', text:'Webcam allocated to Software team' },
];

const FLOAT_ICONS = [
  { icon:'💻', style:{ top:'13%', left:'7%',   animationDuration:'6s',   animationDelay:'0s'   } },
  { icon:'🖥️', style:{ top:'18%', right:'9%',  animationDuration:'7s',   animationDelay:'1s'   } },
  { icon:'🖨️', style:{ top:'60%', left:'5%',   animationDuration:'5.2s', animationDelay:'2s'   } },
  { icon:'🔌', style:{ top:'62%', right:'6%',  animationDuration:'8s',   animationDelay:'.5s'  } },
  { icon:'📡', style:{ top:'35%', left:'14%',  animationDuration:'6.5s', animationDelay:'1.5s' } },
  { icon:'🛡️', style:{ top:'38%', right:'14%', animationDuration:'7.5s', animationDelay:'3s'   } },
  { icon:'⚙️', style:{ top:'78%', left:'18%',  animationDuration:'5.5s', animationDelay:'2.5s' } },
  { icon:'📊', style:{ top:'73%', right:'20%', animationDuration:'6.2s', animationDelay:'.8s'  } },
];

const ROLE_COLOR = {
  admin:    '#4f8ef7',
  it_staff: '#2ecc71',
  employee: '#94a3b8',
};

// ── Mindteck Logo ─────────────────────────────────────────────────────────────
function MindteckLogo({ height = 36, style = {} }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: '#ffffff', borderRadius: 8, padding: '4px 10px',
      height: height + 8, boxShadow: '0 1px 8px rgba(0,0,0,0.25)', flexShrink: 0, ...style,
    }}>
      <img src={logoSrc} alt="Mindteck" style={{ height, display: 'block', objectFit: 'contain' }} />
    </div>
  );
}

// ── Team card ─────────────────────────────────────────────────────────────────
function TeamCard({ member }) {
  const ringColor = ROLE_COLOR[member.role] || '#2ecc71';
  const initials  = member.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className="hp-team-card hp-reveal">
      {member.online && <div className="hp-team-online" />}
      {member.photo ? (
        <img src={member.photo} alt={member.name} style={{
          width: 82, height: 82, borderRadius: '50%', objectFit: 'cover',
          margin: '0 auto 14px', display: 'block',
          border: `2px solid ${ringColor}55`,
          boxShadow: `0 0 0 4px ${ringColor}14, 0 4px 18px rgba(0,0,0,.35)`,
        }} />
      ) : (
        <div className="hp-team-avatar"
          style={{ background: `${ringColor}18`, color: ringColor, border: `2px solid ${ringColor}40` }}>
          {initials}
        </div>
      )}
      <div className="hp-team-name">{member.name}</div>
      {member.designation && (
        <div className="hp-team-role" style={{ color: ringColor, fontWeight: 600, fontSize: 12.5, marginTop: 3 }}>
          {member.designation}
        </div>
      )}
      <div className="hp-team-dept" style={{ marginTop: 4, opacity: 0.55, fontSize: 11.5 }}>
        {member.role === 'admin' ? 'Administrator' : member.role === 'it_staff' ? 'IT Staff' : 'Employee'}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Homepage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const canvasRef = useRef(null);
  const [team, setTeam] = useState([]);

  const goTo = (path) => navigate(user ? path : '/login');

  // ── Team sync from API ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const members = await fetchTeamMembers();
      members.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
      setTeam(members);
    };
    load();
    // Poll every 15 seconds so new staff appear without a full page reload
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  // ── Particle canvas ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize(); window.addEventListener('resize', resize);
    const pts = Array.from({ length: 45 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: Math.random() * 1.8 + .8,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(46,204,113,0.45)'; ctx.fill();
      });
      pts.forEach((a, i) => {
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 110) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(29,92,60,${0.35 * (1 - d / 110)})`; ctx.lineWidth = 0.7; ctx.stroke();
          }
        }
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  // ── Counters ────────────────────────────────────────────────────────────────
  useEffect(() => {
    [
      { id: 'hp-c1', target: 280, suffix: '' },
      { id: 'hp-c2', target: 16,  suffix: '' },
      { id: 'hp-c3', target: 47,  suffix: '' },
      { id: 'hp-c4', target: 100, suffix: '%' },
    ].forEach(({ id, target, suffix }) => {
      const el = document.getElementById(id); if (!el) return;
      let n = 0; const step = Math.ceil(target / 50);
      const t = setInterval(() => {
        n = Math.min(n + step, target); el.textContent = n + suffix;
        if (n >= target) clearInterval(t);
      }, 28);
    });
  }, []);

  // ── Scroll reveal ───────────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach((e, i) => {
        if (e.isIntersecting) setTimeout(() => e.target.classList.add('hp-visible'), i * 80);
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.hp-reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [team]);

  return (
    <div className="hp-root">

      {/* ── HEADER ── */}
      <header className="hp-header">
        <div className="hp-logo" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MindteckLogo height={30} />
          <span className="hp-logo-name" style={{ fontSize: 16, fontWeight: 700 }}>AssetOps</span>
        </div>
        <nav className="hp-nav">
          <a href="#features">Features</a>
          <a href="#team">Team</a>
          <a href="#workflow">Workflow</a>
          <button className="hp-nav-cta" onClick={() => goTo('/dashboard')}>Launch App →</button>
        </nav>
      </header>

      {/* ── HERO ── */}
      <section className="hp-hero">
        <canvas ref={canvasRef} id="hp-canvas" />
        <div className="hp-hero-glow" />
        {FLOAT_ICONS.map((f, i) => (
          <div key={i} className="hp-float-icon"
            style={{ ...f.style, animation: `hp-float ${f.style.animationDuration} ${f.style.animationDelay} ease-in-out infinite` }}>
            {f.icon}
          </div>
        ))}
        <div className="hp-badge"><span className="hp-badge-dot" />MINDTECK IT · ASSET MANAGEMENT SYSTEM</div>
        <h1 className="hp-h1">
          Track Every Asset.<br />
          <span className="hp-green">Own</span> Every <span className="hp-muted">Decision.</span>
        </h1>
        <p className="hp-hero-sub">
          One platform for your entire IT fleet — laptops, servers, switches, printers &amp; more.
          Allocate, track, swap and retire with complete audit trails and email notifications.
        </p>
        <div className="hp-hero-cta">
          <button className="hp-btn hp-btn-primary" onClick={() => goTo('/dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            Launch AssetOps
          </button>
          <a href="#features" className="hp-btn hp-btn-outline">Explore Features</a>
        </div>
        <div className="hp-stats">
          {[
            { id: 'hp-c1', label: 'Assets Tracked',  init: '0'  },
            { id: 'hp-c2', label: 'Allocations',      init: '0'  },
            { id: 'hp-c3', label: 'Network Devices',  init: '0'  },
            { id: 'hp-c4', label: 'Audit Coverage',   init: '0%' },
          ].map((s, i) => (
            <React.Fragment key={s.id}>
              {i > 0 && <div style={{ width: 1, height: 36, background: 'rgba(46,204,113,.1)' }} />}
              <div className="hp-stat">
                <div className="hp-stat-val" id={s.id}>{s.init}</div>
                <div className="hp-stat-label">{s.label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="hp-ticker-wrap">
        <div className="hp-ticker-inner">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <div key={i} className="hp-ticker-item">
              <span className="hp-ticker-dot" style={{ background: t.dot }} />{t.text}
            </div>
          ))}
        </div>
      </div>

      {/* ── PIPELINE ── */}
      <div className="hp-pipeline-wrap" id="workflow">
        <div className="hp-eyebrow hp-reveal">Asset Lifecycle</div>
        <div className="hp-section-title hp-reveal">From Procurement to Disposal</div>
        <div className="hp-section-sub hp-reveal">Every asset follows a fully tracked, audited journey</div>
        <div className="hp-pipeline hp-reveal">
          {PIPELINE.map((p, i) => (
            <React.Fragment key={i}>
              <div className="hp-pipe-step">
                <div className={`hp-pipe-icon ${p.cls}`}>{p.icon}</div>
                <div className="hp-pipe-label">
                  {p.label.split('\n').map((l, j) => <span key={j} style={{ display: 'block' }}>{l}</span>)}
                </div>
              </div>
              {i < PIPELINE.length - 1 && <div className="hp-pipe-arrow" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="hp-features" id="features">
        <div className="hp-eyebrow hp-reveal">Modules</div>
        <div className="hp-section-title hp-reveal">Everything IT Needs</div>
        <div className="hp-section-sub hp-reveal">Purpose-built workflows for every stage of the asset lifecycle</div>
        <div className="hp-features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className={`hp-feature-card ${f.accent} hp-reveal`}>
              <div className={`hp-feature-icon ${f.cls}`}>{f.icon}</div>
              <div className="hp-feature-title">{f.title}</div>
              <div className="hp-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TEAM ── */}
      <section className="hp-team" id="team">
        <div className="hp-eyebrow hp-reveal">Our Team</div>
        <div className="hp-section-title hp-reveal">Mindteck IT Department</div>
        <div className="hp-section-sub hp-reveal">The people managing your entire asset fleet every day</div>
        {team.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(148,163,184,.3)', fontSize: 14 }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>👥</div>
            Team members will appear here once added by an admin<br />
            in <strong style={{ color: 'rgba(46,204,113,.45)' }}>Manage Users</strong>.
          </div>
        ) : (
          <div className="hp-team-grid">
            {team.map(member => <TeamCard key={member.id} member={member} />)}
          </div>
        )}
      </section>

      {/* ── TECH ── */}
      <div className="hp-tech hp-reveal">
        <div className="hp-tech-label">Tech Stack</div>
        <div className="hp-tech-pills">
          {TECH.map(t => (
            <div key={t.label} className="hp-tech-pill">
              <span className="hp-tech-dot" style={{ background: t.color }} />{t.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <section className="hp-cta">
        <div className="hp-cta-bg" />
        <h2 className="hp-reveal">Ready to take control<br />of your asset fleet?</h2>
        <p className="hp-reveal">Set up in minutes. Seed the database, launch the API — your entire team is live.</p>
        <div className="hp-reveal">
          <button className="hp-btn hp-btn-primary"
            style={{ fontSize: 15, padding: '15px 36px', margin: '0 auto', display: 'inline-flex' }}
            onClick={() => goTo('/dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            Launch AssetOps
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="hp-footer">
        <div className="hp-footer-brand">
          <MindteckLogo height={20} style={{ borderRadius: 6, padding: '3px 8px' }} />
        </div>
        <span className="hp-footer-copy">© 2026 Mindteck IT · Asset Management System · v2.0</span>
        <div className="hp-footer-links">
          <button onClick={() => goTo('/dashboard')}>Dashboard</button>
          <button onClick={() => goTo('/inventory')}>Inventory</button>
          <button onClick={() => goTo('/reports')}>Reports</button>
          <button onClick={() => goTo('/network-assets')}>Network</button>
        </div>
      </footer>

    </div>
  );
}