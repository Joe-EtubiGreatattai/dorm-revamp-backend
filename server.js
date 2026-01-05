require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { setupSocket } = require('./config/socket');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: [
            'http://192.168.0.130:8081',
            'http://localhost:8081',
            'exp://192.168.0.130:8081',
            '*'
        ],
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/market', require('./routes/marketRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/housing', require('./routes/housingRoutes'));
app.use('/api/tours', require('./routes/tourRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/library', require('./routes/libraryRoutes'));
app.use('/api/elections', require('./routes/electionRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Basic Route
app.get('/', (req, res) => {
    res.send('Dorm Revamp API is running...');
});

// Error Handlers
app.use(notFound);
app.use(errorHandler);

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dorm_revamp';
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
