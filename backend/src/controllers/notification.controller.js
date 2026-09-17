import { prisma } from "../config/prisma.js";
import { formatNotificationItem } from "../services/notification.service.js";

/**
 * Get all notifications for the authenticated user, optionally filtered by category
 */
export const getMyNotificationsController = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { category = "all", limit = 50 } = req.query;

    const where = { userId };

    if (category === "matches") {
      where.type = { in: ["match", "superlike"] };
    } else if (category === "crossed") {
      where.type = "crossed";
    } else if (category === "activity") {
      where.type = { in: ["request", "recommendation", "system"] };
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          sender: {
            include: {
              profile: true,
              photos: { orderBy: { order: "asc" } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(parseInt(limit, 10) || 50, 100),
      }),
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    const formattedList = notifications.map(formatNotificationItem);

    return res.json({
      success: true,
      unreadCount,
      count: formattedList.length,
      notifications: formattedList,
    });
  } catch (error) {
    console.error("[NOTIFICATION CONTROLLER] getMyNotifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve notifications.",
    });
  }
};

/**
 * Get count of unread notifications for badge rendering
 */
export const getUnreadCountController = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const count = await prisma.notification.count({
      where: { userId, read: false },
    });

    return res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("[NOTIFICATION CONTROLLER] getUnreadCount error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve unread notification count.",
    });
  }
};

/**
 * Mark a single notification as read
 */
export const markNotificationReadController = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    if (!id) {
      return res.status(400).json({ success: false, message: "Notification ID is required." });
    }

    const updated = await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });

    return res.json({
      success: true,
      updated: updated.count > 0,
    });
  } catch (error) {
    console.error("[NOTIFICATION CONTROLLER] markNotificationRead error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read.",
    });
  }
};

/**
 * Mark all notifications as read for current user
 */
export const markAllNotificationsReadController = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return res.json({
      success: true,
      markedReadCount: result.count,
    });
  } catch (error) {
    console.error("[NOTIFICATION CONTROLLER] markAllNotificationsRead error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read.",
    });
  }
};
