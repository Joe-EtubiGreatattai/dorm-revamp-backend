const express = require('express');
const router = express.Router();
const {
    getElections,
    getElection,
    createElection,
    getNews,
    getNewsItem,
    vote,
    getResults,
    getPosition,
    getCandidate,
    applyForPosition,
    getApplications,
    approveApplication,
    rejectApplication
} = require('../controllers/electionController');
const { protect, admin, optionalProtect } = require('../middleware/authMiddleware');

router.get('/', optionalProtect, getElections);
router.get('/news', optionalProtect, getNews);
router.get('/news/:id', optionalProtect, getNewsItem);
router.get('/positions/:id', optionalProtect, getPosition);
router.get('/candidates/:id', optionalProtect, getCandidate);
router.get('/:id', optionalProtect, getElection);
router.get('/:id/results', optionalProtect, getResults);
router.post('/', protect, createElection);
router.post('/:id/vote', protect, vote);

// Candidate application routes
router.post('/:id/positions/:positionId/apply', protect, applyForPosition);
router.get('/:id/applications', protect, getApplications);
router.patch('/applications/:applicationId/approve', protect, approveApplication);
router.patch('/applications/:applicationId/reject', protect, rejectApplication);

module.exports = router;
