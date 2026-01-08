const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

const addFollowers = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm_revamp';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const targetEmail = process.argv[2] || 'joeetubigreatattai@gmail.com';
        const targetUser = await User.findOne({ email: targetEmail });

        if (!targetUser) {
            console.error(`Target user ${targetEmail} not found. Please register first.`);
            process.exit(1);
        }

        console.log(`Found target user: ${targetUser.name} (${targetUser._id})`);

        // Get 1300 test users (from the ones we seeded earlier)
        const testUsers = await User.find({ email: /testuser.*@example\.com/ }).limit(1300);

        if (testUsers.length < 1300) {
            console.warn(`Only found ${testUsers.length} test users. Will proceed with those.`);
        }

        const followerIds = testUsers.map(u => u._id);

        console.log(`Updating ${followerIds.length} users to follow ${targetEmail}...`);

        // 1. Add target user to these users' "following" array if not already there
        await User.updateMany(
            { _id: { $in: followerIds } },
            { $addToSet: { following: targetUser._id } }
        );

        // 2. Add these users to target user's "followers" array using $addToSet to avoid duplicates
        await User.findByIdAndUpdate(targetUser._id, {
            $addToSet: { followers: { $each: followerIds } }
        });

        // Refetch to check count
        const updatedUser = await User.findById(targetUser._id);

        // Automatically enable monetization if reached 1000
        if (updatedUser.followers.length >= 1000 && !updatedUser.monetizationEnabled) {
            updatedUser.monetizationEnabled = true;
            await updatedUser.save();
            console.log('Monetization enabled for user!');
        }

        console.log('Followers added successfully!');
        console.log(`Target user now has ${updatedUser.followers.length} followers.`);
        process.exit(0);

    } catch (error) {
        console.error('Error adding followers:', error);
        process.exit(1);
    }
};

addFollowers();
