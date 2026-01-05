require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const ensureAdmin = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm_revamp';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        const email = process.argv[2];
        const password = process.argv[3];

        if (!email || !password) {
            console.log('Usage: node ensureAdmin.js <email> <password>');
            process.exit(1);
        }

        let user = await User.findOne({ email });

        if (user) {
            console.log('User found. Updating role to Admin...');
            user.role = 'admin';
            // Optionally update password if you want me to force it, 
            // but usually we might just update role. 
            // Given the user prompt "password is qwerty", I should probably ensure the password matches.
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            await user.save();
            console.log('User upgraded to Admin and password updated.');
        } else {
            console.log('User not found. Creating new Admin user...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            user = await User.create({
                name: 'Great Attai', // Default name
                email,
                password: hashedPassword,
                role: 'admin',
                university: 'Admin University',
                isVerified: true
            });
            console.log('New Admin user created.');
        }

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

ensureAdmin();
