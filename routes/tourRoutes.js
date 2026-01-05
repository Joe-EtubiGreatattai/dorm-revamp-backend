const express = require('express');
const router = express.Router();
const {
    getTours,
    getTour,
    acceptTour,
    declineTour,
    completeTour,
    payRent
} = require('../controllers/tourController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getTours);
router.get('/:id', protect, getTour);
router.put('/:id/accept', protect, acceptTour);
router.put('/:id/decline', protect, declineTour);
router.put('/:id/complete', protect, completeTour);
router.post('/:id/pay', protect, payRent);

module.exports = router;
