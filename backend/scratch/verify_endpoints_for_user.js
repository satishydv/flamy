import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/config/prisma.js";
import { getFeedCandidatesController, getNearbyMatchesController } from "../src/controllers/match.controller.js";

async function verify() {
  const satish = await prisma.user.findFirst({
    where: { OR: [{ name: { contains: "satish", mode: "insensitive" } }, { phoneNumber: { contains: "6204812279" } }] },
    include: { profile: true },
  });

  const fakeReq = {
    user: { id: satish.id },
    query: {},
  };

  let feedResult = null;
  const fakeResFeed = {
    json: (data) => { feedResult = data; },
    status: () => fakeResFeed,
  };

  await getFeedCandidatesController(fakeReq, fakeResFeed);
  console.log("=== FEED RESULT ===");
  console.log("Success:", feedResult?.success);
  console.log("Candidates count:", feedResult?.count);
  for (const c of (feedResult?.feed || []).slice(0, 5)) {
    console.log(`- ${c.name}, ${c.age} | ${c.location} (${c.distance}) | ${c.matchPercentage}% match | ${c.photos?.length || 0} photos`);
  }

  let nearbyResult = null;
  const fakeResNearby = {
    json: (data) => { nearbyResult = data; },
    status: () => fakeResNearby,
  };
  await getNearbyMatchesController(fakeReq, fakeResNearby);
  console.log("\n=== NEARBY (MAP/DISCOVER) RESULT ===");
  console.log("Success:", nearbyResult?.success);
  console.log("Nearby count:", nearbyResult?.count);
  for (const c of (nearbyResult?.profiles || []).slice(0, 5)) {
    console.log(`- ${c.name}, ${c.age} | ${c.location} (${c.distance}) | ${c.matchPercentage}% match`);
  }
}

verify().catch(console.error).finally(() => prisma.$disconnect());
