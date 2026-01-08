const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

const seedDatabase = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm_revamp';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const targetEmail = 'greatattai442@gmail.com';
        const targetUser = await User.findOne({ email: targetEmail });

        if (!targetUser) {
            console.error(`Target user ${targetEmail} not found. Please register first.`);
            process.exit(1);
        }

        console.log(`Found target user: ${targetUser.name} (${targetUser._id})`);

        const totalUsers = 1500;
        const followerCount = 1300;
        const usersToCreate = [];
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        const universities = [
            'Federal University of Technology, Akure',
            'University of Lagos',
            'Obafemi Awolowo University',
            'University of Ibadan',
            'Covenant University'
        ];

        console.log(`Generating ${totalUsers} users...`);

        for (let i = 0; i < totalUsers; i++) {
            const university = Math.random() < 0.8 ? universities[0] : universities[Math.floor(Math.random() * (universities.length - 1)) + 1];

            usersToCreate.push({
                name: `Test User ${i + 1}`,
                email: `testuser${i + 1 + Date.now()}@example.com`,
                password: hashedPassword,
                university: university,
                walletId: `WID${crypto.randomInt(10000000, 99999999)}${i}`,
                isVerified: true,
                kycStatus: 'verified'
            });

            if (i % 100 === 0) console.log(`Generated ${i} user objects...`);
        }

        console.log('Bulk inserting users (this may take a moment)...');
        const insertedUsers = await User.insertMany(usersToCreate);
        console.log(`Successfully inserted ${insertedUsers.length} users.`);

        const insertedIds = insertedUsers.map(u => u._id);
        const followerIds = insertedIds.slice(0, followerCount);

        console.log(`Updating ${followerCount} users to follow ${targetEmail}...`);

        // 1. Add target user to these users' "following" array
        await User.updateMany(
            { _id: { $in: followerIds } },
            { $push: { following: targetUser._id } }
        );

        // 2. Add these users to target user's "followers" array
        targetUser.followers = [...new Set([...targetUser.followers, ...followerIds])];

        // Check if target user now has enough followers for monetization
        if (targetUser.followers.length >= 1000) {
            targetUser.monetizationEnabled = true;
        }

        await targetUser.save();

        console.log('Seeding completed successfully!');
        console.log(`Target user now has ${targetUser.followers.length} followers.`);
        process.exit(0);

    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
