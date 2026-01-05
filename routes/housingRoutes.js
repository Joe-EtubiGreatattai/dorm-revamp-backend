const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware'); // Import upload middleware
const {
    getListings,
    getListing,
    createListing,
    updateListing,
    deleteListing,
    requestTour,
    createReview
} = require('../controllers/housingController');
const { protect } = require('../middleware/authMiddleware');

router.get('/listings', getListings);
router.get('/listings/:id', getListing);
router.post('/listings', protect, upload.array('images', 5), createListing);
router.put('/listings/:id', protect, updateListing);
router.delete('/listings/:id', protect, deleteListing);
router.post('/listings/:id/tour', protect, requestTour);
router.post('/listings/:id/review', protect, createReview);

module.exports = router;
