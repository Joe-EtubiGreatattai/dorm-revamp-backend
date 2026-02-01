require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const cleanupTestUsers = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Identify test users:
        // 1. Name starts with "Test"
        // 2. Email contains "testuser" or ends with "@example.com"
        const query = {
            $or: [
                { name: { $regex: /^Test/i } },
                { email: { $regex: /testuser/i } },
                { email: { $regex: /@example\.com$/i } }
            ]
        };

        const testUsers = await User.find(query);
        console.log(`Found ${testUsers.length} test users to delete.`);

        if (testUsers.length > 0) {
            const result = await User.deleteMany(query);
            console.log(`Successfully deleted ${result.deletedCount} test users.`);
        } else {
            console.log('No test users found.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
};

cleanupTestUsers();
