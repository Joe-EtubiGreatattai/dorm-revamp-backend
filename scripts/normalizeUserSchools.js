require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const School = require('../models/School');

const normalizeString = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ') // Replace punctuation with space
        .replace(/\s+/g, ' ')       // Normalize spaces
        .trim();
};

const normalizeUserSchools = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Get all official schools
        const officialSchools = await School.find({});
        console.log(`Loaded ${officialSchools.length} official schools.`);

        // 2. Get all users
        const users = await User.find({});
        console.log(`Auditing ${users.length} users...`);

        let updatedCount = 0;
        let skippedCount = 0;
        let manualReviewCount = 0;

        for (const user of users) {
            const currentSchool = user.university || user.school;
            if (!currentSchool) {
                skippedCount++;
                continue;
            }

            const normCurrent = normalizeString(currentSchool);

            // Try to find a match where one normalized name contains the other or they are equal
            let bestMatch = null;

            // Priority 1: Exact normalized match
            bestMatch = officialSchools.find(s => normalizeString(s.name) === normCurrent);

            // Priority 2: Substring match (if current school is a notable part of our official record)
            if (!bestMatch) {
                bestMatch = officialSchools.find(s => {
                    const normOfficial = normalizeString(s.name);
                    // Avoid matching very short strings to avoid false positives
                    if (normCurrent.length < 4) return false;
                    return normOfficial.includes(normCurrent) || normCurrent.includes(normOfficial);
                });
            }

            if (bestMatch) {
                if (user.university !== bestMatch.name) {
                    console.log(`✨ Normalizing: "${currentSchool}" -> "${bestMatch.name}" (${user.email})`);
                    user.university = bestMatch.name;
                    user.school = bestMatch.name;
                    await user.save();
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                console.log(`❌ No match found for: "${currentSchool}" (User: ${user.email})`);
                manualReviewCount++;
            }
        }

        console.log(`\nFinal Results:`);
        console.log(`✅ ${updatedCount} users updated.`);
        console.log(`ℹ️ ${skippedCount} users already matched or had no school.`);
        console.log(`❓ ${manualReviewCount} users could not be automatically matched.`);

        process.exit(0);
    } catch (error) {
        console.error('Normalization failed:', error);
        process.exit(1);
    }
};

normalizeUserSchools();
