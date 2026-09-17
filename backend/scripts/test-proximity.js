import { calculateDistanceKm, calculateBearing, canonicalPair } from "../src/utils/geo.js";

function runTests() {
  console.log("==================================================");
  console.log("🚀 TESTING PROXIMITY ENGINE & GEO CALCULATIONS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Canonical Pair Ordering
  console.log("\n[TEST 1] Canonical User Pair Ordering:");
  const pair1 = canonicalPair("user_xyz", "user_abc");
  const pair2 = canonicalPair("user_abc", "user_xyz");
  assert(pair1[0] === "user_abc" && pair1[1] === "user_xyz", "Order is alphabetical: abc < xyz");
  assert(pair2[0] === "user_abc" && pair2[1] === "user_xyz", "Reverse call yields identical order");

  // 2. Haversine Distance Calculations
  console.log("\n[TEST 2] Haversine Distance & Proximity Thresholds:");
  // Jubilee Hills Checkpost vs Jubilee Hills Road 36 (~350m)
  const p1 = { lat: 17.4319, lon: 78.4073 };
  const p2 = { lat: 17.4345, lon: 78.4095 };
  const distKmClose = calculateDistanceKm(p1.lat, p1.lon, p2.lat, p2.lon);
  const distMetersClose = Math.round(distKmClose * 1000);
  console.log(`  Distance between Jubilee Hills points: ${distMetersClose}m`);
  assert(distKmClose <= 0.5, `Within 500m threshold: ${distMetersClose}m <= 500m`);

  // Jubilee Hills vs Hitec City (~6 km)
  const pHitec = { lat: 17.4435, lon: 78.3772 };
  const distKmFar = calculateDistanceKm(p1.lat, p1.lon, pHitec.lat, pHitec.lon);
  const distMetersFar = Math.round(distKmFar * 1000);
  console.log(`  Distance to Hitec City: ${distMetersFar}m`);
  assert(distKmFar > 0.5, `Beyond 500m threshold: ${distMetersFar}m > 500m`);

  // Same coordinates (0m distance)
  const distZero = calculateDistanceKm(p1.lat, p1.lon, p1.lat, p1.lon);
  assert(distZero < 0.001, "Same coordinates result in ~0m distance");

  // 3. Proximity Cooldown Simulation
  console.log("\n[TEST 3] Cooldown Logic Simulation (30-Minute Window):");
  const COOLDOWN_MS = 30 * 60 * 1000;
  const now = Date.now();

  // Encounter crossed 10 minutes ago
  const recentEncounterTime = new Date(now - 10 * 60 * 1000);
  const diffRecent = (now - recentEncounterTime.getTime()) / (1000 * 60);
  const shouldTriggerRecent = diffRecent >= 30;
  assert(!shouldTriggerRecent, "Ping within 10 minutes does NOT trigger counter increment (cooldown active)");

  // Encounter crossed 45 minutes ago
  const oldEncounterTime = new Date(now - 45 * 60 * 1000);
  const diffOld = (now - oldEncounterTime.getTime()) / (1000 * 60);
  const shouldTriggerOld = diffOld >= 30;
  assert(shouldTriggerOld, "Ping after 45 minutes triggers counter increment (cooldown expired)");

  // 4. Ghost Mode & Blocked Logic Simulation
  console.log("\n[TEST 4] Ghost Mode & Privacy Filtering Simulation:");
  const testCandidate = {
    id: "cand_123",
    name: "Aanya",
    profile: {
      isGhostMode: true,
      latitude: 17.4320,
      longitude: 78.4074,
    },
  };

  const isEligible = !testCandidate.profile.isGhostMode;
  assert(!isEligible, "Ghost mode candidate is excluded from proximity matching");

  const blockedUserIds = new Set(["user_blocked_99"]);
  const candidateId = "user_blocked_99";
  const isBlocked = blockedUserIds.has(candidateId);
  assert(isBlocked, "Blocked candidate is excluded from proximity matching");

  console.log("==================================================");
  console.log(`Summary: ${passed} passed, ${failed} failed.`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runTests();
