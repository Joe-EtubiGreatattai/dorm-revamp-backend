require('dotenv').config();
const mongoose = require('mongoose');
const School = require('../models/School');

const findLokojaSchools = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
        await mongoose.connect(MONGODB_URI);
        const schools = await School.find({ name: { $regex: /Lokoja/i } });
        console.log('Found Schools:');
        schools.forEach(s => console.log(`- ID: ${s._id}, Name: "${s.name}"`));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

findLokojaSchools();
