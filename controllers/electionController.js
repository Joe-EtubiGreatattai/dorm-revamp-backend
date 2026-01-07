const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Election = require('../models/Election');
const ElectionNews = require('../models/ElectionNews');
const Vote = require('../models/Vote');
const CandidateApplication = require('../models/CandidateApplication');
const Notification = require('../models/Notification');
const { createNotification } = require('./notificationController');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Get all active elections
// @route   GET /api/elections
// @access  Public
const getElections = async (req, res) => {
    try {
        let query = {};
        if (req.user && req.user.blockedUsers && req.user.blockedUsers.length > 0) {
            query.createdBy = { $nin: req.user.blockedUsers };
        }
        const elections = await Election.find(query).sort({ startDate: 1 });

        // Add aggregate stats for each election
        const electionsWithStats = elections.map(election => {
            const electionObj = election.toObject();

            // Calculate total votes across all positions
            const totalVotes = election.positions.reduce((total, pos) => {
                return total + pos.candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
            }, 0);

            electionObj.votesCast = totalVotes;
            electionObj.totalVoters = election.voters?.length || 0;

            return electionObj;
        });

        res.json(electionsWithStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single election
// @route   GET /api/elections/:id
// @access  Public
const getElection = async (req, res) => {
    try {
        const election = await Election.findById(req.params.id)
            .populate('positions.candidates.user', 'name avatar');

        if (!election) {
            return res.status(404).json({ message: 'Election not found' });
        }

        let electionObj = election.toObject();

        // Calculate votesCast summary
        const totalVotes = election.positions.reduce((total, pos) => {
            return total + pos.candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
        }, 0);
        electionObj.votesCast = totalVotes;
        electionObj.totalVoters = election.voters?.length || 0;

        // Include user's application status and voting status
        if (req.user) {
            // Check application
            const application = await CandidateApplication.findOne({
                electionId: election._id,
                userId: req.user._id
            });
            electionObj.myApplication = application ? {
                status: application.status,
                positionId: application.positionId,
                createdAt: application.createdAt
            } : null;

            // Check voting status for all positions
            const userVotes = await Vote.find({
                userId: req.user._id,
                electionId: election._id
            }).select('positionId');
            const votedPositionIds = userVotes.map(v => v.positionId.toString());

            electionObj.positions = electionObj.positions.map(pos => ({
                ...pos,
                hasVoted: votedPositionIds.includes(pos._id.toString())
            }));
        }

        res.json(electionObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new election (Admin or authorized user)
// @route   POST /api/elections
// @access  Private
const createElection = async (req, res) => {
    try {
        const { title, description, positions, startDate, endDate, contestantFee } = req.body;

        const election = new Election({
            title,
            description,
            positions: positions.map(p => ({ title: p, candidates: [] })),
            startDate: startDate || new Date(),
            endDate: endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
            status: 'upcoming',
            contestantFee: contestantFee || 0,
            createdBy: req.user._id
        });

        const createdElection = await election.save();

        // Notify creator that election is pending review
        await createNotification({
            userId: req.user._id,
            type: 'election_created',
            title: 'Election Created!',
            message: `Your election "${title}" has been submitted for review. Candidates can begin applying once it's verified.`,
            relatedId: createdElection._id
        });

        res.status(201).json(createdElection);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get election news
// @route   GET /api/elections/news
// @access  Public
const getNews = async (req, res) => {
    try {
        const news = await ElectionNews.find().sort({ createdAt: -1 });
        res.json(news);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single news item
// @route   GET /api/elections/news/:id
// @access  Public
const getNewsItem = async (req, res) => {
    try {
        const newsItem = await ElectionNews.findById(req.params.id);
        if (!newsItem) {
            return res.status(404).json({ message: 'News item not found' });
        }
        res.json(newsItem);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cast a vote
// @route   POST /api/elections/:id/vote
// @access  Private
const vote = async (req, res) => {
    try {
        const { positionId, candidateId } = req.body;
        const electionId = req.params.id;
        const userId = req.user._id;
        const election = await Election.findById(electionId);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        if (election.status !== 'active') {
            return res.status(400).json({ message: `Election is not active (status: ${election.status})` });
        }

        // 1. Check if user already voted for this specific position
        const existingVote = await Vote.findOne({ userId, electionId, positionId });
        if (existingVote) {
            return res.status(400).json({ message: 'You have already voted for this position' });
        }

        // 2. Identify the position and candidate
        const originalPos = election.positions.id(positionId) || election.positions.find(p => p._id.toString() === positionId);
        if (!originalPos) {
            return res.status(404).json({ message: 'Position not found in this election' });
        }

        const originalCand = originalPos.candidates.id(candidateId);
        if (!originalCand) {
            return res.status(404).json({ message: 'Candidate not found in this position' });
        }

        // 3. Increment vote count & track participation
        originalCand.votes = (originalCand.votes || 0) + 1;

        // Use set to avoid duplicates since voters stores IDs
        if (!election.voters.map(id => id.toString()).includes(userId.toString())) {
            election.voters.push(userId);
        }

        // 4. Save Election FIRST to ensure count is reflected
        await election.save();

        // 5. Create vote record (enforced by DB unique index as well)
        // Note: Done AFTER election.save to ensure we only block further attempts if this one was successful
        const newVote = await Vote.create({
            userId,
            electionId,
            positionId,
            candidateId
        });

        // 6. Secondary actions (Notifications & Sockets) - failures here shouldn't block the vote count
        try {
            const populatedUser = await User.findById(originalCand.user).select('name');
            await createNotification({
                userId,
                type: 'vote_cast',
                title: 'Vote Recorded!',
                message: `Your vote for ${populatedUser?.name || 'the candidate'} for the position of ${originalPos.title} has been securely recorded.`,
                relatedId: election._id,
                fromUserId: req.user._id // Optional but helps normalization
            });

            const io = req.app.get('io');
            if (io) {
                const broadcastElection = await Election.findById(electionId).populate('positions.candidates.user', 'name avatar');
                const totalVotes = broadcastElection.positions.reduce((total, pos) => {
                    return total + pos.candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
                }, 0);

                io.emit('election:updated', {
                    electionId: election._id,
                    votesCast: totalVotes,
                    positions: broadcastElection.positions
                });
            }
        } catch (secondaryError) {
            console.error('Non-blocking secondary action failed:', secondaryError);
        }

        res.status(201).json({ message: 'Vote cast successfully', vote: newVote });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'You have already cast a vote for this position' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get election results
// @route   GET /api/elections/:id/results
// @access  Public
const getResults = async (req, res) => {
    try {
        let election;
        if (req.params.id === 'latest') {
            election = await Election.findOne({ status: 'ended' })
                .sort({ endDate: -1 })
                .populate('positions.candidates.user', 'name avatar');

            if (!election) {
                return res.status(404).json({ message: 'No completed elections found' });
            }
        } else {
            election = await Election.findById(req.params.id)
                .populate('positions.candidates.user', 'name avatar');
        }

        if (!election) return res.status(404).json({ message: 'Election not found' });

        let electionObj = election.toObject();

        // Calculate votesCast summary
        const totalVotes = election.positions.reduce((total, pos) => {
            return total + pos.candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
        }, 0);
        electionObj.votesCast = totalVotes;
        electionObj.totalVoters = election.voters?.length || 0;

        // If user is logged in, check which positions they have already voted for
        if (req.user) {
            const userVotes = await Vote.find({
                userId: req.user._id,
                electionId: election._id
            }).select('positionId');

            const votedPositionIds = userVotes.map(v => v.positionId.toString());

            electionObj.positions = electionObj.positions.map(pos => ({
                ...pos,
                hasVoted: votedPositionIds.includes(pos._id.toString())
            }));
        }

        res.json(electionObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get a single position by ID (searches across elections)
// @route   GET /api/elections/positions/:id
// @access  Public
const getPosition = async (req, res) => {
    try {
        const positionId = req.params.id;

        // Find the election that contains this position
        const election = await Election.findOne({ 'positions._id': positionId })
            .populate('positions.candidates.user', 'name avatar');

        if (!election) {
            return res.status(404).json({ message: 'Position not found' });
        }

        // Find the specific position
        const position = election.positions.find(p => p._id.toString() === positionId);

        if (!position) {
            return res.status(404).json({ message: 'Position not found' });
        }

        let positionObj = position.toObject();
        positionObj.candidates = position.candidates.map(cand => ({
            ...cand.toObject(),
            name: cand.user?.name,
            avatar: cand.user?.avatar
        }));
        positionObj.election = {
            _id: election._id,
            title: election.title,
            status: election.status
        };

        // Check if user has voted for THIS position
        if (req.user) {
            const existingVote = await Vote.findOne({
                userId: req.user._id,
                electionId: election._id,
                positionId: positionId
            });
            positionObj.hasVoted = !!existingVote;
        }

        res.json(positionObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get individual candidate details
// @route   GET /api/elections/candidates/:id
// @access  Public
const getCandidate = async (req, res) => {
    try {
        const candidateId = req.params.id;
        const election = await Election.findOne({ 'positions.candidates._id': candidateId })
            .populate('positions.candidates.user', 'name avatar email');

        if (!election) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        // Find the position and specific candidate
        let foundCandidate = null;
        let foundPosition = null;

        for (const pos of election.positions) {
            const cand = pos.candidates.id(candidateId);
            if (cand) {
                foundCandidate = cand;
                foundPosition = pos;
                break;
            }
        }

        if (!foundCandidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        // Return flattened data for the frontend
        res.json({
            ...foundCandidate.toObject(),
            name: foundCandidate.user?.name,
            avatar: foundCandidate.user?.avatar,
            position: {
                _id: foundPosition._id,
                title: foundPosition.title
            },
            election: {
                _id: election._id,
                title: election.title,
                status: election.status
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==================== CANDIDATE APPLICATIONS ====================

// @desc    Apply for a position as candidate
// @route   POST /api/elections/:id/positions/:positionId/apply
// @access  Private
const applyForPosition = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id: electionId, positionId } = req.params;
        const { manifesto, media, nickname } = req.body;
        const userId = req.user._id;

        // Get election
        const election = await Election.findById(electionId).session(session);
        if (!election) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Election not found' });
        }

        // Check if position exists
        const position = election.positions.id(positionId);
        if (!position) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Position not found' });
        }

        // Check if user already applied
        const existingApp = await CandidateApplication.findOne({ electionId, positionId, userId }).session(session);
        if (existingApp) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'You have already applied for this position' });
        }

        // ATOMIC UPDATE: Deduct from wallet and move to escrow
        const user = await User.findOneAndUpdate(
            { _id: userId, walletBalance: { $gte: election.contestantFee } },
            { $inc: { walletBalance: -election.contestantFee, escrowBalance: election.contestantFee } },
            { new: true, session }
        );

        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Insufficient wallet balance or user not found' });
        }

        await Transaction.create([{
            userId: user._id,
            type: 'contestant_fee',
            amount: election.contestantFee,
            status: 'completed',
            paymentMethod: 'wallet',
            description: `Contestant Fee for ${election.title}`
        }], { session });

        // Create application
        const application = await CandidateApplication.create([{
            electionId,
            positionId,
            userId,
            nickname,
            manifesto,
            media: media || [],
            feeAmount: election.contestantFee,
            feePaid: true,
            status: 'pending'
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // Secondary actions (Non-blocking)
        try {
            await createNotification({
                userId: election.createdBy || req.user._id,
                type: 'candidate_application',
                title: 'New Candidate Application',
                message: `${user.name} applied for ${position.title} in ${election.title}`,
                relatedId: application[0]._id,
                fromUserId: req.user._id
            });

            const io = req.app.get('io');
            if (io) {
                io.emit('application:new', {
                    electionId,
                    positionId,
                    applicationId: application[0]._id
                });
            }
        } catch (err) {
            console.error('Non-blocking error:', err);
        }

        res.status(201).json({ message: 'Application submitted successfully', application: application[0] });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all applications for an election
// @route   GET /api/elections/:id/applications
// @access  Private/Admin
const getApplications = async (req, res) => {
    try {
        const { id: electionId } = req.params;
        const { status } = req.query;

        const election = await Election.findById(electionId);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        // Only creator or admin can see applications
        if (election.createdBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to view applications' });
        }

        const CandidateApplication = require('../models/CandidateApplication');
        const filter = { electionId };
        if (status) filter.status = status;

        const applications = await CandidateApplication.find(filter)
            .populate('userId', 'name email avatar')
            .populate('electionId', 'title')
            .sort({ createdAt: -1 });

        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve candidate application
// @route   PATCH /api/elections/applications/:applicationId/approve
// @access  Private/Admin
const approveApplication = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { applicationId } = req.params;

        const application = await CandidateApplication.findById(applicationId).session(session);

        if (!application) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Application not found' });
        }
        if (application.status !== 'pending') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Application already processed' });
        }

        const election = await Election.findById(application.electionId).session(session);

        // Authorization check: User must be election creator or admin
        if (election.createdBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Not authorized to approve applications for this election' });
        }

        // 1. Update application status
        application.status = 'approved';
        application.reviewedAt = new Date();
        application.reviewedBy = req.user._id;
        await application.save({ session });

        // 2. Add candidate to election position
        const position = election.positions.id(application.positionId);
        position.candidates.push({
            user: application.userId,
            nickname: application.nickname,
            manifesto: application.manifesto,
            votes: 0
        });
        await election.save({ session });

        // 3. ATOMIC UPDATE: Release fee from applicant escrow
        const applicant = await User.findOneAndUpdate(
            { _id: application.userId, escrowBalance: { $gte: application.feeAmount } },
            { $inc: { escrowBalance: -application.feeAmount } },
            { new: true, session }
        );

        if (!applicant) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Integrity error: Escrow balance insufficient for refund/release' });
        }

        // 4. ATOMIC UPDATE: Add to election creator's wallet
        const creator = await User.findOneAndUpdate(
            { _id: election.createdBy },
            { $inc: { walletBalance: application.feeAmount } },
            { new: true, session }
        );

        await session.commitTransaction();
        session.endSession();

        // Secondary actions (Non-blocking)
        try {
            await createNotification({
                userId: application.userId,
                type: 'application_approved',
                title: 'Application Approved!',
                message: `Your application for ${position.title} in ${election.title} has been approved. You are now a candidate!`,
                relatedId: election._id,
                fromUserId: req.user._id
            });

            if (creator) {
                await createNotification({
                    userId: creator._id,
                    type: 'application_approved',
                    title: 'Contestant Fee Received',
                    message: `₦${application.feeAmount.toLocaleString()} contestant fee released to your wallet from candidate's application`,
                    relatedId: election._id,
                    fromUserId: application.userId
                });
            }

            const io = req.app.get('io');
            if (io) {
                io.to(application.userId.toString()).emit('application:approved', {
                    applicationId: application._id,
                    electionId: election._id
                });
                io.emit('wallet:updated', { userId: applicant._id, balance: applicant.walletBalance });
                if (creator) io.emit('wallet:updated', { userId: creator._id, balance: creator.walletBalance });
            }
        } catch (err) {
            console.error('Secondary action failed:', err);
        }

        res.json({ message: 'Application approved successfully', application });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reject candidate application
// @route   PATCH /api/elections/applications/:applicationId/reject
// @access  Private/Admin
const rejectApplication = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { applicationId } = req.params;
        const { reason } = req.body;

        const application = await CandidateApplication.findById(applicationId).session(session);

        if (!application) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Application not found' });
        }
        if (application.status !== 'pending') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Application already processed' });
        }

        const election = await Election.findById(application.electionId).session(session);
        if (!election) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Election not found' });
        }

        // Authorization check: User must be election creator or admin
        if (election.createdBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: 'Not authorized to reject applications for this election' });
        }

        // 1. Update application status
        application.status = 'rejected';
        application.reviewedAt = new Date();
        application.reviewedBy = req.user._id;
        application.rejectionReason = reason;
        await application.save({ session });

        // 2. ATOMIC UPDATE: Refund fee from escrow back to wallet
        const applicant = await User.findOneAndUpdate(
            { _id: application.userId, escrowBalance: { $gte: application.feeAmount } },
            { $inc: { escrowBalance: -application.feeAmount, walletBalance: application.feeAmount } },
            { new: true, session }
        );

        if (!applicant) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Integrity error: Escrow balance insufficient for refund' });
        }

        await session.commitTransaction();
        session.endSession();

        // Secondary actions (Non-blocking)
        try {
            const position = election.positions.id(application.positionId);
            await createNotification({
                userId: application.userId,
                type: 'application_rejected',
                title: 'Application Rejected',
                message: `Your application for ${position.title} in ${election.title} was rejected. Fee refunded to your wallet.${reason ? ` Reason: ${reason}` : ''}`,
                relatedId: election._id,
                fromUserId: req.user._id
            });

            const io = req.app.get('io');
            if (io) {
                io.to(application.userId.toString()).emit('application:rejected', {
                    applicationId: application._id,
                    electionId: election._id
                });
                io.emit('wallet:updated', { userId: applicant._id, balance: applicant.walletBalance });
            }
        } catch (err) {
            console.error('Secondary action failed:', err);
        }

        res.json({ message: 'Application rejected successfully', application });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getElections,
    getElection,
    createElection,
    getNews,
    getNewsItem,
    vote,
    getResults,
    getPosition,
    getCandidate,
    applyForPosition,
    getApplications,
    approveApplication,
    rejectApplication
};
