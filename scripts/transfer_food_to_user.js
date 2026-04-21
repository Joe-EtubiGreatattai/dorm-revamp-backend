const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
const User = require('../models/User');
const MarketItem = require('../models/MarketItem');

async function transferFood() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const email = 'joeetubigreatattai@gmail.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.error(`User with email ${email} not found`);
            process.exit(1);
        }

        console.log(`Found user: ${user.name} (${user._id})`);

        const allTypes = await MarketItem.distinct('type');
        console.log('Available item types:', allTypes);

        const foodCount = await MarketItem.countDocuments({ type: 'food' });
        console.log('Number of items with type "food":', foodCount);
        
        // Also check for 'Food' capitalized just in case
        const capitalizedFoodCount = await MarketItem.countDocuments({ type: 'Food' });
        console.log('Number of items with type "Food":', capitalizedFoodCount);

        const result = await MarketItem.updateMany(
            { type: { $in: ['food', 'Food'] } },
            { $set: { ownerId: user._id } }
        );

        console.log(`Successfully transferred ${result.modifiedCount} food items to user ${user.name}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

transferFood();
