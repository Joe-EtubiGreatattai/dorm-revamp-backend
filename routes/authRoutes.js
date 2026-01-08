const express = require('express');
const router = express.Router();
const {
    register,
    login,
    getMe,
    getAllUsers,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,

    getUserProfile,
    searchUsers, // Import searchUsers
    toggleMonetization,
    deleteUser
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/register', upload.single('avatar'), register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.delete('/me', protect, deleteUser); // Add delete route
router.get('/search', protect, searchUsers); // Add search route
router.get('/users', getAllUsers);
router.get('/users/:id', getUserProfile);

// Update profile with image upload
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.put('/password', protect, changePassword);
router.post('/monetization/toggle', protect, toggleMonetization);

// Bank Accounts
const { addBankAccount, getBankAccounts, resendVerificationCode } = require('../controllers/authController');
router.post('/bank', protect, addBankAccount);
router.get('/bank', protect, getBankAccounts);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendVerificationCode);

// Academic Data
const { getUniversities, getFaculties, getLevels } = require('../controllers/authController');
router.get('/universities', getUniversities);
router.get('/faculties', getFaculties);
router.get('/levels', getLevels);

// Follow/Unfollow
const { followUser, unfollowUser, blockUser, unblockUser, getBlockedUsers } = require('../controllers/authController');
router.get('/blocked', protect, getBlockedUsers);
router.post('/users/:id/follow', protect, followUser);
router.post('/users/:id/unfollow', protect, unfollowUser);
router.post('/users/:id/block', protect, blockUser);
router.post('/users/:id/unblock', protect, unblockUser);

module.exports = router;
