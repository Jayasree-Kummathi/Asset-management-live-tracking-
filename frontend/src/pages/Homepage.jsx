import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Homepage.css';
import logoSrc from '../assets/mindteck_logo.png';
// import LaptopHeroCanvas from './Laptopherocanvas';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const fetchTeamMembers = async () => {
  try {
    const res  = await fetch(`${API}/team-members`);
    const data = await res.json();
    return data.data || [];
  } catch { return []; }
};

const FEATURES = [
  { icon:'📦', cls:'fi-gr', accent:'hp-fc1', title:'Asset Inventory',   desc:'Full register with serial numbers, specs, warranty dates. Laptops, Desktops, Servers, Switches, Routers, Printers, Firewalls — all in one place.' },
  { icon:'📤', cls:'fi-bl', accent:'hp-fc2', title:'Laptop Allocation',  desc:'Assign with department, project, client context. Upload employee photo. Hand delivery or courier with address. Auto-send signed agreement DOCX.' },
  { icon:'🔄', cls:'fi-am', accent:'hp-fc3', title:'4-Step Swap Wizard', desc:'Replace faulty devices end-to-end. Search employee, review old laptop, pick replacement, document issue — all in one guided flow.' },
  { icon:'✅', cls:'fi-pu', accent:'hp-fc4', title:'Acceptance Portal',  desc:'Employee clicks email link, confirms receipt or reports damage with photos. IT sees all responses in the Acceptance Tracker.' },
  { icon:'🖥️', cls:'fi-cy', accent:'hp-fc5', title:'Network Assets',    desc:'HP Switches, Rack Servers, WiFi Routers, Printers, Firewalls. Import directly from your Excel sheets with auto-mapped columns.' },
  { icon:'📊', cls:'fi-re', accent:'hp-fc6', title:'Reports & Audit',   desc:'CSV exports, warranty expiry alerts, brand breakdowns, utilization rates, and a complete immutable audit trail of every action.' },
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

const ROLE_COLOR = {
  admin:    '#4f8ef7',
  it_staff: '#2ecc71',
  employee: '#94a3b8',
};

/* ── Magnetic Button ──────────────────────────────────────── */
function MagneticBtn({ children, className, onClick, style = {} }) {
  const btnRef = useRef(null);
  const handleMouseMove = useCallback((e) => {
    const btn = btnRef.current; if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width  / 2;
    const y = e.clientY - rect.top  - rect.height / 2;
    btn.style.transform = `translate(${x * 0.32}px, ${y * 0.32}px) scale(1.07)`;
  }, []);
  const handleMouseLeave = useCallback(() => {
    if (btnRef.current) btnRef.current.style.transform = 'translate(0,0) scale(1)';
  }, []);
  return (
    <button ref={btnRef} className={className} onClick={onClick}
      style={{ transition:'transform 0.28s cubic-bezier(.23,1,.32,1)', ...style }}
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
    </button>
  );
}

/* ── Tilt Card ────────────────────────────────────────────── */
function TiltCard({ children, className = '', style = {}, onMouseEnter, onMouseLeave: onML }) {
  const ref = useRef(null);
  const handleMove = useCallback((e) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    el.style.transform  = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.03)`;
    el.style.boxShadow  = `${-x * 16}px ${-y * 16}px 36px rgba(46,204,113,0.14)`;
  }, []);
  const handleLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = 'perspective(700px) rotateY(0deg) rotateX(0deg) scale(1)';
    ref.current.style.boxShadow = '';
    onML && onML();
  }, [onML]);
  return (
    <div ref={ref} className={className}
      style={{ transition:'transform 0.32s cubic-bezier(.23,1,.32,1), box-shadow 0.32s ease', ...style }}
      onMouseMove={handleMove} onMouseLeave={handleLeave} onMouseEnter={onMouseEnter}>
      {children}
    </div>
  );
}

/* ── Glitch Text ─────────────────────────────────────────── */
function GlitchText({ children, className = '' }) {
  return (
    <span className={`glitch-wrap ${className}`} data-text={children}>{children}</span>
  );
}

/* ── Mindteck Logo ────────────────────────────────────────── */
function MindteckLogo({ height = 36, style = {} }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      background:'#ffffff', borderRadius:8, padding:'4px 10px',
      height: height + 8, boxShadow:'0 1px 8px rgba(0,0,0,0.25)', flexShrink:0, ...style,
    }}>
      <img src={logoSrc} alt="Mindteck" style={{ height, display:'block', objectFit:'contain' }} />
    </div>
  );
}

/* ── Team Card ────────────────────────────────────────────── */
function TeamCard({ member }) {
  const ringColor = ROLE_COLOR[member.role] || '#2ecc71';
  const initials  = member.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <TiltCard className="hp-team-card hp-reveal">
      {member.online && <div className="hp-team-online" />}
      {member.photo ? (
        <img src={member.photo} alt={member.name} style={{
          width:82, height:82, borderRadius:'50%', objectFit:'cover',
          margin:'0 auto 14px', display:'block',
          border:`2px solid ${ringColor}55`,
          boxShadow:`0 0 0 4px ${ringColor}14, 0 4px 18px rgba(0,0,0,.35)`,
        }} />
      ) : (
        <div className="hp-team-avatar"
          style={{ background:`${ringColor}18`, color:ringColor, border:`2px solid ${ringColor}40` }}>
          {initials}
        </div>
      )}
      <div className="hp-team-name">{member.name}</div>
      {member.designation && (
        <div className="hp-team-role" style={{ color:ringColor, fontWeight:600, fontSize:12.5, marginTop:3 }}>
          {member.designation}
        </div>
      )}
      <div className="hp-team-dept" style={{ marginTop:4, opacity:0.55, fontSize:11.5 }}>
        {member.role === 'admin' ? 'Administrator' : member.role === 'it_staff' ? 'IT Staff' : 'Employee'}
      </div>
    </TiltCard>
  );
}

/* ── Cursor Glow ──────────────────────────────────────────── */
function CursorGlow() {
  const ref = useRef(null);
  const pos = useRef({ x:0, y:0 });
  const cur = useRef({ x:0, y:0 });
  useEffect(() => {
    const onMove = (e) => { pos.current = { x:e.clientX, y:e.clientY }; };
    window.addEventListener('mousemove', onMove);
    let raf;
    const animate = () => {
      cur.current.x += (pos.current.x - cur.current.x) * 0.09;
      cur.current.y += (pos.current.y - cur.current.y) * 0.09;
      if (ref.current) {
        ref.current.style.left = cur.current.x + 'px';
        ref.current.style.top  = cur.current.y + 'px';
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className="cursor-glow" />;
}

/* ── Animated Counter ─────────────────────────────────────── */
function AnimCounter({ target, suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      let n = 0;
      const step = Math.ceil(target / 55);
      const iv = setInterval(() => {
        n = Math.min(n + step, target);
        setVal(n);
        if (n >= target) clearInterval(iv);
      }, 22);
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ── TYPE WRITER for hero subtitle ───────────────────────── */
function TypeWriter({ text, delay = 0 }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  useEffect(() => {
    if (!started) return;
    let i = 0;
    const iv = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(iv);
    }, 22);
    return () => clearInterval(iv);
  }, [started, text]);
  return <span>{displayed}<span className="typewriter-cursor">▋</span></span>;
}

/* ── Main ─────────────────────────────────────────────────── */
export default function Homepage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [team, setTeam]           = useState([]);
  const [headerScrolled, setHS]   = useState(false);
  const [heroReady, setHeroReady] = useState(false);

  const goTo = (path) => navigate(user ? path : '/login');

  useEffect(() => {
    const load = async () => {
      const members = await fetchTeamMembers();
      members.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
      setTeam(members);
    };
    load();
    const iv = setInterval(load, 15000);
    // Trigger hero text reveal after laptop starts opening (~2.2s)
    const t = setTimeout(() => setHeroReady(true), 2200);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, []);

  useEffect(() => {
    const fn = () => setHS(window.scrollY > 40);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach((e, i) => {
        if (e.isIntersecting) setTimeout(() => e.target.classList.add('hp-visible'), i * 65);
      }),
      { threshold: 0.08 }
    );
    document.querySelectorAll('.hp-reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [team]);

  return (
    <div className="hp-root">
      <CursorGlow />

      {/* ── HEADER ── */}
      <header className={`hp-header ${headerScrolled ? 'hp-header-scrolled' : ''}`}>
        <div className="hp-logo" style={{ display:'flex', alignItems:'center', gap:12 }}>
          <MindteckLogo height={30} />
          <span className="hp-logo-name">AssetOps</span>
        </div>
        <nav className="hp-nav">
          <a href="#features">Features</a>
          <a href="#team">Team</a>
          <a href="#workflow">Workflow</a>
          <MagneticBtn className="hp-nav-cta" onClick={() => goTo('/dashboard')}>Launch App →</MagneticBtn>
        </nav>
      </header>

      {/* ══════════════════════════════════════════════
          HERO — Laptop Canvas fills the background
      ═══════════════════════════════════════════════ */}
      <section className="hp-hero">

        {/* 🎬 THE STAR: laptop opening animation */}
        {/* <LaptopHeroCanvas /> */}

        {/* Overlay gradient so text is readable */}
        <div className="hp-hero-overlay" />

        {/* Hero content fades in after laptop opens */}
        <div className={`hp-hero-content ${heroReady ? 'hp-hero-content--ready' : ''}`}>

          <div className="hp-badge">
            <span className="hp-badge-dot" />
            MINDTECK IT · ASSET MANAGEMENT SYSTEM
          </div>

          <h1 className="hp-h1">
            <span className="hp-h1-line">
              Track Every <GlitchText className="hp-green">Asset.</GlitchText>
            </span>
            <br />
            <span className="hp-h1-line hp-h1-line--2">
              <span className="hp-green">Own</span>{' '}Every{' '}
              <span className="hp-muted">Decision.</span>
            </span>
          </h1>

          {heroReady && (
            <p className="hp-hero-sub">
              <TypeWriter
                text="One platform for your entire IT fleet — laptops, servers, switches, printers & more. Allocate, track, swap and retire with complete audit trails."
                delay={400}
              />
            </p>
          )}

          <div className="hp-hero-cta">
            <MagneticBtn className="hp-btn hp-btn-primary" onClick={() => goTo('/dashboard')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Launch AssetOps
            </MagneticBtn>
            <a href="#features" className="hp-btn hp-btn-outline">Explore Features</a>
          </div>

          <div className="hp-stats">
            {[
              { label:'Assets Tracked',  target:280, suffix:''  },
              { label:'Allocations',     target:16,  suffix:''  },
              { label:'Network Devices', target:47,  suffix:''  },
              { label:'Audit Coverage',  target:100, suffix:'%' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div className="hp-stat-divider" />}
                <div className="hp-stat">
                  <div className="hp-stat-val"><AnimCounter target={s.target} suffix={s.suffix} /></div>
                  <div className="hp-stat-label">{s.label}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="hp-ticker-wrap">
        <div className="hp-ticker-fade hp-ticker-fade--left" />
        <div className="hp-ticker-inner">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <div key={i} className="hp-ticker-item">
              <span className="hp-ticker-dot" style={{ background:t.dot }} />{t.text}
            </div>
          ))}
        </div>
        <div className="hp-ticker-fade hp-ticker-fade--right" />
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
                  {p.label.split('\n').map((l, j) => <span key={j} style={{ display:'block' }}>{l}</span>)}
                </div>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className="hp-pipe-arrow">
                  <div className="hp-pipe-arrow-pulse" />
                </div>
              )}
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
          {FEATURES.map((f) => (
            <TiltCard key={f.title} className={`hp-feature-card ${f.accent} hp-reveal`}>
              <div className="hp-feature-shimmer" />
              <div className={`hp-feature-icon ${f.cls}`}>{f.icon}</div>
              <div className="hp-feature-title">{f.title}</div>
              <div className="hp-feature-desc">{f.desc}</div>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ── TEAM ── */}
      <section className="hp-team" id="team">
        <div className="hp-eyebrow hp-reveal">Our Team</div>
        <div className="hp-section-title hp-reveal">Mindteck IT Department</div>
        <div className="hp-section-sub hp-reveal">The people managing your entire asset fleet every day</div>
        {team.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'rgba(148,163,184,.3)', fontSize:14 }}>
            <div style={{ fontSize:44, marginBottom:14 }}>👥</div>
            Team members will appear here once added by an admin<br />
            in <strong style={{ color:'rgba(46,204,113,.45)' }}>Manage Users</strong>.
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
              <span className="hp-tech-dot" style={{ background:t.color }} />{t.label}
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
          <MagneticBtn className="hp-btn hp-btn-primary"
            style={{ fontSize:15, padding:'15px 36px', margin:'0 auto', display:'inline-flex' }}
            onClick={() => goTo('/dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            Launch AssetOps
          </MagneticBtn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="hp-footer">
        <div className="hp-footer-brand">
          <MindteckLogo height={20} style={{ borderRadius:6, padding:'3px 8px' }} />
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