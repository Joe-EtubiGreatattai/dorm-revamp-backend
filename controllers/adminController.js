const User = require('../models/User');
const sanitize = require('mongo-sanitize');
const Order = require('../models/Order');
const Housing = require('../models/Housing');
const MarketItem = require('../models/MarketItem');
const Election = require('../models/Election');
const Post = require('../models/Post');
const ElectionNews = require('../models/ElectionNews');
const { sendPushNotification } = require('../utils/pushService');

// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalListings = await Housing.countDocuments();
        const totalMarketItems = await MarketItem.countDocuments();
        const activeOrders = await Order.countDocuments({ status: { $ne: 'delivered' } });

        // Calculate total volume (just a simple sum for now)
        const orders = await Order.find({ status: 'delivered' });
        const totalRevenue = orders.reduce((acc, order) => acc + (order.totalPrice || 0), 0);

        res.json({
            users: totalUsers,
            orders: totalOrders,
            activeOrders,
            listings: totalListings,
            marketItems: totalMarketItems,
            revenue: totalRevenue
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Users with pagination/search
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    try {
        const { page: pageQuery, keyword: keywordInput, role, status } = sanitize(req.query);
        const pageSize = 20;
        const page = Number(pageQuery) || 1;

        let query = {};

        if (keywordInput) {
            query.name = {
                $regex: String(keywordInput),
                $options: 'i',
            };
        }

        if (role && role !== 'all') {
            query.role = role;
        }

        if (status === 'banned') {
            query.isBanned = true;
        } else if (status === 'active') {
            query.isBanned = { $ne: true };
        }

        const count = await User.countDocuments(query);
        const users = await User.find(query)
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .select('-password')
            .sort({ createdAt: -1 });

        res.json({ users, page, pages: Math.ceil(count / pageSize) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Orders with pagination
// @route   GET /api/admin/orders
// @access  Private/Admin
const getAllOrders = async (req, res) => {
    try {
        const { page: pageQuery, status } = sanitize(req.query);
        const pageSize = 20;
        const page = Number(pageQuery) || 1;

        const filter = {};
        if (status) {
            filter.status = status;
        }

        const count = await Order.countDocuments(filter);
        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .populate('buyerId', 'name email')
            .populate('sellerId', 'name')
            .populate('itemId', 'title price images');

        res.json({ orders, page, pages: Math.ceil(count / pageSize), total: count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get User by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Order by ID
// @route   GET /api/admin/orders/:id
// @access  Private/Admin
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('buyerId', 'name email')
            .populate('sellerId', 'name')
            .populate('itemId', 'title price images');

        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Ban/Unban User
// @route   PUT /api/admin/users/:id/ban
// @access  Private/Admin
const banUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.isBanned = !user.isBanned;
            await user.save();

            // Send push notification
            if (user.pushTokens && user.pushTokens.length > 0) {
                const title = user.isBanned ? 'Account Banned' : 'Account Unbanned';
                const body = user.isBanned
                    ? 'Your account has been banned by an administrator.'
                    : 'Your account has been unbanned. You can now access the platform.';
                await sendPushNotification(user.pushTokens, title, body);
            }

            // Emit real-time ban event
            const io = req.app.get('io');
            if (io && user.isBanned) {
                console.log(`Backend: Emitting user:banned to room ${user._id.toString()}`);
                io.to(user._id.toString()).emit('user:banned', {
                    reason: user.banReason,
                    expiresAt: user.banExpires
                });
            }

            res.json({ message: `User ${user.isBanned ? 'banned' : 'unbanned'}`, isBanned: user.isBanned });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Market Items with pagination
// @route   GET /api/admin/market
// @access  Private/Admin
const getAllMarketItems = async (req, res) => {
    try {
        const { page: pageQuery, type, status } = sanitize(req.query);
        const pageSize = 20;
        const page = Number(pageQuery) || 1;

        const filter = {};
        if (type && type !== 'all') {
            filter.type = type;
        }
        if (status && status !== 'all') {
            filter.status = status;
        }

        const count = await MarketItem.countDocuments(filter);
        const marketItems = await MarketItem.find(filter)
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .populate('ownerId', 'name email');

        res.json({ marketItems, page, pages: Math.ceil(count / pageSize), total: count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Market Item by ID
// @route   GET /api/admin/market/:id
// @access  Private/Admin
const getMarketItemById = async (req, res) => {
    try {
        const item = await MarketItem.findById(req.params.id)
            .populate('ownerId', 'name email');
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ message: 'Item not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete Market Item
// @route   DELETE /api/admin/market/:id
// @access  Private/Admin
const deleteMarketItem = async (req, res) => {
    try {
        const item = await MarketItem.findById(req.params.id);
        if (item) {
            // Notify owner
            const owner = await User.findById(item.ownerId);
            if (owner && owner.pushTokens && owner.pushTokens.length > 0) {
                await sendPushNotification(owner.pushTokens, 'Item Removed', `Your market item "${item.title}" has been removed by an administrator.`);
            }

            await item.deleteOne();
            res.json({ message: 'Item removed' });
        } else {
            res.status(404).json({ message: 'Item not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Housing Listings with pagination
// @route   GET /api/admin/housing
// @access  Private/Admin
const getAllHousingListings = async (req, res) => {
    try {
        const { page: pageQuery, status } = sanitize(req.query);
        const pageSize = 20;
        const page = Number(pageQuery) || 1;

        const filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }

        const count = await Housing.countDocuments(filter);
        const listings = await Housing.find(filter)
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .populate('ownerId', 'name email');

        res.json({ listings, page, pages: Math.ceil(count / pageSize), total: count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Housing Listing by ID
// @route   GET /api/admin/housing/:id
// @access  Private/Admin
const getHousingListingById = async (req, res) => {
    try {
        const listing = await Housing.findById(req.params.id)
            .populate('ownerId', 'name email');
        if (listing) {
            res.json(listing);
        } else {
            res.status(404).json({ message: 'Listing not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify/Unverify Housing Listing (Update Status)
// @route   PATCH /api/admin/housing/:id
// @access  Private/Admin
const verifyHousingListing = async (req, res) => {
    try {
        const { verified } = req.body;
        const listing = await Housing.findById(req.params.id);

        if (listing) {
            if (verified === true) {
                listing.status = 'available';
            } else if (verified === false) {
                listing.status = 'inactive';
            }
            if (req.body.status) {
                listing.status = req.body.status;
            }

            await listing.save();

            // Notify owner
            const owner = await User.findById(listing.ownerId);
            if (owner && owner.pushTokens && owner.pushTokens.length > 0) {
                const title = 'Listing Status Updated';
                const body = `Your housing listing "${listing.title}" has been ${listing.status}.`;
                await sendPushNotification(owner.pushTokens, title, body);
            }

            res.json({ message: `Listing status updated to ${listing.status}`, listing });
        } else {
            res.status(404).json({ message: 'Listing not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete Housing Listing
// @route   DELETE /api/admin/housing/:id
// @access  Private/Admin
const deleteHousingListing = async (req, res) => {
    try {
        const listing = await Housing.findById(req.params.id);
        if (listing) {
            // Notify owner
            const owner = await User.findById(listing.ownerId);
            if (owner && owner.pushTokens && owner.pushTokens.length > 0) {
                await sendPushNotification(owner.pushTokens, 'Listing Removed', `Your housing listing "${listing.title}" has been removed by an administrator.`);
            }

            await listing.deleteOne();
            res.json({ message: 'Listing removed' });
        } else {
            res.status(404).json({ message: 'Listing not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Elections
// @route   GET /api/admin/elections
// @access  Private/Admin
const getAllElections = async (req, res) => {
    try {
        const elections = await Election.find().sort({ startDate: -1 });
        res.json(elections);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Election by ID
// @route   GET /api/admin/elections/:id
// @access  Private/Admin
const getElectionById = async (req, res) => {
    try {
        const election = await Election.findById(req.params.id)
            .populate('positions.candidates.user', 'name avatar');
        if (election) {
            res.json(election);
        } else {
            res.status(404).json({ message: 'Election not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create Election
// @route   POST /api/admin/elections
// @access  Private/Admin
const createElection = async (req, res) => {
    try {
        const { title, description, positions, startDate, endDate } = req.body;

        const election = new Election({
            title,
            description,
            positions: positions.map(p => ({ title: p, candidates: [] })),
            startDate: startDate || new Date(),
            endDate: endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'upcoming'
        });

        const createdElection = await election.save();
        res.status(201).json(createdElection);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update Election Status
// @route   PATCH /api/admin/elections/:id/status
// @access  Private/Admin
const updateElectionStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const election = await Election.findById(req.params.id);

        if (election) {
            election.status = status;
            await election.save();
            res.json(election);
        } else {
            res.status(404).json({ message: 'Election not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete Election
// @route   DELETE /api/admin/elections/:id
// @access  Private/Admin
const deleteElection = async (req, res) => {
    try {
        const election = await Election.findById(req.params.id);
        if (election) {
            await election.deleteOne();
            res.json({ message: 'Election removed' });
        } else {
            res.status(404).json({ message: 'Election not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Posts with pagination
// @route   GET /api/admin/posts
// @access  Private/Admin
const getAllPosts = async (req, res) => {
    try {
        const { page: pageQuery, reported } = sanitize(req.query);
        const pageSize = 20;
        const page = Number(pageQuery) || 1;

        const filter = {};
        if (reported === 'true') {
            filter.isReported = true;
        }

        const count = await Post.countDocuments(filter);
        const posts = await Post.find(filter)
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .populate('userId', 'name email avatar');

        // Transform to match frontend expectations
        const transformedPosts = posts.map(post => ({
            _id: post._id,
            content: post.content,
            images: post.images,
            author: {
                name: post.userId?.name || 'Unknown',
                email: post.userId?.email,
                avatar: post.userId?.avatar
            },
            likes: post.likes?.length || 0,
            comments: post.comments?.length || 0,
            shares: post.shares || 0,
            isReported: post.isReported,
            reportCount: post.reportCount,
            createdAt: post.createdAt
        }));

        res.json({ posts: transformedPosts, page, pages: Math.ceil(count / pageSize), total: count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Post by ID
// @route   GET /api/admin/posts/:id
// @access  Private/Admin
const getPostById = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('userId', 'name email avatar')
            .populate({
                path: 'comments',
                populate: { path: 'userId', select: 'name avatar' }
            });

        if (post) {
            res.json(post);
        } else {
            res.status(404).json({ message: 'Post not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete Post (Admin)
// @route   DELETE /api/admin/posts/:id
// @access  Private/Admin
const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (post) {
            // Notify author
            const author = await User.findById(post.userId);
            if (author && author.pushTokens && author.pushTokens.length > 0) {
                await sendPushNotification(author.pushTokens, 'Post Removed', `Your post has been removed by an administrator for violating our community guidelines.`);
            }

            await post.deleteOne();
            res.json({ message: 'Post removed' });
        } else {
            res.status(404).json({ message: 'Post not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Election News
// @route   GET /api/admin/election-news
// @access  Private/Admin
const getAllElectionNews = async (req, res) => {
    try {
        const pageSize = 20;
        const page = Number(req.query.page) || 1;

        const count = await ElectionNews.countDocuments();
        const newsItems = await ElectionNews.find()
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.json({ newsItems, page, pages: Math.ceil(count / pageSize), total: count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Election News by ID
// @route   GET /api/admin/election-news/:id
// @access  Private/Admin
const getElectionNewsById = async (req, res) => {
    try {
        const newsItem = await ElectionNews.findById(req.params.id);
        if (newsItem) {
            res.json(newsItem);
        } else {
            res.status(404).json({ message: 'News item not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create Election News
// @route   POST /api/admin/election-news
// @access  Private/Admin
const createElectionNews = async (req, res) => {
    try {
        const { title, summary, content, image } = req.body;

        if (!title || !summary || !content) {
            return res.status(400).json({ message: 'Title, summary, and content are required' });
        }

        const newsItem = await ElectionNews.create({
            title,
            summary,
            content,
            image
        });

        res.status(201).json(newsItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update Election News
// @route   PUT /api/admin/election-news/:id
// @access  Private/Admin
const updateElectionNews = async (req, res) => {
    try {
        const { title, summary, content, image } = req.body;
        const newsItem = await ElectionNews.findById(req.params.id);

        if (newsItem) {
            newsItem.title = title || newsItem.title;
            newsItem.summary = summary || newsItem.summary;
            newsItem.content = content || newsItem.content;
            newsItem.image = image || newsItem.image;

            const updatedNews = await newsItem.save();
            res.json(updatedNews);
        } else {
            res.status(404).json({ message: 'News item not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete Election News
// @route   DELETE /api/admin/election-news/:id
// @access  Private/Admin
const deleteElectionNews = async (req, res) => {
    try {
        const newsItem = await ElectionNews.findById(req.params.id);
        if (newsItem) {
            await newsItem.deleteOne();
            res.json({ message: 'News item removed' });
        } else {
            res.status(404).json({ message: 'News item not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update User Role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;

        if (!['user', 'admin', 'ambassador'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const user = await User.findById(req.params.id);
        if (user) {
            user.role = role;
            await user.save();

            // Notify user
            if (user.pushTokens && user.pushTokens.length > 0) {
                await sendPushNotification(user.pushTokens, 'Role Updated', `Your account role has been updated to ${role}.`);
            }

            res.json({ message: `User role updated to ${role}`, role: user.role });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, eta, pickupPoint } = req.body;

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (status) order.status = status;
        if (eta) order.eta = eta;
        if (pickupPoint) order.pickupPoint = pickupPoint;

        await order.save();
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateMarketItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { isFreeMerch, stock } = req.body;

        const item = await MarketItem.findById(id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        if (isFreeMerch !== undefined) item.isFreeMerch = isFreeMerch;
        if (stock !== undefined) item.stock = stock;

        await item.save();

        if (isFreeMerch === true) {
            const owner = await User.findById(item.ownerId);
            if (owner && owner.pushTokens && owner.pushTokens.length > 0) {
                await sendPushNotification(owner.pushTokens, 'Item Marked as Free', `Your item "${item.title}" has been marked as free merch by the admin!`);
            }
        }

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            const populatedItem = await MarketItem.findById(item._id)
                .populate('ownerId', 'name avatar university');
            io.emit('market:itemUpdated', populatedItem);
        }

        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const Appeal = require('../models/Appeal');

// @desc    Get All Appeals
// @route   GET /api/admin/appeals
// @access  Private/Admin
const getAllAppeals = async (req, res) => {
    try {
        const appeals = await Appeal.find()
            .populate('userId', 'name email avatar')
            .sort({ createdAt: -1 });
        res.json(appeals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Appeal Status
// @route   PUT /api/admin/appeals/:id
// @access  Private/Admin
const updateAppealStatus = async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const appeal = await Appeal.findById(req.params.id);

        if (!appeal) {
            return res.status(404).json({ message: 'Appeal not found' });
        }

        appeal.status = status;
        appeal.adminNotes = adminNotes || appeal.adminNotes;
        await appeal.save();

        // If approved, unban the user
        if (status === 'approved') {
            const user = await User.findById(appeal.userId);
            if (user) {
                user.isBanned = false;
                user.banReason = undefined;
                user.banExpires = undefined;
                user.banReason = undefined;
                user.banExpires = undefined;
                await user.save();

                // Notify user
                if (user.pushTokens && user.pushTokens.length > 0) {
                    await sendPushNotification(user.pushTokens, 'Appeal Approved', 'Your ban appeal has been approved. You can now access your account.');
                }
            }
        } else if (status === 'rejected') {
            const user = await User.findById(appeal.userId);
            if (user && user.pushTokens && user.pushTokens.length > 0) {
                await sendPushNotification(user.pushTokens, 'Appeal Rejected', 'Your ban appeal has been rejected.');
            }
        }

        res.json({ message: 'Appeal status updated', appeal });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getAllUsers,
    getAllOrders,
    getUserById,
    getOrderById,
    banUser,
    updateUserRole,
    getAllMarketItems,
    getMarketItemById,
    deleteMarketItem,
    getAllHousingListings,
    getHousingListingById,
    verifyHousingListing,
    deleteHousingListing,
    getAllElections,
    getElectionById,
    createElection,
    updateElectionStatus,
    deleteElection,
    getAllPosts,
    getPostById,
    deletePost,
    getAllElectionNews,
    getElectionNewsById,
    createElectionNews,
    updateElectionNews,
    deleteElectionNews,
    updateOrder,
    updateMarketItem,
    getAllAppeals,
    updateAppealStatus
};
