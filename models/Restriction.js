const mongoose = require('mongoose');

const restrictionSchema = new mongoose.Schema({
    tab: {
        type: String,
        required: true,
        enum: ['market', 'housing', 'library', 'voting', 'feed']
    },
    scope: {
        type: String,
        required: true,
        enum: ['global', 'school', 'user'],
        default: 'global'
    },
    targetId: {
        type: mongoose.Schema.Types.Mixed, // Can be ObjectId for users or String for schools
        default: null
    },
    filters: {
        type: Object,
        default: {}
    },
    reason: {
        type: String,
        default: 'This feature is currently under maintenance.'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Prevent duplicate active restrictions for same tab/scope/target
restrictionSchema.index({ tab: 1, scope: 1, targetId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('Restriction', restrictionSchema);
