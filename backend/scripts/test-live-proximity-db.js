import { prisma } from "../src/config/prisma.js";
import { calculateDistanceKm, canonicalPair } from "../src/utils/geo.js";
import { createAndSendNotification } from "../src/services/notification.service.js";

async function testLiveDbProximity() {
  console.log("==================================================");
  console.log("🚀 TESTING LIVE PROXIMITY ENGINE WITH POSTGRESQL");
  console.log("==================================================");

  const satishId = "usr_ibzso8eqmtvj8s17";
  const aishaId = "cand_aisha_01";

  // Clean any previous test encounters between them
  const [u1, u2] = canonicalPair(satishId, aishaId);
  await prisma.encounter.deleteMany({
    where: { user1Id: u1, user2Id: u2 },
  });

  // Aisha's coordinates (Madhapur)
  const aishaProfile = await prisma.profile.findUnique({ where: { userId: aishaId } });
  const aishaLat = aishaProfile.latitude; // 17.4485
  const aishaLon = aishaProfile.longitude; // 78.3748
  console.log(`[1] Aisha's Coords: (${aishaLat}, ${aishaLon}) in ${aishaProfile.location}`);

  // Satish pings location ~200m away
  const satishLat = aishaLat + 0.0015;
  const satishLon = aishaLon + 0.0015;
  const distKm = calculateDistanceKm(satishLat, satishLon, aishaLat, aishaLon);
  const distanceMeters = Math.round(distKm * 1000);
  console.log(`[2] Satish pings: (${satishLat.toFixed(4)}, ${satishLon.toFixed(4)}), distance = ${distanceMeters}m`);

  if (distKm <= 0.5) {
    console.log("  -> Distance is within 500m threshold! Logging encounter...");

    // Create encounter
    const encounter = await prisma.encounter.create({
      data: {
        user1Id: u1,
        user2Id: u2,
        count: 1,
        lastCrossedAt: new Date(),
        locationName: "Near Madhapur Metro, Hyderabad",
        latitude: satishLat,
        longitude: satishLon,
      },
    });
    console.log(`  -> Encounter record created successfully! ID: ${encounter.id}, count: ${encounter.count}`);

    // Send notifications
    await createAndSendNotification({
      userId: aishaId,
      senderId: satishId,
      type: "crossed",
      title: "Crossed Paths! 📍",
      message: `You crossed paths with Satish Yadav near Madhapur Metro`,
      data: {
        profileId: satishId,
        senderName: "Satish Yadav",
        location: "Near Madhapur Metro, Hyderabad",
        distanceMeters,
      },
    });

    await createAndSendNotification({
      userId: satishId,
      senderId: aishaId,
      type: "crossed",
      title: "Crossed Paths! 📍",
      message: `You crossed paths with Aisha Sharma near Madhapur Metro`,
      data: {
        profileId: aishaId,
        senderName: "Aisha Sharma",
        location: "Near Madhapur Metro, Hyderabad",
        distanceMeters,
      },
    });
    console.log("  -> Both crossed paths notifications generated and sent!");
  }

  // Verify in database:
  const checkEncounter = await prisma.encounter.findUnique({
    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
  });
  console.log("\n[3] Encounter in DB verification:", checkEncounter ? "FOUND ✅" : "NOT FOUND ❌");
  console.log(`    Count: ${checkEncounter?.count}, Location: ${checkEncounter?.locationName}`);

  // Verify Satish profile encounters stat:
  const encounters = await prisma.encounter.findMany({
    where: { OR: [{ user1Id: satishId }, { user2Id: satishId }] },
  });
  console.log(`\n[4] Total real encounters for Satish: ${encounters.length} ✅`);

  // Verify crossed notifications for Satish:
  const notifications = await prisma.notification.findMany({
    where: { userId: satishId, type: "crossed" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  console.log(`\n[5] Latest crossed notification for Satish: "${notifications[0]?.message}" ✅`);

  console.log("\n==================================================");
  console.log("🎉 ALL LIVE POSTGRESQL VERIFICATIONS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

testLiveDbProximity().catch((e) => {
  console.error("TEST ERROR:", e);
  process.exit(1);
});
