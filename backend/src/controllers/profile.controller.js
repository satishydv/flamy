import { prisma } from "../config/prisma.js";
import {
  uploadImageStream,
  deleteImageFromCloudinary,
  CLOUDINARY_FOLDERS,
} from "../services/cloudinary.service.js";
import { emitToUser } from "../socket/index.js";
import { getBlockedUserIds } from "./match.controller.js";
import { createAndSendNotification } from "../services/notification.service.js";
import { calculateDistanceKm, canonicalPair } from "../utils/geo.js";

/**
 * Get current user profile and matchmaking preferences
 */
export const getMyProfileController = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preference: true,
        photos: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Default structure if profile record is not yet created
    const profileData = user.profile || {
      bio: "",
      age: null,
      gender: null,
      location: "",
      jobTitle: "",
      tags: [],
      avatarUrl: user.image || null,
      avatarPublicId: user.imagePublicId || null,
      isGhostMode: false,
      isIncognito: false,
    };

    // Compute dynamic profile stats from database
    const blockedIds = new Set(await getBlockedUserIds(userId));

    // 1. Confirmed mutual matches count
    const rawMatches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: { user1Id: true, user2Id: true },
    });
    const matchesCount = rawMatches.filter((m) => {
      const partnerId = m.user1Id === userId ? m.user2Id : m.user1Id;
      return !blockedIds.has(partnerId);
    }).length;

    // 2. Received likes count from admirers
    const rawLikes = await prisma.like.findMany({
      where: {
        targetUserId: userId,
        action: { in: ["like", "superlike"] },
      },
      select: { userId: true },
    });
    const likesCount = rawLikes.filter((l) => !blockedIds.has(l.userId)).length;

    // 3. Encounters count (from real Encounter table in PostgreSQL)
    const rawEncounters = await prisma.encounter.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: { user1Id: true, user2Id: true, count: true },
    });
    const validEncounters = rawEncounters.filter((e) => {
      const partnerId = e.user1Id === userId ? e.user2Id : e.user1Id;
      return !blockedIds.has(partnerId);
    });
    const totalEncountersCount = validEncounters.reduce((acc, curr) => acc + (curr.count || 1), 0);
    const encountersCount = validEncounters.length > 0 ? totalEncountersCount : 0;

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        image: user.image,
      },
      profile: profileData,
      photos: user.photos || [],
      preference: user.preference || null,
      stats: {
        encounters: encountersCount,
        matches: matchesCount,
        likes: likesCount,
      },
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] getMyProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user profile.",
    });
  }
};

/**
 * Update user profile details (Name, DOB, Gender, Looking For, Location, Coordinates, Bio, Job, Tags)
 */
export const updateProfileController = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      dob,
      age,
      gender,
      lookingFor,
      location,
      latitude,
      longitude,
      jobTitle,
      bio,
      tags,
    } = req.body;

    // Optional update of User name if supplied
    if (name && typeof name === "string" && name.trim()) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: name.trim() },
      });
    }

    // Format DOB and calculate exact age
    let parsedDob = undefined;
    let parsedAge = undefined;

    if (dob) {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) {
        parsedDob = d;
        const now = new Date();
        let calculated = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
          calculated--;
        }
        if (calculated >= 18 && calculated <= 120) {
          parsedAge = calculated;
        }
      }
    }

    // Fallback age if directly provided
    if (parsedAge === undefined && age !== undefined && age !== null && age !== "") {
      const numAge = parseInt(age, 10);
      if (!isNaN(numAge) && numAge >= 18 && numAge <= 120) {
        parsedAge = numAge;
      }
    }

    // Format lookingFor array (e.g. ['Woman'], ['Man'], ['Woman', 'Man'])
    let parsedLookingFor = undefined;
    if (Array.isArray(lookingFor)) {
      parsedLookingFor = lookingFor.map((item) => String(item).trim()).filter(Boolean);
    } else if (typeof lookingFor === "string" && lookingFor.trim()) {
      parsedLookingFor = [lookingFor.trim()];
    }

    // Format coordinates
    const parsedLat =
      latitude !== undefined && latitude !== null && latitude !== ""
        ? parseFloat(latitude)
        : undefined;
    const parsedLon =
      longitude !== undefined && longitude !== null && longitude !== ""
        ? parseFloat(longitude)
        : undefined;

    // Format tags array
    let parsedTags = undefined;
    if (Array.isArray(tags)) {
      parsedTags = tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof tags === "string") {
      parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const updatedProfile = await prisma.profile.upsert({
      where: { userId },
      update: {
        dob: parsedDob,
        age: parsedAge,
        gender: gender !== undefined ? String(gender).trim() : undefined,
        lookingFor: parsedLookingFor,
        location: location !== undefined ? String(location).trim() : undefined,
        latitude: !isNaN(parsedLat) ? parsedLat : undefined,
        longitude: !isNaN(parsedLon) ? parsedLon : undefined,
        jobTitle: jobTitle !== undefined ? String(jobTitle).trim() : undefined,
        bio: bio !== undefined ? String(bio).trim() : undefined,
        tags: parsedTags,
        lastActive: new Date(),
      },
      create: {
        userId,
        dob: parsedDob || null,
        age: parsedAge || null,
        gender: gender ? String(gender).trim() : null,
        lookingFor: parsedLookingFor || [],
        location: location ? String(location).trim() : "",
        latitude: !isNaN(parsedLat) ? parsedLat : null,
        longitude: !isNaN(parsedLon) ? parsedLon : null,
        jobTitle: jobTitle ? String(jobTitle).trim() : "",
        bio: bio ? String(bio).trim() : "",
        tags: parsedTags || [],
        avatarUrl: req.user.image || null,
        avatarPublicId: req.user.imagePublicId || null,
        lastActive: new Date(),
      },
    });

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] updateProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile.",
    });
  }
};

/**
 * Persist onboarding questionnaire answers in UserPreference table
 */
export const savePreferencesController = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      datingGoal,
      personality,
      partnerTraits,
      musicPreference,
      dealBreakers,
    } = req.body;

    const updatedPreference = await prisma.userPreference.upsert({
      where: { userId },
      update: {
        datingGoal: datingGoal ? String(datingGoal).trim() : undefined,
        personality: personality ? String(personality).trim() : undefined,
        partnerTraits: partnerTraits ? String(partnerTraits).trim() : undefined,
        musicPreference: musicPreference ? String(musicPreference).trim() : undefined,
        dealBreakers: dealBreakers ? String(dealBreakers).trim() : undefined,
      },
      create: {
        userId,
        datingGoal: datingGoal ? String(datingGoal).trim() : null,
        personality: personality ? String(personality).trim() : null,
        partnerTraits: partnerTraits ? String(partnerTraits).trim() : null,
        musicPreference: musicPreference ? String(musicPreference).trim() : null,
        dealBreakers: dealBreakers ? String(dealBreakers).trim() : null,
      },
    });

    return res.json({
      success: true,
      message: "Questionnaire answers saved successfully.",
      preference: updatedPreference,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] savePreferences error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save questionnaire answers.",
    });
  }
};

/**
 * Upload profile photo to Cloudinary (direct buffer stream) and save secure_url & public_id
 */
export const uploadProfilePhotoController = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No image file provided. Please upload an image with field name 'image'.",
      });
    }

    // Check if user already has an existing avatar to clean up old Cloudinary asset
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { imagePublicId: true },
    });

    // Upload buffer directly to Cloudinary under dating-app/profiles/
    const uploadResult = await uploadImageStream(req.file.buffer, {
      folder: CLOUDINARY_FOLDERS.PROFILES,
    });

    // Clean up previous image in Cloudinary if different
    if (
      existingUser?.imagePublicId &&
      existingUser.imagePublicId !== uploadResult.public_id
    ) {
      deleteImageFromCloudinary(existingUser.imagePublicId).catch(() => {});
    }

    // Persist Cloudinary secure_url and public_id in PostgreSQL
    await prisma.user.update({
      where: { id: userId },
      data: {
        image: uploadResult.secure_url,
        imagePublicId: uploadResult.public_id,
      },
    });

    const updatedProfile = await prisma.profile.upsert({
      where: { userId },
      update: {
        avatarUrl: uploadResult.secure_url,
        avatarPublicId: uploadResult.public_id,
      },
      create: {
        userId,
        avatarUrl: uploadResult.secure_url,
        avatarPublicId: uploadResult.public_id,
      },
    });

    return res.json({
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] uploadProfilePhoto error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload profile photo to Cloudinary.",
    });
  }
};

/**
 * Delete profile photo from Cloudinary and reset database fields
 */
export const deleteProfilePhotoController = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { imagePublicId: true },
    });

    if (user?.imagePublicId) {
      await deleteImageFromCloudinary(user.imagePublicId);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        image: null,
        imagePublicId: null,
      },
    });

    await prisma.profile.updateMany({
      where: { userId },
      data: {
        avatarUrl: null,
        avatarPublicId: null,
      },
    });

    return res.json({
      success: true,
      message: "Profile photo removed successfully.",
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] deleteProfilePhoto error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove profile photo.",
    });
  }
};

/**
 * Get all gallery photos for the current user (max 5)
 */
export const getGalleryPhotosController = async (req, res) => {
  try {
    const userId = req.user.id;
    const photos = await prisma.profilePhoto.findMany({
      where: { userId },
      orderBy: { order: "asc" },
    });
    return res.json({ success: true, count: photos.length, photos });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] getGalleryPhotos error:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve gallery photos." });
  }
};

/**
 * Upload a photo to user gallery (enforces maximum 5 photos per user)
 * Uploads to Cloudinary under folder 'dating-app/gallery/'
 */
export const uploadGalleryPhotoController = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No image file provided. Please upload an image with field name 'image'.",
      });
    }

    // Check count of existing gallery photos for this user (Max 5 photos per user)
    const existingPhotoCount = await prisma.profilePhoto.count({
      where: { userId },
    });

    if (existingPhotoCount >= 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum limit reached: You can upload a maximum of 5 photos.",
      });
    }

    // Upload to Cloudinary under GALLERY folder ('dating-app/gallery')
    const uploadResult = await uploadImageStream(req.file.buffer, {
      folder: CLOUDINARY_FOLDERS.GALLERY,
    });

    // Save in PostgreSQL via Prisma
    const newPhoto = await prisma.profilePhoto.create({
      data: {
        userId,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        order: existingPhotoCount,
      },
    });

    // If user doesn't have an avatar yet, automatically set this first photo as user avatar
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });
    if (!user?.image) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          image: uploadResult.secure_url,
          imagePublicId: uploadResult.public_id,
        },
      });
      await prisma.profile.updateMany({
        where: { userId },
        data: {
          avatarUrl: uploadResult.secure_url,
          avatarPublicId: uploadResult.public_id,
        },
      });
    }

    const allPhotos = await prisma.profilePhoto.findMany({
      where: { userId },
      orderBy: { order: "asc" },
    });

    return res.json({
      success: true,
      message: "Photo uploaded to gallery successfully.",
      photo: newPhoto,
      photos: allPhotos,
      totalPhotos: allPhotos.length,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] uploadGalleryPhoto error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload photo to gallery.",
    });
  }
};

/**
 * Delete a photo from user gallery and Cloudinary
 */
export const deleteGalleryPhotoController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { photoId } = req.params;

    if (!photoId) {
      return res.status(400).json({ success: false, message: "Photo ID is required." });
    }

    const photo = await prisma.profilePhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return res.status(404).json({ success: false, message: "Photo not found." });
    }

    if (photo.userId !== userId) {
      return res.status(403).json({ success: false, message: "You are not authorized to delete this photo." });
    }

    // Delete asset from Cloudinary
    if (photo.publicId) {
      await deleteImageFromCloudinary(photo.publicId);
    }

    // Delete record from Prisma
    await prisma.profilePhoto.delete({
      where: { id: photoId },
    });

    // Re-index remaining photos order
    const remainingPhotos = await prisma.profilePhoto.findMany({
      where: { userId },
      orderBy: { order: "asc" },
    });

    for (let i = 0; i < remainingPhotos.length; i++) {
      if (remainingPhotos[i].order !== i) {
        await prisma.profilePhoto.update({
          where: { id: remainingPhotos[i].id },
          data: { order: i },
        });
      }
    }

    return res.json({
      success: true,
      message: "Photo deleted successfully.",
      photos: remainingPhotos,
      remainingCount: remainingPhotos.length,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] deleteGalleryPhoto error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete photo.",
    });
  }
};

/**
 * Update privacy settings (Ghost Mode, Incognito Browsing)
 */
export const updatePrivacySettingsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isGhostMode, isIncognito } = req.body;

    const updatedProfile = await prisma.profile.upsert({
      where: { userId },
      update: {
        ...(typeof isGhostMode === "boolean" ? { isGhostMode } : {}),
        ...(typeof isIncognito === "boolean" ? { isIncognito } : {}),
      },
      create: {
        userId,
        isGhostMode: Boolean(isGhostMode),
        isIncognito: Boolean(isIncognito),
      },
    });

    return res.json({
      success: true,
      message: "Privacy preferences saved.",
      isGhostMode: updatedProfile.isGhostMode,
      isIncognito: updatedProfile.isIncognito,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] updatePrivacySettings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update privacy preferences.",
    });
  }
};

/**
 * Block a user: severs all connection, removes match, messages, and requests
 */
export const blockUserController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { targetUserId, reason } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "targetUserId is required." });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: "Cannot block yourself." });
    }

    // Upsert block record
    const block = await prisma.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: currentUserId,
          blockedId: targetUserId,
        },
      },
      update: {
        reason: reason ? String(reason).trim() : null,
        createdAt: new Date(),
      },
      create: {
        blockerId: currentUserId,
        blockedId: targetUserId,
        reason: reason ? String(reason).trim() : null,
      },
    });

    // Dissolve any existing match
    await prisma.match.deleteMany({
      where: {
        OR: [
          { user1Id: currentUserId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: currentUserId },
        ],
      },
    });

    // Delete direct messages between both users
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
    });

    // Delete message requests between both users
    await prisma.messageRequest.deleteMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
    });

    // Remove likes in both directions
    await prisma.like.deleteMany({
      where: {
        OR: [
          { userId: currentUserId, targetUserId: targetUserId },
          { userId: targetUserId, targetUserId: currentUserId },
        ],
      },
    });

    // Notify real-time socket clients
    emitToUser(targetUserId, "chat:blocked", { partnerId: currentUserId });
    emitToUser(currentUserId, "chat:blocked", { partnerId: targetUserId });

    return res.json({
      success: true,
      message: "User has been blocked. All connection history has been severed.",
      block,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] blockUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to block user.",
    });
  }
};

/**
 * Get all users blocked by the authenticated user
 */
export const getBlockedUsersController = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const blocks = await prisma.block.findMany({
      where: { blockerId: currentUserId },
      include: {
        blocked: {
          include: {
            profile: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const blockedUsers = blocks.map((b) => {
      const u = b.blocked;
      const p = u.profile;
      const gallery = (u.photos || []).map((ph) => ph.url);
      return {
        id: u.id,
        name: u.name,
        image: u.image || p?.avatarUrl || gallery[0] || null,
        blockedAt: b.createdAt,
        reason: b.reason,
      };
    });

    return res.json({
      success: true,
      count: blockedUsers.length,
      blockedUsers,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] getBlockedUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load blocked users.",
    });
  }
};

/**
 * Unblock a previously blocked user
 */
export const unblockUserController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.targetUserId || req.body.targetUserId;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "targetUserId is required." });
    }

    await prisma.block.deleteMany({
      where: {
        blockerId: currentUserId,
        blockedId: targetUserId,
      },
    });

    return res.json({
      success: true,
      message: "User unblocked successfully.",
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] unblockUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unblock user.",
    });
  }
};

/**
 * Report a user for policy / community guidelines violations
 */
export const reportUserController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { reportedUserId, category, details, alsoBlock = false } = req.body;

    if (!reportedUserId) {
      return res.status(400).json({ success: false, message: "reportedUserId is required." });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: "Violation category is required." });
    }

    if (reportedUserId === currentUserId) {
      return res.status(400).json({ success: false, message: "You cannot report your own profile." });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: currentUserId,
        reportedId: reportedUserId,
        category: category.trim(),
        details: details ? details.trim() : null,
        status: "pending",
      },
    });

    // If alsoBlock is selected, execute blocking
    if (alsoBlock) {
      await prisma.block.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: currentUserId,
            blockedId: reportedUserId,
          },
        },
        update: { reason: `Reported: ${category.trim()}`, createdAt: new Date() },
        create: {
          blockerId: currentUserId,
          blockedId: reportedUserId,
          reason: `Reported: ${category.trim()}`,
        },
      });

      await prisma.match.deleteMany({
        where: {
          OR: [
            { user1Id: currentUserId, user2Id: reportedUserId },
            { user1Id: reportedUserId, user2Id: currentUserId },
          ],
        },
      });
      await prisma.message.deleteMany({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: reportedUserId },
            { senderId: reportedUserId, receiverId: currentUserId },
          ],
        },
      });
      await prisma.messageRequest.deleteMany({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: reportedUserId },
            { senderId: reportedUserId, receiverId: currentUserId },
          ],
        },
      });
      await prisma.like.deleteMany({
        where: {
          OR: [
            { userId: currentUserId, targetUserId: reportedUserId },
            { userId: reportedUserId, targetUserId: currentUserId },
          ],
        },
      });

      emitToUser(reportedUserId, "chat:blocked", { partnerId: currentUserId });
      emitToUser(currentUserId, "chat:blocked", { partnerId: reportedUserId });
    }

    return res.json({
      success: true,
      message: "Report submitted successfully. Our safety team will review it promptly.",
      reportId: report.id,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] reportUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit report.",
    });
  }
};

/**
 * Delete User Account & Wipe all data per GDPR & App Store Guidelines
 * - Purges all photo assets from Cloudinary CDN
 * - Cascade-deletes all database records associated with the user
 */
export const deleteAccountController = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // 1. Fetch user photos & avatar public IDs to wipe from Cloudinary
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: {
        profile: true,
        photos: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    const publicIdsToDelete = new Set();
    if (user.imagePublicId) publicIdsToDelete.add(user.imagePublicId);
    if (user.profile?.avatarPublicId) publicIdsToDelete.add(user.profile.avatarPublicId);
    (user.photos || []).forEach((photo) => {
      if (photo.publicId) publicIdsToDelete.add(photo.publicId);
    });

    // 2. Wipe every photo from Cloudinary CDN
    for (const publicId of publicIdsToDelete) {
      try {
        await deleteImageFromCloudinary(publicId);
      } catch (cErr) {
        console.error(`[DELETE ACCOUNT] Error deleting Cloudinary asset ${publicId}:`, cErr);
      }
    }

    // 3. Delete user from PostgreSQL (Cascades to all tables)
    await prisma.user.delete({
      where: { id: currentUserId },
    });

    // 4. Return success and clear cookies
    res.clearCookie("better-auth.session_token");

    return res.json({
      success: true,
      message: "Your account and all associated personal data have been permanently wiped.",
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] deleteAccount error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete account.",
    });
  }
};

/**
 * Update user's GPS coordinates and evaluate proximity encounters (~500m)
 * Supports periodic background/foreground pings from the app
 */
export const updateLocationAndCheckProximityController = async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { latitude, longitude, location } = req.body;
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const locationName = location ? String(location).trim() : null;

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        message: "Valid numeric latitude and longitude coordinates are required.",
      });
    }

    // Load current user and profile
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: { profile: true },
    });

    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Upsert current user's profile with updated coordinates
    const updatedProfile = await prisma.profile.upsert({
      where: { userId: currentUserId },
      update: {
        latitude: lat,
        longitude: lon,
        ...(locationName ? { location: locationName } : {}),
        lastActive: new Date(),
      },
      create: {
        userId: currentUserId,
        latitude: lat,
        longitude: lon,
        location: locationName || "Nearby",
        lastActive: new Date(),
      },
    });

    // If current user is in Ghost Mode, their location is updated but proximity matching is paused
    if (updatedProfile.isGhostMode) {
      return res.json({
        success: true,
        message: "Location updated. Ghost Mode is active (proximity matching paused).",
        isGhostMode: true,
        coordinates: { latitude: lat, longitude: lon },
        encountersTriggered: 0,
      });
    }

    // Retrieve blocked user IDs to ensure bidirectional exclusion
    const blockedIds = await getBlockedUserIds(currentUserId);
    const excludeIds = [currentUserId, ...blockedIds];

    // Query potential candidates with coordinates who are NOT in Ghost Mode
    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: excludeIds },
        profile: {
          isNot: null,
          is: {
            isGhostMode: false,
            latitude: { not: null },
            longitude: { not: null },
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const now = new Date();
    const PROXIMITY_THRESHOLD_KM = 0.5; // ~500 meters
    const COOLDOWN_MINUTES = 30; // 30 min cooldown between counter increments & alerts
    let encountersTriggered = 0;
    const matchedEncounters = [];

    for (const candidate of candidates) {
      const cLat = candidate.profile?.latitude;
      const cLon = candidate.profile?.longitude;
      if (cLat === null || cLon === null) continue;

      const distKm = calculateDistanceKm(lat, lon, cLat, cLon);

      if (distKm <= PROXIMITY_THRESHOLD_KM) {
        const [u1, u2] = canonicalPair(currentUserId, candidate.id);

        const existingEncounter = await prisma.encounter.findUnique({
          where: {
            user1Id_user2Id: { user1Id: u1, user2Id: u2 },
          },
        });

        let encounterRecord;
        let shouldNotify = false;

        const effectiveLocation =
          locationName ||
          candidate.profile?.location ||
          existingEncounter?.locationName ||
          "Nearby";

        if (existingEncounter) {
          const diffMinutes =
            (now.getTime() - new Date(existingEncounter.lastCrossedAt).getTime()) / (1000 * 60);

          if (diffMinutes >= COOLDOWN_MINUTES) {
            encounterRecord = await prisma.encounter.update({
              where: { id: existingEncounter.id },
              data: {
                count: { increment: 1 },
                lastCrossedAt: now,
                latitude: lat,
                longitude: lon,
                locationName: effectiveLocation,
              },
            });
            shouldNotify = true;
          } else {
            encounterRecord = existingEncounter;
          }
        } else {
          encounterRecord = await prisma.encounter.create({
            data: {
              user1Id: u1,
              user2Id: u2,
              count: 1,
              lastCrossedAt: now,
              latitude: lat,
              longitude: lon,
              locationName: effectiveLocation,
            },
          });
          shouldNotify = true;
        }

        matchedEncounters.push({
          candidateId: candidate.id,
          candidateName: candidate.name,
          distanceMeters: Math.round(distKm * 1000),
          count: encounterRecord.count,
          notified: shouldNotify,
        });

        if (shouldNotify) {
          encountersTriggered++;

          // Send real-time notification to Candidate
          await createAndSendNotification({
            userId: candidate.id,
            senderId: currentUserId,
            type: "crossed",
            title: "Crossed Paths! 📍",
            message: `You crossed paths with ${currentUser.name} near ${effectiveLocation}`,
            data: {
              profileId: currentUserId,
              senderName: currentUser.name,
              location: effectiveLocation,
              latitude: lat,
              longitude: lon,
              distanceMeters: Math.round(distKm * 1000),
              encountersCount: encounterRecord.count,
            },
          });

          // Send real-time notification to Current User
          await createAndSendNotification({
            userId: currentUserId,
            senderId: candidate.id,
            type: "crossed",
            title: "Crossed Paths! 📍",
            message: `You crossed paths with ${candidate.name} near ${effectiveLocation}`,
            data: {
              profileId: candidate.id,
              senderName: candidate.name,
              location: effectiveLocation,
              latitude: cLat,
              longitude: cLon,
              distanceMeters: Math.round(distKm * 1000),
              encountersCount: encounterRecord.count,
            },
          });
        }
      }
    }

    return res.json({
      success: true,
      message: "Location updated and proximity evaluated.",
      coordinates: { latitude: lat, longitude: lon },
      location: locationName || updatedProfile.location,
      encountersTriggered,
      encounters: matchedEncounters,
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] updateLocationAndCheckProximity error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update location and evaluate proximity.",
    });
  }
};

/**
 * Register or update the user's Expo Push Token in PostgreSQL
 */
export const savePushTokenController = async (req, res) => {
  try {
    const userId = req.user?.id || req.body?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ success: false, message: "Valid push token is required." });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { expoPushToken: token.trim() },
    });

    console.log(`[PROFILE CONTROLLER] Saved expoPushToken for user:${userId}`);
    return res.json({
      success: true,
      message: "Push token registered successfully.",
    });
  } catch (error) {
    console.error("[PROFILE CONTROLLER] savePushToken error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save push token.",
    });
  }
};

