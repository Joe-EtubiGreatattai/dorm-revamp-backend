const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
    createRestriction,
    getMyRestrictions,
    getAllRestrictions,
    deleteRestriction
} = require('../controllers/restrictionController');

// Public/Private routes
router.get('/my', protect, getMyRestrictions);

// Admin routes
router.post('/', protect, admin, createRestriction);
router.get('/', protect, admin, getAllRestrictions);
router.delete('/:id', protect, admin, deleteRestriction);

module.exports = router;
