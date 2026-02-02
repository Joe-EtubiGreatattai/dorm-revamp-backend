const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketItem',
        required: true
    },

    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipping', 'delivered', 'cancelled'],
        default: 'pending'
    },

    // Escrow
    escrowStatus: {
        type: String,
        enum: ['held', 'released'],
        default: 'held'
    },
    escrowAmount: Number,

    deliveryAddress: String,
    estimatedDelivery: Date,

    // ETA for tracking
    eta: {
        type: String,
        default: 'Calculating...'
    },
    pickupPoint: String,
    isFreeMerchOrder: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
