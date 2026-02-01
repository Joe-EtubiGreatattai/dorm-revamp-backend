require('dotenv').config();
const mongoose = require('mongoose');
const School = require('../models/School');
const User = require('../models/User');

const deduplicateLokoja = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const correctName = "Federal University Lokoja (FULOKOJA)";
        const duplicateName = "Federal University Lokoja, Kogi";

        // 1. Double check they both exist
        const correctSchool = await School.findOne({ name: correctName });
        const duplicateSchool = await School.findOne({ name: duplicateName });

        if (!correctSchool) {
            console.error(`Error: Correct school "${correctName}" not found!`);
            process.exit(1);
        }

        if (duplicateSchool) {
            console.log(`Deleting duplicate: "${duplicateName}"`);

            // 2. Just in case, update any users still pointing to the duplicate
            const updatedUsers = await User.updateMany(
                { $or: [{ university: duplicateName }, { school: duplicateName }] },
                { $set: { university: correctName, school: correctName } }
            );
            console.log(`Updated ${updatedUsers.modifiedCount} users to the correct school name.`);

            // 3. Delete the duplicate school record
            await School.deleteOne({ _id: duplicateSchool._id });
            console.log(`✅ Successfully deleted duplicate school record.`);
        } else {
            console.log(`Duplicate school "${duplicateName}" not found. It might have been handled already.`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Deduplication failed:', error);
        process.exit(1);
    }
};

deduplicateLokoja();
