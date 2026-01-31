require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { setupSocket } = require('./config/socket');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const allowedOrigins = [
    'http://192.168.0.130:8081',
    'http://localhost:8081',
    'exp://192.168.0.130:8081',
    'https://dorm-revamp-admin.vercel.app'
];

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Setup socket event handlers
setupSocket(io);

// Make io accessible globally
global.io = io;

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(helmet());
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per 15 minutes
    message: 'Too many requests, please try again later.'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 attempts per 15 mins
    message: 'Too many authentication attempts, please try again in 15 minutes'
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/market', require('./routes/marketRoutes'));
app.use('/api/upload', limiter, require('./routes/uploadRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/housing', require('./routes/housingRoutes'));
app.use('/api/tours', require('./routes/tourRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/library', require('./routes/libraryRoutes'));
app.use('/api/elections', require('./routes/electionRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/bugs', require('./routes/bugReportRoutes'));
app.use('/api/support', require('./routes/supportRoutes'));

// Basic Route
app.get('/', (req, res) => {
    res.send('Dorm API is running...');
});

// Error Handlers
app.use(notFound);
app.use(errorHandler);

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// Start Server
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    console.log(`Socket.io is ready for connections`);
    console.log(`Local network access: http://192.168.0.130:${PORT}`);
});
