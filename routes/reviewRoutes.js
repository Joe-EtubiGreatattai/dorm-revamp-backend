const express = require('express');
const router = express.Router();
const { submitReview, getVendorReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, submitReview);
router.get('/vendor/:id', getVendorReviews);

module.exports = router;
