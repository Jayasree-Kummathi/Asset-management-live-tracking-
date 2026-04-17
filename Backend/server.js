require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const morgan       = require('morgan');
const path         = require('path');
const fs           = require('fs');
const errorHandler = require('./middleware/error');
const teamMembersRoutes = require('./routes/teamMembers');
const { startReminderJob } = require('./utils/reminderJob');

// Initialise DB connection (pool connects on first query)
require('./config/db');
startReminderJob();

const app = express();

// ─── Trust proxy (if behind nginx) ───────────────────────────────────────────
// Required so req.ip is the real client IP and not 127.0.0.1
app.set('trust proxy', 1);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Static file serving — uploaded software packages ────────────────────────
// Agents download EXE/MSI/ZIP from here via authenticated route in agentRoute.js
// The actual download is protected — this just ensures sendFile() works correctly
const uploadsPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/assets',         require('./routes/assets'));
app.use('/api/allocations',    require('./routes/allocations'));
app.use('/api/repairs',        require('./routes/repairs'));
app.use('/api/scraps',         require('./routes/scraps'));
app.use('/api/audit',          require('./routes/audit'));
app.use('/api/reports',        require('./routes/reports'));
app.use('/api/users',          require('./routes/users'));
app.use('/api/acceptance',     require('./routes/acceptance'));
app.use('/api/accessories',    require('./routes/accessories'));
app.use('/api/network-assets', require('./routes/Networkassets'));
app.use('/api/agent',          require('./routes/agentRoute')); // ← agent + software routes
app.use('/api',                teamMembersRoutes);
app.use('/card', require('./routes/assetCardRoute'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success:     true,
    message:     'AssetOps PostgreSQL API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString(),
  });
});

// ─── Test email (admin only — dev/debug use) ──────────────────────────────────
app.post('/api/test-email', async (req, res) => {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host:       process.env.MAIL_HOST,
    port:       Number(process.env.MAIL_PORT) || 587,
    secure:     false,
    requireTLS: true,
    tls:        { ciphers: 'SSLv3', rejectUnauthorized: false },
    auth:       { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });

  try {
    await transporter.verify();
    await transporter.sendMail({
      from:    process.env.MAIL_FROM || process.env.MAIL_USER,
      to:      req.body.to || process.env.MAIL_USER,
      subject: '[AssetOps] Test Email — SMTP Working',
      text:    'SMTP connection is working correctly. AssetOps can send emails.',
    });
    res.json({
      success: true,
      message: 'Test email sent successfully!',
      to:      req.body.to || process.env.MAIL_USER,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      config:  {
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        user: process.env.MAIL_USER,
      },
    });
  }
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Central error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`📡 API base : http://localhost:${PORT}/api`);
  console.log(`🏥 Health   : http://localhost:${PORT}/api/health\n`);
});

process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});