const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    type: {
        type: String,
        enum: ['individual', 'group'],
        default: 'individual'
    },
    groupMetadata: {
        name: String,
        avatar: String,
        description: String
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    lastMessage: {
        type: String,
        default: ''
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Encryption Hook
conversationSchema.pre('save', async function () {
    if (this.isModified('lastMessage')) {
        this.lastMessage = encrypt(this.lastMessage);
    }
});

// Decryption Hooks
conversationSchema.post('init', function (doc) {
    if (doc.lastMessage) {
        doc.lastMessage = decrypt(doc.lastMessage);
    }
});

conversationSchema.post('save', function (doc) {
    if (doc.lastMessage) {
        doc.lastMessage = decrypt(doc.lastMessage);
    }
});

module.exports = mongoose.model('Conversation', conversationSchema);
