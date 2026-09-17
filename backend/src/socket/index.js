import { Server } from "socket.io";
import { prisma } from "../config/prisma.js";

// Global reference to the Socket.IO instance
let io = null;

// Map to track active user sockets: userId -> Set of socket IDs
const onlineUsers = new Map();

/**
 * Initialize Socket.IO server
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    // Determine userId from handshake auth, query, or headers
    const userId =
      socket.handshake.auth?.userId ||
      socket.handshake.query?.userId ||
      socket.handshake.headers?.["x-user-id"];

    if (!userId) {
      console.log(`[SOCKET] Anonymous connection ${socket.id} (no userId supplied)`);
    } else {
      socket.userId = userId;

      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);

      // Join a personal room named after the userId for targeted multicasting
      socket.join(`user:${userId}`);
      console.log(`[SOCKET] User ${userId} connected on socket ${socket.id}. (Active sockets for user: ${onlineUsers.get(userId).size})`);

      // Broadcast online status to the connected user
      socket.emit("presence:sync", { onlineUserIds: Array.from(onlineUsers.keys()) });
    }

    // ── REGISTER REAL-TIME CHAT EVENTS ──

    // Explicit user-registration if userId wasn't in handshake
    socket.on("user:register", ({ userId: regUserId }) => {
      if (!regUserId) return;
      socket.userId = regUserId;
      if (!onlineUsers.has(regUserId)) {
        onlineUsers.set(regUserId, new Set());
      }
      onlineUsers.get(regUserId).add(socket.id);
      socket.join(`user:${regUserId}`);
      console.log(`[SOCKET] User explicitly registered: ${regUserId} (${socket.id})`);
    });

    // Real-time typing indicators
    socket.on("chat:typing", ({ partnerId, isTyping }) => {
      if (!socket.userId || !partnerId) return;
      emitToUser(partnerId, "chat:typing", {
        fromUserId: socket.userId,
        isTyping: Boolean(isTyping),
      });
    });

    // ── CALL SIGNALING EVENTS ──

    /**
     * Initiate a call to a match:
     * payload: { toUserId, type: 'audio' | 'video', callerInfo: { id, name, image } }
     */
    socket.on("call:initiate", async ({ toUserId, type, callerInfo }) => {
      const fromUserId = socket.userId || callerInfo?.id;
      if (!fromUserId || !toUserId) {
        socket.emit("call:error", { message: "Invalid caller or recipient." });
        return;
      }

      console.log(`[CALL] ${fromUserId} initiating ${type || 'audio'} call to ${toUserId}`);

      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Special handling for demo candidate profiles (cand_*)
      if (toUserId.startsWith("cand_")) {
        // Acknowledge outgoing ringing to caller
        socket.emit("call:ringing", { callId, toUserId });

        // Simulate demo profile answering after 2.2 seconds!
        setTimeout(() => {
          socket.emit("call:accepted", {
            callId,
            fromUserId: toUserId,
            isDemoSimulation: true,
          });
        }, 2200);
        return;
      }

      // Real user recipient
      const isOnline = isUserOnline(toUserId);
      if (!isOnline) {
        socket.emit("call:unavailable", {
          toUserId,
          reason: "User is currently offline.",
        });
        return;
      }

      // Notify caller that recipient device is ringing
      socket.emit("call:ringing", { callId, toUserId });

      // Send incoming call prompt to recipient
      emitToUser(toUserId, "call:incoming", {
        callId,
        fromUserId,
        type: type || "audio",
        callerInfo: callerInfo || { id: fromUserId },
      });
    });

    /**
     * Recipient accepts the incoming call
     */
    socket.on("call:accept", ({ toUserId, callId }) => {
      const fromUserId = socket.userId;
      console.log(`[CALL] ${fromUserId} accepted call ${callId} from ${toUserId}`);
      emitToUser(toUserId, "call:accepted", {
        callId,
        fromUserId,
      });
    });

    /**
     * Recipient rejects or caller cancels
     */
    socket.on("call:reject", ({ toUserId, callId, reason }) => {
      const fromUserId = socket.userId;
      console.log(`[CALL] ${fromUserId} rejected/ended call ${callId} with ${toUserId}. Reason: ${reason}`);
      emitToUser(toUserId, "call:rejected", {
        callId,
        fromUserId,
        reason: reason || "declined",
      });
    });

    /**
     * WebRTC Signaling Relay (SDP offer/answer, ICE candidates)
     */
    socket.on("call:signal", ({ toUserId, signalData }) => {
      const fromUserId = socket.userId;
      if (!toUserId || !signalData) return;

      emitToUser(toUserId, "call:signal", {
        fromUserId,
        signalData,
      });
    });

    /**
     * End ongoing call
     */
    socket.on("call:end", ({ toUserId, callId, duration, type }) => {
      const fromUserId = socket.userId;
      console.log(`[CALL] Call ${callId} ended between ${fromUserId} and ${toUserId}. Duration: ${duration}s`);
      emitToUser(toUserId, "call:ended", {
        callId,
        fromUserId,
        duration: duration || 0,
        type: type || "audio",
      });
    });

    // ── DISCONNECT HANDLING ──
    socket.on("disconnect", (reason) => {
      if (socket.userId && onlineUsers.has(socket.userId)) {
        const userSockets = onlineUsers.get(socket.userId);
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(socket.userId);
          console.log(`[SOCKET] User ${socket.userId} went completely offline.`);
        } else {
          console.log(`[SOCKET] Socket ${socket.id} disconnected for user ${socket.userId} (${userSockets.size} sockets remaining).`);
        }
      } else {
        console.log(`[SOCKET] Socket ${socket.id} disconnected (${reason}).`);
      }
    });
  });

  return io;
}

/**
 * Get Socket.IO instance
 */
export function getIO() {
  return io;
}

/**
 * Check if a user currently has at least one active socket connection
 */
export function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

/**
 * Send an event to all connected sockets of a given user
 */
export function emitToUser(userId, event, payload) {
  if (!io) return false;
  io.to(`user:${userId}`).emit(event, payload);
  return true;
}
