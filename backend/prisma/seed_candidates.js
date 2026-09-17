import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/config/prisma.js";

const CANDIDATES = [
  {
    id: "cand_aisha_01",
    name: "Aisha Sharma",
    email: "aisha.sharma@example.com",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
    photos: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
    ],
    age: 26,
    gender: "Woman",
    lookingFor: ["Man"],
    location: "Madhapur, Hyderabad",
    latitude: 17.4485,
    longitude: 78.3748,
    jobTitle: "Marketing Director",
    bio: "Coffee lover, art gallery wanderer, and sunset chaser. Looking for genuine conversations and fun weekend getaways.",
    tags: ["Coffee", "Art", "Travel", "Indie Music"],
    preference: {
      datingGoal: "Long-Term Dating",
      personality: "Extroverted & Energetic",
      partnerTraits: "Great Sense of Humor",
      musicPreference: "Indie Rock & Alternative",
      dealBreakers: "Dishonesty & Lack of Trust",
    },
  },
  {
    id: "cand_sophia_02",
    name: "Sophia Chen",
    email: "sophia.chen@example.com",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
    photos: [
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80",
    ],
    age: 24,
    gender: "Woman",
    lookingFor: ["Man"],
    location: "Jubilee Hills, Hyderabad",
    latitude: 17.4325,
    longitude: 78.4071,
    jobTitle: "UX & Product Designer",
    bio: "Matcha fanatic, rooftop explorer, and vinyl collector. Always curious about new places and ideas.",
    tags: ["Design", "Matcha", "Photography", "Travel"],
    preference: {
      datingGoal: "Long-Term Dating",
      personality: "Adventurous & Spontaneous",
      partnerTraits: "Creativity & Open-Mindedness",
      musicPreference: "Electronic & Lo-Fi",
      dealBreakers: "Lack of Respect",
    },
  },
  {
    id: "cand_chloe_03",
    name: "Chloe Dupont",
    email: "chloe.dupont@example.com",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
    photos: [
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
    ],
    age: 25,
    gender: "Woman",
    lookingFor: ["Man"],
    location: "Gachibowli, Hyderabad",
    latitude: 17.4401,
    longitude: 78.3489,
    jobTitle: "Architectural Designer",
    bio: "Obsessed with modernist architecture, morning 5Ks, and cozy jazz cafes.",
    tags: ["Architecture", "Running", "Jazz", "Design"],
    preference: {
      datingGoal: "Long-Term Dating",
      personality: "Balanced & Mindful",
      partnerTraits: "Ambition & Kindness",
      musicPreference: "Jazz & Soul",
      dealBreakers: "Smoking",
    },
  },
  {
    id: "cand_elena_04",
    name: "Elena Rossi",
    email: "elena.rossi@example.com",
    avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80",
    photos: [
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
    ],
    age: 27,
    gender: "Woman",
    lookingFor: ["Man"],
    location: "Banjara Hills, Hyderabad",
    latitude: 17.4156,
    longitude: 78.4350,
    jobTitle: "Film & Fashion Curator",
    bio: "35mm film photographer, double espresso drinker, and European cinema lover.",
    tags: ["Cinema", "Fashion", "Espresso", "Art"],
    preference: {
      datingGoal: "Exploring Connections",
      personality: "Creative & Expressive",
      partnerTraits: "Intelligence & Wit",
      musicPreference: "Indie & Classical",
      dealBreakers: "Narrow Mindset",
    },
  },
  {
    id: "cand_maya_05",
    name: "Maya Patel",
    email: "maya.patel@example.com",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
    photos: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
    ],
    age: 23,
    gender: "Woman",
    lookingFor: ["Man"],
    location: "Hitec City, Hyderabad",
    latitude: 17.4504,
    longitude: 78.3808,
    jobTitle: "Software Engineer",
    bio: "Coding by day, indie gigs by night. Looking for someone to debate sci-fi movies and try spicy ramen with.",
    tags: ["Tech", "Indie Music", "Foodie", "Sci-Fi"],
    preference: {
      datingGoal: "Long-Term Dating",
      personality: "Extroverted & Energetic",
      partnerTraits: "Great Sense of Humor",
      musicPreference: "Rock & Indie",
      dealBreakers: "Dishonesty",
    },
  },
  {
    id: "cand_zara_06",
    name: "Zara Khan",
    email: "zara.khan@example.com",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
    photos: [
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
    ],
    age: 25,
    gender: "Woman",
    lookingFor: ["Man"],
    location: "Kondapur, Hyderabad",
    latitude: 17.4699,
    longitude: 78.3578,
    jobTitle: "Journalist & Podcaster",
    bio: "Storyteller, masala chai enthusiast, and voracious book collector. Seeking deep talks and weekend drives.",
    tags: ["Books", "Writing", "Chai", "Podcasts"],
    preference: {
      datingGoal: "Long-Term Dating",
      personality: "Thoughtful & Curious",
      partnerTraits: "Good Listener",
      musicPreference: "Acoustic & Folk",
      dealBreakers: "Arrogance",
    },
  },
  {
    id: "cand_lucas_07",
    name: "Lucas Vance",
    email: "lucas.vance@example.com",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
    photos: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
    ],
    age: 28,
    gender: "Man",
    lookingFor: ["Woman", "Man"],
    location: "Banjara Hills, Hyderabad",
    latitude: 17.4200,
    longitude: 78.4300,
    jobTitle: "Founder & Creative Lead",
    bio: "Building tech products, passionate about fitness and weekend motorcycle trips.",
    tags: ["Startups", "Fitness", "Travel", "Coffee"],
    preference: {
      datingGoal: "Long-Term Dating",
      personality: "Driven & Active",
      partnerTraits: "Positivity & Ambition",
      musicPreference: "Deep House",
      dealBreakers: "Negativity",
    },
  },
  {
    id: "cand_liam_08",
    name: "Liam Miller",
    email: "liam.miller@example.com",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
    photos: [
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
    ],
    age: 26,
    gender: "Man",
    lookingFor: ["Woman", "Man"],
    location: "Financial District, Hyderabad",
    latitude: 17.4172,
    longitude: 78.3421,
    jobTitle: "Investment Analyst",
    bio: "Marathon runner, amateur chef, and weekend cyclist. Always down for good food and travel.",
    tags: ["Running", "Cooking", "Finance", "Cycling"],
    preference: {
      datingGoal: "Exploring Connections",
      personality: "Calm & Grounded",
      partnerTraits: "Kindness & Empathy",
      musicPreference: "Pop & R&B",
      dealBreakers: "Rudeness",
    },
  },
];

async function seed() {
  console.log("=== SEEDING REAL CANDIDATES INTO POSTGRESQL ===");

  for (const c of CANDIDATES) {
    // 1. Upsert User
    await prisma.user.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        email: c.email,
        image: c.avatar,
      },
      create: {
        id: c.id,
        name: c.name,
        email: c.email,
        image: c.avatar,
      },
    });

    // 2. Upsert Profile
    await prisma.profile.upsert({
      where: { userId: c.id },
      update: {
        age: c.age,
        gender: c.gender,
        lookingFor: c.lookingFor,
        location: c.location,
        latitude: c.latitude,
        longitude: c.longitude,
        jobTitle: c.jobTitle,
        bio: c.bio,
        tags: c.tags,
        avatarUrl: c.avatar,
        lastActive: new Date(),
      },
      create: {
        userId: c.id,
        age: c.age,
        gender: c.gender,
        lookingFor: c.lookingFor,
        location: c.location,
        latitude: c.latitude,
        longitude: c.longitude,
        jobTitle: c.jobTitle,
        bio: c.bio,
        tags: c.tags,
        avatarUrl: c.avatar,
        lastActive: new Date(),
      },
    });

    // 3. Upsert UserPreference
    await prisma.userPreference.upsert({
      where: { userId: c.id },
      update: c.preference,
      create: {
        userId: c.id,
        ...c.preference,
      },
    });

    // 4. Create ProfilePhoto records for multi-photo gallery
    await prisma.profilePhoto.deleteMany({ where: { userId: c.id } });
    for (let i = 0; i < c.photos.length; i++) {
      await prisma.profilePhoto.create({
        data: {
          userId: c.id,
          url: c.photos[i],
          publicId: `sample_cdn_${c.id}_${i}`,
          order: i,
        },
      });
    }

    console.log(`✓ Seeded ${c.name} (${c.location}) with ${c.photos.length} photos`);
  }

  // Find real users (not candidate bots)
  const realUsers = await prisma.user.findMany({
    where: {
      id: { not: { startsWith: "cand_" } },
    },
  });

  for (const u of realUsers) {
    console.log(`\nSetting up real matches, messages, and requests for user: ${u.name} (${u.id})`);

    // 1. Create confirmed mutual match with Zara Khan (cand_zara_06)
    const [u1, u2] = [u.id, "cand_zara_06"].sort();
    await prisma.match.upsert({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
      update: {},
      create: { user1Id: u1, user2Id: u2 },
    });

    await prisma.like.upsert({
      where: { userId_targetUserId: { userId: u.id, targetUserId: "cand_zara_06" } },
      update: { action: "like" },
      create: { userId: u.id, targetUserId: "cand_zara_06", action: "like" },
    });

    await prisma.like.upsert({
      where: { userId_targetUserId: { userId: "cand_zara_06", targetUserId: u.id } },
      update: { action: "like" },
      create: { userId: "cand_zara_06", targetUserId: u.id, action: "like" },
    });

    // 2. Clear old messages with Zara Khan and seed the exact dialogue from screenshot
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: u.id, receiverId: "cand_zara_06" },
          { senderId: "cand_zara_06", receiverId: u.id },
        ],
      },
    });

    const now = Date.now();
    await prisma.message.create({
      data: {
        senderId: "cand_zara_06",
        receiverId: u.id,
        text: `Hey ${u.name.split(" ")[0] || "there"}! 👋 Noticed we crossed paths near Kondapur earlier!`,
        createdAt: new Date(now - 15 * 60 * 1000), // 15 mins ago
      },
    });

    await prisma.message.create({
      data: {
        senderId: u.id,
        receiverId: "cand_zara_06",
        text: "Hey Zara! Yes! Were you grabbing coffee at that corner place?",
        createdAt: new Date(now - 12 * 60 * 1000), // 12 mins ago
      },
    });

    await prisma.message.create({
      data: {
        senderId: "cand_zara_06",
        receiverId: u.id,
        text: "Haha exactly! Their iced flat whites are unmatched ☕ You live nearby?",
        read: false, // Unread to show badge!
        createdAt: new Date(now - 8 * 60 * 1000), // 8 mins ago
      },
    });

    console.log("✓ Seeded real message history with Zara Khan matching screenshot!");

    // 3. Pre-seed 2 incoming Message Requests (before match)
    // Request 1: Chloe Dupont
    await prisma.messageRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId: "cand_chloe_03",
          receiverId: u.id,
        },
      },
      update: {
        message: "Hey! Loved your profile and noticed we both love morning runs and architecture! Would love to chat ☕",
        status: "pending",
      },
      create: {
        senderId: "cand_chloe_03",
        receiverId: u.id,
        message: "Hey! Loved your profile and noticed we both love morning runs and architecture! Would love to chat ☕",
        status: "pending",
      },
    });

    // Request 2: Maya Patel
    await prisma.messageRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId: "cand_maya_05",
          receiverId: u.id,
        },
      },
      update: {
        message: "Hey there! 👋 Saw we crossed paths near Hitec City! What's your top coffee recommendation in town? ✨",
        status: "pending",
      },
      create: {
        senderId: "cand_maya_05",
        receiverId: u.id,
        message: "Hey there! 👋 Saw we crossed paths near Hitec City! What's your top coffee recommendation in town? ✨",
        status: "pending",
      },
    });

    console.log("✓ Seeded 2 incoming Message Requests (Chloe Dupont & Maya Patel)!");
  }

  console.log("\n✅ ALL CANDIDATES, MESSAGES, AND REQUESTS SUCCESSFULLY SEEDED INTO POSTGRESQL DATABASE!");
}

seed()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
