const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/pushService');

// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ userId: req.user._id })
            .populate('fromUserId', 'name avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const normalizedNotifications = notifications.map(notif => {
            const n = notif.toObject();
            return {
                ...n,
                user: n.fromUserId,
                content: n.message || n.title
            };
        });

        res.json(normalizedNotifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (notification.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        notification.isRead = true;
        await notification.save();

        res.json(notification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user._id, isRead: false },
            { isRead: true }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (notification.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await notification.deleteOne();
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single notification
// @route   GET /api/notifications/:id
// @access  Private
const getNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id)
            .populate('fromUserId', 'name avatar');

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (notification.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const n = notification.toObject();
        const normalizedNotification = {
            ...n,
            user: n.fromUserId,
            content: n.message || n.title
        };

        res.json(normalizedNotification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Register Expo Push Token
// @route   POST /api/notifications/push-token
// @access  Private
const registerPushToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        const user = await User.findById(req.user._id);

        if (!user.pushTokens.includes(token)) {
            user.pushTokens.push(token);
            await user.save();
        }

        res.json({ message: 'Token registered' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Helper function to create notification (called from other controllers)
const createNotification = async (data) => {
    try {
        const user = await User.findById(data.userId);
        if (!user) return;

        // Settings mapping
        const settingsMap = {
            'like': 'likes',
            'comment': 'comments',
            'follow': 'follows',
            'message': 'messages',
            'mention': 'mentions',
            'order': 'orderUpdates',
            'election_created': 'electionReminders',
            'vote_cast': 'electionReminders',
            'candidate_application': 'electionReminders',
            'application_approved': 'electionReminders',
            'application_rejected': 'electionReminders',
            'share': 'shares',
            'group_invite': 'groups',
            'group_accept': 'groups',
            'group_joined': 'groups'
            // Default to always true for system or unmapped types if not specified
        };

        const settingKey = settingsMap[data.type];
        if (settingKey && user.notificationSettings && user.notificationSettings[settingKey] === false) {
            console.log(`Notification of type ${data.type} suppressed for user ${user.email} due to settings.`);
            return null; // Skip creation and push
        }

        const notification = await Notification.create(data);

        // Populate and normalize for real-time update
        const populatedNotification = await Notification.findById(notification._id)
            .populate('fromUserId', 'name avatar');

        const n = populatedNotification.toObject();
        const normalizedNotification = {
            ...n,
            user: n.fromUserId,
            content: n.message || n.title
        };

        // Emit real-time event
        const io = global.io; // Assuming io is available globally or via app
        if (io) {
            io.to(data.userId.toString()).emit('notification:new', normalizedNotification);

            // Also emit a specific event for unread count update
            const unreadCount = await Notification.countDocuments({ userId: data.userId, isRead: false });
            io.to(data.userId.toString()).emit('notification:unreadCount', unreadCount);
        }

        // Send Push Notification
        if (user.pushTokens && user.pushTokens.length > 0) {
            await sendPushNotification(
                user.pushTokens,
                data.title || 'New Notification',
                data.message || 'You have a new notification',
                { notificationId: notification._id, ...data },
                data.imageUrl || null
            );
        }

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getNotification,
    createNotification,
    registerPushToken
};
