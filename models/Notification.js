const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['like', 'comment', 'follow', 'message', 'mention', 'tour', 'order',
            'candidate_application', 'application_approved', 'application_rejected',
            'vote_cast', 'election_created', 'withdrawal_approved', 'withdrawal_rejected'],
        required: true
    },

    fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    relatedId: String,

    title: String,
    message: String,

    isRead: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
