const mongoose = require('mongoose');

const electionSchema = mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['upcoming', 'active', 'ended'], default: 'upcoming' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Election creator for fee distribution
    contestantFee: { type: Number, default: 0 }, // Fee to apply as candidate
    positions: [{
        title: { type: String, required: true },
        candidates: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            nickname: String,
            manifesto: String,
            votes: { type: Number, default: 0 }
        }]
    }],
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Election', electionSchema);
