# Socket.io Integration Guide

## Server-Side (Backend) - ✅ COMPLETED

### Connection Setup
The backend is fully configured with Socket.io and supports real-time events for all major features.

### Available Events

#### Authentication
All socket connections require JWT authentication via `socket.handshake.auth.token`.

#### Messaging Events
- `message:send` - Send a message
- `message:receive` - Receive a message
- `typing:start` - User started typing
- `typing:stop` - User stopped typing
- `message:read` - Mark message as read
- `conversation:join` - Join a conversation room

#### Notification Events
- `notification:new` - New notification received
- `notification:send` - Send notification to user

#### Post Events
- `post:new` - New post created (broadcast)
- `post:liked` - Post was liked

#### Comment Events
- `comment:new` - New comment on post

#### Order Events
- `order:statusUpdate` - Order status changed
- `order:escrowReleased` - Escrow funds released

#### Tour Request Events
- `tour:newRequest` - New tour request created
- `tour:statusUpdate` - Tour request accepted/declined

#### User Status Events
- `user:online` - User came online
- `user:offline` - User went offline

---

## Client-Side (Frontend) Integration

### Installation
```bash
npm install socket.io-client
```

### Basic Setup

```typescript
// utils/socket.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5001'; // Change in production

let socket: Socket | null = null;

export const initializeSocket = (token: string) => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            auth: { token }
        });

        socket.on('connect', () => {
            console.log('Socket connected:', socket?.id);
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    }
    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
```

### Usage Examples

#### Messaging
```typescript
import { getSocket } from '@/utils/socket';

// Send message
const sendMessage = (data: {
    conversationId: string;
    receiverId: string;
    content: string;
}) => {
    const socket = getSocket();
    socket?.emit('message:send', data);
};

// Listen for messages
socket?.on('message:receive', (message) => {
    console.log('New message:', message);
    // Update UI with new message
});

// Typing indicator
const startTyping = (conversationId: string, receiverId: string) => {
    socket?.emit('typing:start', { conversationId, receiverId });
};
```

#### Real-time Posts
```typescript
// Listen for new posts
socket?.on('post:new', (post) => {
    console.log('New post:', post);
    // Add post to feed
});

// Listen for post likes
socket?.on('post:liked', ({ postId, likerId, likerName }) => {
    console.log(`${likerName} liked post ${postId}`);
    // Update post likes count
});
```

#### Real-time Comments
```typescript
socket?.on('comment:new', ({ postId, comment }) => {
    console.log('New comment on post:', postId, comment);
    // Add comment to post
});
```

#### Order Updates
```typescript
socket?.on('order:statusUpdate', ({ orderId, status }) => {
    console.log(`Order ${orderId} status:`, status);
    // Update order status in UI
});

socket?.on('order:escrowReleased', ({ orderId, amount, message }) => {
    console.log('Escrow released:', message);
    // Show notification to seller
});
```

#### Tour Requests
```typescript
socket?.on('tour:newRequest', (tourRequest) => {
    console.log('New tour request:', tourRequest);
    // Show notification to property owner
});

socket?.on('tour:statusUpdate', ({ tourId, status, meetingPoint }) => {
    console.log(`Tour ${tourId} ${status}`);
    // Update UI with tour status
});
```

#### Notifications
```typescript
socket?.on('notification:new', (notification) => {
    console.log('New notification:', notification);
    // Show in-app notification
    // Update notification badge count
});
```

### React Native Context Provider

```typescript
// context/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeSocket, getSocket, disconnectSocket } from '@/utils/socket';

interface SocketContextType {
    isConnected: boolean;
    socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({
    isConnected: false,
    socket: null
});

export const SocketProvider = ({ children, token }: { children: React.ReactNode; token?: string }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        if (token) {
            const socketInstance = initializeSocket(token);
            setSocket(socketInstance);

            socketInstance.on('connect', () => setIsConnected(true));
            socketInstance.on('disconnect', () => setIsConnected(false));

            return () => {
                disconnectSocket();
            };
        }
    }, [token]);

    return (
        <SocketContext.Provider value={{ isConnected, socket }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
```

### Integration in App
```typescript
// app/_layout.tsx
import { SocketProvider } from '@/context/SocketContext';

export default function RootLayout() {
    const [userToken, setUserToken] = useState<string | null>(null);

    // Get token from storage/auth
    useEffect(() => {
        // Load token from AsyncStorage or SecureStore
        const token = await getUserToken();
        setUserToken(token);
    }, []);

    return (
        <SocketProvider token={userToken}>
            {/* Your app content */}
        </SocketProvider>
    );
}
```

### Usage in Components
```typescript
import { useSocket } from '@/context/SocketContext';

export default function ChatScreen() {
    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (!socket) return;

        socket.on('message:receive', handleNewMessage);

        return () => {
            socket.off('message:receive', handleNewMessage);
        };
    }, [socket]);

    const handleNewMessage = (message) => {
        // Update messages state
    };

    return <View>{/* Chat UI */}</View>;
}
```

---

## Production Considerations

1. **Environment Variables**: Set proper SOCKET_URL for production
2. **CORS**: Update `origin` in server.js to your frontend URL
3. **Error Handling**: Implement reconnection logic
4. **Scalability**: Consider using Redis adapter for multiple server instances
5. **Security**: Validate all socket events on server-side
6. **Rate Limiting**: Implement rate limiting for socket events

---

## Testing

Test socket connections using the Socket.io admin UI or browser console:
```javascript
const socket = io('http://localhost:5001', {
    auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => console.log('Connected'));
socket.emit('message:send', { /* data */ });
```

