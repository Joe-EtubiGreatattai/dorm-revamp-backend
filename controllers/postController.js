const Post = require('../models/Post');
const User = require('../models/User');

// @desc    Get all posts for feed
// @route   GET /api/posts/feed
// @access  Private
const getFeed = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = {
            $or: [
                { visibility: 'public' },
                { $and: [{ visibility: 'school' }, { school: req.user.university }] }
            ]
        };

        const posts = await Post.find(query)
            .populate('userId', 'name avatar university')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Post.countDocuments(query);

        const normalizedPosts = posts.map(post => {
            const p = post.toObject();
            return { ...p, user: p.userId, userId: p.userId?._id };
        });

        res.json({
            posts: normalizedPosts,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public
const getPost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('userId', 'name avatar university')
            .populate({
                path: 'comments',
                populate: { path: 'userId', select: 'name avatar' }
            });

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const p = post.toObject();
        res.json({ ...p, user: p.userId, userId: p.userId?._id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res) => {
    try {
        const { content, school } = req.body;

        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map(file => file.path); // Cloudinary URLs
        } else if (req.body.images) {
            images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
        }

        if (!content) {
            return res.status(400).json({ message: 'Content is required' });
        }

        const post = await Post.create({
            userId: req.user._id,
            content,
            images,
            school: req.user.university, // Use university for school filtering
            visibility: req.body.visibility || 'public'
        });

        const populatedPost = await Post.findById(post._id)
            .populate('userId', 'name avatar university');

        // Emit real-time event
        const io = req.app.get('io');

        const p = populatedPost.toObject();
        const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };

        if (io) {
            io.emit('post:new', normalizedPost);
        }

        res.status(201).json(normalizedPost);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
const updatePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { content, images } = req.body;

        post.content = content || post.content;
        post.images = images || post.images;

        await post.save();

        res.json(post);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await post.deleteOne();

        res.json({ message: 'Post deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Like/unlike post
// @route   POST /api/posts/:id/like
// @access  Private
const likePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const alreadyLiked = post.likes.includes(req.user._id);

        if (alreadyLiked) {
            post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            post.likes.push(req.user._id);
        }

        await post.save();

        // Fetch populated post for real-time update
        const updatedPost = await Post.findById(post._id)
            .populate('userId', 'name avatar university');

        const p = updatedPost.toObject();
        const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };

        // Emit real-time events
        const io = req.app.get('io');
        if (io) {
            // Global update for feed
            io.emit('post:updated', normalizedPost);

            // Notification for author (only if liked)
            if (!alreadyLiked) {
                io.to(post.userId.toString()).emit('post:liked', {
                    postId: post._id,
                    likerId: req.user._id,
                    likerName: req.user.name,
                    likerAvatar: req.user.avatar
                });
            }
        }

        res.json({ liked: !alreadyLiked, likesCount: post.likes.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Share post
// @route   POST /api/posts/:id/share
// @access  Private
const sharePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        post.shares += 1;
        await post.save();

        const updatedPost = await Post.findById(post._id).populate('userId', 'name avatar university');
        const p = updatedPost.toObject();
        const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };

        const io = req.app.get('io');
        if (io) io.emit('post:updated', normalizedPost);

        res.json({ sharesCount: post.shares });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bookmark/save post
// @route   POST /api/posts/:id/bookmark
// @access  Private
const bookmarkPost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const alreadySaved = post.savedBy.includes(req.user._id);
        if (alreadySaved) {
            post.savedBy = post.savedBy.filter(id => id.toString() !== req.user._id.toString());
        } else {
            post.savedBy.push(req.user._id);
        }

        await post.save();

        const updatedPost = await Post.findById(post._id).populate('userId', 'name avatar university');
        const p = updatedPost.toObject();
        const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };

        const io = req.app.get('io');
        if (io) io.emit('post:updated', normalizedPost);

        res.json({ saved: !alreadySaved, savedCount: post.savedBy.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get posts by user
// @route   GET /api/posts/user/:userId
// @access  Public
const getUserPosts = async (req, res) => {
    try {
        const { tab } = req.query;
        let query = { userId: req.params.userId };

        if (tab === 'Media') {
            query.images = { $exists: true, $ne: [] };
        } else if (tab === 'Likes') {
            query = { likes: req.params.userId };
        } else if (tab === 'Saved') {
            query = { savedBy: req.params.userId };
        }

        const posts = await Post.find(query)
            .populate('userId', 'name avatar university')
            .sort({ createdAt: -1 });

        const normalizedPosts = posts.map(post => {
            const p = post.toObject();
            return { ...p, user: p.userId, userId: p.userId?._id };
        });

        res.json(normalizedPosts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getFeed,
    getPost,
    createPost,
    updatePost,
    deletePost,
    likePost,
    sharePost,
    bookmarkPost,
    getUserPosts
};
