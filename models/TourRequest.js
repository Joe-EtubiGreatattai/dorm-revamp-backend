const mongoose = require('mongoose');

const tourRequestSchema = new mongoose.Schema({
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Housing',
        required: true
    },
    requesterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    preferredDate: Date,
    preferredTime: String,
    message: String,

    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'completed', 'paid'],
        default: 'pending'
    },
    meetingPoint: String,
}, { timestamps: true });

module.exports = mongoose.model('TourRequest', tourRequestSchema);
