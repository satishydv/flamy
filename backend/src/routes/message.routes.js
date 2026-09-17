import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  getConversationsController,
  getChatMessagesController,
  sendMessageController,
  sendMessageRequestController,
  getReceivedMessageRequestsController,
  acceptMessageRequestController,
  declineMessageRequestController,
  checkChatPermissionController,
} from "../controllers/message.controller.js";

const router = Router();

// Protected messaging endpoints - require active session
router.use(requireAuth);

// Conversation list
router.get("/conversations", getConversationsController);

// Message Requests (before match)
router.get("/requests", getReceivedMessageRequestsController);
router.post("/requests", sendMessageRequestController);
router.post("/requests/:requestId/accept", acceptMessageRequestController);
router.post("/requests/:requestId/decline", declineMessageRequestController);

// Relationship & safety permission check
router.get("/permission/:partnerId", checkChatPermissionController);

// Direct thread messages
router.get("/:partnerId", getChatMessagesController);
router.post("/:partnerId", sendMessageController);

export default router;
