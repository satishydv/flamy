import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./config/prisma.js";
import authRoutes from "./routes/auth.routes.js";
import otpRoutes from "./routes/otp.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import matchRoutes from "./routes/match.routes.js";
import messageRoutes from "./routes/message.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { initSocket } from "./socket/index.js";

dotenv.config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 5001;

// Trust reverse proxy (Nginx / FastPanel / Cloudflare) to ensure HTTPS cookies work
app.set("trust proxy", 1);

// Create standard Node HTTP server to wrap Express and Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO instance
initSocket(server);

// Enable CORS for all origins (Expo, web, mobile, local network IP, etc.) with credentials support
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any incoming origin dynamically so credentials: true works with all clients
      callback(null, true);
    },
    credentials: true,
  })
);

// Mount Phone OTP authentication routes BEFORE BetterAuth wildcard
app.use("/api/auth/otp", express.json(), otpRoutes);

// Ensure mobile requests (React Native / Expo / APK) have a trusted Origin for BetterAuth CSRF checks
app.use("/api/auth", (req, res, next) => {
  if (!req.headers.origin) {
    req.headers.origin =
      req.headers.referer ||
      process.env.BETTER_AUTH_URL ||
      "https://backend.ckinfynity.shop";
  }
  next();
});

// Mount BetterAuth routes BEFORE express.json()
app.use("/api/auth", authRoutes);

// Body parsing middleware for all standard application routes
app.use(express.json());

// Profile and matchmaking preferences routes
app.use("/api/profile", profileRoutes);

// Nearby matching & encounters routes
app.use("/api/matches", matchRoutes);

// Real messages & before-match message requests routes
app.use("/api/messages", messageRoutes);

// In-app notifications & alerts routes
app.use("/api/notifications", notificationRoutes);

// Basic health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Test endpoint to read back records from Test table
app.get("/api/test", async (req, res) => {
  try {
    const tests = await prisma.test.findMany();
    res.json({ success: true, count: tests.length, data: tests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function startServer() {
  server.listen(PORT, async () => {
    console.log(`Server started on PORT: ${PORT}`);
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("Database connected successfully");
    } catch (error) {
      console.error("Database connection failed:", error.message || error);
    }
  });
}

startServer();

export default app;
