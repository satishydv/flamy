import { prisma } from "../config/prisma.js";

/**
 * Authentication middleware dedicated strictly to the Admin Panel.
 * Validates the admin session against the independent `AdminSession` / `AdminUser` tables.
 */
export const requireAdminAuth = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    // 2. Fallback to custom x-admin-token header
    if (!token && req.headers["x-admin-token"]) {
      token = req.headers["x-admin-token"].trim();
    }

    // 3. Fallback to cookies (if passed via cookie)
    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/admin_session_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1].trim());
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required. Please log in.",
      });
    }

    // Lookup session in admin_session table
    const session = await prisma.adminSession.findUnique({
      where: { token },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            avatar: true,
            lastLogin: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired admin session. Please log in again.",
      });
    }

    if (new Date() > new Date(session.expiresAt)) {
      // Clean up expired session asynchronously
      prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      return res.status(401).json({
        success: false,
        message: "Admin session has expired. Please log in again.",
      });
    }

    if (!session.admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "This admin account has been deactivated. Contact the system administrator.",
      });
    }

    // Attach admin info to request
    req.admin = session.admin;
    req.adminSession = session;
    return next();
  } catch (error) {
    console.error("[ADMIN AUTH ERROR]:", error.message || error);
    return res.status(500).json({
      success: false,
      message: "Admin authorization check failed due to server error.",
    });
  }
};
