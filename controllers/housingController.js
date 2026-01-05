const Housing = require('../models/Housing');
const TourRequest = require('../models/TourRequest');
const { createNotification } = require('./notificationController');

// @desc    Get all housing listings
// @route   GET /api/housing/listings
// @access  Public
const getListings = async (req, res) => {
    try {
        const { category, type, minPrice, maxPrice, bedrooms, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        let query = { status: 'available' };

        // Support both 'category' (internal) and 'type' (frontend param)
        const activeCategory = category || type;
        if (activeCategory && activeCategory !== 'All') {
            query.category = activeCategory;
        }
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseInt(minPrice);
            if (maxPrice) query.price.$lte = parseInt(maxPrice);
        }
        if (bedrooms) query.bedrooms = parseInt(bedrooms);

        const listings = await Housing.find(query)
            .populate('ownerId', 'name avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Housing.countDocuments(query);

        res.json({
            listings,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single listing
// @route   GET /api/housing/listings/:id
// @access  Public
const getListing = async (req, res) => {
    console.log('🏠 [BACKEND] getListing called');
    console.log('🏠 [BACKEND] Listing ID:', req.params.id);

    try {
        const HousingReview = require('../models/HousingReview');

        const listing = await Housing.findById(req.params.id)
            .populate('ownerId', 'name avatar university phoneNumber');

        if (!listing) {
            console.log('❌ [BACKEND] Listing not found:', req.params.id);
            return res.status(404).json({ message: 'Listing not found' });
        }

        // Fetch actual reviews from the HousingReview model
        const reviews = await HousingReview.find({ listingId: req.params.id })
            .populate('userId', 'name avatar')
            .sort({ createdAt: -1 });

        // Transform for frontend expectations
        const transformedReviews = reviews.map(r => ({
            _id: r._id,
            user: r.userId,
            rating: r.rating,
            comment: r.comment,
            createdAt: r.createdAt
        }));

        const listingObj = listing.toObject();
        listingObj.reviews = transformedReviews;
        listingObj.totalReviews = transformedReviews.length;

        console.log('✅ [BACKEND] Listing found with', transformedReviews.length, 'reviews');

        res.json(listingObj);
    } catch (error) {
        console.error('❌ [BACKEND] Error in getListing:', {
            message: error.message,
            stack: error.stack,
            id: req.params.id
        });
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create listing
// @route   POST /api/housing/listings
// @access  Private
const createListing = async (req, res) => {
    console.log('🏠 [BACKEND] createListing called');
    console.log('🏠 [BACKEND] User ID:', req.user?._id);
    console.log('🏠 [BACKEND] Request body:', req.body);
    console.log('🏠 [BACKEND] Files:', req.files?.length || 0, 'files uploaded');

    try {
        let images = [];
        if (req.files && req.files.length > 0) {
            console.log('🏠 [BACKEND] Processing uploaded files...');
            images = req.files.map((file, index) => {
                console.log(`🏠 [BACKEND] File ${index}:`, {
                    fieldname: file.fieldname,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    path: file.path?.substring(0, 50)
                });
                return file.path;
            });
            console.log('🏠 [BACKEND] Processed image URLs:', images);
        } else if (req.body.images) {
            console.log('🏠 [BACKEND] Using images from body');
            images = req.body.images;
        }

        const tourFee = req.body.tourFee ? parseInt(req.body.tourFee) : 0;
        const price = parseInt(req.body.price);

        if (tourFee > price * 0.05) {
            return res.status(400).json({ message: 'Tour fee cannot exceed 5% of the property price' });
        }

        const listingData = {
            ...req.body,
            price,
            tourFee,
            images,
            ownerId: req.user._id
        };

        console.log('🏠 [BACKEND] Creating listing with data:', {
            title: listingData.title,
            category: listingData.category,
            price: listingData.price,
            address: listingData.address?.substring(0, 30),
            amenities: listingData.amenities,
            imageCount: images.length,
            ownerId: listingData.ownerId
        });

        const listing = await Housing.create(listingData);
        console.log('✅ [BACKEND] Listing created:', listing._id);

        const populatedListing = await Housing.findById(listing._id)
            .populate('ownerId', 'name avatar');

        console.log('✅ [BACKEND] Sending response');
        res.status(201).json(populatedListing);
    } catch (error) {
        console.error('❌ [BACKEND] Error creating listing:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update listing
// @route   PUT /api/housing/listings/:id
// @access  Private
const updateListing = async (req, res) => {
    try {
        const listing = await Housing.findById(req.params.id);

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        if (listing.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const tourFee = req.body.tourFee !== undefined ? parseFloat(req.body.tourFee) : listing.tourFee;
        const price = req.body.price !== undefined ? parseFloat(req.body.price) : listing.price;

        if (tourFee > price * 0.05) {
            return res.status(400).json({ message: 'Tour fee cannot exceed 5% of the property price' });
        }

        const updatedListing = await Housing.findByIdAndUpdate(
            req.params.id,
            { ...req.body, price, tourFee },
            { new: true, runValidators: true }
        ).populate('ownerId', 'name avatar');

        res.json(updatedListing);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete listing
// @route   DELETE /api/housing/listings/:id
// @access  Private
const deleteListing = async (req, res) => {
    try {
        const listing = await Housing.findById(req.params.id);

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        if (listing.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await listing.deleteOne();
        res.json({ message: 'Listing deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Request tour
// @route   POST /api/housing/listings/:id/tour
// @access  Private
const requestTour = async (req, res) => {
    try {
        const User = require('../models/User');
        const Transaction = require('../models/Transaction');

        const listing = await Housing.findById(req.params.id);

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        const tourFee = listing.tourFee || 0;
        const student = await User.findById(req.user._id);
        const agent = await User.findById(listing.ownerId);

        if (tourFee > 0) {
            if (student.walletBalance < tourFee) {
                return res.status(400).json({ message: `Insufficient wallet balance to pay touring fee (₦${tourFee.toLocaleString()})` });
            }

            // Transfer touring fee
            student.walletBalance -= tourFee;
            agent.walletBalance += tourFee;

            await student.save();
            await agent.save();

            // Create transaction records
            await Transaction.create({
                userId: student._id,
                type: 'tour_payment',
                amount: tourFee,
                status: 'completed',
                marketItemId: listing._id.toString()
            });

            await Transaction.create({
                userId: agent._id,
                type: 'tour_receive',
                amount: tourFee,
                status: 'completed',
                marketItemId: listing._id.toString()
            });
        }

        const { preferredDate, preferredTime, message } = req.body;

        const tourRequest = await TourRequest.create({
            listingId: listing._id,
            requesterId: req.user._id,
            ownerId: listing.ownerId,
            preferredDate,
            preferredTime,
            message
        });

        const populatedRequest = await TourRequest.findById(tourRequest._id)
            .populate('requesterId', 'name avatar university')
            .populate('listingId', 'title address');

        // Create notification for owner
        await createNotification({
            userId: listing.ownerId,
            fromUserId: req.user._id,
            type: 'tour',
            relatedId: tourRequest._id.toString(),
            title: 'New Tour Request',
            message: `${req.user.name} requested a tour for "${listing.title}". ${tourFee > 0 ? `Touring fee of ₦${tourFee.toLocaleString()} received.` : ''}`
        });

        res.status(201).json({
            ...populatedRequest.toObject(),
            newBalance: student.walletBalance
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create review for listing
// @route   POST /api/housing/listings/:id/review
// @access  Private
const createReview = async (req, res) => {
    console.log('🏠 [BACKEND] createReview called');
    try {
        const HousingReview = require('../models/HousingReview');
        const { rating, comment } = req.body;

        const listing = await Housing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        // Create review
        const review = await HousingReview.create({
            listingId: req.params.id,
            userId: req.user._id,
            rating,
            comment
        });

        // Populate user data
        const populatedReview = await HousingReview.findById(review._id)
            .populate('userId', 'name avatar');

        // Update listing stats
        const allReviews = await HousingReview.find({ listingId: req.params.id });
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

        listing.rating = avgRating;
        listing.totalReviews = allReviews.length;

        // Also sync with the reviews array in Housing model if it exists
        if (listing.reviews) {
            listing.reviews.push(review._id);
        }

        await listing.save();

        // Emit socket event for real-time updates
        const io = req.app.get('io');
        if (io) {
            io.emit('review:new', {
                listingId: req.params.id,
                review: {
                    _id: populatedReview._id,
                    user: populatedReview.userId,
                    rating: populatedReview.rating,
                    comment: populatedReview.comment,
                    createdAt: populatedReview.createdAt
                }
            });
        }

        res.status(201).json(populatedReview);
    } catch (error) {
        console.error('❌ [BACKEND] Error creating review:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getListings,
    getListing,
    createListing,
    updateListing,
    deleteListing,
    requestTour,
    createReview
};
