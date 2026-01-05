const mongoose = require('mongoose');

const candidateApplicationSchema = new mongoose.Schema({
    electionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Election',
        required: true
    },
    positionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    nickname: String,
    manifesto: {
        type: String,
        required: true
    },
    media: [String], // URLs to images/videos

    // Fee details
    feeAmount: {
        type: Number,
        required: true
    },
    feePaid: {
        type: Boolean,
        default: false
    },

    // Application status
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },

    // Admin response
    reviewedAt: Date,
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectionReason: String
}, {
    timestamps: true
});

// Index for faster queries
candidateApplicationSchema.index({ electionId: 1, userId: 1 });
candidateApplicationSchema.index({ status: 1 });

module.exports = mongoose.model('CandidateApplication', candidateApplicationSchema);
