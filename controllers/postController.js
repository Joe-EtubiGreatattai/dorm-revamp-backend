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
            $and: [
                {
                    $or: [
                        { visibility: 'public' },
                        { $and: [{ visibility: 'school' }, { school: req.user.university }] }
                    ]
                }
            ]
        };

        // Find users who have blocked me OR users I have blocked
        const usersToExclude = [...(req.user.blockedUsers || [])];

        // Find users who have blocked current user
        const usersWhoBlockedMe = await User.find({ blockedUsers: req.user._id }).select('_id');
        usersWhoBlockedMe.forEach(u => {
            if (!usersToExclude.includes(u._id)) {
                usersToExclude.push(u._id);
            }
        });

        if (usersToExclude.length > 0) {
            query.$and.push({ userId: { $nin: usersToExclude } });
        }

        if (req.user.notInterestedPosts && req.user.notInterestedPosts.length > 0) {
            query.$and.push({ _id: { $nin: req.user.notInterestedPosts } });
        }

        const posts = await Post.find(query)
            .populate('userId', 'name avatar university monetizationEnabled')
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
            .populate('userId', 'name avatar university monetizationEnabled') // Updated populate call
            .populate({
                path: 'comments',
                populate: { path: 'userId', select: 'name avatar' }
            });

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // BOLA Check: Visibility and Blocks
        const isOwner = req.user && post.userId._id.toString() === req.user._id.toString();

        if (!isOwner) {
            // 1. Check if blocked
            if (req.user) {
                const targetUser = await User.findById(post.userId._id);
                if (targetUser.blockedUsers.includes(req.user._id) || req.user.blockedUsers.includes(post.userId._id)) {
                    return res.status(403).json({ message: 'Not authorized to view this post' });
                }
            }

            // 2. Check Visibility
            if (post.visibility === 'school' && (!req.user || req.user.university !== post.school)) {
                return res.status(403).json({ message: 'This post is only visible to students of ' + post.school });
            }
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
    console.log('📝 [Backend] createPost started');
    const startTime = Date.now();
    try {
        const { content, school } = req.body;

        let images = [];
        if (req.files && req.files.length > 0) {
            console.log(`🖼️ [Backend] Processing ${req.files.length} images from upload`);
            images = req.files.map(file => file.path); // Cloudinary URLs
        } else if (req.body.images) {
            console.log('🖼️ [Backend] Using images from body');
            images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
        }

        if (!content) {
            console.log('❌ [Backend] createPost: Content is missing');
            return res.status(400).json({ message: 'Content is required' });
        }

        console.log('💾 [Backend] Saving post to database...');
        const post = await Post.create({
            userId: req.user._id,
            content,
            images,
            video: req.body.video,
            locations: req.body.locations,
            school: req.user.university,
            visibility: req.body.visibility || 'public'
        });

        console.log('🔍 [Backend] Polulating post data...');
        const populatedPost = await Post.findById(post._id)
            .populate('userId', 'name avatar university monetizationEnabled');

        // Emit real-time event
        const io = req.app.get('io');

        const p = populatedPost.toObject();
        const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };

        if (io) {
            console.log('📡 [Backend] Emitting real-time post event');
            io.emit('post:new', normalizedPost);
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [Backend] createPost success in ${duration}ms, post ID:`, post._id);
        res.status(201).json(normalizedPost);
    } catch (error) {
        console.error('❌ [Backend] createPost error:', error.message);
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

        const { content, images, video, locations, visibility } = req.body;

        post.content = content || post.content;
        post.images = images || post.images;
        post.video = video || post.video;
        post.locations = locations || post.locations;
        post.visibility = visibility || post.visibility;

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
        const userId = req.user._id;
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const alreadyLiked = post.likes.includes(userId);
        const update = alreadyLiked
            ? { $pull: { likes: userId } }
            : { $addToSet: { likes: userId } };

        const updatedPost = await Post.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        ).populate('userId', 'name avatar university followers');

        const p = updatedPost.toObject();
        const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };

        // Monetization logic
        const author = updatedPost.userId;
        if (!alreadyLiked && author && author.followers && author.followers.length >= 1000) {
            const currentLikes = updatedPost.likes.length;
            if (currentLikes > 0 && currentLikes % 100 === 0) {
                const Transaction = require('../models/Transaction');
                await User.findByIdAndUpdate(author._id, {
                    $inc: { walletBalance: 1, totalMonetizationEarnings: 1 }
                });
                await Transaction.create({
                    userId: author._id,
                    type: 'monetization_like',
                    amount: 1,
                    status: 'completed',
                    description: `Like milestone reached: ${currentLikes} likes`
                });
            }
        }

        // Emit real-time events
        const io = req.app.get('io');
        if (io) {
            io.emit('post:updated', normalizedPost);

            if (!alreadyLiked && post.userId.toString() !== userId.toString()) {
                const { createNotification } = require('./notificationController');
                await createNotification({
                    userId: post.userId,
                    type: 'like',
                    fromUserId: userId,
                    relatedId: post._id,
                    title: 'New Like',
                    message: `${req.user.name} liked your post`
                });
            }
        }

        res.json({ liked: !alreadyLiked, likesCount: updatedPost.likes.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Share post
// @route   POST /api/posts/:id/share
// @access  Private
const sharePost = async (req, res) => {
    try {
        const updatedPost = await Post.findByIdAndUpdate(
            req.params.id,
            { $inc: { shares: 1 } },
            { new: true }
        ).populate('userId', 'name avatar university monetizationEnabled');

        if (!updatedPost) return res.status(404).json({ message: 'Post not found' });

        const p = updatedPost.toObject();
        const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };

        const io = req.app.get('io');
        if (io) io.emit('post:updated', normalizedPost);

        // Notification for author
        if (updatedPost.userId.toString() !== req.user._id.toString()) {
            const { createNotification } = require('./notificationController');
            await createNotification({
                userId: updatedPost.userId,
                type: 'share',
                fromUserId: req.user._id,
                relatedId: updatedPost._id,
                title: 'Post Shared',
                message: `${req.user.name} shared your post`
            });
        }

        res.json({ sharesCount: updatedPost.shares });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bookmark/save post
// @route   POST /api/posts/:id/bookmark
// @access  Private
const bookmarkPost = async (req, res) => {
    try {
        const userId = req.user._id;
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const alreadySaved = post.savedBy.includes(userId);
        const update = alreadySaved
            ? { $pull: { savedBy: userId } }
            : { $addToSet: { savedBy: userId } };

        const updatedPost = await Post.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        ).populate('userId', 'name avatar university monetizationEnabled');

        const p = updatedPost.toObject();
        const normalizedPost = { ...p, user: p.userId, userId: p.userId?._id };

        const io = req.app.get('io');
        if (io) io.emit('post:updated', normalizedPost);

        res.json({ saved: !alreadySaved, savedCount: updatedPost.savedBy.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get posts by user
// @route   GET /api/posts/user/:userId
// @access  Public
const getUserPosts = async (req, res) => {
    const targetUserId = req.params.userId;
    console.log('📬 [Backend] Get Posts for user ID:', targetUserId);
    try {
        const { tab } = req.query;

        // BOLA Check: Block status
        if (req.user) {
            const targetUser = await User.findById(targetUserId);
            if (targetUser && (targetUser.blockedUsers.includes(req.user._id) || req.user.blockedUsers.includes(targetUserId))) {
                return res.status(403).json({ message: 'Access denied due to blocking' });
            }
        }

        let query = { userId: targetUserId };

        if (tab === 'Media') {
            query.images = { $exists: true, $ne: [] };
        } else if (tab === 'Likes') {
            query = { likes: req.params.userId };
        } else if (tab === 'Saved') {
            query = { savedBy: req.params.userId };
        }

        const posts = await Post.find(query)
            .populate('userId', 'name avatar university monetizationEnabled')
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

const reportPost = async (req, res) => {
    try {
        const { reason } = req.body;
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const Report = require('../models/Report');
        await Report.create({
            reporterId: req.user._id,
            targetId: post._id,
            targetType: 'post',
            reason: reason || 'Inappropriate content'
        });

        post.isReported = true;
        post.reportCount += 1;
        await post.save();

        res.json({ message: 'Post reported successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const notInterested = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.notInterestedPosts.includes(req.params.id)) {
            user.notInterestedPosts.push(req.params.id);
            await user.save();
        }

        res.json({ message: 'Target marked as not interested' });
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
    getUserPosts,
    reportPost,
    notInterested
};
