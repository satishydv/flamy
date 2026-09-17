import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  getMyNotificationsController,
  getUnreadCountController,
  markNotificationReadController,
  markAllNotificationsReadController,
} from "../controllers/notification.controller.js";

const router = Router();

// Protected notification endpoints - require active session
router.use(requireAuth);

router.get("/", getMyNotificationsController);
router.get("/unread-count", getUnreadCountController);
router.patch("/mark-all-read", markAllNotificationsReadController);
router.patch("/:id/read", markNotificationReadController);

export default router;
