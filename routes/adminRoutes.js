const express = require('express');
const router = express.Router();
const {
    getDashboardStats, getAllUsers, getAllOrders, getUserById, getOrderById, banUser, updateUserRole,
    getAllMarketItems, getMarketItemById, deleteMarketItem,
    getAllHousingListings, getHousingListingById, verifyHousingListing, deleteHousingListing,
    getAllElections, getElectionById, createElection, updateElectionStatus, deleteElection,
    getAllPosts, getPostById, deletePost,
    getAllElectionNews, getElectionNewsById, createElectionNews, updateElectionNews, deleteElectionNews
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/stats', protect, admin, getDashboardStats);
router.get('/users', protect, admin, getAllUsers);
router.get('/users/:id', protect, admin, getUserById);
router.put('/users/:id/ban', protect, admin, banUser);
router.put('/users/:id/role', protect, admin, updateUserRole);
router.get('/orders', protect, admin, getAllOrders);
router.get('/orders/:id', protect, admin, getOrderById);
router.put('/orders/:id', protect, admin, updateOrder);
router.get('/market', protect, admin, getAllMarketItems);
router.get('/market/:id', protect, admin, getMarketItemById);
router.put('/market/:id', protect, admin, updateMarketItem);
router.delete('/market/:id', protect, admin, deleteMarketItem);
router.get('/housing', protect, admin, getAllHousingListings);
router.get('/housing/:id', protect, admin, getHousingListingById);
router.patch('/housing/:id', protect, admin, verifyHousingListing);
router.delete('/housing/:id', protect, admin, deleteHousingListing);

// Election Routes
router.get('/elections', protect, admin, getAllElections);
router.post('/elections', protect, admin, createElection); // Create
router.get('/elections/:id', protect, admin, getElectionById);
router.patch('/elections/:id/status', protect, admin, updateElectionStatus);
router.delete('/elections/:id', protect, admin, deleteElection);

// Post Routes
router.get('/posts', protect, admin, getAllPosts);
router.get('/posts/:id', protect, admin, getPostById);
router.delete('/posts/:id', protect, admin, deletePost);

// Election News Routes
router.get('/election-news', protect, admin, getAllElectionNews);
router.post('/election-news', protect, admin, createElectionNews);
router.get('/election-news/:id', protect, admin, getElectionNewsById);
router.put('/election-news/:id', protect, admin, updateElectionNews);
router.delete('/election-news/:id', protect, admin, deleteElectionNews);

module.exports = router;
