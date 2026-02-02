const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
    uploaderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    course: String,
    faculty: String,
    department: String,
    level: String,
    university: String,

    fileUrl: String,
    fileId: String,
    fileType: {
        type: String,
        enum: ['pdf', 'doc', 'ppt', 'video']
    },
    fileSize: Number,
    coverUrl: String,
    content: String,

    category: {
        type: String,
        enum: ['notes', 'past-questions', 'textbook', 'video']
    },

    downloads: {
        type: Number,
        default: 0
    },
    views: {
        type: Number,
        default: 0
    },
    saves: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    downloaders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review'
    }],
    rating: {
        type: Number,
        default: 0
    },

    isVerified: {
        type: Boolean,
        default: false
    },
    aiSummary: String,
}, { timestamps: true });

module.exports = mongoose.model('Material', materialSchema);
