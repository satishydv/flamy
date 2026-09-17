import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/config/prisma.js";

async function testFeed() {
  const userId = "usr_ibzso8eqmtvj8s17"; // satish yadav
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, preference: true },
  });
  console.log("Current User:", currentUser.name, "ID:", currentUser.id);
  console.log("Profile:", currentUser.profile);

  const existingSwipes = await prisma.like.findMany({
    where: { userId },
    select: { targetUserId: true },
  });
  const excludedIds = [userId, ...existingSwipes.map((s) => s.targetUserId)];

  const candidates = await prisma.user.findMany({
    where: {
      id: { notIn: excludedIds },
      profile: { isNot: null },
    },
    include: {
      profile: true,
      preference: true,
      photos: { orderBy: { order: "asc" } },
    },
  });

  console.log("Available candidates in DB:", candidates.length);
  for (const c of candidates) {
    console.log(`- Candidate ${c.name} (${c.id})`);
    console.log(`  Gender: ${c.profile?.gender}, LookingFor: ${JSON.stringify(c.profile?.lookingFor)}`);
  }
}

testFeed().catch(console.error).finally(() => prisma.$disconnect());
