const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

const fixLastMessages = async () => {
    await connectDB();

    try {
        const conversations = await Conversation.find({});
        console.log(`Checking ${conversations.length} conversations...`);

        let updatedCount = 0;

        for (const conv of conversations) {
            // Find the actual last message for this conversation
            const lastMsg = await Message.findOne({ conversationId: conv._id })
                .sort({ createdAt: -1 });

            if (lastMsg) {
                // If conversation has no lastMessage or it differs (optional check, but good for sync)
                // We'll update it to ensure consistency, especially if it was "No messages yet" (null/undefined)

                // Only update if missing or empty, OR if we want to force sync. 
                // Let's force sync to be sure.

                let content = lastMsg.content;

                // If it's a transfer type and content is encrypted/decrypted, it might need handling?
                // The Message model decrypts on init/save. When we query via mongoose, we get the doc.
                // If we access .content, the getter/hook might run.
                // However, in this script we are just reading string. 
                // NOTE: The Message model has a decryption hook on 'init'. 
                // So 'lastMsg.content' should be plain text if encryption is working correctly.

                if (lastMsg.type === 'image' && !content) content = '[Image]';
                if (lastMsg.type === 'voice' && !content) content = '[Voice Message]';
                if (lastMsg.type === 'transfer' && !content) content = 'Money Sent'; // Fallback

                if (conv.lastMessage !== content || !conv.lastMessageAt) {
                    conv.lastMessage = content;
                    conv.lastMessageAt = lastMsg.createdAt;
                    await conv.save();
                    console.log(`Updated Conv ${conv._id}: "${content}"`);
                    updatedCount++;
                }
            } else {
                console.log(`Conv ${conv._id} has no messages.`);
            }
        }

        console.log('-----------------------------------');
        console.log(`Fixed ${updatedCount} conversations.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

fixLastMessages();
