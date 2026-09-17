import { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../config/auth.js";
import { prisma } from "../config/prisma.js";
import { getSessionController, getProvidersController } from "../controllers/auth.controller.js";

const router = Router();

// Custom helper routes
router.get("/me", getSessionController);
router.get("/providers", getProvidersController);

// Comprehensive Sign-Out handler (clears both BetterAuth and custom OTP sessions + cookies)
router.post("/sign-out", async (req, res) => {
  try {
    let token = null;
    if (req.headers.cookie) {
      const match = req.headers.cookie.match(/better-auth\.session_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1].trim());
    }
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7).trim();
    }
    if (!token && req.headers["x-session-token"]) {
      token = req.headers["x-session-token"].trim();
    }

    if (token) {
      await prisma.session.deleteMany({
        where: { token },
      }).catch(() => {});
    }

    try {
      await auth.api.signOut({
        headers: req.headers,
      });
    } catch (e) {}

    const isHttps =
      process.env.NODE_ENV === "production" ||
      process.env.BETTER_AUTH_URL?.startsWith("https://");

    res.clearCookie("better-auth.session_token", {
      path: "/",
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
    });

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("[AUTH] Sign-out error:", err);
    return res.json({ success: true });
  }
});

import { requireAuth } from "../middleware/auth.middleware.js";

// Ensure /me always returns the current authenticated user via either BetterAuth cookie or Bearer token
router.get("/me", requireAuth, (req, res) => {
  return res.json({
    success: true,
    user: req.user,
    session: req.session,
  });
});

// BetterAuth handler for social login, sign-in, callbacks, sessions
const authHandler = toNodeHandler(auth);

// Intercept BetterAuth social OAuth callback redirect to attach the session token to the callback URL
router.get("/callback/:provider", (req, res, next) => {
  const originalWriteHead = res.writeHead;
  res.writeHead = function (statusCode, statusMessage, headers) {
    let finalHeaders = headers;
    if (typeof statusMessage === "object" && statusMessage !== null && !headers) {
      finalHeaders = statusMessage;
    }

    const getH = (name) => {
      if (finalHeaders && finalHeaders[name]) return finalHeaders[name];
      return res.getHeader(name);
    };

    const setH = (name, val) => {
      if (finalHeaders && typeof finalHeaders === "object") {
        finalHeaders[name] = val;
      }
      res.setHeader(name, val);
    };

    const location = getH("location") || getH("Location");
    const setCookie = getH("set-cookie") || getH("Set-Cookie");

    if (location && setCookie) {
      const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
      const match = cookieStr.match(/(?:better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/);
      if (match) {
        const token = decodeURIComponent(match[1].trim());
        const separator = location.includes("?") ? "&" : "?";
        if (!location.includes("token=")) {
          const newLocation = `${location}${separator}token=${encodeURIComponent(token)}`;
          setH("location", newLocation);
          setH("Location", newLocation);
        }
      }
    }

    return originalWriteHead.apply(res, arguments);
  };

  return authHandler(req, res, next);
});

router.all("/*splat", authHandler);
router.all("/", authHandler);

export default router;
