const Review = require('../models/Review');
const User = require('../models/User');

// @desc    Submit a review
// @route   POST /api/reviews
// @access  Private
const submitReview = async (req, res) => {
    try {
        const { targetId, targetType, rating, content } = req.body;

        if (!targetId || !targetType || !rating) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if user already reviewed this target
        const existingReview = await Review.findOne({
            userId: req.user._id,
            targetId,
            targetType
        });

        if (existingReview) {
            existingReview.rating = rating;
            existingReview.content = content;
            await existingReview.save();
            return res.json(existingReview);
        }

        const review = await Review.create({
            userId: req.user._id,
            targetId,
            targetType,
            rating,
            content
        });

        res.status(201).json(review);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get reviews for a vendor
// @route   GET /api/reviews/vendor/:id
// @access  Public
const getVendorReviews = async (req, res) => {
    try {
        const reviews = await Review.find({
            targetId: req.params.id,
            targetType: 'vendor'
        }).populate('userId', 'name avatar');

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    submitReview,
    getVendorReviews
};
