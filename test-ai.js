require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const { handleAutoResponder } = require('./controllers/aiController');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';

async function testAI() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Find two users to use as test subjects
        const users = await User.find().limit(2);
        if (users.length < 2) {
            console.error('❌ Error: Need at least 2 users in the database to test.');
            process.exit(1);
        }

        const sender = users[0]; // The "Human" sender
        const receiver = users[1]; // The "AI" receiver

        console.log(`👤 Sender (Human): ${sender.name} (${sender._id})`);
        console.log(`🤖 Receiver (AI): ${receiver.name} (${receiver._id})`);

        // 2. Ensure Receiver has AI enabled globally
        console.log(`⚙️ Enabling global AI for ${receiver.name}...`);
        receiver.aiSettings = {
            enabled: true,
            aiName: 'TestBot',
            customContext: 'I am a testing bot designed to verify the auto-responder.'
        };
        await receiver.save();

        // 3. Find or Create a conversation
        let conversation = await Conversation.findOne({
            participants: { $all: [sender._id, receiver._id] },
            type: 'individual'
        });

        if (!conversation) {
            console.log('📂 Creating new test conversation...');
            conversation = await Conversation.create({
                participants: [sender._id, receiver._id],
                type: 'individual'
            });
        }

        // 4. Ensure AI is enabled for this specific conversation for the receiver
        console.log(`✨ Enabling AI (sparkles) for this specific chat...`);
        if (!conversation.aiEnabledFor.includes(receiver._id)) {
            conversation.aiEnabledFor.push(receiver._id);
            await conversation.save();
        }

        // 5. Mock the Socket.io (io) object
        const mockIo = {
            to: (roomId) => ({
                emit: (event, data) => {
                    console.log(`📡 [Socket Mock] Event: ${event} | Room: ${roomId}`);
                    if (event === 'message:receive') {
                        console.log(`   📝 AI Output: "${data.content}"`);
                    }
                }
            })
        };

        // 6. Trigger the Auto-Responder
        const testMessage = "Hello Bot, how are you today?";
        console.log(`\n💬 Simulating message from ${sender.name}: "${testMessage}"`);
        console.log('⏳ Triggering AI (this may take a few seconds)...');

        await handleAutoResponder(
            mockIo,
            conversation._id,
            receiver._id,
            sender._id,
            testMessage
        );

        console.log('\n✅ Test cycle finished. Check logs above for results.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        process.exit(1);
    }
}

testAI();
