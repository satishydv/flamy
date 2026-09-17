import { prisma } from "../config/prisma.js";
import { emitToUser } from "../socket/index.js";
import { sendExpoPushNotification } from "./push.service.js";

/**
 * Format a Date object into a short friendly relative time string
 */
export function formatNotificationTime(date) {
  if (!date) return "Recently";
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return past.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Format a Prisma notification record into the schema expected by the frontend
 */
export function formatNotificationItem(notification) {
  const sender = notification.sender;
  const profile = sender?.profile;
  const avatarUrl =
    sender?.image ||
    profile?.avatarUrl ||
    sender?.photos?.[0]?.url ||
    null;

  let actionText;
  if (notification.type === "match" || notification.type === "superlike") {
    actionText = "Chat Now";
  } else if (notification.type === "crossed") {
    actionText = "View Profile";
  } else if (notification.type === "request") {
    actionText = "View Request";
  } else if (notification.type === "recommendation") {
    actionText = "Explore";
  } else if (notification.type === "message" || notification.type === "chat") {
    actionText = "Reply";
  }

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    timestamp: formatNotificationTime(notification.createdAt),
    createdAt: notification.createdAt,
    read: notification.read,
    profileId: sender?.id || notification.data?.profileId || undefined,
    profileAvatar: avatarUrl ? { uri: avatarUrl } : null,
    senderName: sender?.name || notification.data?.senderName || null,
    actionText,
    data: notification.data,
  };
}

/**
 * Create a new notification in DB, push in real-time via Socket.IO,
 * and dispatch OS-level background push notification via Expo Push API
 */
export async function createAndSendNotification({
  userId,
  senderId = null,
  type,
  title,
  message,
  data = null,
}) {
  try {
    if (!userId || !type || !title || !message) {
      console.warn("[NOTIFICATION SERVICE] Missing required fields for notification:", {
        userId,
        type,
        title,
      });
      return null;
    }

    const record = await prisma.notification.create({
      data: {
        userId,
        senderId,
        type,
        title,
        message,
        data,
      },
      include: {
        sender: {
          include: {
            profile: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    const formatted = formatNotificationItem(record);

    // 1. Push real-time event to recipient socket
    emitToUser(userId, "notification:new", formatted);
    console.log(`[NOTIFICATION SERVICE] Emitted "${type}" notification to user:${userId}`);

    // 2. Dispatch OS-level push notification if user has registered an Expo push token
    const recipient = await prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true },
    });

    if (recipient?.expoPushToken) {
      sendExpoPushNotification({
        to: recipient.expoPushToken,
        title,
        body: message,
        data: {
          type,
          notificationId: record.id,
          ...(data || {}),
        },
      }).catch((pushErr) => {
        console.error("[NOTIFICATION SERVICE] Background push dispatch notice:", pushErr);
      });
    }

    return formatted;
  } catch (error) {
    console.error("[NOTIFICATION SERVICE] Error creating notification:", error);
    return null;
  }
}
