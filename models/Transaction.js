const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['topup', 'withdrawal', 'escrow_hold', 'escrow_release', 'rent_payment', 'rent_receive', 'tour_payment', 'tour_receive', 'transfer_in', 'transfer_out', 'contestant_fee', 'monetization_like', 'monetization_comment'],
        required: true,
    },
    relatedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'pending_acceptance', 'rejected'],
        default: 'pending',
    },
    paymentMethod: String,
    bankDetails: {
        account: String,
        bank: String,
        accountName: String,
    },
    marketItemId: String, // Optional: relating to a specific purchase
    pairingId: {
        type: String,
        description: 'Links an outgoing transfer to its corresponding incoming record'
    },
    reference: {
        type: String,
        unique: true,
        sparse: true // Only required for external payments
    }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
