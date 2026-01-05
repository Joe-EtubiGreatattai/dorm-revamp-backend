const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markAsRead,
    markAllAsRead,

    deleteNotification,
    registerPushToken
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getNotifications);
router.put('/:id/read', protect, markAsRead);
router.put('/read-all', protect, markAllAsRead);
router.delete('/:id', protect, deleteNotification);
router.post('/push-token', protect, registerPushToken);

module.exports = router;
