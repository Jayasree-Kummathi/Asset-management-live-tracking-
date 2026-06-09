'use strict';
const express = require('express');
const router  = express.Router();

const {
  getAllocations,
  getAllocation,
  allocateLaptop,
  receiveLaptop,
  swapLaptop,
  getMyAllocation,
  sendAuditEmail,
  sendBulkAuditEmail,          // ← added
} = require('../controllers/allocationController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect); // applies to every route below — no need to repeat it

// ── Static / non-parameterised routes first ───────────────────────────────────
router.route('/')
  .get(getAllocations)
  .post(authorize('superadmin', 'admin', 'it_staff'), allocateLaptop);

router.get('/my', getMyAllocation);

// ── Bulk audit — must be before /:id so Express doesn't treat "bulk" as an ID ─
router.post(
  '/send-audit-email/bulk',
  authorize('superadmin', 'admin', 'it_staff'),
  sendBulkAuditEmail
);

// ── Parameterised sub-resource routes ────────────────────────────────────────
router.put( '/:id/receive',          authorize('superadmin', 'admin', 'it_staff'), receiveLaptop);
router.put( '/:id/swap',             authorize('superadmin', 'admin', 'it_staff'), swapLaptop);
router.post('/:id/send-audit-email', authorize('superadmin', 'admin', 'it_staff'), sendAuditEmail);

// ── Generic /:id last ─────────────────────────────────────────────────────────
router.get('/:id', getAllocation);

module.exports = router;