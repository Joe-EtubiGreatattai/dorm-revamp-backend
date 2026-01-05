require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const makeAdmin = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm_revamp';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        const email = process.argv[2];
        if (!email) {
            console.log('Please provide an email address as argument');
            process.exit(1);
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found');
            process.exit(1);
        }

        user.role = 'admin';
        await user.save();
        console.log(`User ${user.name} (${user.email}) is now an Admin`);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

makeAdmin();
