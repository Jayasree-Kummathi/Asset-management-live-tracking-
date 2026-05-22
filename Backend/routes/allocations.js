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
} = require('../controllers/allocationController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ── Static / non-parameterised routes first ───────────────────────────────────
router.route('/')
  .get(getAllocations)
  .post(authorize('admin', 'it_staff'), allocateLaptop);

router.get('/my', getMyAllocation);

// ── Parameterised sub-resource routes (must come before /:id) ─────────────────
router.put( '/:id/receive',          authorize('admin', 'it_staff'), receiveLaptop);
router.put( '/:id/swap',             authorize('admin', 'it_staff'), swapLaptop);
router.post('/:id/send-audit-email', authorize('admin', 'it_staff'), sendAuditEmail);

// ── Generic /:id last — catches everything else ───────────────────────────────
router.get('/:id', getAllocation);

module.exports = router;