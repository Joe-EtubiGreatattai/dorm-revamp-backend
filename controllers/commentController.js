const Comment = require('../models/Comment');
const Post = require('../models/Post');

// @desc    Get comments for a post
// @route   GET /api/comments/post/:postId
// @access  Public
const getComments = async (req, res) => {
    try {
        const comments = await Comment.find({ postId: req.params.postId, parentCommentId: null })
            .populate('userId', 'name avatar')
            .populate({
                path: 'replies',
                populate: { path: 'userId', select: 'name avatar' }
            })
            .sort({ createdAt: -1 });

        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create comment
// @route   POST /api/comments
// @access  Private
const createComment = async (req, res) => {
    try {
        const { postId, content, parentCommentId } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Content is required' });
        }

        const comment = await Comment.create({
            postId,
            userId: req.user._id,
            content,
            parentCommentId: parentCommentId || null
        });

        // Add comment to post
        const post = await Post.findById(postId);
        if (post) {
            if (parentCommentId) {
                // Add to parent comment replies
                const parentComment = await Comment.findById(parentCommentId);
                if (parentComment) {
                    parentComment.replies.push(comment._id);
                    await parentComment.save();
                }
            } else {
                post.comments.push(comment._id);
                await post.save();
            }

            // Monetization logic for comments (paid to post author)
            if (post.userId.toString() !== req.user._id.toString()) {
                const User = require('../models/User');
                const author = await User.findById(post.userId);
                if (author && author.followers && author.followers.length >= 1000) {
                    const Transaction = require('../models/Transaction');
                    await User.findByIdAndUpdate(author._id, {
                        $inc: { walletBalance: 1, totalMonetizationEarnings: 1 }
                    });
                    await Transaction.create({
                        userId: author._id,
                        type: 'monetization_comment',
                        amount: 1,
                        status: 'completed',
                        description: `Monetization for comment on post ${postId}`
                    });
                }
            }
        }

        const populatedComment = await Comment.findById(comment._id)
            .populate('userId', 'name avatar');

        // Emit real-time events
        const io = req.app.get('io');
        if (io && post) {
            // Fetch updated post for global feed update
            const updatedPost = await Post.findById(postId)
                .populate('userId', 'name avatar university');

            if (updatedPost) {
                const p = updatedPost.toObject();
                const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };
                io.emit('post:updated', normalizedPost);
            }

            // Target author for notification
            if (post.userId.toString() !== req.user._id.toString()) {
                const { createNotification } = require('./notificationController');
                await createNotification({
                    userId: post.userId,
                    type: 'comment',
                    fromUserId: req.user._id,
                    relatedId: postId,
                    title: 'New Comment',
                    message: `${req.user.name} commented on your post: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`
                });
            }

            // If it's a reply, also notify the parent comment owner
            if (parentCommentId) {
                const parentComment = await Comment.findById(parentCommentId);
                if (parentComment && parentComment.userId.toString() !== req.user._id.toString() && parentComment.userId.toString() !== post.userId.toString()) {
                    const { createNotification } = require('./notificationController');
                    await createNotification({
                        userId: parentComment.userId,
                        type: 'comment',
                        fromUserId: req.user._id,
                        relatedId: postId,
                        title: 'New Reply',
                        message: `${req.user.name} replied to your comment`
                    });
                }
            }
        }

        res.status(201).json(populatedComment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
const updateComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        if (comment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        comment.content = req.body.content || comment.content;
        await comment.save();

        res.json(comment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        if (comment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await comment.deleteOne();
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Like/unlike comment
// @route   POST /api/comments/:id/like
// @access  Private
const likeComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        const alreadyLiked = comment.likes.includes(req.user._id);

        if (alreadyLiked) {
            comment.likes = comment.likes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            comment.likes.push(req.user._id);
        }

        await comment.save();

        // Emit real-time updates
        const io = req.app.get('io');
        if (io) {
            const updatedPost = await Post.findById(comment.postId)
                .populate('userId', 'name avatar university');

            if (updatedPost) {
                const p = updatedPost.toObject();
                const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };
                io.emit('post:updated', normalizedPost);
            }
        }

        res.json({ liked: !alreadyLiked, likesCount: comment.likes.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getComments,
    createComment,
    updateComment,
    deleteComment,
    likeComment
};
