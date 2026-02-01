const mongoose = require('mongoose');
const dotenv = require('dotenv');
const School = require('../models/School');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const universities = [
    'University of Lagos (UNILAG)',
    'University of Ibadan (UI)',
    'Covenant University',
    'Afe Babalola University (ABUAD)',
    'Babcock University',
    'University of Nigeria, Nsukka (UNN)',
    'Obafemi Awolowo University (OAU)',
    'Ahmadu Bello University (ABU)',
    'University of Ilorin (UNILORIN)',
    'Landmark University',
    'Lagos State University (LASU)',
    'Pan-Atlantic University',
    'Rivers State University',
    'Federal University of Technology, Akure (FUTA)',
    'Federal University of Technology, Minna (FUTMINNA)',
    'University of Benin (UNIBEN)',
    'Nnamdi Azikiwe University (UNIZIK)',
    'Bayero University Kano (BUK)',
    'University of Port Harcourt (UNIPORT)',
    'Bowen University',
    'Federal University Lokoja (FULOKOJA)',
    'University of Abuja (UNIABUJA)',
];

const seedSchools = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB for seeding...');

        // Clear existing schools
        await School.deleteMany({});
        console.log('Cleared existing schools.');

        // Insert new schools
        const schoolData = universities.map(name => ({ name }));
        await School.insertMany(schoolData);
        console.log(`Successfully seeded ${schoolData.length} schools.`);

        mongoose.connection.close();
    } catch (error) {
        console.error('Error seeding schools:', error);
        process.exit(1);
    }
};

seedSchools();
