const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

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
        enum: ['text', 'image', 'voice', 'file', 'market_item'],
        default: 'text'
    },
    marketItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketItem',
        default: null
    },
    mediaUrl: String,

    // Advanced Features
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    isDelivered: {
        type: Boolean,
        default: false
    },
    reactions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        emoji: String
    }],

    isRead: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

// Encryption Hook
messageSchema.pre('save', async function () {
    if (this.isModified('content') && this.type === 'text') {
        this.content = encrypt(this.content);
    }
});

// Decryption Hooks
messageSchema.post('init', function (doc) {
    if (doc.content && doc.type === 'text') {
        doc.content = decrypt(doc.content);
    }
});

messageSchema.post('save', function (doc) {
    if (doc.content && doc.type === 'text') {
        doc.content = decrypt(doc.content);
    }
});

// Ensure decrypted content is returned in JSON
messageSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.content && ret.type === 'text') {
            ret.content = decrypt(ret.content);
        }
        return ret;
    }
});

module.exports = mongoose.model('Message', messageSchema);
