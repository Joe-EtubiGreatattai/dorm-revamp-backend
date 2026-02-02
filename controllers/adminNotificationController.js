const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPushNotification } = require('../utils/pushService');

/**
 * @desc    Send targeted notifications (Push + DB)
 * @route   POST /api/admin/notifications/send
 * @access  Private/Admin
 */
const sendTargetedNotifications = async (req, res) => {
    try {
        const { target, filters, title, message, data } = req.body;

        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required' });
        }

        let query = {};

        // Apply filters based on target
        switch (target) {
            case 'all':
                query = { isBanned: false };
                break;
            case 'school':
                if (!filters.school) return res.status(400).json({ message: 'School filter is required' });
                query = { university: filters.school, isBanned: false };
                break;
            case 'individual':
                if (!filters.userId) return res.status(400).json({ message: 'User ID is required' });
                query = { _id: filters.userId };
                break;
            case 'registration_date':
                if (!filters.startDate && !filters.endDate) {
                    return res.status(400).json({ message: 'Start or end date is required' });
                }
                query.createdAt = {};
                if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
                if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
                break;
            case 'role':
                if (!filters.role) return res.status(400).json({ message: 'Role is required' });
                query = { role: filters.role };
                break;
            case 'kyc':
                if (!filters.kycStatus) return res.status(400).json({ message: 'KYC status is required' });
                query = { kycStatus: filters.kycStatus };
                break;
            case 'activity':
                if (!filters.days) return res.status(400).json({ message: 'Activity days is required' });
                const activityDate = new Date();
                activityDate.setDate(activityDate.getDate() - filters.days);
                query = { lastSeen: { $gte: activityDate } };
                break;
            case 'wealth':
                if (filters.minBalance === undefined) return res.status(400).json({ message: 'Min balance is required' });
                query = { walletBalance: { $gte: filters.minBalance } };
                break;
            default:
                return res.status(400).json({ message: 'Invalid target category' });
        }

        const users = await User.find(query).select('_id pushTokens name email');

        if (users.length === 0) {
            return res.status(404).json({ message: 'No users found matching these criteria' });
        }

        // Prepare notifications in bulk
        const notificationData = users.map(user => ({
            userId: user._id,
            type: 'system',
            title,
            message,
            relatedId: 'admin_broadcast',
            fromUserId: req.user._id // Admin ID
        }));

        // Insert into DB
        await Notification.insertMany(notificationData);

        // Prepare Push Notifications
        const pushTokens = users
            .filter(u => u.pushTokens && u.pushTokens.length > 0)
            .flatMap(u => u.pushTokens);

        if (pushTokens.length > 0) {
            // sendPushNotification handles chunking automatically
            await sendPushNotification(
                pushTokens,
                title,
                message,
                { type: 'system', ...data }
            );
        }

        // Emit real-time events in background if needed
        const io = global.io;
        if (io) {
            users.forEach(user => {
                io.to(user._id.toString()).emit('notification:new', {
                    type: 'system',
                    title,
                    message,
                    createdAt: new Date()
                });
            });
        }

        res.json({
            message: `Notification sent successfully to ${users.length} users`,
            userCount: users.length,
            pushCount: pushTokens.length
        });

    } catch (error) {
        console.error('Error sending targeted notifications:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    sendTargetedNotifications
};
