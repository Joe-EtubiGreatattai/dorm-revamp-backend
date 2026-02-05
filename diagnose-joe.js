
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const userId = '695d157581ce56d39033ff41'; // Joe Great
        const convId = '6983ddd56a7abb151dbfdce4';

        console.log(`\n🔍 Diagnosing User: ${userId}`);
        const user = await User.findById(userId);
        if (!user) {
            console.log('❌ User not found');
        } else {
            console.log(`✅ User found: ${user.name}`);
            console.log(`⚙️ AI Settings:`, JSON.stringify(user.aiSettings, null, 2));
        }

        console.log(`\n🔍 Diagnosing Conversation: ${convId}`);
        const conv = await Conversation.findById(convId);
        if (!conv) {
            console.log('❌ Conversation not found');
        } else {
            console.log(`✅ Conversation found`);
            console.log(`✨ AI Enabled For:`, conv.aiEnabledFor);
            const isEnabled = conv.aiEnabledFor?.some(id => id.toString() === userId);
            console.log(`👉 Is AI enabled for THIS user in this chat? ${isEnabled ? 'YES' : 'NO'}`);
        }

        console.log(`\n🔍 Checking latest messages in this conversation...`);
        const messages = await Message.find({ conversationId: convId })
            .sort({ createdAt: -1 })
            .limit(5);

        console.log('Recent messages:');
        messages.forEach(m => {
            console.log(`- [${m.createdAt}] from ${m.senderId === userId ? 'AI/User' : 'Other'}: "${m.content.substring(0, 30)}..." | isAIReply: ${m.isAIReply}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
