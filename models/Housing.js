const mongoose = require('mongoose');

const housingSchema = new mongoose.Schema({
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
    address: String,
    location: {
        lat: Number,
        lng: Number
    },

    bedrooms: Number,
    bathrooms: Number,
    amenities: [String],
    images: [String],

    category: {
        type: String,
        enum: ['Self-Con', 'Flat', 'Roommate', 'Hostel']
    },
    status: {
        type: String,
        enum: ['available', 'rented', 'inactive'],
        default: 'available'
    },

    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
    }],
    rating: {
        type: Number,
        default: 0
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    tourFee: {
        type: Number,
        default: 0
    },
}, { timestamps: true });

module.exports = mongoose.model('Housing', housingSchema);
