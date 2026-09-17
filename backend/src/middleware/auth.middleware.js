import { auth } from "../config/auth.js";
import { prisma } from "../config/prisma.js";

/**
 * Robust authentication middleware:
 * Supports BetterAuth sessions (OAuth/cookies) and custom session tokens (OTP/JWT/mobile headers).
 */
export const requireAuth = async (req, res, next) => {
  try {
    // 1. First attempt: BetterAuth standard session check
    try {
      const betterSession = await auth.api.getSession({
        headers: req.headers,
      });

      if (betterSession && betterSession.user) {
        req.user = betterSession.user;
        req.session = betterSession.session;
        return next();
      }
    } catch (baErr) {
      // Fall through to database session token lookup
    }

    // 2. Second attempt: Direct token lookup from Authorization header or cookies
    let token = null;

    // Check Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    // Check cookie header for better-auth.session_token
    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/(?:better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1].trim());
      }
    }

    // Check custom x-session-token header
    if (!token && req.headers["x-session-token"]) {
      token = req.headers["x-session-token"].trim();
    }

    if (token) {
      const dbSession = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (dbSession && new Date() < new Date(dbSession.expiresAt)) {
        req.user = dbSession.user;
        req.session = dbSession;
        return next();
      }
    }

    return res.status(401).json({
      success: false,
      message: "Unauthorized. Please log in to access this resource.",
    });
  } catch (error) {
    console.error("[AUTH MIDDLEWARE] Error:", error.message || error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed due to server error.",
    });
  }
};

/**
 * Optional authentication middleware:
 * Populates req.user if session/token exists, but proceeds anyway if not.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    try {
      const betterSession = await auth.api.getSession({
        headers: req.headers,
      });

      if (betterSession && betterSession.user) {
        req.user = betterSession.user;
        req.session = betterSession.session;
        return next();
      }
    } catch (baErr) {}

    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/(?:better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1].trim());
      }
    }

    if (!token && req.headers["x-session-token"]) {
      token = req.headers["x-session-token"].trim();
    }

    if (token) {
      const dbSession = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (dbSession && new Date() < new Date(dbSession.expiresAt)) {
        req.user = dbSession.user;
        req.session = dbSession;
      }
    }

    return next();
  } catch (error) {
    return next();
  }
};

