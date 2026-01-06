const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        default: 'General Support'
    },
    status: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open'
    },
    messages: [{
        sender: {
            type: String,
            enum: ['user', 'admin'],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        attachment: String, // URL
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    lastMessageAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
