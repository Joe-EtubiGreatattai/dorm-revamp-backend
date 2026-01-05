const mongoose = require('mongoose');

const electionNewsSchema = mongoose.Schema({
    title: { type: String, required: true },
    summary: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String },
    date: { type: String, default: () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
}, {
    timestamps: true
});

module.exports = mongoose.model('ElectionNews', electionNewsSchema);
