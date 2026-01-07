const mongoose = require('mongoose');
const TourRequest = require('../models/TourRequest');
const { createNotification } = require('./notificationController');
const Housing = require('../models/Housing');

// @desc    Get user's tour requests
// @route   GET /api/tours
// @access  Private
const getTours = async (req, res) => {
    try {
        const tours = await TourRequest.find({
            $or: [
                { requesterId: req.user._id },
                { ownerId: req.user._id }
            ]
        })
            .populate('requesterId', 'name avatar university')
            .populate('ownerId', 'name avatar university')
            .populate('listingId', 'title address images')
            .sort({ createdAt: -1 });

        res.json(tours);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single tour request
// @route   GET /api/tours/:id
// @access  Private
const getTour = async (req, res) => {
    try {
        const tour = await TourRequest.findById(req.params.id)
            .populate('requesterId', 'name avatar phoneNumber university')
            .populate('ownerId', 'name avatar phoneNumber university')
            .populate('listingId');

        if (!tour) {
            return res.status(404).json({ message: 'Tour request not found' });
        }

        // Check authorization
        if (
            tour.requesterId._id.toString() !== req.user._id.toString() &&
            tour.ownerId._id.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(tour);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Accept tour request
// @route   PUT /api/tours/:id/accept
// @access  Private
const acceptTour = async (req, res) => {
    try {
        const tour = await TourRequest.findById(req.params.id).populate('listingId', 'title');

        if (!tour) {
            return res.status(404).json({ message: 'Tour request not found' });
        }

        if (tour.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        tour.status = 'accepted';
        tour.meetingPoint = req.body.meetingPoint;
        if (req.body.preferredDate) tour.preferredDate = req.body.preferredDate;
        if (req.body.preferredTime) tour.preferredTime = req.body.preferredTime;
        await tour.save();

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to(tour.requesterId.toString()).emit('tour:statusUpdate', {
                tourId: tour._id,
                status: 'accepted',
                meetingPoint: tour.meetingPoint
            });
        }

        // Create persistent notification
        await createNotification({
            userId: tour.requesterId,
            fromUserId: req.user._id,
            type: 'tour',
            relatedId: tour._id.toString(),
            title: 'Tour Request Accepted',
            message: `The owner has accepted your tour request for "${tour.listingId?.title || 'the apartment'}". Meeting point: ${tour.meetingPoint}`
        });

        // Fetch fully populated tour to return
        const updatedTour = await TourRequest.findById(tour._id)
            .populate('requesterId', 'name avatar phoneNumber university')
            .populate('ownerId', 'name avatar phoneNumber university')
            .populate('listingId');

        res.json(updatedTour);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Decline tour request
// @route   PUT /api/tours/:id/decline
// @access  Private
const declineTour = async (req, res) => {
    try {
        const tour = await TourRequest.findById(req.params.id).populate('listingId', 'title');

        if (!tour) {
            return res.status(404).json({ message: 'Tour request not found' });
        }

        if (tour.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        tour.status = 'declined';
        await tour.save();

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to(tour.requesterId.toString()).emit('tour:statusUpdate', {
                tourId: tour._id,
                status: 'declined'
            });
        }

        // Create persistent notification
        await createNotification({
            userId: tour.requesterId,
            fromUserId: req.user._id,
            type: 'tour',
            relatedId: tour._id.toString(),
            title: 'Tour Request Declined',
            message: `Your tour request for "${tour.listingId?.title || 'the apartment'}" was declined.`
        });

        // Fetch fully populated tour to return
        const updatedTour = await TourRequest.findById(tour._id)
            .populate('requesterId', 'name avatar phoneNumber university')
            .populate('ownerId', 'name avatar phoneNumber university')
            .populate('listingId');

        res.json(updatedTour);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Complete tour request
// @route   PUT /api/tours/:id/complete
// @access  Private
const completeTour = async (req, res) => {
    try {
        const tour = await TourRequest.findById(req.params.id).populate('listingId', 'title');

        if (!tour) {
            return res.status(404).json({ message: 'Tour request not found' });
        }

        if (tour.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        tour.status = 'completed';
        await tour.save();

        // Fetch fully populated tour to return
        const updatedTour = await TourRequest.findById(tour._id)
            .populate('requesterId', 'name avatar phoneNumber university')
            .populate('ownerId', 'name avatar phoneNumber university')
            .populate('listingId');

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to(tour.requesterId.toString()).emit('tour:statusUpdate', {
                tourId: tour._id,
                status: 'completed'
            });
        }

        // Create notification for student
        await createNotification({
            userId: tour.requesterId,
            fromUserId: req.user._id,
            type: 'tour',
            relatedId: tour._id.toString(),
            title: 'Tour Completed',
            message: `The agent has marked your tour for "${updatedTour.listingId?.title || 'the apartment'}" as completed. You can now proceed with rent payment.`
        });

        res.json(updatedTour);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Pay rent for tour listing
// @route   POST /api/tours/:id/pay
// @access  Private
const payRent = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const Transaction = require('../models/Transaction');
        const User = require('../models/User');

        const tour = await TourRequest.findById(req.params.id).populate('listingId').session(session);
        if (!tour) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Tour record not found' });
        }
        if (tour.status !== 'completed') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Tour must be completed before payment' });
        }
        if (tour.requesterId.toString() !== req.user._id.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Not authorized' });
        }

        const amount = tour.listingId.price;
        const agentId = tour.ownerId;

        // ATOMIC UPDATE: Deduct from student
        const student = await User.findOneAndUpdate(
            { _id: req.user._id, walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount } },
            { new: true, session }
        );

        if (!student) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Insufficient wallet balance' });
        }

        // ATOMIC UPDATE: Add to agent
        await User.findOneAndUpdate(
            { _id: agentId },
            { $inc: { walletBalance: amount } },
            { session }
        );

        // Create transaction records
        await Transaction.create([{
            userId: req.user._id,
            type: 'rent_payment',
            amount: -amount,
            status: 'completed',
            marketItemId: tour.listingId._id.toString()
        }, {
            userId: agentId,
            type: 'rent_receive',
            amount: amount,
            status: 'completed',
            marketItemId: tour.listingId._id.toString()
        }], { session });

        // Update tour status to paid and housing status to rented
        tour.status = 'paid';
        await tour.save({ session });

        if (tour.listingId) {
            const hId = tour.listingId._id || tour.listingId;
            const housing = await Housing.findById(hId).session(session);
            if (housing) {
                housing.status = 'rented';
                await housing.save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        // Secondary actions (Non-blocking)
        try {
            const agent = await User.findById(agentId);
            await createNotification({
                userId: agentId,
                fromUserId: req.user._id,
                type: 'tour',
                relatedId: tour._id.toString(),
                title: 'Rent Payment Received',
                message: `${student.name} has paid ₦${amount.toLocaleString()} rent for "${tour.listingId.title}"`
            });

            const io = req.app.get('io');
            if (io) {
                io.emit('wallet:updated', { userId: req.user._id, balance: student.walletBalance });
                if (agent) io.emit('wallet:updated', { userId: agentId, balance: agent.walletBalance });

                if (tour.listingId) {
                    io.emit('housing:statusUpdate', {
                        listingId: tour.listingId._id,
                        status: 'rented'
                    });
                }
            }
        } catch (err) {
            console.error('Secondary action failed:', err);
        }

        res.json({ message: 'Payment successful', balance: student.walletBalance });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getTours,
    getTour,
    acceptTour,
    declineTour,
    completeTour,
    payRent
};
