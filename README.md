# Dorm Revamp Backend - Quick Start Guide

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Variables
Create a `.env` file in the backend directory with:
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/dorm_revamp
JWT_SECRET=your_super_secret_jwt_key_here
NODE_ENV=development
```

### 3. Start MongoDB
Make sure MongoDB is running on your machine:
```bash
# For macOS with Homebrew
brew services start mongodb-community

# Or using mongod directly
mongod
```

### 4. Run the Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## API Endpoints Testing

### Authentication
```bash
# Register
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@university.edu",
    "password": "password123",
    "university": "UNILAG"
  }'

# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@university.edu",
    "password": "password123"
  }'
```

### Wallet (Requires Auth Token)
```bash
# Get Balance
curl -X GET http://localhost:5001/api/wallet/balance \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Top Up
curl -X POST http://localhost:5001/api/wallet/topup \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "paymentMethod": "card"
  }'
```

### Posts
```bash
# Get Feed
curl -X GET http://localhost:5001/api/posts/feed \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Create Post
curl -X POST http://localhost:5001/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My first post!",
    "images": []
  }'
```

## What's Implemented

### ✅ Complete
**16 MongoDB Models**:  
User, Post, Comment, MarketItem, Order, Transaction, Housing, TourRequest, Review, Material, Election, Position, Candidate, Vote, Message, Notification

**Middleware**:  
- Authentication (JWT)
- Error Handling
- File Upload (Multer)

**Complete API Systems** (60+ endpoints):

1. **Authentication**: Register, Login, Get Current User
2. **Wallet**: Top Up, Withdraw, Get Balance, Transaction History
3. **Posts**: CRUD, Like/Unlike, Paginated Feed
4. **Comments**: CRUD, Like, Nested Replies
5. **Market**: CRUD Items, Search & Filter, Purchase with Escrow
6. **Orders**: Get Orders, Update Status, Confirm Receipt (Release Escrow)
7. **Housing**: CRUD Listings, Search & Filter, Request Tours
8. **Tours**: Get Requests, Accept/Decline
9. **Library**: Upload/Download Materials, Save, Search & Filter
10. **Elections**: Get Elections, Get Results, Cast Vote
11. **Notifications**: Get, Mark as Read, Delete

### 🚧 Optional
- **Messaging with Socket.io**: Requires real-time infrastructure setup

## Project Structure
```
backend/
├── models/          # 16 Mongoose schemas
├── controllers/     # Business logic
├── routes/          # API endpoints
├── middleware/      # Auth, validation, errors
├── config/          # Configuration files
├── uploads/         # File uploads directory
├── server.js        # Entry point
└── .env             # Environment variables
```

## Next Steps

1. **Test the Current Implementation**: Use the curl commands above or Postman
2. **Implement Remaining Features**: Market, Housing, Library, Elections, Messaging
3. **Add Validation**: Use express-validator for input validation
4. **File Upload**: Configure Cloudinary or AWS S3 for production
5. **Real-time Features**: Implement Socket.io for messaging and notifications
6. **Testing**: Add unit and integration tests
7. **Deploy**: Set up on Heroku, Railway, or DigitalOcean

