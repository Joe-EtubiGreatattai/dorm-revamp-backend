const express = require('express');
const router = express.Router();
const { summarizeDocument, generateCBT, generateCBTReport, updateAISettings } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.post('/summarize', protect, summarizeDocument);
router.post('/generate-cbt', protect, generateCBT);
router.post('/cbt-report', protect, generateCBTReport);
router.put('/settings', protect, updateAISettings);

module.exports = router;
