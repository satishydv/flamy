import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/config/prisma.js";

async function check() {
  const users = await prisma.user.findMany({
    include: { profile: true, preference: true, photos: true },
  });
  console.log("TOTAL USERS IN DATABASE:", users.length);
  for (const u of users) {
    console.log(`- User [${u.id}]: ${u.name} (${u.email || u.phoneNumber})`);
    console.log("  Profile:", u.profile ? `Gender=${u.profile.gender}, LookingFor=${JSON.stringify(u.profile.lookingFor)}, Lat=${u.profile.latitude}, Lon=${u.profile.longitude}` : "NO PROFILE");
    console.log("  Photos count:", u.photos.length);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
