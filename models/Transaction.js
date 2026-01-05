const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['topup', 'withdrawal', 'escrow_hold', 'escrow_release', 'rent_payment', 'rent_receive', 'tour_payment', 'tour_receive'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    paymentMethod: String,
    bankDetails: {
        account: String,
        bank: String,
        accountName: String,
    },
    marketItemId: String, // Optional: relating to a specific purchase
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
