import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/config/prisma.js";

async function cleanupIncomplete() {
  const users = await prisma.user.findMany({
    include: { profile: true },
  });

  for (const u of users) {
    if (!u.profile || !u.profile.gender || !u.profile.location || u.name.includes("CK GROUP") || u.name.includes("VARA")) {
      console.log(`Deleting incomplete test user: ${u.name} (${u.id})`);
      await prisma.like.deleteMany({ where: { OR: [{ userId: u.id }, { targetUserId: u.id }] } });
      await prisma.match.deleteMany({ where: { OR: [{ user1Id: u.id }, { user2Id: u.id }] } });
      await prisma.profilePhoto.deleteMany({ where: { userId: u.id } });
      await prisma.profile.deleteMany({ where: { userId: u.id } });
      await prisma.userPreference.deleteMany({ where: { userId: u.id } });
      await prisma.session.deleteMany({ where: { userId: u.id } });
      await prisma.account.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }

  const remaining = await prisma.user.findMany({ include: { profile: true } });
  console.log(`Remaining clean users in DB: ${remaining.length}`);
  for (const r of remaining) {
    console.log(`- ${r.name} (${r.profile?.gender}, ${r.profile?.location})`);
  }
}

cleanupIncomplete().catch(console.error).finally(() => prisma.$disconnect());
