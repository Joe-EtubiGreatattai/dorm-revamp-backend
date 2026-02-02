const mongoose = require('mongoose');
const MarketItem = require('../models/MarketItem');
const Order = require('../models/Order');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { createNotification } = require('./notificationController');

// @desc    Get user's orders
// @route   GET /api/orders?role=buyer|seller|all
// @access  Private
const getOrders = async (req, res) => {
    try {
        const { role = 'buyer' } = req.query;

        let query = {};

        if (role === 'buyer') {
            // Only orders where user is the buyer
            query = { buyerId: req.user._id };
        } else if (role === 'seller') {
            // Only orders where user is the seller
            query = { sellerId: req.user._id };
        } else if (role === 'all') {
            // Both buyer and seller orders
            query = {
                $or: [
                    { buyerId: req.user._id },
                    { sellerId: req.user._id }
                ]
            };
        }

        const orders = await Order.find(query)
            .populate('buyerId', 'name avatar')
            .populate('sellerId', 'name avatar')
            .populate('itemId', 'title images price')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('buyerId', 'name avatar university')
            .populate('sellerId', 'name avatar university')
            .populate('itemId');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is buyer or seller
        if (
            order.buyerId._id.toString() !== req.user._id.toString() &&
            order.sellerId._id.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
const updateStatus = async (req, res) => {
    console.log('🔄 [BACKEND] updateStatus called');
    console.log('🔄 [BACKEND] Order ID:', req.params.id);
    console.log('🔄 [BACKEND] Request body:', req.body);
    console.log('🔄 [BACKEND] User ID:', req.user?._id);

    try {
        const { status, eta } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            console.log('❌ [BACKEND] Order not found:', req.params.id);
            return res.status(404).json({ message: 'Order not found' });
        }

        console.log('🔄 [BACKEND] Found order:', {
            orderId: order._id,
            currentStatus: order.status,
            currentETA: order.eta,
            sellerId: order.sellerId,
            buyerId: order.buyerId
        });

        // Only seller can update status
        if (order.sellerId.toString() !== req.user._id.toString()) {
            console.log('❌ [BACKEND] Authorization failed:', {
                orderSellerId: order.sellerId.toString(),
                userId: req.user._id.toString()
            });
            return res.status(403).json({ message: 'Not authorized' });
        }

        console.log('✅ [BACKEND] Authorization passed');

        // Update status if provided
        if (status) {
            console.log('🔄 [BACKEND] Updating status:', status);
            order.status = status;
        }

        // Update ETA if provided
        if (eta) {
            console.log('🔄 [BACKEND] Updating ETA:', eta);
            order.eta = eta;
        }

        await order.save();
        console.log('✅ [BACKEND] Order saved successfully');

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            console.log('🔄 [BACKEND] Emitting socket event to buyer:', order.buyerId.toString());
            io.to(order.buyerId.toString()).emit('order:statusUpdate', {
                orderId: order._id,
                status: order.status,
                eta: order.eta
            });
        } else {
            console.log('⚠️ [BACKEND] Socket.io not available');
        }

        // Create notification for buyer
        let notificationMessage = `Your order status has been updated to ${order.status}.`;
        if (order.status === 'delivered') {
            notificationMessage = "Your order has been delivered! Please confirm you've received it to release funds.";
        }

        await createNotification({
            userId: order.buyerId,
            type: 'order',
            title: 'Order Status Updated',
            message: notificationMessage,
            relatedId: order._id.toString(),
            fromUserId: req.user._id // The seller
        });

        console.log('✅ [BACKEND] Sending response:', order);
        res.json(order);
    } catch (error) {
        console.error('❌ [BACKEND] Error in updateStatus:', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ message: error.message });
    }
};

// @desc    Confirm receipt and release escrow
// @route   POST /api/orders/:id/confirm
// @access  Private
const confirmReceipt = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const order = await Order.findById(req.params.id).session(session);

        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Order not found' });
        }

        // Only buyer can confirm
        if (order.buyerId.toString() !== req.user._id.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (order.escrowStatus === 'released') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Escrow already released' });
        }

        const buyerId = order.buyerId;
        const sellerId = order.sellerId;
        const amount = order.escrowAmount;

        // ATOMIC UPDATE: Deduct from buyer escrow
        const buyer = await User.findOneAndUpdate(
            { _id: buyerId, escrowBalance: { $gte: amount } },
            { $inc: { escrowBalance: -amount } },
            { new: true, session }
        );

        if (!buyer) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Integrity error: Escrow balance insufficient for release' });
        }

        // ATOMIC UPDATE: Add to seller wallet
        const seller = await User.findOneAndUpdate(
            { _id: sellerId },
            { $inc: { walletBalance: amount } },
            { new: true, session }
        );

        if (!seller) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Seller not found' });
        }

        // Update order
        order.escrowStatus = 'released';
        order.status = 'delivered';
        await order.save({ session });

        // Create transaction record for escrow release
        await Transaction.create([{
            userId: sellerId,
            type: 'escrow_release',
            amount: amount,
            status: 'completed',
            orderId: order._id
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // Secondary actions (Non-blocking)
        try {
            const io = req.app.get('io');
            if (io) {
                io.to(sellerId.toString()).emit('order:escrowReleased', {
                    orderId: order._id,
                    amount: amount,
                    message: 'Funds have been released to your wallet'
                });
                io.emit('wallet:updated', { userId: sellerId, balance: seller.walletBalance });
            }

            await createNotification({
                userId: sellerId,
                type: 'order',
                title: 'Funds Released',
                message: `Funds for your order have been released to your wallet.`,
                relatedId: order._id.toString(),
                fromUserId: buyerId
            });
        } catch (err) {
            console.error('Secondary action failed:', err);
        }

        res.json({
            message: 'Funds released to seller',
            order
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel order
// @route   POST /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const order = await Order.findById(req.params.id).session(session);

        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Order not found' });
        }

        // Only buyer can cancel
        if (order.buyerId.toString() !== req.user._id.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Only the buyer can cancel this order' });
        }

        // Check if order is cancellable (pending or processing)
        const nonCancellableStatuses = ['shipping', 'delivered', 'cancelled'];
        if (nonCancellableStatuses.includes(order.status)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: `Order cannot be cancelled because it is already ${order.status}`
            });
        }

        const buyerId = order.buyerId;
        const amount = order.escrowAmount;

        // 1. ATOMIC UPDATE: Refund escrow to buyer
        let buyer;
        if (order.escrowStatus === 'held') {
            buyer = await User.findOneAndUpdate(
                { _id: buyerId, escrowBalance: { $gte: amount } },
                { $inc: { escrowBalance: -amount, walletBalance: amount } },
                { new: true, session }
            );

            if (!buyer) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: 'Integrity error: Escrow balance insufficient for refund' });
            }
            order.escrowStatus = 'released';
        }

        // 2. Update order status
        order.status = 'cancelled';
        await order.save({ session });

        // 3. Make item available again
        if (order.itemId) {
            await MarketItem.findByIdAndUpdate(order.itemId, { status: 'available' }, { session });
        }

        // 4. Create transaction record for refund
        await Transaction.create([{
            userId: buyerId,
            type: 'escrow_release',
            amount: amount,
            status: 'completed',
            orderId: order._id,
            marketItemId: order.itemId?.toString()
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // Secondary actions (Non-blocking)
        try {
            const io = req.app.get('io');
            if (io) {
                io.to(order.sellerId.toString()).emit('order:cancelled', {
                    orderId: order._id,
                    message: 'A buyer has cancelled their order'
                });
                if (buyer) io.emit('wallet:updated', { userId: buyerId, balance: buyer.walletBalance });
                io.emit('market:itemUpdated', { itemId: order.itemId, status: 'available' });
            }

            await createNotification({
                userId: order.sellerId,
                type: 'order',
                title: 'Order Cancelled',
                message: `A buyer has cancelled their order. Funds have been returned to them.`,
                relatedId: order._id.toString(),
                fromUserId: req.user._id
            });
        } catch (err) {
            console.error('Secondary action failed:', err);
        }

        res.json({
            message: 'Order cancelled and funds refunded',
            order
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getOrders,
    getOrder,
    updateStatus,
    confirmReceipt,
    cancelOrder
};
