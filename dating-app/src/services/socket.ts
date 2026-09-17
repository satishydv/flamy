import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '@/constants/api';

let socket: Socket | null = null;
let currentUserId: string | null = null;

export interface IncomingCallData {
  callId: string;
  fromUserId: string;
  type: 'audio' | 'video';
  callerInfo: {
    id: string;
    name?: string;
    image?: any;
    location?: string;
  };
}

/**
 * Initialize or reuse the active Socket.IO connection
 */
export function connectSocket(userId: string): Socket {
  if (socket && socket.connected && currentUserId === userId) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentUserId = userId;

  socket = io(BACKEND_URL, {
    auth: { userId },
    query: { userId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    withCredentials: true,
  });

  socket.on('connect', () => {
    console.log(`[SOCKET CLIENT] Connected successfully (ID: ${socket?.id}, User: ${userId})`);
    socket?.emit('user:register', { userId });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[SOCKET CLIENT] Disconnected (${reason})`);
  });

  socket.on('connect_error', (err) => {
    console.warn(`[SOCKET CLIENT] Connection error:`, err.message);
  });

  return socket;
}

/**
 * Retrieve the active socket instance
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Disconnect and release the active socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
}
