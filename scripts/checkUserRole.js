require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const checkUser = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm_revamp';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        // Check the specific ID from the logs
        const id = '69590d4470fc5910b9f90940';
        // Note: The ID in the user prompt seems to be a valid ObjectId format but might be masked/hypothetical or from a previous run. 
        // If it's valid, we check it. If not, we rely on email.
        try {
            const userById = await User.findById(id);
            if (userById) {
                console.log('User found by ID:', { name: userById.name, email: userById.email, role: userById.role });
            } else {
                console.log('No user found with ID:', id);
            }
        } catch (e) {
            console.log('Invalid ID format in script, skipping ID check.');
        }

        const email = 'greatattai442@gmail.com';
        const userByEmail = await User.findOne({ email });
        if (userByEmail) {
            console.log('User found by Email:', { id: userByEmail._id, name: userByEmail.name, email: userByEmail.email, role: userByEmail.role });
        } else {
            console.log('User NOT found by Email:', email);
        }

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkUser();
