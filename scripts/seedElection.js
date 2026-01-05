require('dotenv').config();
const mongoose = require('mongoose');
const ElectionNews = require('../models/ElectionNews');
const Election = require('../models/Election');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Seed News
        const newsCount = await ElectionNews.countDocuments();
        if (newsCount === 0) {
            await ElectionNews.create([
                {
                    title: 'SUG Presidential Debate Tomorrow',
                    summary: 'Candidates will face off in the main auditorium to discuss their manifestos.',
                    content: 'Full details about the debate including time and venue.',
                    image: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&q=80'
                },
                {
                    title: 'Voter Registration Ends in 48 Hours',
                    summary: 'Ensure your student ID is verified to participate in the upcoming elections.',
                    content: 'Login to your portal to check your verification status.',
                    image: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&q=80'
                }
            ]);
            console.log('Seed news created');
        }

        // Seed an Election if none exists
        const electionCount = await Election.countDocuments();
        if (electionCount === 0) {
            await Election.create({
                title: 'SUG General Elections 2026',
                description: 'Annual election for Student Union Government executives.',
                status: 'active',
                startDate: new Date(),
                endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                positions: [
                    { title: 'President', candidates: [] },
                    { title: 'Vice President', candidates: [] }
                ]
            });
            console.log('Seed election created');
        }

        console.log('Seeding complete');
        process.exit();
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
}

seed();
