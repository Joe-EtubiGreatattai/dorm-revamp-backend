const express = require('express');
const router = express.Router();
const {
    getComments,
    createComment,
    updateComment,
    deleteComment,
    likeComment
} = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

router.get('/post/:postId', getComments);
router.post('/', protect, createComment);
router.put('/:id', protect, updateComment);
router.delete('/:id', protect, deleteComment);
router.post('/:id/like', protect, likeComment);

module.exports = router;
