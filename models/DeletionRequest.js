const mongoose = require('mongoose');

const deletionRequestSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processed'],
        default: 'pending'
    },
    requestedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('DeletionRequest', deletionRequestSchema);
