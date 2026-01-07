const mongoose = require('mongoose');
const MarketItem = require('../models/MarketItem');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

// @desc    Get all market items
// @route   GET /api/market/items
// @access  Public
const getItems = async (req, res) => {
    try {
        const { type, category, search, minPrice, maxPrice, condition, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        let query = { status: 'available' };

        if (type) query.type = type;
        if (category) query.category = category;
        if (condition && condition !== 'Any') query.condition = condition;

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseInt(minPrice);
            if (maxPrice) query.price.$lte = parseInt(maxPrice);
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter out blocked users if logged in
        if (req.user && req.user.blockedUsers && req.user.blockedUsers.length > 0) {
            query.ownerId = { $nin: req.user.blockedUsers };
        }

        const items = await MarketItem.find(query)
            .populate('ownerId', 'name avatar university')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await MarketItem.countDocuments(query);

        res.json({
            items,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single market item
// @route   GET /api/market/items/:id
// @access  Public
const getItem = async (req, res) => {
    try {
        const item = await MarketItem.findById(req.params.id)
            .populate('ownerId', 'name avatar university');

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        // BOLA Check: Block status
        if (req.user) {
            const targetUser = await User.findById(item.ownerId._id);
            if (targetUser && (targetUser.blockedUsers.includes(req.user._id) || req.user.blockedUsers.includes(targetUser._id))) {
                return res.status(403).json({ message: 'Access denied due to blocking' });
            }
        }

        // Increment views atomically
        await MarketItem.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create market item
// @route   POST /api/market/items
// @access  Private
const createItem = async (req, res) => {
    console.log('🛒 [Backend] createItem called');
    console.log('🛒 [Backend] Request body:', req.body);
    console.log('🛒 [Backend] User ID:', req.user._id);
    try {
        const itemData = {
            ...req.body,
            ownerId: req.user._id
        };
        console.log('📝 [Backend] Creating item with data:', itemData);

        const item = await MarketItem.create(itemData);
        console.log('✅ [Backend] Item created:', item._id);
        const populatedItem = await MarketItem.findById(item._id)
            .populate('ownerId', 'name avatar university');

        res.status(201).json(populatedItem);
    } catch (error) {
        console.log('❌ [Backend] Error:', error.message);
        console.log('❌ [Backend] Stack:', error.stack);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update market item
// @route   PUT /api/market/items/:id
// @access  Private
const updateItem = async (req, res) => {
    try {
        const item = await MarketItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        if (item.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updatedItem = await MarketItem.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('ownerId', 'name avatar university');

        res.json(updatedItem);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete market item
// @route   DELETE /api/market/items/:id
// @access  Private
const deleteItem = async (req, res) => {
    try {
        const item = await MarketItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        if (item.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await item.deleteOne();
        res.json({ message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Purchase item (create order with escrow)
// @route   POST /api/market/items/:id/purchase
// @access  Private
const purchaseItem = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const item = await MarketItem.findById(req.params.id).session(session);

        if (!item) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Item not found' });
        }

        if (item.status !== 'available') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Item is not available' });
        }

        // ATOMIC UPDATE: Deduct from buyer wallet and add to escrow
        const buyer = await User.findOneAndUpdate(
            { _id: req.user._id, walletBalance: { $gte: item.price } },
            { $inc: { walletBalance: -item.price, escrowBalance: item.price } },
            { new: true, session }
        );

        if (!buyer) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Insufficient wallet balance' });
        }

        // Create order with escrow
        const order = await Order.create([{
            buyerId: req.user._id,
            sellerId: item.ownerId,
            itemId: item._id,
            amount: item.price,
            escrowAmount: item.price,
            escrowStatus: 'held'
        }], { session });

        // Create escrow transaction
        await Transaction.create([{
            userId: req.user._id,
            type: 'escrow_hold',
            amount: -item.price, // Negative for deduction
            status: 'completed',
            orderId: order[0]._id
        }], { session });

        // Update item status
        item.status = 'sold';
        await item.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Secondary actions (Non-blocking)
        try {
            await createNotification({
                userId: item.ownerId,
                fromUserId: req.user._id,
                type: 'order',
                title: 'New Order Received',
                message: `Your item "${item.title}" has been purchased by ${buyer.name} for ₦${item.price.toLocaleString()}. Check your active orders.`,
                relatedId: order[0]._id.toString()
            });

            const io = req.app.get('io');
            if (io) {
                io.emit('wallet:updated', { userId: req.user._id, balance: buyer.walletBalance });
            }
        } catch (err) {
            console.error('Market purchase notification error:', err);
        }

        res.status(201).json({
            message: 'Purchase successful',
            order: order[0],
            escrowBalance: buyer.escrowBalance
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};


// @desc    Get logged in user items
// @route   GET /api/market/my-items
// @access  Private
const getUserItems = async (req, res) => {
    try {
        const items = await MarketItem.find({ ownerId: req.user._id })
            .sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getItems,
    getItem,
    getUserItems,
    createItem,
    updateItem,
    deleteItem,
    purchaseItem
};
