const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { createBugReport, getBugReports, updateBugReport } = require('../controllers/bugReportController');

// Submit bug report (Any authenticated user)
router.post('/', protect, createBugReport);

// Admin routes
router.get('/', protect, admin, getBugReports);
router.put('/:id', protect, admin, updateBugReport);

module.exports = router;
