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
    getUserProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/register', upload.single('avatar'), register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserProfile);

// Update profile with image upload
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.put('/password', protect, changePassword);

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
const { followUser, unfollowUser } = require('../controllers/authController');
router.post('/users/:id/follow', protect, followUser);
router.post('/users/:id/unfollow', protect, unfollowUser);

module.exports = router;
