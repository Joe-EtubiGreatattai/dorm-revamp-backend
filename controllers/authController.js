const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        const { name, email, password, university } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const userData = {
            name,
            email,
            password: hashedPassword,
            university
        };

        if (req.file) {
            userData.avatar = req.file.path; // Cloudinary secure_url is provided in req.file.path
        }

        // Generate Verification Token
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        userData.verificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        userData.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 Hours

        const user = await User.create(userData);

        if (user) {
            // Send Verification Email
            try {
                const message = `Welcome to Dorm Revamp! Please use the following code to verify your email address: ${verificationToken}`;
                await sendEmail({
                    email: user.email,
                    subject: 'Email Verification',
                    message
                });
            } catch (err) {
                console.log('Verification email failed to send');
                // Don't fail registration, user can request resend later
            }

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                university: user.university,
                avatar: user.avatar,
                walletBalance: user.walletBalance,
                token: generateToken(user._id)
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user email
        const user = await User.findOne({ email });

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                university: user.university,
                avatar: user.avatar,
                walletBalance: user.walletBalance,
                escrowBalance: user.escrowBalance,
                followers: user.followers,
                following: user.following,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user profile & settings
// @route   PUT /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        console.log('Fetching user profile for ID:', req.params.id);
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            console.log('User not found in DB for ID:', req.params.id);
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error in getUserProfile:', error);
        res.status(500).json({ message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.bio = req.body.bio || user.bio;
            user.university = req.body.university || user.university;

            // Handle Notification Settings
            if (req.body.notificationSettings) {
                user.notificationSettings = {
                    ...user.notificationSettings,
                    ...req.body.notificationSettings
                };
            }

            // Handle Avatar (if uploaded securely via multer/cloudinary)
            if (req.file) {
                user.avatar = req.file.path; // Cloudinary secure_url
            } else if (req.body.avatar) {
                user.avatar = req.body.avatar;
            }

            const updatedUser = await user.save();
            const token = generateToken(updatedUser._id);

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                university: updatedUser.university,
                token: token,
                avatar: updatedUser.avatar,
                bio: updatedUser.bio,
                notificationSettings: updatedUser.notificationSettings
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Change Password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (user && (await bcrypt.compare(currentPassword, user.password))) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
            await user.save();
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(400).json({ message: 'Invalid current password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate Reset Token (Simple 6 digit code for mobile friendliness)
        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash and set to resetPasswordToken field
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 Minutes

        await user.save();

        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a POST request to: \n\n ${resetToken}`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset Token',
                message
            });

            res.status(200).json({ success: true, data: 'Email sent' });
        } catch (err) {
            console.log(err);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;

            await user.save();

            return res.status(500).json({ message: 'Email could not be sent' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
    try {
        // Get hashed token
        const resetPasswordToken = crypto.createHash('sha256').update(req.body.token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        // Set new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            token
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify Email
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            verificationToken: hashedToken,
            verificationTokenExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpire = undefined;
        await user.save();

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add Bank Account
// @route   POST /api/auth/bank
// @access  Private
const addBankAccount = async (req, res) => {
    try {
        const { bankName, accountNumber, accountName } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) return res.status(404).json({ message: 'User not found' });

        user.bankAccounts.push({ bankName, accountNumber, accountName });
        await user.save();

        res.json(user.bankAccounts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Bank Accounts
// @route   GET /api/auth/bank
// @access  Private
const getBankAccounts = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.bankAccounts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Resend Verification Code
// @route   POST /api/auth/resend-code
// @access  Public
const resendVerificationCode = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Account already verified' });
        }

        // Generate Verification Token
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        user.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 Hours

        await user.save();

        const message = `Welcome to Dorm Revamp! Please use the following code to verify your email address: ${verificationToken}`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Email Verification Code (Resend)',
                message
            });
            res.json({ message: 'Verification code sent' });
        } catch (err) {
            user.verificationToken = undefined;
            user.verificationTokenExpire = undefined;
            await user.save();
            return res.status(500).json({ message: 'Email could not be sent' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Universities
// @route   GET /api/auth/universities
// @access  Public
const getUniversities = async (req, res) => {
    try {
        // Static list for now
        const universities = [
            'University of Lagos',
            'Obafemi Awolowo University',
            'University of Ibadan',
            'University of Nigeria, Nsukka',
            'Ahmadu Bello University',
            'Covenant University',
            'Babcock University',
            'Lagos State University',
            'University of Ilorin',
            'Federal University of Technology, Akure'
        ];
        res.json(universities.sort());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Faculties
// @route   GET /api/auth/faculties
// @access  Public
const getFaculties = async (req, res) => {
    try {
        const faculties = [
            'Arts',
            'Science',
            'Engineering',
            'Social Sciences',
            'Law',
            'Medicine',
            'Education',
            'Environmental Sciences',
            'Management Sciences',
            'Agriculture'
        ];
        res.json(faculties.sort());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Levels
// @route   GET /api/auth/levels
// @access  Public
const getLevels = async (req, res) => {
    try {
        const levels = [
            '100 Level',
            '200 Level',
            '300 Level',
            '400 Level',
            '500 Level',
            '600 Level',
            'Postgraduate'
        ];
        res.json(levels);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Follow a user
// @route   POST /api/auth/users/:id/follow
// @access  Private
const followUser = async (req, res) => {
    try {
        const userIdToFollow = req.params.id;
        const currentUserId = req.user._id;

        if (userIdToFollow === currentUserId.toString()) {
            return res.status(400).json({ message: 'You cannot follow yourself' });
        }

        // Find the user to follow
        const userToFollow = await User.findById(userIdToFollow);
        if (!userToFollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if already following
        if (userToFollow.followers.includes(currentUserId)) {
            return res.status(400).json({ message: 'Already following this user' });
        }

        // Add to followers/following
        userToFollow.followers.push(currentUserId);
        await userToFollow.save();

        const currentUser = await User.findById(currentUserId);
        currentUser.following.push(userIdToFollow);
        await currentUser.save();

        res.json({ message: 'Successfully followed user', user: userToFollow });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Unfollow a user
// @route   POST /api/auth/users/:id/unfollow
// @access  Private
const unfollowUser = async (req, res) => {
    try {
        const userIdToUnfollow = req.params.id;
        const currentUserId = req.user._id;

        if (userIdToUnfollow === currentUserId.toString()) {
            return res.status(400).json({ message: 'You cannot unfollow yourself' });
        }

        // Find the user to unfollow
        const userToUnfollow = await User.findById(userIdToUnfollow);
        if (!userToUnfollow) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if actually following
        if (!userToUnfollow.followers.includes(currentUserId)) {
            return res.status(400).json({ message: 'Not following this user' });
        }

        // Remove from followers/following
        userToUnfollow.followers = userToUnfollow.followers.filter(id => id.toString() !== currentUserId.toString());
        await userToUnfollow.save();

        const currentUser = await User.findById(currentUserId);
        currentUser.following = currentUser.following.filter(id => id.toString() !== userIdToUnfollow);
        await currentUser.save();

        res.json({ message: 'Successfully unfollowed user', user: userToUnfollow });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    register,
    login,
    getMe,
    getAllUsers,
    updateProfile,
    changePassword,
    forgotPassword,
    getUserProfile,
    resetPassword,
    verifyEmail,
    resendVerificationCode,
    addBankAccount,
    getBankAccounts,
    getUniversities,
    getFaculties,
    getLevels,
    followUser,
    unfollowUser
};
