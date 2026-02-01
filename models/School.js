const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    shortName: {
        type: String,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('School', schoolSchema);
