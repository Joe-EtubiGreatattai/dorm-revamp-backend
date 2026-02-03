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
router.put('/messages/:messageId', chatController.editMessage);
router.delete('/messages/:messageId', chatController.deleteMessage);
router.post('/messages/:messageId/react', chatController.reactToMessage);

module.exports = router;
