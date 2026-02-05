require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';

async function diagnose() {
    try {
        await mongoose.connect(MONGODB_URI);

        const convId = "6983ddd56a7abb151dbfdce4";
        const userId = "697e1fecbb81885705ba1ed1";

        console.log(`🔍 Diagnosing User: ${userId}`);
        const user = await User.findById(userId);
        if (!user) {
            console.log("❌ User not found");
        } else {
            console.log("✅ User found:", user.name);
            console.log("⚙️  AI Settings:", JSON.stringify(user.aiSettings, null, 2));
        }

        console.log(`\n🔍 Diagnosing Conversation: ${convId}`);
        const conv = await Conversation.findById(convId);
        if (!conv) {
            console.log("❌ Conversation not found");
        } else {
            console.log("✅ Conversation found");
            console.log("👥 Participants:", conv.participants);
            console.log("✨ AI Enabled For:", conv.aiEnabledFor);

            const isEnabled = conv.aiEnabledFor?.some(id => id.toString() === userId);
            console.log(`\n👉 Is AI enabled for this user in this chat? ${isEnabled ? "YES" : "NO"}`);
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Diagnostic failed:", error);
        process.exit(1);
    }
}

diagnose();
