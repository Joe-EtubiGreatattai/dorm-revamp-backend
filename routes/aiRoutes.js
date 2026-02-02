const express = require('express');
const router = express.Router();
const { summarizeDocument, generateCBT } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.post('/summarize', protect, summarizeDocument);
router.post('/generate-cbt', protect, generateCBT);

module.exports = router;
