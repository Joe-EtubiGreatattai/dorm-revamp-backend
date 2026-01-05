const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: String,
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    content: String,
    type: {
        type: String,
        enum: ['text', 'image', 'voice', 'file'],
        default: 'text'
    },
    mediaUrl: String,

    isRead: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
