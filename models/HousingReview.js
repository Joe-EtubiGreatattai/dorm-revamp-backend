const mongoose = require('mongoose');

const housingReviewSchema = new mongoose.Schema({
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Housing',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('HousingReview', housingReviewSchema);
