const mongoose = require('mongoose');

const cbtSchema = mongoose.Schema({
    title: { type: String, required: true },
    courseCode: { type: String, required: true },
    duration: { type: Number, required: true }, // in minutes
    questions: [{
        question: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswer: { type: Number, required: true }, // Index of correct option (0-3)
        explanation: { type: String }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    isGenerated: { type: Boolean, default: false }
}, {
    timestamps: true
});

module.exports = mongoose.model('CBT', cbtSchema);
