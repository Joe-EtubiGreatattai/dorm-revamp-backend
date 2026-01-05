const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All chat routes are private

// Chat routes
router.get('/conversations', chatController.getConversations);
router.get('/conversations/:id', chatController.getConversation);
router.get('/conversations/:id/messages', chatController.getMessages);
router.get('/unread-count', chatController.getUnreadCount);
router.post('/conversations', chatController.createConversation);
router.post('/conversations/:id/messages', chatController.sendMessage);

module.exports = router;
