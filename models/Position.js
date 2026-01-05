const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
    electionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Election',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,

    candidates: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate'
    }],
}, { timestamps: true });

module.exports = mongoose.model('Position', positionSchema);
