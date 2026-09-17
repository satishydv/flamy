import { prisma } from "../config/prisma.js";
import { createAndSendNotification, formatNotificationTime } from "../services/notification.service.js";
import { emitToUser } from "../socket/index.js";

/**
 * Retrieve all user IDs blocked by or blocking the given user
 */
export async function getBlockedUserIds(userId) {
  if (!userId) return [];
  const blocks = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set();
  blocks.forEach((b) => {
    if (b.blockerId === userId) ids.add(b.blockedId);
    if (b.blockedId === userId) ids.add(b.blockerId);
  });
  return Array.from(ids);
}

/**
 * Calculate Great-Circle distance in kilometers using the Haversine formula
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate compass bearing angle in radians between two GPS coordinates
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  return Math.atan2(y, x);
}

/**
 * Robust mutual gender compatibility check supporting plural/singular (women/woman, men/man)
 */
function isGenderCompatible(wantedList, candidateGender) {
  if (!wantedList || !Array.isArray(wantedList) || wantedList.length === 0) return true;
  if (!candidateGender) return true;
  const cg = String(candidateGender).toLowerCase().trim();
  return wantedList.some((wanted) => {
    const w = String(wanted).toLowerCase().trim();
    if (w === "everyone" || w === "both" || w === "all") return true;
    if (w === cg) return true;
    if (
      (w === "women" || w === "woman" || w === "female") &&
      (cg === "women" || cg === "woman" || cg === "female")
    ) {
      return true;
    }
    if (
      (w === "men" || w === "man" || w === "male") &&
      (cg === "men" || cg === "man" || cg === "male")
    ) {
      return true;
    }
    return false;
  });
}


/**
 * Get nearby matches for the authenticated user, filtered by mutual gender preferences
 * and sorted by distance with computed radar coordinates (x, y).
 */
export const getNearbyMatchesController = async (req, res) => {
  try {
    const currentUserId = req.user?.id || null;

    // Load current user's profile and questionnaire preferences if logged in
    let currentUser = null;
    if (currentUserId) {
      currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        include: {
          profile: true,
          preference: true,
        },
      });
    }

    const userProfile = currentUser?.profile;
    const userPref = currentUser?.preference;

    // If current user enabled Ghost Mode, they are hidden and discovery is paused
    if (userProfile?.isGhostMode) {
      return res.json({
        success: true,
        isGhostMode: true,
        count: 0,
        message: "Ghost Mode is active. Your profile is hidden from the radar map.",
        userCoordinates: {
          latitude: userProfile.latitude || 17.4747,
          longitude: userProfile.longitude || 78.3343,
        },
        profiles: [],
      });
    }

    // Determine current user coordinates (from query, then profile, then fallback Hyderabad)
    let userLat = req.query.lat ? parseFloat(req.query.lat) : userProfile?.latitude;
    let userLon = req.query.lon ? parseFloat(req.query.lon) : userProfile?.longitude;

    if (isNaN(userLat) || isNaN(userLon) || userLat === null || userLon === null) {
      userLat = 17.4747;
      userLon = 78.3343;
    }

    const radiusKm = req.query.radiusKm ? parseFloat(req.query.radiusKm) : 50;
    const category = req.query.category || "all";

    // Build mutual gender filter
    const lookingFor = userProfile?.lookingFor || [];
    const myGender = userProfile?.gender;

    // Retrieve blocked user IDs to ensure neither party sees each other
    const blockedIds = await getBlockedUserIds(currentUserId);
    const excludeIds = currentUserId ? [currentUserId, ...blockedIds] : [];

    // Query candidate profiles in database (excluding ghost mode and blocked users)
    const candidates = await prisma.user.findMany({
      where: {
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        profile: { isNot: null, is: { isGhostMode: false } },
      },
      include: {
        profile: true,
        preference: true,
        photos: {
          orderBy: { order: "asc" },
        },
      },
      take: 100,
    });

    // Query real encounters between current user and candidates
    const userEncounters = currentUserId
      ? await prisma.encounter.findMany({
          where: {
            OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
          },
        })
      : [];
    const encounterMap = new Map();
    userEncounters.forEach((e) => {
      const partnerId = e.user1Id === currentUserId ? e.user2Id : e.user1Id;
      encounterMap.set(partnerId, e);
    });

    // Query active likes sent by current user to accurately return liked & superLiked status
    const userLikes = currentUserId
      ? await prisma.like.findMany({
          where: {
            userId: currentUserId,
            action: { in: ["like", "superlike"] },
          },
          select: { targetUserId: true, action: true },
        })
      : [];
    const likeMap = new Map();
    userLikes.forEach((l) => likeMap.set(l.targetUserId, l.action));

    const formattedProfiles = [];

    for (const candidate of candidates) {
      const p = candidate.profile;
      const pref = candidate.preference;
      if (!p) continue;

      // 1. Filter by my 'lookingFor' preferences if specified
      if (lookingFor.length > 0 && p.gender && !isGenderCompatible(lookingFor, p.gender)) {
        continue;
      }

      // 2. Filter by candidate's 'lookingFor' preference if specified
      if (p.lookingFor && p.lookingFor.length > 0 && myGender && !isGenderCompatible(p.lookingFor, myGender)) {
        continue;
      }

      // Calculate distance
      let cLat = p.latitude;
      let cLon = p.longitude;

      // If candidate has no lat/lon, generate a reasonable local delta around user location
      if (cLat === null || cLon === null || isNaN(cLat) || isNaN(cLon)) {
        const seed = (candidate.id.charCodeAt(candidate.id.length - 1) || 5) % 10;
        cLat = userLat + (seed - 5) * 0.003;
        cLon = userLon + ((seed * 3) % 10 - 5) * 0.003;
      }

      const distanceKm = calculateDistanceKm(userLat, userLon, cLat, cLon);

      // Skip if beyond requested radius
      if (distanceKm > radiusKm) continue;

      // Human-readable distance
      const distanceStr =
        distanceKm < 1
          ? `${Math.max(50, Math.round(distanceKm * 1000))}m away`
          : `${distanceKm.toFixed(1)}km away`;

      // Radar coordinates calculation (0 to 100 percent)
      const bearing = calculateBearing(userLat, userLon, cLat, cLon);
      // Normalize radius: distance determines ring (0.12 to 0.40 radius from center)
      const ringRatio = Math.min(0.38, 0.12 + (distanceKm / Math.max(radiusKm, 10)) * 0.26);
      const radarX = Math.round(50 + ringRatio * 100 * Math.cos(bearing));
      const radarY = Math.round(50 + ringRatio * 100 * Math.sin(bearing));

      // Compatibility score calculation based on questionnaires
      let score = 75;
      let matchReason = "Nearby Encounter";

      if (userPref && pref) {
        if (userPref.datingGoal && userPref.datingGoal === pref.datingGoal) {
          score += 10;
          matchReason = `Shared Goal: ${userPref.datingGoal}`;
        }
        if (userPref.personality && userPref.personality === pref.personality) {
          score += 6;
          matchReason = "Same Energy & Vibe";
        }
        if (userPref.musicPreference && userPref.musicPreference === pref.musicPreference) {
          score += 5;
        }
      } else {
        // Fallback score seeded by user id
        score = 80 + ((candidate.id.charCodeAt(candidate.id.length - 1) || 2) % 17);
      }

      const finalMatchPct = Math.min(99, Math.max(72, score));
      const galleryUrls = (candidate.photos || []).map((photo) => photo.url);

      const enc = encounterMap.get(candidate.id);
      const encCount = enc ? enc.count : 0;
      const lastCrossedStr = enc
        ? `Crossed paths ${formatNotificationTime(enc.lastCrossedAt)}`
        : "Nearby on radar";
      const displayLocation = enc?.locationName || p.location || "Nearby";

      formattedProfiles.push({
        id: candidate.id,
        name: candidate.name,
        age: p.age || 24,
        isVerified: true,
        jobTitle: p.jobTitle || "Creative Professional",
        location: displayLocation,
        distance: distanceStr,
        distanceKm: distanceKm,
        encountersCount: encCount,
        lastCrossed: lastCrossedStr,
        hasCrossedPaths: !!enc,
        lastCrossedAt: enc?.lastCrossedAt || null,
        matchPercentage: finalMatchPct,
        bio: p.bio || "Looking to meet genuine people and explore the city.",
        tags: p.tags && p.tags.length > 0 ? p.tags : ["Coffee", "Art", "Travel"],
        image: candidate.image || p.avatarUrl || galleryUrls[0] || null,
        additionalImages: galleryUrls,
        photos: candidate.photos || [],
        mapCoordinates: {
          x: Math.min(88, Math.max(12, radarX)),
          y: Math.min(88, Math.max(12, radarY)),
        },
        category: category,
        online: true,
        liked: likeMap.has(candidate.id),
        superLiked: likeMap.get(candidate.id) === "superlike",
        datingGoal: pref?.datingGoal || "Long-Term Dating",
        personality: pref?.personality || "Balanced & Mindful",
        partnerTraits: pref?.partnerTraits || "Sense of Humor",
        musicPreference: pref?.musicPreference || "Indie & Acoustic",
        dealBreakers: pref?.dealBreakers || "Dishonesty",
        compatibilityReason: matchReason,
      });
    }

    // Category-specific filtering and sorting
    let finalProfiles = formattedProfiles;

    if (category === "recent" || category === "crossed") {
      // Prioritize profiles that have a real Encounter record, sorted by latest encounter
      const crossedOnly = formattedProfiles.filter((item) => item.hasCrossedPaths);
      if (crossedOnly.length > 0) {
        crossedOnly.sort(
          (a, b) => new Date(b.lastCrossedAt).getTime() - new Date(a.lastCrossedAt).getTime()
        );
        finalProfiles = crossedOnly;
      } else {
        // If no crossed paths yet, sort by distance ascending
        finalProfiles.sort((a, b) => a.distanceKm - b.distanceKm);
      }
    } else if (category === "nearby") {
      finalProfiles = formattedProfiles.filter((item) => item.distanceKm <= 3.0);
      if (finalProfiles.length === 0) finalProfiles = formattedProfiles.slice(0, 10);
    } else {
      // Default: sort by distance ascending
      finalProfiles.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return res.json({
      success: true,
      count: finalProfiles.length,
      userCoordinates: { latitude: userLat, longitude: userLon },
      profiles: finalProfiles,
    });
  } catch (error) {
    console.error("[MATCH CONTROLLER] getNearbyMatches error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load nearby matches.",
    });
  }
};

/**
 * Get candidate feed for HomeScreen swipe cards
 * Excludes the current user and any candidate already swiped (liked or passed)
 */
export const getFeedCandidatesController = async (req, res) => {
  try {
    const currentUserId = req.user?.id || null;

    let currentUser = null;
    let excludedIds = [];

    if (currentUserId) {
      currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        include: {
          profile: true,
          preference: true,
        },
      });

      const existingSwipes = await prisma.like.findMany({
        where: { userId: currentUserId },
        select: { targetUserId: true },
      });
      const blockedIds = await getBlockedUserIds(currentUserId);
      excludedIds = [currentUserId, ...existingSwipes.map((s) => s.targetUserId), ...blockedIds];
    }

    const userProfile = currentUser?.profile;
    const userPref = currentUser?.preference;

    let userLat = req.query.lat ? parseFloat(req.query.lat) : userProfile?.latitude;
    let userLon = req.query.lon ? parseFloat(req.query.lon) : userProfile?.longitude;

    if (isNaN(userLat) || isNaN(userLon) || userLat === null || userLon === null) {
      userLat = 17.4747;
      userLon = 78.3343;
    }

    const lookingFor = userProfile?.lookingFor || [];
    const myGender = userProfile?.gender;

    // Query candidates not yet swiped on (excluding ghost mode and blocked users)
    const candidates = await prisma.user.findMany({
      where: {
        ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
        profile: { isNot: null, is: { isGhostMode: false } },
      },
      include: {
        profile: true,
        preference: true,
        photos: {
          orderBy: { order: "asc" },
        },
      },
      take: 50,
    });

    // Query encounters for current user to show crossed paths on candidate feed cards
    const userEncounters = currentUserId
      ? await prisma.encounter.findMany({
          where: {
            OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
          },
        })
      : [];
    const feedEncounterMap = new Map();
    userEncounters.forEach((e) => {
      const partnerId = e.user1Id === currentUserId ? e.user2Id : e.user1Id;
      feedEncounterMap.set(partnerId, e);
    });

    const feed = [];

    for (const candidate of candidates) {
      const p = candidate.profile;
      const pref = candidate.preference;
      if (!p) continue;

      // Filter by mutual gender preferences
      if (lookingFor.length > 0 && p.gender && !isGenderCompatible(lookingFor, p.gender)) {
        continue;
      }

      if (p.lookingFor && p.lookingFor.length > 0 && myGender && !isGenderCompatible(p.lookingFor, myGender)) {
        continue;
      }

      let cLat = p.latitude;
      let cLon = p.longitude;
      if (cLat === null || cLon === null || isNaN(cLat) || isNaN(cLon)) {
        const seed = (candidate.id.charCodeAt(candidate.id.length - 1) || 5) % 10;
        cLat = userLat + (seed - 5) * 0.003;
        cLon = userLon + ((seed * 3) % 10 - 5) * 0.003;
      }

      const distanceKm = calculateDistanceKm(userLat, userLon, cLat, cLon);
      const distanceStr =
        distanceKm < 1
          ? `${Math.max(50, Math.round(distanceKm * 1000))}m away`
          : `${distanceKm.toFixed(1)}km away`;

      // Compatibility score
      let score = 75;
      let matchReason = "Nearby Encounter";

      if (userPref && pref) {
        if (userPref.datingGoal && userPref.datingGoal === pref.datingGoal) {
          score += 10;
          matchReason = `Shared Goal: ${userPref.datingGoal}`;
        }
        if (userPref.personality && userPref.personality === pref.personality) {
          score += 6;
          matchReason = "Same Energy & Vibe";
        }
        if (userPref.musicPreference && userPref.musicPreference === pref.musicPreference) {
          score += 5;
        }
      } else {
        score = 80 + ((candidate.id.charCodeAt(candidate.id.length - 1) || 2) % 17);
      }

      const finalMatchPct = Math.min(99, Math.max(72, score));
      const galleryUrls = (candidate.photos || []).map((photo) => photo.url);

      const feedEnc = feedEncounterMap.get(candidate.id);
      const feedEncCount = feedEnc ? feedEnc.count : 0;
      const feedLastCrossed = feedEnc
        ? `Crossed paths ${formatNotificationTime(feedEnc.lastCrossedAt)}`
        : "Discovered nearby";
      const feedLoc = feedEnc?.locationName || p.location || "Nearby";

      feed.push({
        id: candidate.id,
        name: candidate.name,
        age: p.age || 24,
        isVerified: true,
        jobTitle: p.jobTitle || "Creative Professional",
        location: feedLoc,
        distance: distanceStr,
        distanceKm: distanceKm,
        encountersCount: feedEncCount,
        lastCrossed: feedLastCrossed,
        hasCrossedPaths: !!feedEnc,
        matchPercentage: finalMatchPct,
        bio: p.bio || "Looking to meet genuine people and explore the city.",
        tags: p.tags && p.tags.length > 0 ? p.tags : ["Coffee", "Art", "Travel"],
        image: candidate.image || p.avatarUrl || galleryUrls[0] || null,
        additionalImages: galleryUrls,
        photos: candidate.photos || [],
        mapCoordinates: { x: 50, y: 50 },
        category: "all",
        online: true,
        liked: false,
        datingGoal: pref?.datingGoal || "Long-Term Dating",
        personality: pref?.personality || "Balanced & Mindful",
        partnerTraits: pref?.partnerTraits || "Sense of Humor",
        musicPreference: pref?.musicPreference || "Indie & Acoustic",
        dealBreakers: pref?.dealBreakers || "Dishonesty",
        compatibilityReason: matchReason,
      });
    }

    feed.sort((a, b) => a.distanceKm - b.distanceKm);

    return res.json({
      success: true,
      count: feed.length,
      feed,
    });
  } catch (error) {
    console.error("[MATCH CONTROLLER] getFeedCandidates error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load candidate feed.",
    });
  }
};

/**
 * Handle Swipe Action (Like, Pass, or Superlike)
 * Detects mutual likes in real time and automatically creates Match records
 */
export const swipeController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { targetUserId, action = "like" } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "targetUserId is required.",
      });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot swipe on your own profile.",
      });
    }

    // Verify target user exists in database
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target profile not found or no longer active.",
      });
    }

    // Check if either party has blocked the other
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUserId },
        ],
      },
    });

    if (isBlocked) {
      return res.status(400).json({
        success: false,
        message: "Cannot swipe on a blocked user profile.",
      });
    }

    // Upsert swipe record in Like table
    const normalizedAction = action.toLowerCase();

    if (normalizedAction === "unlike") {
      await prisma.like.deleteMany({
        where: {
          userId: currentUserId,
          targetUserId,
        },
      });
      return res.json({
        success: true,
        action: "unlike",
        isMatch: false,
      });
    }

    const swipeRecord = await prisma.like.upsert({
      where: {
        userId_targetUserId: {
          userId: currentUserId,
          targetUserId,
        },
      },
      update: {
        action: normalizedAction,
        createdAt: new Date(),
      },
      create: {
        userId: currentUserId,
        targetUserId,
        action: normalizedAction,
      },
    });

    // If passed, return immediately with isMatch: false
    if (normalizedAction === "pass") {
      return res.json({
        success: true,
        action: "pass",
        isMatch: false,
      });
    }

    // If like or superlike, check if targetUser has also liked or superliked current user
    const reciprocalSwipe = await prisma.like.findFirst({
      where: {
        userId: targetUserId,
        targetUserId: currentUserId,
        action: { in: ["like", "superlike"] },
      },
    });

    if (reciprocalSwipe) {
      // Mutual Like Detected! Create canonical match record (user1Id < user2Id)
      const [u1, u2] = [currentUserId, targetUserId].sort();

      const matchRecord = await prisma.match.upsert({
        where: {
          user1Id_user2Id: {
            user1Id: u1,
            user2Id: u2,
          },
        },
        update: {},
        create: {
          user1Id: u1,
          user2Id: u2,
        },
      });

      // Retrieve matched candidate details for instant frontend celebration modal
      const matchedUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: {
          profile: true,
          preference: true,
          photos: { orderBy: { order: "asc" } },
        },
      });

      // Send real-time notification to the matched partner
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { name: true },
      });
      const currentUserName = currentUser?.name || "Someone";

      createAndSendNotification({
        userId: targetUserId,
        senderId: currentUserId,
        type: "match",
        title: "It's a Match! 🎉",
        message: `You and ${currentUserName} matched! Say hello!`,
        data: { matchId: matchRecord.id, profileId: currentUserId },
      }).catch((err) => console.error("[MATCH NOTIFICATION] Error:", err));

      return res.json({
        success: true,
        isMatch: true,
        action: normalizedAction,
        match: matchRecord,
        matchedUser: {
          id: matchedUser.id,
          name: matchedUser.name,
          age: matchedUser.profile?.age || 24,
          isVerified: true,
          image: matchedUser.image || matchedUser.profile?.avatarUrl || matchedUser.photos?.[0]?.url || null,
          location: matchedUser.profile?.location || "Nearby",
          jobTitle: matchedUser.profile?.jobTitle || "Professional",
          bio: matchedUser.profile?.bio || "",
          photos: matchedUser.photos || [],
          encountersCount: Math.max(1, (matchedUser.id.charCodeAt(0) || 1) % 4),
        },
      });
    }

    // If swiped superlike (and target hasn't liked back yet), notify them!
    if (normalizedAction === "superlike") {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { name: true },
      });
      const currentUserName = currentUser?.name || "Someone";

      createAndSendNotification({
        userId: targetUserId,
        senderId: currentUserId,
        type: "superlike",
        title: "New Super Like! ⭐",
        message: `${currentUserName} sent you a Super Like! Check their profile.`,
        data: { profileId: currentUserId },
      }).catch((err) => console.error("[SUPERLIKE NOTIFICATION] Error:", err));
    }

    // Swiped like/superlike, but target hasn't liked back yet
    return res.json({
      success: true,
      isMatch: false,
      action: normalizedAction,
      swipe: swipeRecord,
    });
  } catch (error) {
    console.error("[MATCH CONTROLLER] swipe error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record swipe action.",
    });
  }
};

/**
 * Get all confirmed mutual matches for the authenticated user
 */
export const getMyMatchesController = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      },
      include: {
        user1: {
          include: {
            profile: true,
            preference: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
        user2: {
          include: {
            profile: true,
            preference: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const blockedIds = new Set(await getBlockedUserIds(currentUserId));
    const activeMatches = matches.filter((m) => {
      const partnerId = m.user1Id === currentUserId ? m.user2Id : m.user1Id;
      return !blockedIds.has(partnerId);
    });

    const formattedMatches = activeMatches.map((match) => {
      const isUser1 = match.user1Id === currentUserId;
      const partner = isUser1 ? match.user2 : match.user1;
      const p = partner.profile;
      const pref = partner.preference;
      const galleryUrls = (partner.photos || []).map((photo) => photo.url);

      return {
        matchId: match.id,
        matchedAt: match.createdAt,
        id: partner.id,
        name: partner.name,
        age: p?.age || 24,
        isVerified: true,
        jobTitle: p?.jobTitle || "Creative Professional",
        location: p?.location || "Nearby",
        distance: "Matched",
        encountersCount: Math.max(1, (partner.id.charCodeAt(0) || 1) % 4),
        lastCrossed: "Connected",
        matchPercentage: 96,
        bio: p?.bio || "",
        tags: p?.tags || ["Coffee", "Travel"],
        image: partner.image || p?.avatarUrl || galleryUrls[0] || null,
        additionalImages: galleryUrls,
        photos: partner.photos || [],
        mapCoordinates: { x: 50, y: 50 },
        category: "likes",
        online: true,
        liked: true,
        datingGoal: pref?.datingGoal || "Long-Term Dating",
        personality: pref?.personality || "",
        partnerTraits: pref?.partnerTraits || "",
        musicPreference: pref?.musicPreference || "",
        dealBreakers: pref?.dealBreakers || "",
      };
    });

    return res.json({
      success: true,
      count: formattedMatches.length,
      matches: formattedMatches,
    });
  } catch (error) {
    console.error("[MATCH CONTROLLER] getMyMatches error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load matches.",
    });
  }
};

/**
 * Get profiles who liked the current user (where current user hasn't liked back or passed yet)
 */
export const getReceivedLikesController = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Likes where targetUserId is current user
    const receivedLikes = await prisma.like.findMany({
      where: {
        targetUserId: currentUserId,
        action: { in: ["like", "superlike"] },
      },
      include: {
        user: {
          include: {
            profile: true,
            preference: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Check which users current user has already swiped on
    const mySwipes = await prisma.like.findMany({
      where: { userId: currentUserId },
      select: { targetUserId: true },
    });
    const alreadySwipedIds = new Set(mySwipes.map((s) => s.targetUserId));
    const blockedIds = new Set(await getBlockedUserIds(currentUserId));

    const formattedLikes = [];

    for (const item of receivedLikes) {
      const admirer = item.user;
      if (alreadySwipedIds.has(admirer.id) || blockedIds.has(admirer.id)) {
        continue; // already liked back, passed, or blocked
      }

      const p = admirer.profile;
      const pref = admirer.preference;
      const galleryUrls = (admirer.photos || []).map((photo) => photo.url);

      formattedLikes.push({
        id: admirer.id,
        name: admirer.name,
        age: p?.age || 24,
        isVerified: true,
        jobTitle: p?.jobTitle || "Creative Professional",
        location: p?.location || "Nearby",
        distance: "Nearby",
        encountersCount: Math.max(1, (admirer.id.charCodeAt(0) || 1) % 4),
        lastCrossed: "Liked your profile",
        matchPercentage: 88,
        bio: p?.bio || "",
        tags: p?.tags || [],
        image: admirer.image || p?.avatarUrl || galleryUrls[0] || null,
        additionalImages: galleryUrls,
        photos: admirer.photos || [],
        mapCoordinates: { x: 50, y: 50 },
        category: "likes",
        online: true,
        liked: false,
        datingGoal: pref?.datingGoal || "",
        personality: pref?.personality || "",
      });
    }

    return res.json({
      success: true,
      count: formattedLikes.length,
      likes: formattedLikes,
    });
  } catch (error) {
    console.error("[MATCH CONTROLLER] getReceivedLikes error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load received likes.",
    });
  }
};

/**
 * Unmatch a user: dissolves the mutual match, permanently deletes chat history
 * and pending requests, and sets swipe records to 'pass' to prevent future matching.
 */
export const unmatchController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "targetUserId is required.",
      });
    }

    // 1. Dissolve Match record
    await prisma.match.deleteMany({
      where: {
        OR: [
          { user1Id: currentUserId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: currentUserId },
        ],
      },
    });

    // 2. Delete all direct Messages between both users
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
    });

    // 3. Delete any MessageRequests between both users
    await prisma.messageRequest.deleteMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
    });

    // 4. Update or insert Like records as 'pass' in both directions to prevent future matching
    await prisma.like.upsert({
      where: {
        userId_targetUserId: {
          userId: currentUserId,
          targetUserId,
        },
      },
      update: { action: "pass", createdAt: new Date() },
      create: { userId: currentUserId, targetUserId, action: "pass" },
    });

    await prisma.like.upsert({
      where: {
        userId_targetUserId: {
          userId: targetUserId,
          targetUserId: currentUserId,
        },
      },
      update: { action: "pass", createdAt: new Date() },
      create: { userId: targetUserId, targetUserId: currentUserId, action: "pass" },
    });

    // 5. Notify real-time socket clients
    emitToUser(targetUserId, "chat:unmatched", { partnerId: currentUserId });
    emitToUser(currentUserId, "chat:unmatched", { partnerId: targetUserId });

    return res.json({
      success: true,
      message: "Match dissolved, conversation deleted, and future matching prevented.",
    });
  } catch (error) {
    console.error("[MATCH CONTROLLER] unmatch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to dissolve match.",
    });
  }
};

/**
 * Get real crossed paths / encounters for the logged-in user
 */
export const getEncountersController = async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const blockedIds = await getBlockedUserIds(currentUserId);

    const encounters = await prisma.encounter.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      },
      include: {
        user1: {
          include: {
            profile: true,
            preference: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
        user2: {
          include: {
            profile: true,
            preference: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
      },
      orderBy: { lastCrossedAt: "desc" },
    });

    const validEncounters = encounters.filter((e) => {
      const partnerId = e.user1Id === currentUserId ? e.user2Id : e.user1Id;
      return !blockedIds.includes(partnerId);
    });

    const formatted = validEncounters.map((e) => {
      const partner = e.user1Id === currentUserId ? e.user2 : e.user1;
      const p = partner.profile || {};
      const galleryUrls = (partner.photos || []).map((photo) => photo.url);

      return {
        encounterId: e.id,
        id: partner.id,
        name: partner.name,
        age: p.age || 24,
        isVerified: true,
        jobTitle: p.jobTitle || "Member",
        location: e.locationName || p.location || "Nearby",
        distance: "Crossed paths",
        encountersCount: e.count,
        lastCrossedAt: e.lastCrossedAt,
        lastCrossed: formatNotificationTime(e.lastCrossedAt),
        bio: p.bio || "",
        tags: p.tags || [],
        image: partner.image || p.avatarUrl || galleryUrls[0] || null,
        additionalImages: galleryUrls,
        photos: partner.photos || [],
      };
    });

    return res.json({
      success: true,
      count: formatted.length,
      encounters: formatted,
    });
  } catch (error) {
    console.error("[MATCH CONTROLLER] getEncounters error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load encounters.",
    });
  }
};

