import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth.middleware.js";
import {
  getNearbyMatchesController,
  getFeedCandidatesController,
  swipeController,
  getMyMatchesController,
  getReceivedLikesController,
  unmatchController,
  getEncountersController,
} from "../controllers/match.controller.js";

const router = Router();

// Public / Preview Discovery routes (personalized when logged in, real candidate feed always)
router.get("/nearby", optionalAuth, getNearbyMatchesController);
router.get("/feed", optionalAuth, getFeedCandidatesController);

// Protected actions requiring active session
router.use(requireAuth);

// Real Crossed Paths / Proximity Encounters
router.get("/encounters", getEncountersController);

// Record a swipe (like, pass, superlike) & detect mutual match
router.post("/swipe", swipeController);

// Confirmed mutual matches
router.get("/my-matches", getMyMatchesController);

// Incoming likes awaiting response
router.get("/received-likes", getReceivedLikesController);

// Dissolve match & delete chat history
router.post("/unmatch", unmatchController);
router.post("/unmatch/:partnerId", (req, res, next) => {
  req.body.targetUserId = req.params.partnerId;
  return unmatchController(req, res, next);
});

export default router;

