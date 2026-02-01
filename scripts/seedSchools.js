require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mongoose = require('mongoose');
const School = require('../models/School');

const seedSchools = async () => {
    try {
        // 1. Database Connection
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 2. Read PDF
        const pdfPath = path.join(__dirname, '..', 'schools.pdf');
        if (!fs.existsSync(pdfPath)) {
            console.error('PDF file not found at:', pdfPath);
            process.exit(1);
        }

        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);

        // 3. Extract and Clean School Names
        // Split by newlines and filter out empty strings/short junk
        const schools = data.text
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 5); // Basic filter to avoid junk headers/footers

        console.log(`Found ${schools.length} potential school names.`);

        // 4. Seed Database
        let count = 0;
        for (const schoolName of schools) {
            try {
                // Check if already exists to avoid unique constraint error
                const exists = await School.findOne({ name: schoolName });
                if (!exists) {
                    await School.create({ name: schoolName });
                    count++;
                }
            } catch (err) {
                console.error(`Error saving school: ${schoolName}`, err.message);
            }
        }

        console.log(`Successfully seeded ${count} new schools.`);
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedSchools();
