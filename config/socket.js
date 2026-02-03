const { authenticateSocket } = require('../middleware/socketAuthMiddleware');
const Message = require('../models/Message');
const User = require('../models/User'); // Import User model
const { sendPushNotification } = require('../utils/pushService'); // Import push service

const connectedUsers = new Map(); // userId -> socketId

const setupSocket = (io) => {
    // Authentication middleware
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        const userId = socket.user._id.toString();
        console.log(`User connected: ${socket.user.name} (${userId})`);

        // Store user's socket connection
        connectedUsers.set(userId, socket.id);

        // Join user's personal room
        socket.join(userId);

        // Emit online status
        socket.broadcast.emit('user:online', { userId });

        // ============ MESSAGING EVENTS ============

        // Join conversation room
        socket.on('conversation:join', (conversationId) => {
            console.log(`🔵 [Socket] User ${userId} joining conversation room: ${conversationId}`);
            console.log(`🔵 [Socket] ConversationId type: ${typeof conversationId}`);
            socket.join(conversationId);
            console.log(`✅ [Socket] User ${userId} successfully joined room: ${conversationId}`);
            console.log(`🔵 [Socket] User rooms:`, Array.from(socket.rooms));
        });

        // Send message
        socket.on('message:send', async (data) => {
            try {
                const { conversationId, receiverId, content, type, mediaUrl, replyTo } = data;

                // Create message in database
                const message = await Message.create({
                    conversationId,
                    senderId: userId,
                    receiverId,
                    content,
                    type: type || 'text',
                    mediaUrl,
                    replyTo: replyTo || null
                });

                const populatedMessage = await Message.findById(message._id)
                    .populate('senderId', 'name avatar')
                    .populate('receiverId', 'name avatar')
                    .populate('replyTo');

                // Set isDelivered to true if receiver is online
                if (connectedUsers.has(receiverId.toString())) {
                    populatedMessage.isDelivered = true;
                    await Message.findByIdAndUpdate(message._id, { isDelivered: true });
                }

                // Emit to conversation room (sender and other participants)
                io.to(conversationId).emit('message:receive', populatedMessage);

                // Emit to receiver's personal room for notification
                io.to(receiverId.toString()).emit('message:notification', {
                    from: socket.user,
                    message: populatedMessage
                });
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });

        // Message Delivered
        socket.on('message:delivered', async ({ messageId, conversationId }) => {
            try {
                const message = await Message.findByIdAndUpdate(messageId, { isDelivered: true }, { new: true });
                if (message) {
                    io.to(conversationId).emit('message:status_update', {
                        messageId: message._id,
                        conversationId,
                        isDelivered: true
                    });
                }
            } catch (err) {
                console.error('Error in message:delivered:', err);
            }
        });

        // Message Read
        socket.on('message:read', async ({ conversationId, userId: readerId }) => {
            try {
                // Mark all messages from other user as read
                await Message.updateMany(
                    { conversationId, receiverId: readerId, isRead: false },
                    { isRead: true }
                );

                io.to(conversationId).emit('message:read_all', {
                    conversationId,
                    readerId
                });
            } catch (err) {
                console.error('Error in message:read:', err);
            }
        });

        // Typing indicator
        socket.on('typing:start', ({ conversationId, receiverId, status }) => {
            io.to(receiverId).emit('typing:indicator', {
                conversationId,
                userId,
                userName: socket.user.name,
                isTyping: true,
                status: status || 'typing'
            });
        });

        socket.on('typing:stop', ({ conversationId, receiverId }) => {
            io.to(receiverId).emit('typing:indicator', {
                conversationId,
                userId,
                isTyping: false
            });
        });

        // Mark message as read
        socket.on('message:read', async ({ messageId }) => {
            try {
                const message = await Message.findById(messageId);
                if (message) {
                    message.isRead = true;
                    await message.save();

                    io.to(message.senderId.toString()).emit('message:read', { messageId });
                }
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });

        // ============ NOTIFICATION EVENTS ============

        // New notification (called from other parts of the app)
        socket.on('notification:send', (data) => {
            io.to(data.userId).emit('notification:new', data);
        });

        // ============ POST EVENTS ============

        // New post created
        socket.on('post:created', (post) => {
            socket.broadcast.emit('post:new', post);
        });

        // Post liked
        socket.on('post:like', ({ postId, likerId, likerName }) => {
            // Notify post owner
            socket.broadcast.emit('post:liked', {
                postId,
                likerId,
                likerName
            });
        });

        // New comment on post
        socket.on('comment:created', ({ postId, comment, postOwnerId }) => {
            // Notify post owner
            io.to(postOwnerId).emit('comment:new', {
                postId,
                comment
            });
        });

        // ============ ORDER EVENTS ============

        // Order status updated
        socket.on('order:statusUpdate', ({ orderId, status, buyerId, sellerId }) => {
            io.to(buyerId).emit('order:status', { orderId, status });
            io.to(sellerId).emit('order:status', { orderId, status });
        });

        // Escrow released
        socket.on('order:escrowRelease', ({ orderId, sellerId, amount }) => {
            io.to(sellerId).emit('order:escrowReleased', {
                orderId,
                amount,
                message: 'Funds have been released to your wallet'
            });
        });

        // ============ TOUR REQUEST EVENTS ============

        // Tour request created
        socket.on('tour:request', ({ ownerId, tourRequest }) => {
            io.to(ownerId).emit('tour:newRequest', tourRequest);
        });

        // Tour request accepted/declined
        socket.on('tour:response', ({ requesterId, tourId, status, meetingPoint }) => {
            io.to(requesterId).emit('tour:statusUpdate', {
                tourId,
                status,
                meetingPoint
            });
        });

        // ============ CALLING EVENTS (SIGNALING) ============

        socket.on('call:start', async ({ receiverId, isVideo }) => {
            console.log(`Call started from ${userId} to ${receiverId}`);
            const caller = {
                _id: userId,
                name: socket.user.name,
                avatar: socket.user.avatar
            };
            io.to(receiverId).emit('call:incoming', { caller, isVideo });

            // Send Push Notification for background/killed state
            try {
                const receiver = await User.findById(receiverId);
                if (receiver && receiver.pushTokens?.length > 0) {
                    await sendPushNotification(
                        receiver.pushTokens,
                        'Incoming Call',
                        `${socket.user.name} is calling you...`,
                        {
                            type: 'call_incoming',
                            caller,
                            isVideo
                        }
                    );
                }
            } catch (error) {
                console.error('Error sending call push notification:', error);
            }
        });

        socket.on('call:accept', ({ callerId }) => {
            console.log(`Call accepted by ${userId}`);
            io.to(callerId).emit('call:accepted', { responderId: userId });
        });

        socket.on('call:decline', ({ callerId }) => {
            console.log(`Call declined by ${userId}`);
            io.to(callerId).emit('call:declined', { responderId: userId });
        });

        socket.on('call:end', ({ otherUserId }) => {
            console.log(`Call ended by ${userId}, notifying ${otherUserId}`);
            io.to(otherUserId).emit('call:ended', { byUserId: userId });
        });

        // WebRTC Signaling
        socket.on('call:offer', ({ to, offer }) => {
            console.log(`📞 [Socket] Forwarding call offer from ${userId} to ${to}`);
            io.to(to).emit('call:offer', { from: userId, offer });
        });

        socket.on('call:answer', ({ to, answer }) => {
            console.log(`📞 [Socket] Forwarding call answer from ${userId} to ${to}`);
            io.to(to).emit('call:answer', { from: userId, answer });
        });

        socket.on('call:ice-candidate', ({ to, candidate }) => {
            console.log(`📞 [Socket] Forwarding ICE candidate from ${userId} to ${to}`);
            io.to(to).emit('call:ice-candidate', { from: userId, candidate });
        });

        // WebRTC Signaling (ICE Candidates & Offers/Answers) - For Future
        socket.on('call:signal', ({ to, data }) => {
            io.to(to).emit('call:signal', { from: userId, data });
        });

        // ============ DISCONNECT ============

        // Update Online Status
        const User = require('../models/User');
        User.findByIdAndUpdate(userId, { isOnline: true }).catch(err => console.error('Error updating online status:', err));

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.name}`);
            connectedUsers.delete(userId);

            // Update offline status
            User.findByIdAndUpdate(userId, {
                isOnline: false,
                lastSeen: new Date()
            }).catch(err => console.error('Error updating offline status:', err));

            socket.broadcast.emit('user:offline', { userId });
        });
    });

    return io;
};

// Helper function to emit events from controllers
const emitToUser = (io, userId, event, data) => {
    io.to(userId).emit(event, data);
};

const emitToAll = (io, event, data) => {
    io.emit(event, data);
};

module.exports = { setupSocket, emitToUser, emitToAll, connectedUsers };
