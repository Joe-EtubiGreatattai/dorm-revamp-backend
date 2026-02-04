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
        enum: ['user', 'admin', 'ambassador'],
        default: 'user'
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    banReason: String,
    banExpires: Date,
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
        messages: { type: Boolean, default: true },
        mentions: { type: Boolean, default: true },
        priceAlerts: { type: Boolean, default: true },
        orderUpdates: { type: Boolean, default: true },
        electionReminders: { type: Boolean, default: true },
        shares: { type: Boolean, default: true }
    },

    // Banking
    bankAccounts: [{
        bankName: String,
        accountNumber: String,
        accountName: String,
        isDefault: { type: Boolean, default: false }
    }],

    // Privacy
    privacySettings: {
        appLock: { type: Boolean, default: false },
        onlineStatus: { type: Boolean, default: true },
        readReceipts: { type: Boolean, default: true }
    },

    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    notInterestedPosts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
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

    // KYC & Identification
    matricNo: {
        type: String,
        // unique: true, // Optional: enforce uniqueness if desired
    },
    walletId: {
        type: String,
        unique: true,
    },
    kycDocument: String, // URL to uploaded ID
    identityNumber: String, // BVN or NIN
    identityType: {
        type: String,
        enum: ['bvn', 'nin']
    },
    kycStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected', 'none'],
        default: 'none'
    },
    // Monetization
    monetizationEnabled: {
        type: Boolean,
        default: false
    },
    totalMonetizationEarnings: {
        type: Number,
        default: 0
    },
    hasClaimedFreeMerch: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
