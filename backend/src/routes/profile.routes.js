import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadPhotoMiddleware } from "../middleware/upload.middleware.js";
import {
  getMyProfileController,
  updateProfileController,
  savePreferencesController,
  uploadProfilePhotoController,
  deleteProfilePhotoController,
  getGalleryPhotosController,
  uploadGalleryPhotoController,
  deleteGalleryPhotoController,
  updatePrivacySettingsController,
  blockUserController,
  getBlockedUsersController,
  unblockUserController,
  reportUserController,
  deleteAccountController,
  updateLocationAndCheckProximityController,
  savePushTokenController,
} from "../controllers/profile.controller.js";

const router = Router();

// Protect all profile routes with authentication
router.use(requireAuth);

// Register device Expo Push Token
router.post("/push-token", savePushTokenController);
router.put("/push-token", savePushTokenController);

// Get current user profile and matchmaking preferences
router.get("/me", getMyProfileController);

// Update profile details (bio, age, gender, location, job, tags, name)
router.put("/", updateProfileController);

// Periodic GPS ping & Real Proximity Engine
router.post("/location", updateLocationAndCheckProximityController);
router.put("/location", updateLocationAndCheckProximityController);

// Update privacy preferences (Ghost Mode, Incognito Browsing)
router.put("/privacy", updatePrivacySettingsController);
router.post("/privacy", updatePrivacySettingsController);

// Block, Unblock, and View Blocked Accounts
router.post("/block", blockUserController);
router.get("/blocked", getBlockedUsersController);
router.delete("/blocked/:targetUserId", unblockUserController);
router.post("/unblock", unblockUserController);

// Report User Profile
router.post("/report", reportUserController);

// Delete Account & Permanent Data Wipe (GDPR / App Store)
router.delete("/account", deleteAccountController);

// Persist onboarding questionnaire answers
router.post("/preferences", savePreferencesController);

// Upload profile photo directly to Cloudinary (1MB limit, auto-optimized)
router.post("/upload-photo", uploadPhotoMiddleware, uploadProfilePhotoController);

// Delete profile photo
router.delete("/photo", deleteProfilePhotoController);

// Multi-Photo Gallery endpoints (Max 5 photos per user)
router.get("/gallery", getGalleryPhotosController);
router.post("/gallery", uploadPhotoMiddleware, uploadGalleryPhotoController);
router.delete("/gallery/:photoId", deleteGalleryPhotoController);

export default router;

