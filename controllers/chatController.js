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
            user: otherParticipant
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
            .sort({ createdAt: 1 });

        // Mark messages as read when fetching
        await Message.updateMany(
            {
                conversationId: req.params.id,
                receiverId: req.user._id,
                isRead: false
            },
            { isRead: true }
        );

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

        const { content } = req.body;
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

        console.log('🟢 [Backend] Creating message in database...');
        const message = await Message.create({
            conversationId,
            senderId: req.user._id,
            receiverId,
            content,
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

        // Socket.io emit
        console.log('🟢 [Backend] Getting socket.io instance...');
        const io = req.app.get('io');

        if (io) {
            console.log('🟢 [Backend] Socket.io instance found');

            // Convert conversationId to string for socket rooms
            const roomId = conversationId.toString();
            console.log('🟢 [Backend] Room ID (converted to string):', roomId);
            console.log('🟢 [Backend] Message object being emitted:', JSON.stringify(message, null, 2));

            console.log('📡 [Backend] Emitting message:new to room:', roomId);
            io.to(roomId).emit('message:new', message);
            console.log('✅ [Backend] message:new emitted successfully');
            // Also notify receiver if they are not in the room
            console.log('📡 [Backend] Emitting notification:message to user:', receiverId.toString());
            io.to(receiverId.toString()).emit('notification:message', {
                senderId: req.user._id,
                senderName: req.user.name,
                content: content,
                conversationId
            });
        }

        console.log('🟢 [Backend] Sending response to client');
        res.status(201).json(message);
    } catch (error) {
        console.error('❌ [Backend] Error in sendMessage:', error);
        console.error('❌ [Backend] Error stack:', error.stack);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getConversations,
    getConversation,
    getMessages,
    createConversation,
    sendMessage,
    getUnreadCount
};
