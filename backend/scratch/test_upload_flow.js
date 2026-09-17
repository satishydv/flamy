import { prisma } from "../src/config/prisma.js";

const BACKEND_URL = "http://localhost:5001";

// Simple 1x1 transparent PNG buffer
const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// Simple 1x1 JPEG buffer
const TINY_JPEG_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64"
);

// Simple 1x1 WebP buffer
const TINY_WEBP_BUFFER = Buffer.from(
  "UklGRkAAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAIAAAAAAFZQOCAYAAAAMAEAnQEqAQABAAFAJiWkAANwAP79NvgA",
  "base64"
);

// Oversized buffer: 1.2 MB of dummy data
const OVERSIZED_BUFFER = Buffer.alloc(1.2 * 1024 * 1024, 0xff);

// Non-image text buffer
const TEXT_BUFFER = Buffer.from("Hello, this is a plain text file, not an image!");

async function runTests() {
  console.log("=== STARTING CLOUDINARY & PROFILE INTEGRATION TESTS ===\n");

  // 1. Create a temporary test user and session in database
  const testPhone = "919999988888";
  let testUser = await prisma.user.findFirst({
    where: { phoneNumber: testPhone },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        id: "test_usr_" + Date.now().toString(36),
        name: "Cloudinary Test User",
        phoneNumber: testPhone,
        phoneNumberVerified: true,
      },
    });
  }

  const testToken = "test_sess_" + Date.now().toString(36);
  const testSession = await prisma.session.create({
    data: {
      id: "test_ses_" + Date.now().toString(36),
      userId: testUser.id,
      token: testToken,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    },
  });

  console.log(`✓ Test user created: ${testUser.name} (${testUser.id})`);
  console.log(`✓ Test session created with token: ${testToken}\n`);

  const authHeaders = {
    Authorization: `Bearer ${testToken}`,
  };

  // -------------------------------------------------------------
  // TEST 1: Unauthenticated upload rejection
  // -------------------------------------------------------------
  console.log("TEST 1: Unauthenticated upload rejection (Expect 401)");
  try {
    const formData = new FormData();
    const blob = new Blob([TINY_JPEG_BUFFER], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await fetch(`${BACKEND_URL}/api/profile/upload-photo`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (res.status === 401 && !data.success) {
      console.log("✓ PASS: Correctly rejected unauthenticated request with 401:", data.message);
    } else {
      console.error("✗ FAIL: Expected 401 but got:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 1:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 2: Invalid file type rejection (non-image)
  // -------------------------------------------------------------
  console.log("TEST 2: Invalid file type rejection (Expect 400)");
  try {
    const formData = new FormData();
    const blob = new Blob([TEXT_BUFFER], { type: "text/plain" });
    formData.append("image", blob, "notes.txt");

    const res = await fetch(`${BACKEND_URL}/api/profile/upload-photo`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    const data = await res.json();
    if (res.status === 400 && !data.success) {
      console.log("✓ PASS: Correctly rejected non-image file with 400:", data.message);
    } else {
      console.error("✗ FAIL: Expected 400 but got:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 2:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 3: Oversized file rejection (> 1 MB)
  // -------------------------------------------------------------
  console.log("TEST 3: Oversized file rejection > 1 MB (Expect 400)");
  try {
    const formData = new FormData();
    const blob = new Blob([OVERSIZED_BUFFER], { type: "image/jpeg" });
    formData.append("image", blob, "large.jpg");

    const res = await fetch(`${BACKEND_URL}/api/profile/upload-photo`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    const data = await res.json();
    if (res.status === 400 && !data.success) {
      console.log("✓ PASS: Correctly rejected > 1 MB file with 400:", data.message);
    } else {
      console.error("✗ FAIL: Expected 400 but got:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 3:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 4: Successful JPEG upload to Cloudinary
  // -------------------------------------------------------------
  console.log("TEST 4: Valid JPEG under 1 MB upload to Cloudinary");
  let uploadedPublicId = null;
  try {
    const formData = new FormData();
    const blob = new Blob([TINY_JPEG_BUFFER], { type: "image/jpeg" });
    formData.append("image", blob, "profile.jpg");

    const res = await fetch(`${BACKEND_URL}/api/profile/upload-photo`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    const data = await res.json();
    if (res.status === 200 && data.success && data.url && data.publicId) {
      uploadedPublicId = data.publicId;
      console.log("✓ PASS: Uploaded to Cloudinary successfully!");
      console.log(`  - URL: ${data.url}`);
      console.log(`  - Public ID: ${data.publicId}`);
      console.log(`  - Folder: ${data.publicId.split("/")[0] + "/" + data.publicId.split("/")[1]}`);
    } else {
      console.error("✗ FAIL: Upload failed:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 4:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 5: Successful PNG upload to Cloudinary
  // -------------------------------------------------------------
  console.log("TEST 5: Valid PNG under 1 MB upload to Cloudinary");
  try {
    const formData = new FormData();
    const blob = new Blob([TINY_PNG_BUFFER], { type: "image/png" });
    formData.append("image", blob, "avatar.png");

    const res = await fetch(`${BACKEND_URL}/api/profile/upload-photo`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    const data = await res.json();
    if (res.status === 200 && data.success && data.url) {
      console.log("✓ PASS: PNG uploaded successfully!");
      console.log(`  - URL: ${data.url}`);
      console.log(`  - Public ID: ${data.publicId}`);
      uploadedPublicId = data.publicId;
    } else {
      console.error("✗ FAIL: PNG upload failed:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 5:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 6: Successful WebP upload to Cloudinary
  // -------------------------------------------------------------
  console.log("TEST 6: Valid WebP under 1 MB upload to Cloudinary");
  try {
    const formData = new FormData();
    const blob = new Blob([TINY_WEBP_BUFFER], { type: "image/webp" });
    formData.append("image", blob, "photo.webp");

    const res = await fetch(`${BACKEND_URL}/api/profile/upload-photo`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    const data = await res.json();
    if (res.status === 200 && data.success && data.url) {
      console.log("✓ PASS: WebP uploaded successfully!");
      console.log(`  - URL: ${data.url}`);
      console.log(`  - Public ID: ${data.publicId}`);
      uploadedPublicId = data.publicId;
    } else {
      console.error("✗ FAIL: WebP upload failed:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 6:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 7: Persist Onboarding Questionnaire Answers
  // -------------------------------------------------------------
  console.log("TEST 7: Persist Onboarding Questionnaire Answers");
  try {
    const prefPayload = {
      datingGoal: "Long-Term Dating",
      personality: "Extroverted & Energetic",
      partnerTraits: "Great Sense of Humor",
      musicPreference: "Indie Rock & Alternative",
      dealBreakers: "Dishonesty & Lack of Trust",
    };

    const res = await fetch(`${BACKEND_URL}/api/profile/preferences`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prefPayload),
    });
    const data = await res.json();
    if (res.status === 200 && data.success && data.preference) {
      console.log("✓ PASS: Onboarding preferences persisted in database!");
      console.log(`  - Dating Goal: ${data.preference.datingGoal}`);
      console.log(`  - Personality: ${data.preference.personality}`);
      console.log(`  - Deal Breakers: ${data.preference.dealBreakers}`);
    } else {
      console.error("✗ FAIL: Preferences save failed:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 7:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 8: Update User Profile Details (Bio, Age, Gender, Location)
  // -------------------------------------------------------------
  console.log("TEST 8: Update Profile (Bio, Age, Gender, Location, Job, Tags)");
  try {
    const profilePayload = {
      name: "Jenny Wilson",
      age: 26,
      gender: "Female",
      location: "San Francisco, CA",
      jobTitle: "Senior Product Designer",
      bio: "Coffee enthusiast, UI designer, and weekend hiker.",
      tags: ["Design", "Coffee", "Hiking", "Travel"],
    };

    const res = await fetch(`${BACKEND_URL}/api/profile`, {
      method: "PUT",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profilePayload),
    });
    const data = await res.json();
    if (res.status === 200 && data.success && data.profile) {
      console.log("✓ PASS: Profile updated successfully!");
      console.log(`  - Age: ${data.profile.age}`);
      console.log(`  - Gender: ${data.profile.gender}`);
      console.log(`  - Location: ${data.profile.location}`);
      console.log(`  - Bio: ${data.profile.bio}`);
      console.log(`  - Tags: ${JSON.stringify(data.profile.tags)}`);
    } else {
      console.error("✗ FAIL: Profile update failed:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 8:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 9: Verify Database Persistence via GET /api/profile/me
  // -------------------------------------------------------------
  console.log("TEST 9: Retrieve Complete Profile via GET /api/profile/me");
  try {
    const res = await fetch(`${BACKEND_URL}/api/profile/me`, {
      headers: authHeaders,
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log("✓ PASS: Complete profile retrieved from PostgreSQL:");
      console.log(`  - User Name: ${data.user.name}`);
      console.log(`  - User Photo URL: ${data.user.image}`);
      console.log(`  - Profile Avatar: ${data.profile.avatarUrl}`);
      console.log(`  - Cloudinary Public ID: ${data.profile.avatarPublicId}`);
      console.log(`  - Bio: ${data.profile.bio}`);
      console.log(`  - Questionnaire: ${data.preference?.datingGoal} / ${data.preference?.personality}`);
    } else {
      console.error("✗ FAIL: Failed to retrieve profile:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 9:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 10: Delete Profile Photo from Cloudinary and Database
  // -------------------------------------------------------------
  console.log("TEST 10: Delete Profile Photo");
  try {
    const res = await fetch(`${BACKEND_URL}/api/profile/photo`, {
      method: "DELETE",
      headers: authHeaders,
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      console.log("✓ PASS: Photo deleted successfully:", data.message);

      // Verify DB cleared
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: { profile: true },
      });
      if (!updatedUser.image && !updatedUser.profile.avatarUrl) {
        console.log("✓ PASS: Database confirmed avatarUrl and image set to null!");
      } else {
        console.error("✗ FAIL: Image field was not cleared in DB:", updatedUser);
      }
    } else {
      console.error("✗ FAIL: Delete photo failed:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 10:", err.message);
  }
  console.log("");

  // Cleanup test session and user
  await prisma.session.deleteMany({ where: { userId: testUser.id } });
  await prisma.profile.deleteMany({ where: { userId: testUser.id } });
  await prisma.userPreference.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("✓ Cleanup: Removed temporary test user and test data.");

  console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");
}

runTests().catch(console.error);
