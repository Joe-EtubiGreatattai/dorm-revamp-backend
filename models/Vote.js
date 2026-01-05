const mongoose = require('mongoose');

const voteSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    electionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Election',
        required: true
    },
    positionId: {
        type: String, // Or ObjectId if we refactor positions to be separate models
        required: true
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Ensure a user can only vote once per position in an election
voteSchema.index({ userId: 1, electionId: 1, positionId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
