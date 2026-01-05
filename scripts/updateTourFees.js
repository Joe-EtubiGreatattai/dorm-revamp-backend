const mongoose = require('mongoose');
const Housing = require('../models/Housing');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const updateTourFees = async () => {
    try {
        console.log('🚀 [MIGRATION] Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ [MIGRATION] Connected.');

        const listings = await Housing.find({});
        console.log(`🔍 [MIGRATION] Found ${listings.length} listings to update.`);

        let updatedCount = 0;
        for (const listing of listings) {
            // Set tourFee to 2% of price, capped at 5% (obviously)
            // Rounded to nearest 100
            const calculatedFee = Math.round((listing.price * 0.02) / 100) * 100;

            listing.tourFee = calculatedFee;
            await listing.save();
            updatedCount++;
            console.log(`✅ [MIGRATION] Updated "${listing.title}": Price=₦${listing.price.toLocaleString()}, Tour Fee=₦${calculatedFee.toLocaleString()}`);
        }

        console.log(`\n✨ [MIGRATION] Successfully updated ${updatedCount} listings.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ [MIGRATION] Error:', error);
        process.exit(1);
    }
};

updateTourFees();
