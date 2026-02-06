const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

const cleanupFollowers = async () => {
    await connectDB();

    try {
        const users = await User.find({});
        console.log(`Analyzing ${users.length} users...`);

        let totalRemoved = 0;
        let totalDeduplicated = 0;

        for (const user of users) {
            let userUpdated = false;

            // 1. Remove Duplicate Followers
            const uniqueFollowers = [];
            const followerMap = new Set();
            let duplicatesFound = 0;

            if (user.followers && user.followers.length > 0) {
                user.followers.forEach(followerId => {
                    const idStr = followerId.toString();
                    if (!followerMap.has(idStr)) {
                        followerMap.add(idStr);
                        uniqueFollowers.push(followerId);
                    } else {
                        duplicatesFound++;
                    }
                });
            }

            if (duplicatesFound > 0) {
                console.log(`User ${user.email}: Found ${duplicatesFound} duplicate followers.`);
                user.followers = uniqueFollowers;
                userUpdated = true;
                totalDeduplicated += duplicatesFound;
            }

            // 2. Remove "Unreal" (Non-existent) Followers
            const validFollowers = [];
            let invalidFound = 0;

            if (user.followers && user.followers.length > 0) {
                for (const followerId of user.followers) {
                    // Optimized: In a massive DB, standard findById inside loop is slow.
                    // But for cleanup script it's acceptable, or we could fetch all valid IDs once if memory allows.
                    // For safety and lower memory, checking individual existence or using cached set of all user IDs is better.
                    // Let's use countDocuments for existence check which is lightweight.
                    const exists = await User.countDocuments({ _id: followerId });

                    if (exists) {
                        validFollowers.push(followerId);
                    } else {
                        console.log(`User ${user.email}: Removing non-existent follower ${followerId}`);
                        invalidFound++;
                    }
                }
            }

            if (invalidFound > 0) {
                user.followers = validFollowers;
                userUpdated = true;
                totalRemoved += invalidFound;
            }

            // 3. (Optional) Check 'following' consistency? 
            // The prompt asked especially for "unreal excess follower", so existence and duplication are the main targets.

            if (userUpdated) {
                await user.save();
                console.log(`Saved updates for ${user.name} (${user.email}).`);
            }
        }

        console.log('-----------------------------------');
        console.log('Cleanup Complete.');
        console.log(`Total duplicate followers removed: ${totalDeduplicated}`);
        console.log(`Total non-existent followers removed: ${totalRemoved}`);

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

cleanupFollowers();
