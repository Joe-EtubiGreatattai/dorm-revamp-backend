const mongoose = require('mongoose');

const marketItemSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    price: {
        type: Number,
        required: true
    },
    category: String,
    type: {
        type: String,
        enum: ['item', 'food', 'service'],
        required: true
    },
    images: [String],

    // Food-specific
    prepTime: String,
    calories: Number,
    dietary: [String],

    // Service-specific
    duration: String,
    platform: String,

    status: {
        type: String,
        enum: ['available', 'sold', 'inactive'],
        default: 'available'
    },
    views: {
        type: Number,
        default: 0
    },
    isFreeMerch: {
        type: Boolean,
        default: false
    },
    stock: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

module.exports = mongoose.model('MarketItem', marketItemSchema);
