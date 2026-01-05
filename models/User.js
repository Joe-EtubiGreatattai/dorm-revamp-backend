const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        required: true,
    },
    university: String,
    school: String,
    avatar: String,
    bio: String,
    dateOfBirth: Date,
    phoneNumber: String,

    // Notifications
    pushTokens: [{
        type: String // Array of Expo Push Tokens
    }],
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // Wallet
    walletBalance: {
        type: Number,
        default: 0,
    },
    escrowBalance: {
        type: Number,
        default: 0,
    },

    // Social
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Settings
    notificationSettings: {
        likes: { type: Boolean, default: true },
        comments: { type: Boolean, default: true },
        follows: { type: Boolean, default: true },
        messages: { type: Boolean, default: true }
    },

    // Banking
    bankAccounts: [{
        bankName: String,
        accountNumber: String,
        accountName: String,
        isDefault: { type: Boolean, default: false }
    }],

    // Online Status
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },

    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpire: Date,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
