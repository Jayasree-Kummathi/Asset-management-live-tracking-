// routes/chatbot.js
const express = require('express');
const router  = express.Router();
const { getContext, search, ask } = require('../controllers/chatbotController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/context', getContext);   // GET /api/chatbot/context?page=inventory
router.get('/search',  search);       // GET /api/chatbot/search?q=varsha
router.post('/ask',    ask);          // POST /api/chatbot/ask

module.exports = router;