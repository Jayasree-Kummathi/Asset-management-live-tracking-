import { useEffect, useRef } from 'react';

// Draws a glowing dashboard UI inside the laptop screen
function drawDashboardUI(ctx, x, y, w, h, progress, time) {
  // Add validation to prevent negative dimensions
  if (w <= 0 || h <= 0) return;
  
  ctx.save();
  ctx.globalAlpha = Math.min(progress, 1);

  // Screen bg - advanced gradient
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#0a1a0a');
  grad.addColorStop(0.5, '#051005');
  grad.addColorStop(1, '#020802');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Matrix rain effect
  ctx.globalAlpha = progress * 0.03;
  for (let i = 0; i < h; i += 2) {
    ctx.fillStyle = i % 4 === 0 ? '#2ecc71' : '#1a5c3a';
    ctx.fillRect(x, y + i, w, 1);
  }
  ctx.globalAlpha = progress;

  const pad = 14;
  const iw = w - pad * 2;
  
  // Ensure iw is positive
  if (iw <= 0) {
    ctx.restore();
    return;
  }

  // Top bar with glassmorphism
  ctx.fillStyle = 'rgba(46,204,113,0.12)';
  ctx.shadowBlur = 0;
  ctx.fillRect(x + pad, y + pad, iw, 24);
  ctx.fillStyle = '#2ecc71';
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#2ecc7140';
  ctx.font = `bold ${Math.max(12, Math.round(w * 0.048))}px 'Space Mono', monospace`;
  ctx.fillText('▶ ASSETOPS', x + pad + 8, y + pad + 17);
  ctx.shadowBlur = 0;

  // Status dots with pulse
  const dotRadius = Math.max(1, Math.min(4, w * 0.012));
  if (dotRadius > 0) {
    [
      { color: '#2ecc71', pulse: true },
      { color: '#f59e0b', pulse: false },
      { color: '#3b82f6', pulse: false }
    ].forEach((item, i) => {
      const dotX = x + w - pad - 8 - i * 16;
      const dotY = y + pad + 12;
      if (dotX - dotRadius > x && dotX + dotRadius < x + w) {
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
        if (item.pulse && (Math.floor(time / 800) % 2 === 0)) {
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotRadius * 2, 0, Math.PI * 2);
          ctx.fillStyle = `${item.color}30`;
          ctx.fill();
        }
      }
    });
  }

  // Animated bar chart with glow
  const bars = [0.72, 0.88, 0.45, 0.94, 0.68, 0.51];
  const bw = iw / bars.length - 4;
  
  if (bw > 0) {
    const chartY = y + pad + 32;
    const chartH = h * 0.28;
    bars.forEach((v, i) => {
      const bh = chartH * v * Math.min(progress * 1.5, 1);
      const bx = x + pad + i * (bw + 4);
      const by = chartY + chartH - bh;
      if (bx + bw <= x + w && by > y) {
        // Bar background
        ctx.fillStyle = `rgba(46,204,113,0.08)`;
        ctx.fillRect(bx, chartY, bw, chartH);
        // Animated bar
        const gradient = ctx.createLinearGradient(bx, by + bh, bx, by);
        gradient.addColorStop(0, '#2ecc71');
        gradient.addColorStop(1, '#27ae60');
        ctx.fillStyle = gradient;
        ctx.fillRect(bx, by, bw, bh);
        // Bar glow
        ctx.fillStyle = `rgba(46,204,113,0.3)`;
        ctx.fillRect(bx, by, bw, 1);
      }
    });
  }

  // Stat cards with cyberpunk style
  const cardY = y + pad + 32 + (h * 0.28) + 8;
  const cardH = Math.min(h * 0.16, 80);
  const cardW = (iw - 8) / 3;
  
  if (cardW > 0 && cardH > 0) {
    const stats = [
      { label: 'ACTIVE', val: '280', unit: '', color: '#2ecc71', icon: '💻' },
      { label: 'ALLOC', val: '16', unit: '', color: '#3b82f6', icon: '📤' },
      { label: 'NET', val: '47', unit: '', color: '#f59e0b', icon: '🌐' },
    ];
    stats.forEach((s, i) => {
      const cx = x + pad + i * (cardW + 4);
      if (cx + cardW <= x + w) {
        // Card border
        ctx.strokeStyle = `${s.color}40`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const radius = Math.min(6, cardW * 0.08);
        ctx.moveTo(cx + radius, cardY);
        ctx.lineTo(cx + cardW - radius, cardY);
        ctx.quadraticCurveTo(cx + cardW, cardY, cx + cardW, cardY + radius);
        ctx.lineTo(cx + cardW, cardY + cardH - radius);
        ctx.quadraticCurveTo(cx + cardW, cardY + cardH, cx + cardW - radius, cardY + cardH);
        ctx.lineTo(cx + radius, cardY + cardH);
        ctx.quadraticCurveTo(cx, cardY + cardH, cx, cardY + cardH - radius);
        ctx.lineTo(cx, cardY + radius);
        ctx.quadraticCurveTo(cx, cardY, cx + radius, cardY);
        ctx.closePath();
        ctx.fillStyle = `rgba(46,204,113,0.04)`;
        ctx.fill();
        ctx.stroke();
        
        // Icon
        ctx.font = `${Math.max(16, Math.round(w * 0.04))}px system-ui`;
        ctx.fillStyle = s.color;
        ctx.fillText(s.icon, cx + 8, cardY + 24);
        
        // Value
        ctx.font = `bold ${Math.max(18, Math.round(w * 0.055))}px 'Space Mono', monospace`;
        ctx.fillStyle = s.color;
        ctx.fillText(s.val + s.unit, cx + 8, cardY + cardH * 0.65);
        
        // Label
        ctx.font = `${Math.max(8, Math.round(w * 0.028))}px 'DM Sans', monospace`;
        ctx.fillStyle = 'rgba(46,204,113,0.5)';
        ctx.fillText(s.label, cx + 8, cardY + cardH - 8);
      }
    });
  }

  // Activity feed with scanline effect
  const tableY = cardY + cardH + 8;
  const rowH = Math.min(Math.max(14, (y + h - tableY - pad) / 4), 36);
  
  if (rowH > 0) {
    const rows = [
      { text: 'LTB-280  →  Pravieen MK', status: '✓', color: '#2ecc71' },
      { text: 'LTB-273  ←  Returned', status: '↩', color: '#3b82f6' },
      { text: 'SW/001   ●  HP Switch', status: '●', color: '#f59e0b' },
      { text: 'LTB-272  ✓  Jacob Thomas', status: '✓', color: '#2ecc71' },
    ];
    rows.forEach((row, i) => {
      if (tableY + i * rowH + rowH > y + h - pad) return;
      // Row background
      ctx.fillStyle = i % 2 === 0 ? 'rgba(46,204,113,0.03)' : 'transparent';
      ctx.fillRect(x + pad, tableY + i * rowH, iw, rowH);
      
      // Status indicator
      ctx.font = `${Math.max(10, Math.round(w * 0.032))}px monospace`;
      ctx.fillStyle = row.color;
      ctx.fillText(row.status, x + pad + 6, tableY + i * rowH + rowH * 0.7);
      
      // Row text
      ctx.fillStyle = i === 0 ? '#2ecc71' : 'rgba(46,204,113,0.6)';
      ctx.font = `${Math.max(9, Math.round(w * 0.03))}px 'DM Sans', monospace`;
      ctx.fillText(row.text, x + pad + 24, tableY + i * rowH + rowH * 0.68);
    });
  }

  // Glowing cursor with cyberpunk style
  if (Math.floor(time / 600) % 2 === 0) {
    ctx.fillStyle = '#2ecc71';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#2ecc71';
    ctx.fillRect(x + pad + 4, y + h - pad - 12, 8, 12);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

export default function LaptopHeroCanvas({ style = {} }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ 
    openAngle: 0, 
    phase: 'closed', 
    startTime: null, 
    particles: [], 
    floaters: [],
    mouseInfluence: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let mouse = { x: -999, y: -999 };
    let frameCount = 0;

    const resize = () => {
      if (!canvas) return;
      canvas.width = Math.max(100, canvas.offsetWidth);
      canvas.height = Math.max(100, canvas.offsetHeight);
      initFloaters();
    };

    // Floating IT asset icons with cyberpunk style
    const ASSET_ICONS = ['💻', '🖥️', '🖨️', '🔌', '📡', '🛡️', '⚙️', '📊', '🖱️', '⌨️', '🔧', '📱', '🎮', '🔋'];
    const initFloaters = () => {
      if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        stateRef.current.floaters = [];
        return;
      }
      
      stateRef.current.floaters = Array.from({ length: 18 }, (_, i) => ({
        icon: ASSET_ICONS[i % ASSET_ICONS.length],
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.max(10, Math.min(36, Math.random() * 20 + 16)),
        alpha: Math.random() * 0.25 + 0.06,
        phase: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.008,
        glowIntensity: Math.random() * 0.5 + 0.3,
      }));
    };

    // Advanced particle burst with energy waves
    const spawnParticles = (cx, cy) => {
      const colors = ['#2ecc71', '#27ae60', '#3b82f6', '#f59e0b', '#e8f5e9'];
      for (let i = 0; i < 80; i++) {
        const angle = (Math.random() * Math.PI * 2);
        const speed = Math.random() * 4 + 0.8;
        stateRef.current.particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1, 
          decay: Math.random() * 0.02 + 0.012,
          size: Math.random() * 4 + 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          trail: [],
        });
      }
    };

    // Advanced grid with circuit board style
    const drawGrid = (alpha) => {
      if (!canvas || canvas.width <= 0 || canvas.height <= 0) return;
      
      ctx.save();
      ctx.globalAlpha = alpha * 0.12;
      
      // Main grid
      const gx = 48, gy = 48;
      const radius = Math.max(0.5, Math.min(1.5, Math.min(canvas.width, canvas.height) * 0.0025));
      
      for (let x = gx / 2; x < canvas.width; x += gx) {
        for (let y = gy / 2; y < canvas.height; y += gy) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = '#2ecc71';
          ctx.fill();
          
          // Connection lines
          if (x + gx < canvas.width) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + gx, y);
            ctx.strokeStyle = `rgba(46,204,113,0.15)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          if (y + gy < canvas.height) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + gy);
            ctx.stroke();
          }
        }
      }
      
      ctx.restore();
    };

    // Enhanced connection lines with energy flow
    const drawConnections = (floaters, alpha, time) => {
      ctx.save();
      floaters.forEach((a, i) => {
        floaters.slice(i + 1).forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 180) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            const intensity = Math.sin(time * 0.003 + d * 0.05) * 0.5 + 0.5;
            ctx.strokeStyle = `rgba(46,204,113,${alpha * 0.15 * (1 - d / 180) * intensity})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        });
      });
      ctx.restore();
    };

    // Draw the laptop in 3D perspective with enhanced materials
    const drawLaptop = (t) => {
      const s = stateRef.current;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;

      const scale = Math.min(W, H) * 0.00078;
      const bw = 380 * scale, bh = 26 * scale;
      const sw = 340 * scale, sh = 240 * scale;

      const bx = cx - bw / 2;
      const by = cy + 35 * scale;

      // Enhanced shadow
      ctx.save();
      ctx.globalAlpha = 0.4;
      const shadowGrad = ctx.createRadialGradient(cx, by + bh + 25 * scale, 0, cx, by + bh + 25 * scale, bw * 0.8);
      shadowGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
      shadowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = shadowGrad;
      ctx.ellipse(cx, by + bh + 22 * scale, bw * 0.6, 18 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Base body with carbon fiber texture
      ctx.save();
      const baseGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      baseGrad.addColorStop(0, '#1a2a1a');
      baseGrad.addColorStop(0.5, '#0e180e');
      baseGrad.addColorStop(1, '#0a120a');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, [0, 0, 8 * scale, 8 * scale]);
      ctx.fill();
      
      // Base edge glow
      ctx.strokeStyle = 'rgba(46,204,113,0.25)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      
      // Keyboard area with backlit effect
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(bx + 16 * scale, by + 4 * scale, bw - 32 * scale, bh - 12 * scale, 4);
      ctx.fill();
      
      // Enhanced keyboard rows with glow
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 12 - row; col++) {
          const kx = bx + 20 * scale + col * (bw - 40 * scale) / (12 - row) + row * 5 * scale;
          const ky = by + 6 * scale + row * 5 * scale;
          const kw = (bw - 40 * scale) / (12 - row) - 2.5 * scale;
          ctx.fillStyle = `rgba(46,204,113,${0.08 + (frameCount % 120) / 1200})`;
          ctx.beginPath();
          ctx.roundRect(kx, ky, kw, 3.5 * scale, 1.5);
          ctx.fill();
        }
      }
      
      // Touchpad with glow
      ctx.fillStyle = 'rgba(46,204,113,0.06)';
      ctx.strokeStyle = 'rgba(46,204,113,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx - 24 * scale, by + 5.5 * scale, 48 * scale, bh - 10 * scale, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Hinge with metallic finish
      ctx.save();
      ctx.fillStyle = '#0d180d';
      ctx.beginPath();
      ctx.roundRect(cx - 20 * scale, by - 4 * scale, 40 * scale, 8 * scale, 4);
      ctx.fill();
      ctx.fillStyle = '#1a2a1a';
      ctx.beginPath();
      ctx.roundRect(cx - 18 * scale, by - 3 * scale, 36 * scale, 5 * scale, 2);
      ctx.fill();
      ctx.restore();

      // Screen lid with enhanced rotation
      const openAngle = s.openAngle;
      const lidAngle = openAngle * (-125 * Math.PI / 180);

      const pivotX = cx;
      const pivotY = by;

      const lidH = sh + 12 * scale;
      const lidW = sw + 12 * scale;

      const cosA = Math.cos(lidAngle);
      const sinA = Math.sin(lidAngle);

      const ldx = -lidW / 2;
      const ldy_bottom = 0;
      const ldy_top = -lidH;

      const project = (lx, ly) => ({
        x: pivotX + lx,
        y: pivotY + ly * cosA + Math.abs(ly) * sinA * 0.4,
      });

      const bl = project(ldx, ldy_bottom);
      const br = project(ldx + lidW, ldy_bottom);
      const tr = project(ldx + lidW, ldy_top);
      const tl = project(ldx, ldy_top);

      // Lid outer body with premium finish
      ctx.save();
      const lidGrad = ctx.createLinearGradient(tl.x, tl.y, br.x, br.y);
      lidGrad.addColorStop(0, '#1e2e1e');
      lidGrad.addColorStop(0.5, '#122212');
      lidGrad.addColorStop(1, '#0a160a');
      ctx.fillStyle = lidGrad;
      ctx.beginPath();
      ctx.moveTo(bl.x, bl.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(tl.x, tl.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(46,204,113,0.3)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Apple-style logo glow
      if (openAngle > 0.05) {
        ctx.globalAlpha = openAngle * 0.6;
        ctx.fillStyle = 'rgba(46,204,113,0.12)';
        const lc = project(0, -lidH * 0.5);
        const glowRadius = Math.max(2, 20 * scale);
        ctx.beginPath();
        ctx.arc(lc.x, lc.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Screen bezel with glass effect
      const bpad = 10 * scale;
      const sbl = project(ldx + bpad, ldy_bottom + bpad);
      const sbr = project(ldx + lidW - bpad, ldy_bottom + bpad);
      const str_ = project(ldx + lidW - bpad, ldy_top + bpad);
      const stl = project(ldx + bpad, ldy_top + bpad);
      
      ctx.fillStyle = '#030803';
      ctx.beginPath();
      ctx.moveTo(sbl.x, sbl.y);
      ctx.lineTo(sbr.x, sbr.y);
      ctx.lineTo(str_.x, str_.y);
      ctx.lineTo(stl.x, stl.y);
      ctx.closePath();
      ctx.fill();

      // Dashboard UI with new graphics
      if (openAngle > 0.3) {
        ctx.beginPath();
        ctx.moveTo(sbl.x, sbl.y);
        ctx.lineTo(sbr.x, sbr.y);
        ctx.lineTo(str_.x, str_.y);
        ctx.lineTo(stl.x, stl.y);
        ctx.closePath();
        ctx.clip();

        const minX = Math.min(stl.x, sbl.x);
        const minY = Math.min(stl.y, str_.y);
        const maxX = Math.max(str_.x, sbr.x);
        const maxY = Math.max(sbl.y, sbr.y);

        ctx.save();
        const screenW = maxX - minX;
        const screenH = maxY - minY;
        
        if (screenW > 0 && screenH > 0 && Math.abs(cosA) > 0.1) {
          ctx.transform(1, 0, 0, cosA, 0, 0);

          const dashProgress = Math.min(1, Math.max(0, (openAngle - 0.3) / 0.7));
          drawDashboardUI(
            ctx,
            minX,
            minY / Math.abs(cosA),
            screenW,
            screenH / Math.abs(cosA),
            dashProgress,
            t
          );
        }
        ctx.restore();

        // Enhanced screen glow
        if (screenW > 0 && screenH > 0) {
          ctx.globalAlpha = (Math.max(0, (openAngle - 0.3) / 0.7)) * 0.15;
          const glowGrad = ctx.createRadialGradient(cx, (minY + maxY) / 2, 0, cx, (minY + maxY) / 2, screenW * 0.7);
          glowGrad.addColorStop(0, '#2ecc71');
          glowGrad.addColorStop(0.5, '#27ae60');
          glowGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(minX, minY, screenW, screenH);
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();

      // Keyboard reflection
      if (openAngle > 0.5) {
        ctx.save();
        ctx.globalAlpha = openAngle * 0.12;
        const refGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
        refGrad.addColorStop(0, 'transparent');
        refGrad.addColorStop(0.3, '#2ecc71');
        refGrad.addColorStop(0.7, '#2ecc71');
        refGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = refGrad;
        ctx.fillRect(bx, by, bw, bh);
        ctx.restore();
      }
    };

    resize();
    window.addEventListener('resize', resize);
    
    const resizeObserver = new ResizeObserver(() => {
      if (canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        initFloaters();
      }
    });
    
    if (canvas) {
      resizeObserver.observe(canvas);
    }

    const PHASES = {
      idle: 2000,
      opening: 2600,
      open: 99999,
    };

    const draw = (timestamp) => {
      frameCount++;
      
      if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        animId = requestAnimationFrame(draw);
        return;
      }
      
      if (!stateRef.current.startTime) stateRef.current.startTime = timestamp;
      const elapsed = timestamp - stateRef.current.startTime;
      const s = stateRef.current;

      if (s.phase === 'closed' && elapsed > PHASES.idle) {
        s.phase = 'opening';
        s.phaseStart = timestamp;
      }
      if (s.phase === 'opening') {
        const pElapsed = timestamp - s.phaseStart;
        const raw = Math.min(pElapsed / PHASES.opening, 1);
        s.openAngle = raw < 1
          ? 1 - Math.pow(2, -12 * raw) * Math.cos((raw * 12 - 0.75) * (2 * Math.PI) / 3)
          : 1;
        if (raw >= 0.6 && s.particles.length === 0) {
          const W = canvas.width, H = canvas.height;
          const scale = Math.min(W, H) * 0.00078;
          spawnParticles(W / 2, H / 2 - 70 * scale);
        }
        if (raw >= 1) s.phase = 'open';
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dynamic background
      const bgGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width * 0.8);
      bgGrad.addColorStop(0, 'rgba(8,20,8,0.95)');
      bgGrad.addColorStop(1, 'rgba(2,6,2,0.98)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawGrid(1);

      if (s.floaters && s.floaters.length > 0) {
        s.floaters.forEach(f => {
          f.x += f.vx;
          f.y += f.vy;
          f.phase += f.speed;
          if (f.x < -50) f.x = canvas.width + 50;
          if (f.x > canvas.width + 50) f.x = -50;
          if (f.y < -50) f.y = canvas.height + 50;
          if (f.y > canvas.height + 50) f.y = -50;

          const dx = f.x - mouse.x, dy = f.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120) {
            f.x += (dx / dist) * 2;
            f.y += (dy / dist) * 2;
          }

          const pulse = 0.5 + Math.sin(f.phase) * 0.3;
          ctx.save();
          ctx.globalAlpha = f.alpha * pulse;
          ctx.font = `${f.size}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Glow effect
          ctx.shadowBlur = 12;
          ctx.shadowColor = `rgba(46,204,113,${f.alpha * pulse * 0.6})`;
          
          const ringRadius = Math.max(1, f.size * 0.7);
          ctx.beginPath();
          ctx.arc(f.x, f.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(46,204,113,${f.alpha * pulse * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          
          ctx.fillText(f.icon, f.x, f.y);
          ctx.restore();
        });

        drawConnections(s.floaters, 1, timestamp);
      }

      if (s.particles && s.particles.length > 0) {
        s.particles = s.particles.filter(p => p.life > 0);
        s.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.life -= p.decay;
          
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          const particleRadius = Math.max(0.5, p.size * p.life);
          ctx.beginPath();
          ctx.arc(p.x, p.y, particleRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      drawLaptop(timestamp);

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'auto',
        zIndex: 0,
        filter: 'brightness(1.05) contrast(1.02)',
        ...style,
      }}
    />
  );
}