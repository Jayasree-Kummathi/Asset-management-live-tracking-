'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Backend/routes/agentRoute.js
// ─────────────────────────────────────────────────────────────────────────────

const express  = require('express');
const router   = express.Router();
const agent    = require('../controllers/agentController');
const software = require('../controllers/softwareController');

// ── Use "protect" — matches your existing auth middleware export name ─────────
const { protect } = require('../middleware/auth');

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ── Public — agent EXE calls these (no JWT, uses device_key) ─────────────────
router.post('/register',     agent.registerDevice);
router.post('/report',       agent.receiveReport);
router.post('/activity', agent.receiveActivity);
router.get('/verify-token',  agent.verifyInstallToken);  // one-time install token

// ── Agent polling — software push (no JWT, device_key auth inside controller) ─
router.get('/pending-tasks', software.getPendingTasks);
router.post('/task-result',  software.reportTaskResult);
router.get('/download/:id',  software.downloadSoftware);

// ── Admin — live tracking ─────────────────────────────────────────────────────
router.get('/locations',                      protect, adminOnly, agent.getAllLocations);
router.get('/locations/:assetId/history',     protect, adminOnly, agent.getLocationHistory);

// ── Admin — agent management ──────────────────────────────────────────────────
router.get('/registrations',                  protect, adminOnly, agent.getRegistrations);
router.put('/registrations/:id/assign',       protect, adminOnly, agent.assignAsset);
router.put('/registrations/:id/toggle',       protect, adminOnly, agent.toggleAgent);
router.post('/generate-token',                protect, adminOnly, agent.generateInstallToken);

// ── Admin — software push ─────────────────────────────────────────────────────
router.get('/software',                       protect, adminOnly, software.listSoftware);
router.post('/software',                      protect, adminOnly, software.upload.single('file'), software.uploadSoftware);
router.post('/software/:id/push',             protect, adminOnly, software.pushSoftware);
router.get('/software/:id/status',            protect, adminOnly, software.getPushStatus);
router.delete('/software/:id',                protect, adminOnly, software.deleteSoftware);

module.exports = router;