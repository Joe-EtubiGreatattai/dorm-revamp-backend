const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    positionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Position',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    name: String,
    manifesto: String,
    avatar: String,
    media: [String],

    votes: {
        type: Number,
        default: 0
    },
}, { timestamps: true });

module.exports = mongoose.model('Candidate', candidateSchema);
