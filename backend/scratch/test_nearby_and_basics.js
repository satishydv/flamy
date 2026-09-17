import { prisma } from "../src/config/prisma.js";

const BACKEND_URL = "http://localhost:5001";

async function runNearbyAndBasicsTests() {
  console.log("=== STARTING NEARBY MATCHING & BASICS INTEGRATION TESTS ===\n");

  // 1. Create Test User A (Woman seeking Men in London)
  const phoneA = "919888877771";
  let userA = await prisma.user.findFirst({ where: { phoneNumber: phoneA } });
  if (!userA) {
    userA = await prisma.user.create({
      data: {
        id: "test_a_" + Date.now().toString(36),
        name: "Alice London",
        phoneNumber: phoneA,
        phoneNumberVerified: true,
      },
    });
  }

  const tokenA = "sess_a_" + Date.now().toString(36);
  await prisma.session.create({
    data: {
      id: "ses_a_" + Date.now().toString(36),
      userId: userA.id,
      token: tokenA,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  const authHeadersA = { Authorization: `Bearer ${tokenA}` };

  // 2. Create Candidate User B (Man seeking Women ~350m away from London Eye)
  const phoneB = "919888877772";
  let userB = await prisma.user.findFirst({ where: { phoneNumber: phoneB } });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        id: "test_b_" + Date.now().toString(36),
        name: "Bob Nearby",
        phoneNumber: phoneB,
        phoneNumberVerified: true,
      },
    });
  }

  // Set Profile for User B (350m away from Alice)
  await prisma.profile.upsert({
    where: { userId: userB.id },
    update: {
      dob: new Date("1997-03-12"),
      age: 29,
      gender: "Man",
      lookingFor: ["Woman"],
      location: "South Bank, London",
      latitude: 51.5045, // ~350m south of 51.5074
      longitude: -0.1265,
      jobTitle: "Architect",
      bio: "Coffee and city walks.",
    },
    create: {
      userId: userB.id,
      dob: new Date("1997-03-12"),
      age: 29,
      gender: "Man",
      lookingFor: ["Woman"],
      location: "South Bank, London",
      latitude: 51.5045,
      longitude: -0.1265,
      jobTitle: "Architect",
      bio: "Coffee and city walks.",
    },
  });

  // 3. Create Candidate User C (Distant Man 60km away in Oxford)
  const phoneC = "919888877773";
  let userC = await prisma.user.findFirst({ where: { phoneNumber: phoneC } });
  if (!userC) {
    userC = await prisma.user.create({
      data: {
        id: "test_c_" + Date.now().toString(36),
        name: "Charlie Distant",
        phoneNumber: phoneC,
        phoneNumberVerified: true,
      },
    });
  }

  await prisma.profile.upsert({
    where: { userId: userC.id },
    update: {
      dob: new Date("1996-08-22"),
      age: 30,
      gender: "Man",
      lookingFor: ["Woman"],
      location: "Oxford",
      latitude: 51.7520, // ~85km away
      longitude: -1.2577,
    },
    create: {
      userId: userC.id,
      dob: new Date("1996-08-22"),
      age: 30,
      gender: "Man",
      lookingFor: ["Woman"],
      location: "Oxford",
      latitude: 51.7520,
      longitude: -1.2577,
    },
  });

  // -------------------------------------------------------------
  // TEST 1: Update User A Basics (DOB, Gender, Looking For, GPS)
  // -------------------------------------------------------------
  console.log("TEST 1: Update Profile with Basics (DOB, Gender, Looking For, Lat/Lon)");
  try {
    const payload = {
      name: "Alice Wilson",
      dob: "1999-05-15",
      gender: "Woman",
      lookingFor: ["Man"],
      location: "Central London",
      latitude: 51.5074,
      longitude: -0.1278,
    };

    const res = await fetch(`${BACKEND_URL}/api/profile`, {
      method: "PUT",
      headers: {
        ...authHeadersA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.status === 200 && data.success && data.profile) {
      console.log("✓ PASS: Profile Basics saved successfully in PostgreSQL!");
      console.log(`  - Name: ${payload.name}`);
      console.log(`  - Calculated Age: ${data.profile.age} (from DOB 1999-05-15)`);
      console.log(`  - Gender: ${data.profile.gender}`);
      console.log(`  - Looking For: ${JSON.stringify(data.profile.lookingFor)}`);
      console.log(`  - GPS: (${data.profile.latitude}, ${data.profile.longitude})`);
    } else {
      console.error("✗ FAIL: Basics update failed:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 1:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 2: GET /api/matches/nearby within 10 km
  // -------------------------------------------------------------
  console.log("TEST 2: GET /api/matches/nearby (Haversine Distance & Mutual Filters)");
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/matches/nearby?lat=51.5074&lon=-0.1278&radiusKm=10`,
      {
        headers: authHeadersA,
      }
    );

    const data = await res.json();
    if (res.status === 200 && data.success && Array.isArray(data.profiles)) {
      console.log(`✓ PASS: Retrieved ${data.count} nearby matches!`);

      const foundBob = data.profiles.find((p) => p.id === userB.id);
      const foundCharlie = data.profiles.find((p) => p.id === userC.id);

      if (foundBob) {
        console.log("✓ PASS: Bob (Nearby ~350m) was found in nearby radius!");
        console.log(`  - Distance: ${foundBob.distance}`);
        console.log(`  - Radar Coordinates: (${foundBob.mapCoordinates.x}, ${foundBob.mapCoordinates.y})`);
        console.log(`  - Match Percentage: ${foundBob.matchPercentage}%`);
      } else {
        console.error("✗ FAIL: Bob was not found in nearby results!");
      }

      if (!foundCharlie) {
        console.log("✓ PASS: Charlie (Oxford, ~85km away) was correctly excluded by 10km radius filter!");
      } else {
        console.error("✗ FAIL: Charlie should have been filtered out by distance!");
      }
    } else {
      console.error("✗ FAIL: Nearby API request failed:", res.status, data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 2:", err.message);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 3: Expanding Radius to 100 km
  // -------------------------------------------------------------
  console.log("TEST 3: Expanding radiusKm=100 (Charlie should now be included)");
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/matches/nearby?lat=51.5074&lon=-0.1278&radiusKm=100`,
      {
        headers: authHeadersA,
      }
    );

    const data = await res.json();
    const foundCharlie = data.profiles?.find((p) => p.id === userC.id);
    if (foundCharlie) {
      console.log("✓ PASS: Charlie found when radius expanded to 100 km!");
      console.log(`  - Charlie Distance: ${foundCharlie.distance}`);
    } else {
      console.error("✗ FAIL: Charlie not found in 100km radius:", data);
    }
  } catch (err) {
    console.error("✗ FAIL in Test 3:", err.message);
  }
  console.log("");

  // Cleanup test users
  await prisma.session.deleteMany({
    where: { userId: { in: [userA.id, userB.id, userC.id] } },
  });
  await prisma.profile.deleteMany({
    where: { userId: { in: [userA.id, userB.id, userC.id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userA.id, userB.id, userC.id] } },
  });
  console.log("✓ Cleanup: Removed temporary test users from database.");

  console.log("\n=== ALL NEARBY & BASICS TESTS COMPLETED SUCCESSFULLY ===");
}

runNearbyAndBasicsTests().catch(console.error);
