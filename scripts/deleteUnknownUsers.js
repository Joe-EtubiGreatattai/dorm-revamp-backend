require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

const deleteUnknownUsers = async () => {
    await connectDB();

    try {
        console.log('🔍 Finding all "Unknown User" records...\n');

        // Find all users with name "Unknown User"
        const unknownUsers = await User.find({ name: 'Unknown User' });

        if (unknownUsers.length === 0) {
            console.log('✅ No "Unknown User" records found.');
            process.exit(0);
        }

        console.log(`📊 Found ${unknownUsers.length} "Unknown User" records\n`);

        const unknownUserIds = unknownUsers.map(u => u._id);

        // Display the users that will be deleted
        console.log('👥 Users to be deleted:');
        unknownUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. ID: ${user._id}, Email: ${user.email || 'N/A'}, Created: ${user.createdAt}`);
        });

        console.log('\n🗑️  Starting cleanup process...\n');

        // 1. Delete messages sent by unknown users
        const deletedMessages = await Message.deleteMany({ senderId: { $in: unknownUserIds } });
        console.log(`   ✓ Deleted ${deletedMessages.deletedCount} messages sent by unknown users`);

        // 2. Delete conversations where unknown users are participants
        const deletedConversations = await Conversation.deleteMany({
            participants: { $in: unknownUserIds }
        });
        console.log(`   ✓ Deleted ${deletedConversations.deletedCount} conversations involving unknown users`);

        // 3. Delete posts by unknown users
        const deletedPosts = await Post.deleteMany({ userId: { $in: unknownUserIds } });
        console.log(`   ✓ Deleted ${deletedPosts.deletedCount} posts by unknown users`);

        // 4. Delete comments by unknown users
        const deletedComments = await Comment.deleteMany({ userId: { $in: unknownUserIds } });
        console.log(`   ✓ Deleted ${deletedComments.deletedCount} comments by unknown users`);

        // 5. Remove unknown users from followers/following lists
        const updatedFollowers = await User.updateMany(
            { followers: { $in: unknownUserIds } },
            { $pull: { followers: { $in: unknownUserIds } } }
        );
        console.log(`   ✓ Removed unknown users from ${updatedFollowers.modifiedCount} follower lists`);

        const updatedFollowing = await User.updateMany(
            { following: { $in: unknownUserIds } },
            { $pull: { following: { $in: unknownUserIds } } }
        );
        console.log(`   ✓ Removed unknown users from ${updatedFollowing.modifiedCount} following lists`);

        // 6. Finally, delete the unknown user records themselves
        const deletedUsers = await User.deleteMany({ _id: { $in: unknownUserIds } });
        console.log(`   ✓ Deleted ${deletedUsers.deletedCount} unknown user records`);

        console.log('\n✅ Cleanup completed successfully!\n');
        console.log('📋 Summary:');
        console.log(`   - Users deleted: ${deletedUsers.deletedCount}`);
        console.log(`   - Messages deleted: ${deletedMessages.deletedCount}`);
        console.log(`   - Conversations deleted: ${deletedConversations.deletedCount}`);
        console.log(`   - Posts deleted: ${deletedPosts.deletedCount}`);
        console.log(`   - Comments deleted: ${deletedComments.deletedCount}`);
        console.log(`   - Follower lists updated: ${updatedFollowers.modifiedCount}`);
        console.log(`   - Following lists updated: ${updatedFollowing.modifiedCount}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
};

// Run the script
deleteUnknownUsers();
