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
            io.to(post.userId.toString()).emit('comment:new', {
                postId,
                comment: populatedComment
            });
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
