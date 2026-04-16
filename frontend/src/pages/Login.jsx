import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ─── All styles inline so no external CSS needed ──────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,700;1,400&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#f5f0eb}
.lp-root{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#c9b8a8;padding:24px}
.lp-card{display:flex;width:100%;max-width:960px;min-height:580px;background:#faf7f4;border-radius:28px;overflow:hidden;box-shadow:0 40px 80px rgba(80,50,30,.25),0 0 0 1px rgba(255,255,255,.6)}
.lp-form-panel{flex:0 0 420px;padding:56px 48px;display:flex;flex-direction:column;justify-content:center;background:#faf7f4}
.lp-brand{display:flex;align-items:center;gap:10px;margin-bottom:40px}
.lp-brand-icon{width:36px;height:36px;background:#1d5c3c;border-radius:10px;display:flex;align-items:center;justify-content:center}
.lp-brand-name{font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:#2d1f14;letter-spacing:-.02em}
.lp-heading{font-family:'Fraunces',serif;font-size:34px;font-weight:700;color:#2d1f14;letter-spacing:-.03em;line-height:1.15;margin-bottom:6px}
.lp-sub{font-size:13px;color:#9e8a7a;margin-bottom:32px}
.lp-field{margin-bottom:16px}
.lp-input{width:100%;padding:13px 16px;background:#fff;border:1.5px solid #e8dfd6;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:14px;color:#2d1f14;outline:none;transition:border-color .2s,box-shadow .2s}
.lp-input::placeholder{color:#bfad9e}
.lp-input:focus{border-color:#1d5c3c;box-shadow:0 0 0 3px rgba(29,92,60,.12)}
.lp-input-wrap{position:relative}
.lp-eye{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#bfad9e;padding:0;line-height:1;transition:color .2s}
.lp-eye:hover{color:#1d5c3c}
.lp-forgot{display:block;text-align:right;font-size:12px;color:#9e8a7a;text-decoration:none;margin-top:6px;margin-bottom:24px;transition:color .2s;cursor:pointer}
.lp-forgot:hover{color:#1d5c3c}
.lp-btn{width:100%;padding:14px;background:#1d5c3c;color:#fff;border:none;border-radius:14px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:.01em;transition:background .2s,transform .15s,box-shadow .2s;box-shadow:0 4px 16px rgba(29,92,60,.35);margin-bottom:24px}
.lp-btn:hover{background:#27ae60;transform:translateY(-1px);box-shadow:0 8px 20px rgba(29,92,60,.4)}
.lp-btn:active{transform:translateY(0)}
.lp-btn:disabled{opacity:.65;cursor:not-allowed;transform:none}
.lp-divider{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.lp-divider-line{flex:1;height:1px;background:#e8dfd6}
.lp-divider-text{font-size:12px;color:#bfad9e;white-space:nowrap}
.lp-socials{display:flex;gap:12px;justify-content:center}
.lp-social-btn{flex:1;padding:10px;background:#fff;border:1.5px solid #e8dfd6;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .2s,box-shadow .2s}
.lp-social-btn:hover{border-color:#c9b8a8;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.lp-error{background:rgba(220,50,50,.08);border:1px solid rgba(220,50,50,.25);color:#c0392b;padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:14px;text-align:center}
.lp-art-panel{flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:32px}
.lp-art-caption{position:relative;z-index:2;color:rgba(255,255,255,.95)}
.lp-art-caption h2{font-family:'Fraunces',serif;font-size:22px;font-weight:700;line-height:1.3;margin-bottom:6px;text-shadow:0 1px 4px rgba(0,0,0,.2)}
.lp-art-caption p{font-size:13px;opacity:.8}
.lp-art-dots{display:flex;gap:8px;margin-top:16px}
.lp-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4);cursor:pointer;transition:background .2s,transform .2s}
.lp-dot.active{background:#fff;transform:scale(1.2)}
.lp-spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:lp-spin .7s linear infinite;margin:0 auto}
@keyframes lp-spin{to{transform:rotate(360deg)}}
@media(max-width:700px){.lp-art-panel{display:none}.lp-form-panel{flex:1;padding:40px 28px}}
`;

// ─── SVG Illustrations ────────────────────────────────────────────────────────
function Slide0() {
  return (
    <svg viewBox="0 0 460 420" xmlns="http://www.w3.org/2000/svg" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <linearGradient id="sky0" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8e8c0"/>
          <stop offset="60%" stopColor="#8dd4a8"/>
          <stop offset="100%" stopColor="#5ab880"/>
        </linearGradient>
        <linearGradient id="fl0" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a0c8b0"/>
          <stop offset="100%" stopColor="#6aab84"/>
        </linearGradient>
      </defs>
      <rect width="460" height="420" fill="url(#sky0)"/>
      <circle cx="280" cy="85" r="50" fill="#fff9d0" opacity=".85"/>
      <circle cx="280" cy="85" r="36" fill="#fce77d" opacity=".95"/>
      <ellipse cx="80" cy="295" rx="130" ry="55" fill="#5a9070" opacity=".4"/>
      <ellipse cx="380" cy="305" rx="110" ry="48" fill="#4a7860" opacity=".35"/>
      <path d="M0 325 Q230 285 460 325 L460 420 L0 420Z" fill="url(#fl0)" opacity=".9"/>
      <rect x="80" y="188" width="200" height="150" fill="#c9d8b0" rx="2"/>
      <rect x="80" y="158" width="200" height="34" fill="#a8b890"/>
      <polygon points="70,158 290,158 290,140 180,116 70,140" fill="#88986a"/>
      <rect x="145" y="268" width="50" height="70" fill="#4a6a38" rx="2"/>
      <rect x="95" y="208" width="38" height="28" fill="#d4e8f4" rx="3" opacity=".9"/>
      <rect x="245" y="208" width="38" height="28" fill="#d4e8f4" rx="3" opacity=".9"/>
      <line x1="114" y1="208" x2="114" y2="236" stroke="#b0c8de" strokeWidth="1.5"/>
      <line x1="95" y1="222" x2="133" y2="222" stroke="#b0c8de" strokeWidth="1.5"/>
      <line x1="264" y1="208" x2="264" y2="236" stroke="#b0c8de" strokeWidth="1.5"/>
      <line x1="245" y1="222" x2="283" y2="222" stroke="#b0c8de" strokeWidth="1.5"/>
      <rect x="128" y="172" width="84" height="16" fill="#1d5c3c" rx="3"/>
      <text x="170" y="184" textAnchor="middle" fill="#fff" fontSize="8" fontFamily="sans-serif" fontWeight="bold">ASSET DEPOT</text>
      <rect x="305" y="298" width="60" height="30" fill="#e8c060" rx="4"/>
      <rect x="355" y="288" width="12" height="42" fill="#c8a040" rx="2"/>
      <rect x="340" y="283" width="28" height="6" fill="#a08020" rx="1"/>
      <circle cx="315" cy="332" r="8" fill="#555"/><circle cx="315" cy="332" r="4" fill="#888"/>
      <circle cx="348" cy="332" r="8" fill="#555"/><circle cx="348" cy="332" r="4" fill="#888"/>
      <rect x="310" y="290" width="32" height="20" fill="#f0d070" rx="3"/>
      <rect x="320" y="294" width="18" height="12" fill="#c8e8f8" rx="2" opacity=".8"/>
      <rect x="30" y="152" width="52" height="28" fill="#fff" rx="6" opacity=".95"/>
      <text x="56" y="162" textAnchor="middle" fill="#1d5c3c" fontSize="7" fontFamily="sans-serif" fontWeight="bold">ASSET #</text>
      <text x="56" y="172" textAnchor="middle" fill="#2d1f14" fontSize="9" fontFamily="sans-serif" fontWeight="bold">LTB-280</text>
      <rect x="380" y="183" width="58" height="28" fill="#fff" rx="6" opacity=".95"/>
      <text x="409" y="193" textAnchor="middle" fill="#1d5c3c" fontSize="7" fontFamily="sans-serif" fontWeight="bold">TRACKED</text>
      <text x="409" y="203" textAnchor="middle" fill="#2d1f14" fontSize="9" fontFamily="sans-serif" fontWeight="bold">✓ LIVE</text>
      <circle cx="386" cy="197" r="4" fill="#2ecc71"/>
      <rect x="418" y="293" width="6" height="40" fill="#5a4020"/><ellipse cx="421" cy="280" rx="14" ry="22" fill="#2a6030"/>
      <rect x="40" y="303" width="5" height="30" fill="#5a4020"/><ellipse cx="42" cy="292" rx="11" ry="17" fill="#2a5028"/>
    </svg>
  );
}

function Slide1() {
  return (
    <svg viewBox="0 0 460 420" xmlns="http://www.w3.org/2000/svg" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b8e8d0"/><stop offset="100%" stopColor="#7cc4a4"/>
        </linearGradient>
      </defs>
      <rect width="460" height="420" fill="url(#bg1)"/>
      <path d="M0 275 Q230 255 460 275 L460 420 L0 420Z" fill="#8ab898" opacity=".7"/>
      <rect x="130" y="128" width="200" height="140" fill="#1a2a20" rx="8"/>
      <rect x="135" y="133" width="190" height="128" fill="#0f1a14" rx="5"/>
      <rect x="218" y="268" width="24" height="20" fill="#2a3a30"/>
      <rect x="200" y="286" width="60" height="5" fill="#1a2a20" rx="2"/>
      <rect x="135" y="133" width="190" height="18" fill="#1a2a1a" rx="5"/>
      <circle cx="148" cy="142" r="4" fill="#e05050" opacity=".8"/>
      <circle cx="160" cy="142" r="4" fill="#e0a050" opacity=".8"/>
      <circle cx="172" cy="142" r="4" fill="#2ecc71" opacity=".8"/>
      <text x="230" y="146" textAnchor="middle" fill="#6a9a7a" fontSize="7" fontFamily="sans-serif">AssetOps Dashboard</text>
      <rect x="140" y="158" width="52" height="36" fill="#1a2a1a" rx="4"/>
      <text x="166" y="169" textAnchor="middle" fill="#6a9a7a" fontSize="6" fontFamily="sans-serif">TOTAL</text>
      <text x="166" y="181" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="sans-serif" fontWeight="bold">280</text>
      <text x="166" y="190" textAnchor="middle" fill="#2ecc71" fontSize="6" fontFamily="sans-serif">▲ 4.2%</text>
      <rect x="198" y="158" width="52" height="36" fill="#1a2a1a" rx="4"/>
      <text x="224" y="169" textAnchor="middle" fill="#6a9a7a" fontSize="6" fontFamily="sans-serif">ACTIVE</text>
      <text x="224" y="181" textAnchor="middle" fill="#2ecc71" fontSize="11" fontFamily="sans-serif" fontWeight="bold">247</text>
      <text x="224" y="190" textAnchor="middle" fill="#2ecc71" fontSize="6" fontFamily="sans-serif">▲ 2.1%</text>
      <rect x="256" y="158" width="64" height="36" fill="#1a2a1a" rx="4"/>
      <text x="288" y="169" textAnchor="middle" fill="#6a9a7a" fontSize="6" fontFamily="sans-serif">IN REPAIR</text>
      <text x="288" y="181" textAnchor="middle" fill="#f0a030" fontSize="11" fontFamily="sans-serif" fontWeight="bold">8</text>
      <text x="288" y="190" textAnchor="middle" fill="#f0a030" fontSize="6" fontFamily="sans-serif">▼ 1.4%</text>
      <rect x="140" y="202" width="80" height="52" fill="#1a2a1a" rx="4"/>
      <text x="180" y="210" textAnchor="middle" fill="#6a9a7a" fontSize="6" fontFamily="sans-serif">Monthly Allocations</text>
      {[16,22,14,28,20,25].map((h,i)=>(
        <rect key={i} x={144+i*13} y={250-h} width="9" height={h} fill={i===3?"#1d5c3c":"#2a7a50"} rx="2" opacity=".9"/>
      ))}
      <rect x="226" y="202" width="95" height="52" fill="#1a2a1a" rx="4"/>
      <text x="273" y="210" textAnchor="middle" fill="#6a9a7a" fontSize="6" fontFamily="sans-serif">Asset Status</text>
      <circle cx="255" cy="233" r="15" fill="none" stroke="#2ecc71" strokeWidth="6" strokeDasharray="57 38"/>
      <circle cx="255" cy="233" r="15" fill="none" stroke="#f0a030" strokeWidth="6" strokeDasharray="20 75" strokeDashoffset="-57"/>
      <circle cx="255" cy="233" r="8" fill="#1a2a1a"/>
      <text x="255" y="236" textAnchor="middle" fill="#fff" fontSize="6" fontFamily="sans-serif" fontWeight="bold">88%</text>
      <rect x="276" y="220" width="6" height="5" fill="#2ecc71" rx="1"/>
      <text x="285" y="225" fill="#8ab898" fontSize="5.5" fontFamily="sans-serif">Active</text>
      <rect x="276" y="229" width="6" height="5" fill="#f0a030" rx="1"/>
      <text x="285" y="234" fill="#8ab898" fontSize="5.5" fontFamily="sans-serif">Repair</text>
      <rect x="155" y="293" width="150" height="28" fill="#c8d8b8" rx="5"/>
      {[0,1,2,3,4,5,6,7,8,9].map(i=>(
        <rect key={i} x={163+i*13} y={300} width="10" height="7" fill="#a8b898" rx="2" opacity=".8"/>
      ))}
      <rect x="30" y="178" width="70" height="34" fill="#fff" rx="8" opacity=".95"/>
      <text x="65" y="191" textAnchor="middle" fill="#1d5c3c" fontSize="7" fontFamily="sans-serif" fontWeight="bold">GPS TRACKED</text>
      <text x="65" y="204" textAnchor="middle" fill="#2d1f14" fontSize="9" fontFamily="sans-serif" fontWeight="bold">📍 LIVE</text>
    </svg>
  );
}

function Slide2() {
  return (
    <svg viewBox="0 0 460 420" xmlns="http://www.w3.org/2000/svg" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      <defs>
        <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8e8d0"/><stop offset="55%" stopColor="#9acca8"/><stop offset="100%" stopColor="#6aaa80"/>
        </linearGradient>
      </defs>
      <rect width="460" height="420" fill="url(#bg2)"/>
      <path d="M0 318 Q230 293 460 318 L460 420 L0 420Z" fill="#5a8a68" opacity=".7"/>
      {[0,1,2,3,4].map(i=>(
        <line key={`v${i}`} x1={80+i*80} y1="60" x2={60+i*80} y2="300" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
      ))}
      {[0,1,2,3,4].map(i=>(
        <line key={`h${i}`} x1="20" y1={80+i*50} x2="440" y2={80+i*50} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
      ))}
      <rect x="160" y="98" width="140" height="175" fill="rgba(255,255,255,.92)" rx="14"/>
      <rect x="160" y="98" width="140" height="32" fill="#1d5c3c" rx="14"/>
      <rect x="160" y="116" width="140" height="14" fill="#1d5c3c"/>
      <text x="230" y="119" textAnchor="middle" fill="#fff" fontSize="9" fontFamily="sans-serif" fontWeight="bold">FLEET TRACKER</text>
      <text x="230" y="129" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="7" fontFamily="sans-serif">Live Asset Locations</text>
      {[
        {id:'LTB-280',loc:'Warehouse A',s:'#2ecc71',st:'Active'},
        {id:'LTB-272',loc:'Route B-7',s:'#f0a030',st:'Transit'},
        {id:'SRV-001',loc:'Server Room',s:'#2ecc71',st:'Active'},
        {id:'PRN-004',loc:'Finance Dept',s:'#e05050',st:'Service'},
      ].map((it,i)=>(
        <g key={i}>
          <rect x="168" y={138+i*34} width="124" height="28" fill={i%2===0?"#f0f8f0":"#fff"} rx="6"/>
          <circle cx="180" cy={152+i*34} r="5" fill={it.s}/>
          <text x="190" y={149+i*34} fill="#2d1f14" fontSize="7.5" fontFamily="sans-serif" fontWeight="600">{it.id}</text>
          <text x="190" y={159+i*34} fill="#9e8a7a" fontSize="6.5" fontFamily="sans-serif">{it.loc}</text>
          <rect x="252" y={146+i*34} width="34" height="14" fill={it.s} rx="7" opacity=".15"/>
          <text x="269" y={156+i*34} textAnchor="middle" fill={it.s} fontSize="6" fontFamily="sans-serif" fontWeight="bold">{it.st}</text>
        </g>
      ))}
      <circle cx="80" cy="158" r="8" fill="#e05050"/>
      <text x="80" y="161" textAnchor="middle" fill="#fff" fontSize="8">A</text>
      <circle cx="380" cy="198" r="8" fill="#f0a030"/>
      <text x="380" y="201" textAnchor="middle" fill="#fff" fontSize="8">B</text>
      <circle cx="420" cy="118" r="8" fill="#2ecc71"/>
      <text x="420" y="121" textAnchor="middle" fill="#fff" fontSize="8">C</text>
      <path d="M80 158 Q180 128 230 148 Q330 173 380 198" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeDasharray="6 4"/>
    </svg>
  );
}

const SLIDES = [
  { comp: Slide0, caption: 'All your IT assets in one place.', sub: 'Track laptops, servers, switches & printers from one dashboard.' },
  { comp: Slide1, caption: 'Real-time insights at a glance.', sub: 'Live dashboards, warranty alerts, and utilization rates.' },
  { comp: Slide2, caption: 'Fleet tracking made effortless.', sub: 'GPS-powered visibility across all departments and locations.' },
];

// ─── Main Login Component ─────────────────────────────────────────────────────
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form,     setForm]     = useState({ email: 'admin@company.com', password: 'admin123' });
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [slide,    setSlide]    = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // ✅ Calls the REAL API login — never alert(), never fake
      const success = await login(form.email, form.password);
      if (success) {
        // Role-based redirect — read role from localStorage since setUser is async
        const userData = localStorage.getItem('user');
        const user = userData ? JSON.parse(userData) : null;
        if (user?.role === 'employee') {
          navigate('/my-dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const SlideComp = SLIDES[slide].comp;

  return (
    <>
      <style>{CSS}</style>
      <div className="lp-root">
        <div className="lp-card">

          {/* ── FORM PANEL ── */}
          <div className="lp-form-panel">
            <div className="lp-brand">
              <div className="lp-brand-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#fff"/>
                  <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#fff" opacity=".7"/>
                  <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#fff" opacity=".7"/>
                  <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#fff" opacity=".5"/>
                </svg>
              </div>
              <span className="lp-brand-name">AssetOps</span>
            </div>

            <h1 className="lp-heading">Welcome Back!</h1>
            <p className="lp-sub">Sign in to Mindteck Asset Management</p>

            <form onSubmit={handleSubmit}>
              <div className="lp-field">
                <input className="lp-input" type="email" placeholder="Email address"
                  value={form.email} required
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
              </div>

              <div className="lp-field">
                <div className="lp-input-wrap">
                  <input className="lp-input" type={showPass ? 'text' : 'password'}
                    placeholder="Password" value={form.password} required
                    style={{ paddingRight: 42 }}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}/>
                  <button type="button" className="lp-eye" onClick={() => setShowPass(s => !s)}>
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <span className="lp-forgot">Forgot password?</span>

              {error && <div className="lp-error">{error}</div>}

              <button type="submit" className="lp-btn" disabled={loading}>
                {loading ? <div className="lp-spinner"/> : 'Sign In →'}
              </button>
            </form>

            <div className="lp-divider">
              <div className="lp-divider-line"/>
              <span className="lp-divider-text">Mindteck IT · AssetOps v2.0</span>
              <div className="lp-divider-line"/>
            </div>

            <div style={{ textAlign:'center', fontSize:12, color:'#9e8a7a' }}>
              <div style={{ marginBottom:4 }}>Admin: admin@company.com</div>
              <div style={{ fontFamily:'monospace', color:'#1d5c3c', fontWeight:600 }}>Password: admin123</div>
            </div>
          </div>

          {/* ── ILLUSTRATION PANEL ── */}
          <div className="lp-art-panel">
            <SlideComp/>
            <div className="lp-art-caption">
              <h2>{SLIDES[slide].caption}</h2>
              <p>{SLIDES[slide].sub}</p>
              <div className="lp-art-dots">
                {SLIDES.map((_, i) => (
                  <div key={i} className={`lp-dot${i === slide ? ' active' : ''}`}
                    onClick={() => setSlide(i)}/>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}