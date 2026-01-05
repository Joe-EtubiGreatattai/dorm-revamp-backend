const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    targetType: {
        type: String,
        enum: ['housing', 'material'],
        required: true
    },

    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    content: String,
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
