const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Socket.io authentication middleware
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }

        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Authentication error: Invalid token'));
    }
};

module.exports = { authenticateSocket };
