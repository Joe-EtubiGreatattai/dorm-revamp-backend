const express = require('express');
const router = express.Router();
const {
    getFeed,
    getPost,
    createPost,
    updatePost,
    deletePost,
    likePost,
    sharePost,
    bookmarkPost,
    getUserPosts,
    reportPost,
    notInterested,
    incrementView
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/feed', protect, getFeed);
router.get('/user/:userId', getUserPosts);
router.get('/:id', getPost);
router.post('/', protect, createPost);
router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, likePost);
router.post('/:id/share', protect, sharePost);
router.post('/:id/bookmark', protect, bookmarkPost);
router.post('/:id/report', protect, reportPost);
router.post('/:id/not-interested', protect, notInterested);
router.post('/:id/view', protect, incrementView);

module.exports = router;
