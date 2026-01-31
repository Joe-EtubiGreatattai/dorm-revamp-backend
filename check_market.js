const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';

async function checkDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const MarketItem = mongoose.model('MarketItem', new mongoose.Schema({}, { strict: false }));
        const count = await MarketItem.countDocuments();
        console.log('Total MarketItems:', count);

        const sample = await MarketItem.findOne();
        if (sample) {
            console.log('Sample item:', JSON.stringify(sample, null, 2));
        } else {
            console.log('No items found');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkDB();
