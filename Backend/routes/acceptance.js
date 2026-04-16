const express = require('express');
const router  = express.Router();
const { getAcceptanceData, submitAcceptance, listAcceptances } = require('../controllers/acceptanceController');
const { protect } = require('../middleware/auth');

// Public routes (no auth — employee clicks link in email)
router.get('/:token',        getAcceptanceData);
router.post('/:token/submit', submitAcceptance);

// Protected — IT staff/admin view all responses
router.get('/', protect, listAcceptances);

module.exports = router;
