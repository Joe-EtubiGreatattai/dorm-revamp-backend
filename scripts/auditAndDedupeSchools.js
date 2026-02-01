require('dotenv').config();
const mongoose = require('mongoose');
const School = require('../models/School');
const User = require('../models/User');

const normalizeString = (str) => {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const auditAndDedupeSchools = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        let allSchools = await School.find({});
        console.log(`Auditing ${allSchools.length} schools with fuzzy matching...`);

        let mergedCount = 0;

        // Sorting by length descending so we compare longer names against shorter ones
        allSchools.sort((a, b) => b.name.length - a.name.length);

        for (let i = 0; i < allSchools.length; i++) {
            const schoolA = allSchools[i];
            if (!schoolA) continue; // Already merged/deleted

            const normA = normalizeString(schoolA.name);

            for (let j = i + 1; j < allSchools.length; j++) {
                const schoolB = allSchools[j];
                if (!schoolB) continue;

                const normB = normalizeString(schoolB.name);

                // If one contains the other and they are "long enough" to be meaningful
                // or if they are both about the same thing
                if (normA.includes(normB) || normB.includes(normA)) {
                    // Pick the longer one as the winner
                    const winner = normA.length >= normB.length ? schoolA : schoolB;
                    const loser = normA.length >= normB.length ? schoolB : schoolA;

                    console.log(`\n💎 Matching: "${winner.name}" matches "${loser.name}"`);
                    console.log(`🗑️ Merging "${loser.name}" into "${winner.name}"`);

                    // Update users
                    const userUpdate = await User.updateMany(
                        { $or: [{ university: loser.name }, { school: loser.name }] },
                        { $set: { university: winner.name, school: winner.name } }
                    );

                    if (userUpdate.modifiedCount > 0) {
                        console.log(`   ➡️ Updated ${userUpdate.modifiedCount} users.`);
                    }

                    // Delete the duplicate
                    await School.deleteOne({ _id: loser._id });

                    // Remove from our loop array
                    if (winner === schoolA) {
                        allSchools[j] = null;
                    } else {
                        // This case shouldn't happen with our sort, but for safety:
                        allSchools[i] = null;
                        break;
                    }
                    mergedCount++;
                }
            }
        }

        console.log(`\nCleanup Finished:`);
        console.log(`✅ Merged/Deleted ${mergedCount} duplicate entries.`);
        console.log(`✨ Total schools now: ${214 - mergedCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Audit failed:', error);
        process.exit(1);
    }
};

auditAndDedupeSchools();
