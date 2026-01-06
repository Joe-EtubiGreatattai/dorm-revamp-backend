const mongoose = require('mongoose');

const bugReportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String,
        required: true
    },
    attachments: [{
        type: String // URL to cloud storage
    }],
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    adminNotes: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('BugReport', bugReportSchema);
