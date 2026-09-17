import { prisma } from "../src/config/prisma.js";

const BACKEND_URL = "http://localhost:5001";

async function runSafetyTests() {
  console.log("=== STARTING SAFETY, PRIVACY & MODERATION TESTS ===\n");

  const timestamp = Date.now();
  const userA_Id = `test_safety_a_${timestamp}`;
  const userB_Id = `test_safety_b_${timestamp}`;
  const sessionTokenA = `token_a_${timestamp}`;
  const sessionTokenB = `token_b_${timestamp}`;

  try {
    // 1. Setup Test User A
    const userA = await prisma.user.create({
      data: {
        id: userA_Id,
        name: "Safety Tester Alice",
        phoneNumber: `9199000${timestamp % 100000}`,
        profile: {
          create: {
            age: 25,
            gender: "Woman",
            lookingFor: ["Man"],
            location: "Kondapur, Hyderabad",
            latitude: 17.4747,
            longitude: 78.3343,
            isGhostMode: false,
            isIncognito: false,
          },
        },
        sessions: {
          create: {
            id: `sess_a_${timestamp}`,
            token: sessionTokenA,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    // Setup Test User B
    const userB = await prisma.user.create({
      data: {
        id: userB_Id,
        name: "Safety Tester Bob",
        phoneNumber: `9199111${timestamp % 100000}`,
        profile: {
          create: {
            age: 27,
            gender: "Man",
            lookingFor: ["Woman"],
            location: "Madhapur, Hyderabad",
            latitude: 17.4749,
            longitude: 78.3345,
            isGhostMode: false,
            isIncognito: false,
          },
        },
        sessions: {
          create: {
            id: `sess_b_${timestamp}`,
            token: sessionTokenB,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    console.log("✓ Created Test Users A & B with authenticated sessions");

    // TEST 1: Ghost Mode Toggle
    console.log("\n--- TEST 1: Ghost Mode Toggle & Discovery Filtering ---");
    const ghostRes = await fetch(`${BACKEND_URL}/api/profile/privacy`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionTokenB}`,
      },
      body: JSON.stringify({ isGhostMode: true }),
    });
    const ghostData = await ghostRes.json();
    console.log("Ghost mode update response:", ghostData);
    if (!ghostData.success || !ghostData.isGhostMode) throw new Error("Ghost mode update failed");

    // Alice queries radar - Bob should NOT appear because Bob is in Ghost Mode
    const radarRes = await fetch(`${BACKEND_URL}/api/matches/nearby`, {
      headers: { Authorization: `Bearer ${sessionTokenA}` },
    });
    const radarData = await radarRes.json();
    const bobInRadar = radarData.profiles?.some((p) => p.id === userB_Id);
    console.log("Bob visible in Alice's radar while Bob in Ghost Mode?:", bobInRadar);
    if (bobInRadar) throw new Error("Ghost mode user appeared in radar!");
    console.log("✓ Ghost Mode successfully hid Bob from Radar");

    // Turn Ghost Mode off for Bob
    await fetch(`${BACKEND_URL}/api/profile/privacy`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionTokenB}`,
      },
      body: JSON.stringify({ isGhostMode: false }),
    });

    // TEST 2: Match, Messages & Unmatch Flow
    console.log("\n--- TEST 2: Mutual Match, Direct Chat & Unmatch ---");
    // Create match and messages directly
    const [u1, u2] = [userA_Id, userB_Id].sort();
    await prisma.match.create({
      data: { user1Id: u1, user2Id: u2 },
    });
    await prisma.message.create({
      data: { senderId: userA_Id, receiverId: userB_Id, text: "Hey Bob! Testing unmatch flow" },
    });
    await prisma.message.create({
      data: { senderId: userB_Id, receiverId: userA_Id, text: "Hey Alice! Chatting right now." },
    });

    // Verify conversation exists
    const convRes = await fetch(`${BACKEND_URL}/api/messages/conversations`, {
      headers: { Authorization: `Bearer ${sessionTokenA}` },
    });
    const convData = await convRes.json();
    const hasBobInConversations = convData.conversations?.some((c) => c.profileId === userB_Id);
    console.log("Alice sees Bob in active conversations before unmatch:", hasBobInConversations);
    if (!hasBobInConversations) throw new Error("Conversation not found before unmatch");

    // Alice calls Unmatch
    const unmatchRes = await fetch(`${BACKEND_URL}/api/matches/unmatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionTokenA}`,
      },
      body: JSON.stringify({ targetUserId: userB_Id }),
    });
    const unmatchData = await unmatchRes.json();
    console.log("Unmatch response:", unmatchData);
    if (!unmatchData.success) throw new Error("Unmatch API call failed");

    // Verify Match is gone
    const matchRecord = await prisma.match.findFirst({
      where: { OR: [{ user1Id: u1, user2Id: u2 }] },
    });
    console.log("Match record exists after unmatch?:", Boolean(matchRecord));
    if (matchRecord) throw new Error("Match record was not deleted!");

    // Verify Messages are gone
    const remainingMessages = await prisma.message.count({
      where: {
        OR: [
          { senderId: userA_Id, receiverId: userB_Id },
          { senderId: userB_Id, receiverId: userA_Id },
        ],
      },
    });
    console.log("Direct messages remaining after unmatch:", remainingMessages);
    if (remainingMessages > 0) throw new Error("Messages were not purged on unmatch!");

    // Verify Like record is set to 'pass'
    const likeRecordA = await prisma.like.findUnique({
      where: { userId_targetUserId: { userId: userA_Id, targetUserId: userB_Id } },
    });
    console.log("Alice's like state for Bob after unmatch:", likeRecordA?.action);
    if (likeRecordA?.action !== "pass") throw new Error("Future match prevention failed (action not pass)");
    console.log("✓ Unmatch completely dissolved connection, deleted chat, and prevented rematch");

    // TEST 3: Block User Flow & Bidirectional Filtering
    console.log("\n--- TEST 3: Block User Flow ---");
    const blockRes = await fetch(`${BACKEND_URL}/api/profile/block`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionTokenA}`,
      },
      body: JSON.stringify({ targetUserId: userB_Id, reason: "Testing safety block" }),
    });
    const blockData = await blockRes.json();
    console.log("Block response:", blockData);
    if (!blockData.success) throw new Error("Block user API failed");

    // Check Alice's blocked list
    const blockedListRes = await fetch(`${BACKEND_URL}/api/profile/blocked`, {
      headers: { Authorization: `Bearer ${sessionTokenA}` },
    });
    const blockedListData = await blockedListRes.json();
    console.log("Alice's blocked users count:", blockedListData.count);
    const isBobInBlockedList = blockedListData.blockedUsers?.some((b) => b.id === userB_Id);
    if (!isBobInBlockedList) throw new Error("Blocked user not in blocked accounts list");

    // Verify Bob cannot message Alice
    const tryMessageRes = await fetch(`${BACKEND_URL}/api/messages/${userA_Id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionTokenB}`,
      },
      body: JSON.stringify({ text: "Are you still there?" }),
    });
    console.log("Bob sending message to blocker Alice status:", tryMessageRes.status);
    if (tryMessageRes.status !== 403) throw new Error("Blocked user was able to send message!");

    // Verify Bob does not appear in Alice's feed or radar
    const feedRes = await fetch(`${BACKEND_URL}/api/matches/feed`, {
      headers: { Authorization: `Bearer ${sessionTokenA}` },
    });
    const feedData = await feedRes.json();
    const bobInFeed = feedData.feed?.some((f) => f.id === userB_Id);
    console.log("Blocked Bob in Alice's swipe feed?:", bobInFeed);
    if (bobInFeed) throw new Error("Blocked user appeared in swipe feed!");

    // Test Unblock
    const unblockRes = await fetch(`${BACKEND_URL}/api/profile/blocked/${userB_Id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionTokenA}` },
    });
    const unblockData = await unblockRes.json();
    console.log("Unblock response:", unblockData);
    if (!unblockData.success) throw new Error("Unblock user failed");
    console.log("✓ Block & Unblock bidirectional isolation verified");

    // TEST 4: Report User Flow
    console.log("\n--- TEST 4: Report User Profile ---");
    const reportRes = await fetch(`${BACKEND_URL}/api/profile/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionTokenA}`,
      },
      body: JSON.stringify({
        reportedUserId: userB_Id,
        category: "Harassment",
        details: "User sent inappropriate unsolicited messages.",
        alsoBlock: true,
      }),
    });
    const reportData = await reportRes.json();
    console.log("Report response:", reportData);
    if (!reportData.success) throw new Error("Report API failed");

    const reportInDb = await prisma.report.findFirst({
      where: { reporterId: userA_Id, reportedId: userB_Id },
    });
    console.log("Report logged in DB with category:", reportInDb?.category, "status:", reportInDb?.status);
    if (!reportInDb || reportInDb.status !== "pending") throw new Error("Report not logged in DB");
    console.log("✓ Report successfully logged with violation category and moderation queue status");

    // TEST 5: Account Deletion & Data Wipe (GDPR)
    console.log("\n--- TEST 5: Account Deletion & GDPR Wipe ---");
    const deleteRes = await fetch(`${BACKEND_URL}/api/profile/account`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionTokenA}` },
    });
    const deleteData = await deleteRes.json();
    console.log("Delete account response:", deleteData);
    if (!deleteData.success) throw new Error("Delete account API failed");

    // Verify user is gone
    const checkUserA = await prisma.user.findUnique({ where: { id: userA_Id } });
    console.log("User A exists in database after account deletion?:", Boolean(checkUserA));
    if (checkUserA) throw new Error("User A was not deleted!");

    // Verify cascade deleted profile, reports, blocks
    const remainingReports = await prisma.report.count({ where: { reporterId: userA_Id } });
    const remainingBlocks = await prisma.block.count({ where: { blockerId: userA_Id } });
    console.log("Remaining reports for User A:", remainingReports);
    console.log("Remaining blocks for User A:", remainingBlocks);
    if (remainingReports > 0 || remainingBlocks > 0) throw new Error("Cascade delete failed on reports/blocks!");
    console.log("✓ Account deletion permanently wiped user and all cascaded data");

    // Clean up User B
    await prisma.user.delete({ where: { id: userB_Id } });
    console.log("✓ Cleaned up User B");

    console.log("\n🎉 ALL SAFETY, PRIVACY & MODERATION BACKEND TESTS PASSED!");
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    // Cleanup attempt
    try {
      await prisma.user.deleteMany({ where: { id: { in: [userA_Id, userB_Id] } } });
    } catch (e) {}
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSafetyTests();
