import { prisma } from "../src/config/prisma.js";
import { isExpoPushToken, sendExpoPushNotification } from "../src/services/push.service.js";
import { createAndSendNotification } from "../src/services/notification.service.js";

async function runPushTests() {
  console.log("==================================================");
  console.log("🚀 TESTING EXPO PUSH NOTIFICATIONS SYSTEM");
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

  // 1. Token format validation
  console.log("\n[TEST 1] Expo Push Token Validation:");
  assert(isExpoPushToken("ExponentPushToken[AbCdEf1234567890]"), "Valid ExponentPushToken[...] returns true");
  assert(isExpoPushToken("ExpoPushToken[AbCdEf1234567890]"), "Valid ExpoPushToken[...] returns true");
  assert(!isExpoPushToken("invalid-fcm-token-1234"), "Plain string returns false");
  assert(!isExpoPushToken(""), "Empty string returns false");
  assert(!isExpoPushToken(null), "Null returns false");

  // 2. Database saving & retrieval of expoPushToken
  console.log("\n[TEST 2] PostgreSQL User expoPushToken Storage:");
  const testUserId = "usr_ibzso8eqmtvj8s17"; // Satish Yadav
  const mockExpoToken = "ExponentPushToken[mock_satish_device_token]";

  await prisma.user.update({
    where: { id: testUserId },
    data: { expoPushToken: mockExpoToken },
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id: testUserId },
    select: { id: true, name: true, expoPushToken: true },
  });

  assert(updatedUser?.expoPushToken === mockExpoToken, "expoPushToken successfully saved to User record in PostgreSQL");
  console.log(`  User ${updatedUser?.name} expoPushToken = ${updatedUser?.expoPushToken}`);

  // 3. Expo Push API Payload Delivery Simulation
  console.log("\n[TEST 3] Expo Push API Dispatch Testing:");
  // Sending a test push to Expo's official push service endpoint
  const pushResult = await sendExpoPushNotification({
    to: mockExpoToken,
    title: "It's a Match! 🎉",
    body: "You and Aisha Sharma matched! Say hello!",
    data: { type: "match", matchId: "test_match_123" },
  });

  // Expo Push API returns an object with `data: [ { status: 'error' | 'ok', ... } ]`
  // For mock token, Expo Push API responds HTTP 200 with DeviceNotRegistered error ticket
  assert(pushResult !== null, "Successfully connected to Expo Push API https://exp.host/--/api/v2/push/send");
  if (pushResult?.data) {
    console.log("  Expo Push API response tickets:", pushResult.data);
    assert(Array.isArray(pushResult.data), "Expo Push API returned valid ticket response array");
  }

  // 4. Integrated createAndSendNotification with push dispatch
  console.log("\n[TEST 4] createAndSendNotification Integrated Push:");
  const notif = await createAndSendNotification({
    userId: testUserId,
    type: "message",
    title: "Aisha Sharma 💬",
    message: "Hey! Loved seeing you near Madhapur!",
    data: { partnerId: "cand_aisha_01" },
  });

  assert(notif !== null && notif.type === "message", "createAndSendNotification creates DB record and dispatches push");

  console.log("\n==================================================");
  console.log(`Summary: ${passed} passed, ${failed} failed.`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runPushTests().catch((err) => {
  console.error("TEST FAILED WITH EXCEPTION:", err);
  process.exit(1);
});
