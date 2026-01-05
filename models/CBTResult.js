const mongoose = require('mongoose');

const cbtResultSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cbt: { type: mongoose.Schema.Types.ObjectId, ref: 'CBT', required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    timeSpent: { type: Number }, // in seconds
    answers: [{
        questionIndex: Number,
        selectedOption: Number,
        isCorrect: Boolean
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('CBTResult', cbtResultSchema);
