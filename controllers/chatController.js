const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get all conversations for a user
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: { $in: [req.user._id] }
        })
            .populate('participants', 'name avatar isOnline')
            .sort({ lastMessageAt: -1 });

        // Get unread counts for each conversation
        const formattedConversations = await Promise.all(conversations.map(async (conv) => {
            const otherParticipant = conv.participants.find(p => p._id.toString() !== req.user._id.toString());

            // Count unread messages for this user in this conversation
            const unreadCount = await Message.countDocuments({
                conversationId: conv._id,
                receiverId: req.user._id,
                isRead: false
            });

            return {
                id: conv._id,
                user: otherParticipant,
                type: conv.type || 'individual',
                groupMetadata: conv.groupMetadata,
                participants: conv.participants,
                lastMessage: conv.lastMessage,
                timestamp: conv.lastMessageAt || conv.updatedAt,
                unread: unreadCount > 0,
                unreadCount: unreadCount
            };
        }));

        res.json(formattedConversations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single conversation with its messages
// @route   GET /api/chat/conversations/:id
// @access  Private
const getConversation = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id)
            .populate('participants', 'name avatar isOnline');

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' })
        }

        const otherParticipant = conversation.participants.find(p => p._id.toString() !== req.user._id.toString());

        res.json({
            id: conversation._id,
            user: otherParticipant,
            type: conversation.type || 'individual',
            groupMetadata: conversation.groupMetadata,
            participants: conversation.participants,
            creatorId: conversation.creatorId,
            admins: conversation.admins
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get messages for a conversation
// @route   GET /api/chat/conversations/:id/messages
// @access  Private
const getMessages = async (req, res) => {
    try {
        const messages = await Message.find({ conversationId: req.params.id })
            .populate('replyTo')
            .populate('marketItem')
            .populate('transactionId')
            .sort({ createdAt: 1 });

        // Mark messages as read when fetching
        const result = await Message.updateMany(
            {
                conversationId: req.params.id,
                receiverId: req.user._id,
                isRead: false
            },
            { isRead: true }
        );

        if (result.modifiedCount > 0) {
            const io = req.app.get('io');
            if (io) {
                io.to(req.params.id).emit('message:read_all', {
                    conversationId: req.params.id,
                    readerId: req.user._id
                });
            }
        }

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get unread message count
// @route   GET /api/chat/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
    try {
        const count = await Message.countDocuments({
            receiverId: req.user._id,
            isRead: false
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new conversation
// @route   POST /api/chat/conversations
// @access  Private
const createConversation = async (req, res) => {
    try {
        const { recipientId } = req.body;

        if (!recipientId) {
            return res.status(400).json({ message: 'Recipient ID is required' });
        }

        // Check if either user has blocked the other
        const [currentUser, recipientUser] = await Promise.all([
            User.findById(req.user._id),
            User.findById(recipientId)
        ]);

        if (!recipientUser) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        if (currentUser.blockedUsers.includes(recipientId)) {
            return res.status(400).json({ message: 'You have blocked this user' });
        }

        if (recipientUser.blockedUsers.includes(req.user._id)) {
            return res.status(400).json({ message: 'You cannot message this user' });
        }

        // Check if conversation already exists between these two
        let conversation = await Conversation.findOne({
            participants: { $all: [req.user._id, recipientId] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [req.user._id, recipientId]
            });
        }

        res.status(201).json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Send a message
// @route   POST /api/chat/conversations/:id/messages
// @access  Private
const sendMessage = async (req, res) => {
    try {
        console.log('🟢 [Backend] ========== SEND MESSAGE REQUEST ==========');
        console.log('🟢 [Backend] Request body:', req.body);
        console.log('🟢 [Backend] Conversation ID from params:', req.params.id);
        console.log('🟢 [Backend] User:', { id: req.user._id, name: req.user.name });

        const { content, type, mediaUrl, replyTo, marketItem, transactionId } = req.body;
        const conversationId = req.params.id;

        console.log('🟢 [Backend] Content:', content);
        console.log('🟢 [Backend] ConversationId type:', typeof conversationId);

        console.log('🟢 [Backend] Looking up conversation...');
        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            console.log('❌ [Backend] Conversation not found!');
            return res.status(404).json({ message: 'Conversation not found' });
        }

        console.log('🟢 [Backend] Conversation found:', {
            id: conversation._id,
            participants: conversation.participants
        });

        const receiverId = conversation.participants.find(p => p.toString() !== req.user._id.toString());
        console.log('🟢 [Backend] Receiver ID:', receiverId);

        // Check for blocks
        const [sender, receiver] = await Promise.all([
            User.findById(req.user._id),
            User.findById(receiverId)
        ]);

        if (sender.blockedUsers.includes(receiverId)) {
            return res.status(400).json({ message: 'You have blocked this user' });
        }

        if (receiver.blockedUsers.includes(req.user._id)) {
            return res.status(400).json({ message: 'You cannot message this user' });
        }

        console.log('🟢 [Backend] Creating message in database...');
        const message = await Message.create({
            conversationId,
            senderId: req.user._id,
            receiverId,
            content,
            type: type || 'text',
            mediaUrl,
            replyTo: replyTo || null,
            marketItem: marketItem || null,
            transactionId: transactionId || null,
            isRead: false // New messages are unread
        });

        console.log('🟢 [Backend] Message created:', {
            id: message._id,
            conversationId: message.conversationId,
            conversationIdType: typeof message.conversationId,
            senderId: message.senderId,
            content: message.content
        });

        // Update conversation last message
        conversation.lastMessage = content;
        conversation.lastMessageAt = Date.now();
        await conversation.save();

        // Populate message before emitting
        const populatedMessage = await Message.findById(message._id)
            .populate('replyTo')
            .populate('marketItem')
            .populate('transactionId');

        // Socket.io emit
        console.log('🟢 [Backend] Getting socket.io instance...');
        const io = req.app.get('io');

        if (io) {
            console.log('🟢 [Backend] Socket.io instance found');

            // Convert conversationId to string for socket rooms
            const roomId = conversationId.toString();
            console.log('🟢 [Backend] Room ID (converted to string):', roomId);

            console.log('📡 [Backend] Emitting message:receive to room:', roomId);
            io.to(roomId).emit('message:receive', populatedMessage);
            console.log('✅ [Backend] message:receive emitted successfully');
            // Also notify receiver if they are not in the room
            console.log('📡 [Backend] Emitting notification:message to user:', receiverId.toString());
            io.to(receiverId.toString()).emit('notification:message', {
                senderId: req.user._id,
                senderName: req.user.name,
                content: content,
                conversationId,
                message: populatedMessage
            });
        }

        console.log('🟢 [Backend] Sending response to client');
        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error('❌ [Backend] Error in sendMessage:', error);
        console.error('❌ [Backend] Error stack:', error.stack);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Edit a message
// @route   PUT /api/chat/messages/:messageId
// @access  Private
const editMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const message = await Message.findById(req.params.messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (message.senderId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized to edit this message' });
        }

        message.content = content;
        message.isEdited = true;
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(message.conversationId.toString()).emit('message:edit', message);
        }

        res.json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a message
// @route   DELETE /api/chat/messages/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (message.senderId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized to delete this message' });
        }

        message.isDeleted = true;
        message.content = 'This message was deleted';
        message.mediaUrl = null;
        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(message.conversationId.toString()).emit('message:delete', {
                messageId: message._id,
                conversationId: message.conversationId
            });
        }

        res.json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    React to a message
// @route   POST /api/chat/messages/:messageId/react
// @access  Private
const reactToMessage = async (req, res) => {
    try {
        const { emoji } = req.body;
        const message = await Message.findById(req.params.messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Check if user already reacted with this emoji
        const existingReactionIndex = message.reactions.findIndex(
            r => r.userId.toString() === req.user._id.toString() && r.emoji === emoji
        );

        if (existingReactionIndex !== -1) {
            // Remove reaction if already exists
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            // Add new reaction
            message.reactions.push({ userId: req.user._id, emoji });
        }

        await message.save();

        const io = req.app.get('io');
        if (io) {
            io.to(message.conversationId.toString()).emit('message:react', {
                messageId: message._id,
                reactions: message.reactions,
                conversationId: message.conversationId
            });
        }

        res.json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getConversations,
    getConversation,
    getMessages,
    createConversation,
    sendMessage,
    getUnreadCount,
    editMessage,
    deleteMessage,
    reactToMessage
};
