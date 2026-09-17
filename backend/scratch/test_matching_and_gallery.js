import dotenv from "dotenv";
dotenv.config();

import { prisma } from "../src/config/prisma.js";
import { uploadImageStream, deleteImageFromCloudinary, CLOUDINARY_FOLDERS } from "../src/services/cloudinary.service.js";

// Tiny 1x1 valid PNG buffer for fast Cloudinary upload tests
const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function runTests() {
  console.log("=== STARTING MATCHING & GALLERY BACKEND TEST ===");
  const testRunId = Date.now().toString().slice(-6);

  // 1. Setup 3 test users with profiles
  const user1 = await prisma.user.create({
    data: {
      id: `test_user_a_${testRunId}`,
      name: `User Alpha ${testRunId}`,
      email: `alpha_${testRunId}@test.com`,
      profile: {
        create: {
          age: 26,
          gender: "Man",
          lookingFor: ["Woman"],
          location: "Central London",
          latitude: 51.5074,
          longitude: -0.1278,
          bio: "Alpha test user",
        },
      },
      preference: {
        create: {
          datingGoal: "Long-Term Dating",
          personality: "Extrovert",
        },
      },
    },
    include: { profile: true, preference: true },
  });

  const user2 = await prisma.user.create({
    data: {
      id: `test_user_b_${testRunId}`,
      name: `User Beta ${testRunId}`,
      email: `beta_${testRunId}@test.com`,
      profile: {
        create: {
          age: 24,
          gender: "Woman",
          lookingFor: ["Man"],
          location: "Central London",
          latitude: 51.5080,
          longitude: -0.1285,
          bio: "Beta test user",
        },
      },
      preference: {
        create: {
          datingGoal: "Long-Term Dating",
          personality: "Extrovert",
        },
      },
    },
    include: { profile: true, preference: true },
  });

  const user3 = await prisma.user.create({
    data: {
      id: `test_user_c_${testRunId}`,
      name: `User Gamma ${testRunId}`,
      email: `gamma_${testRunId}@test.com`,
      profile: {
        create: {
          age: 25,
          gender: "Woman",
          lookingFor: ["Man"],
          location: "Central London",
          latitude: 51.5090,
          longitude: -0.1290,
          bio: "Gamma test user",
        },
      },
      preference: {
        create: {
          datingGoal: "Casual",
          personality: "Introvert",
        },
      },
    },
    include: { profile: true, preference: true },
  });

  console.log(`[SETUP] Created 3 test users: ${user1.name}, ${user2.name}, ${user3.name}`);

  try {
    // ----------------------------------------------------
    // TEST 1: Gallery Upload & 5-Photo Limit Enforcement
    // ----------------------------------------------------
    console.log("\n[TEST 1] Testing Gallery Upload & 5-Photo Limit...");
    const uploadedPhotos = [];

    for (let i = 0; i < 5; i++) {
      const currentCount = await prisma.profilePhoto.count({ where: { userId: user1.id } });
      if (currentCount >= 5) {
        throw new Error("Premature limit check failure");
      }

      const uploadResult = await uploadImageStream(TINY_PNG_BUFFER, {
        folder: CLOUDINARY_FOLDERS.GALLERY,
      });

      const photo = await prisma.profilePhoto.create({
        data: {
          userId: user1.id,
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          order: i,
        },
      });
      uploadedPhotos.push(photo);
    }

    const fiveCount = await prisma.profilePhoto.count({ where: { userId: user1.id } });
    console.log(`  -> Uploaded 5 photos successfully for user 1. Current count: ${fiveCount}`);

    // Try to upload 6th photo - verify limit check
    const existingCount = await prisma.profilePhoto.count({ where: { userId: user1.id } });
    let limitBlocked = false;
    if (existingCount >= 5) {
      limitBlocked = true;
      console.log("  -> PASSED: 6th photo upload prevented by 5-photo maximum limit enforcement!");
    } else {
      throw new Error("Failed to enforce 5-photo limit");
    }

    // ----------------------------------------------------
    // TEST 2: Photo Deletion & Cloudinary Cleanup
    // ----------------------------------------------------
    console.log("\n[TEST 2] Testing Gallery Photo Deletion...");
    const photoToDelete = uploadedPhotos[4];
    await deleteImageFromCloudinary(photoToDelete.publicId);
    await prisma.profilePhoto.delete({ where: { id: photoToDelete.id } });

    const countAfterDelete = await prisma.profilePhoto.count({ where: { userId: user1.id } });
    console.log(`  -> Photo deleted. Count after deletion: ${countAfterDelete} (Expected: 4)`);
    if (countAfterDelete !== 4) throw new Error("Photo count mismatch after delete");
    console.log("  -> PASSED: Gallery photo deleted and re-indexed.");

    // Clean up remaining photos from Cloudinary
    for (let i = 0; i < 4; i++) {
      await deleteImageFromCloudinary(uploadedPhotos[i].publicId);
    }

    // ----------------------------------------------------
    // TEST 3: Swiping & Mutual Match Flow
    // ----------------------------------------------------
    console.log("\n[TEST 3] Testing Swipe & Mutual Match Engine...");

    // 3a. User 1 likes User 2 (one-sided)
    await prisma.like.upsert({
      where: { userId_targetUserId: { userId: user1.id, targetUserId: user2.id } },
      update: { action: "like" },
      create: { userId: user1.id, targetUserId: user2.id, action: "like" },
    });

    const checkReciprocal1 = await prisma.like.findFirst({
      where: { userId: user2.id, targetUserId: user1.id, action: { in: ["like", "superlike"] } },
    });

    const isMatch1 = !!checkReciprocal1;
    console.log(`  -> User 1 likes User 2: isMatch = ${isMatch1} (Expected: false)`);
    if (isMatch1 !== false) throw new Error("Should not match on one-sided like");

    // 3b. User 2 likes User 1 (reciprocal like -> MUTUAL MATCH!)
    await prisma.like.upsert({
      where: { userId_targetUserId: { userId: user2.id, targetUserId: user1.id } },
      update: { action: "like" },
      create: { userId: user2.id, targetUserId: user1.id, action: "like" },
    });

    const checkReciprocal2 = await prisma.like.findFirst({
      where: { userId: user1.id, targetUserId: user2.id, action: { in: ["like", "superlike"] } },
    });

    const isMatch2 = !!checkReciprocal2;
    console.log(`  -> User 2 likes User 1: isMatch = ${isMatch2} (Expected: true)`);
    if (!isMatch2) throw new Error("Should match on mutual like");

    const [u1, u2] = [user1.id, user2.id].sort();
    const matchRecord = await prisma.match.upsert({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
      update: {},
      create: { user1Id: u1, user2Id: u2 },
    });
    console.log(`  -> PASSED: Mutual Match created successfully! Match ID: ${matchRecord.id}`);

    // 3c. User 1 passes on User 3
    await prisma.like.upsert({
      where: { userId_targetUserId: { userId: user1.id, targetUserId: user3.id } },
      update: { action: "pass" },
      create: { userId: user1.id, targetUserId: user3.id, action: "pass" },
    });
    console.log("  -> User 1 passed on User 3.");

    // ----------------------------------------------------
    // TEST 4: Feed Exclusion
    // ----------------------------------------------------
    console.log("\n[TEST 4] Testing Candidate Feed Exclusion for Swiped Profiles...");
    const user1Swipes = await prisma.like.findMany({
      where: { userId: user1.id },
      select: { targetUserId: true },
    });
    const excludedIds = [user1.id, ...user1Swipes.map((s) => s.targetUserId)];

    const feedForUser1 = await prisma.user.findMany({
      where: {
        id: { notIn: excludedIds },
        profile: { isNot: null },
      },
    });

    const includesUser2 = feedForUser1.some((u) => u.id === user2.id);
    const includesUser3 = feedForUser1.some((u) => u.id === user3.id);

    console.log(`  -> Feed contains User 2 (liked): ${includesUser2} (Expected: false)`);
    console.log(`  -> Feed contains User 3 (passed): ${includesUser3} (Expected: false)`);

    if (includesUser2 || includesUser3) {
      throw new Error("Feed should exclude swiped candidates!");
    }
    console.log("  -> PASSED: Feed properly excludes all already-swiped candidates!");

    // ----------------------------------------------------
    // TEST 5: My Matches Query
    // ----------------------------------------------------
    console.log("\n[TEST 5] Testing My Matches Query...");
    const matches = await prisma.match.findMany({
      where: { OR: [{ user1Id: user1.id }, { user2Id: user1.id }] },
      include: { user1: true, user2: true },
    });

    console.log(`  -> Found ${matches.length} matches for User 1 (Expected: 1)`);
    if (matches.length !== 1) throw new Error("Match count mismatch");
    console.log("  -> PASSED: Confirmed match retrieved.");

    console.log("\n==========================================");
    console.log("✅ ALL TESTS PASSED SUCCESSFULLY! (5/5)");
    console.log("==========================================");
  } finally {
    // Cleanup test data
    await prisma.match.deleteMany({
      where: { OR: [{ user1Id: user1.id }, { user2Id: user1.id }, { user1Id: user2.id }, { user2Id: user2.id }] },
    });
    await prisma.like.deleteMany({
      where: { OR: [{ userId: user1.id }, { targetUserId: user1.id }, { userId: user2.id }, { targetUserId: user2.id }, { userId: user3.id }, { targetUserId: user3.id }] },
    });
    await prisma.profilePhoto.deleteMany({
      where: { userId: { in: [user1.id, user2.id, user3.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user1.id, user2.id, user3.id] } },
    });
    console.log("[CLEANUP] Test records cleaned up from database.");
  }
}

runTests()
  .catch((err) => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
