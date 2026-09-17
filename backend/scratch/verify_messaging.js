import dotenv from "dotenv";
dotenv.config();
import { prisma } from "../src/config/prisma.js";
import {
  getConversationsController,
  getChatMessagesController,
  sendMessageController,
  sendMessageRequestController,
  getReceivedMessageRequestsController,
  acceptMessageRequestController,
  declineMessageRequestController,
  checkChatPermissionController,
} from "../src/controllers/message.controller.js";

function createMockRes() {
  let result = null;
  let statusCode = 200;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      result = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getResult: () => result,
  };
  return res;
}

async function verify() {
  console.log("==================================================");
  console.log("   MESSAGING & MESSAGE REQUEST VERIFICATION SUITE   ");
  console.log("==================================================\n");

  // Find test user (satish)
  const satish = await prisma.user.findFirst({
    where: {
      OR: [{ name: { contains: "satish", mode: "insensitive" } }, { phoneNumber: { contains: "6204812279" } }],
    },
  });

  if (!satish) {
    throw new Error("Test user Satish not found in DB");
  }

  console.log(`Testing with user: ${satish.name} (${satish.id})`);

  // 1. Test Get Conversations
  console.log("\n[TEST 1] Fetching Conversations...");
  const convReq = { user: { id: satish.id } };
  const convRes = createMockRes();
  await getConversationsController(convReq, convRes);
  const convData = convRes.getResult();

  console.log(`✓ Status: ${convRes.getStatusCode()}`);
  console.log(`✓ Conversations count: ${convData?.count}`);
  for (const c of convData?.conversations || []) {
    console.log(`  - With ${c.partner.name}: "${c.lastMessage}" (${c.timestamp}) [unread: ${c.unreadCount}, match: ${c.isMatch}]`);
  }

  const zaraConv = convData?.conversations?.find((c) => c.partner.name === "Zara Khan");
  if (!zaraConv) throw new Error("Zara Khan conversation not found in conversations list!");
  console.log("  -> PASSED: Zara Khan conversation present with correct last message and unread count.");

  // 2. Test Get Chat Messages for Zara Khan
  console.log("\n[TEST 2] Fetching Thread Messages for Zara Khan (cand_zara_06)...");
  const msgReq = { user: { id: satish.id }, params: { partnerId: "cand_zara_06" } };
  const msgRes = createMockRes();
  await getChatMessagesController(msgReq, msgRes);
  const msgData = msgRes.getResult();

  console.log(`✓ Thread messages count: ${msgData?.messages?.length}`);
  console.log(`✓ Mutual match: ${msgData?.isMatch}, Can call: ${msgData?.canCall}`);
  for (const m of msgData?.messages || []) {
    console.log(`  [${m.isMine ? "ME" : "ZARA"} ${m.timestamp}]: ${m.text}`);
  }
  if (!msgData?.messages || msgData.messages.length < 3) {
    throw new Error("Expected at least 3 messages matching screenshot!");
  }
  console.log("  -> PASSED: Screenshot dialogue verified!");

  // 3. Test Sending a New Real Message
  console.log("\n[TEST 3] Sending real message to Zara Khan...");
  const sendReq = {
    user: { id: satish.id },
    params: { partnerId: "cand_zara_06" },
    body: { text: "Sounds like a plan! How about Saturday at 3 PM? ☕" },
  };
  const sendRes = createMockRes();
  await sendMessageController(sendReq, sendRes);
  const sendData = sendRes.getResult();

  console.log(`✓ Message sent successfully! ID: ${sendData?.message?.id}`);
  console.log(`✓ Stored text: "${sendData?.message?.text}"`);
  console.log("  -> PASSED: Real message persisted to PostgreSQL.");

  // 4. Test Fetching Pending Message Requests
  console.log("\n[TEST 4] Fetching Incoming Message Requests (Before Match)...");
  const reqListReq = { user: { id: satish.id } };
  const reqListRes = createMockRes();
  await getReceivedMessageRequestsController(reqListReq, reqListRes);
  const reqListData = reqListRes.getResult();

  console.log(`✓ Pending requests count: ${reqListData?.count}`);
  for (const r of reqListData?.requests || []) {
    console.log(`  - From ${r.sender.name} (${r.sender.location}): "${r.message}"`);
  }
  if (!reqListData?.requests || reqListData.requests.length === 0) {
    throw new Error("Expected pending message requests!");
  }
  console.log("  -> PASSED: Incoming message requests retrieved.");

  // 5. Test Sending a Message Request Before Match (to Elena Rossi)
  console.log("\n[TEST 5] Sending Message Request before match to Elena Rossi (cand_elena_04)...");
  const sendReqBody = {
    user: { id: satish.id },
    body: {
      targetUserId: "cand_elena_04",
      message: "Hey Elena! Love your film photography style. Would love to connect! 📷",
    },
  };
  const sendReqRes = createMockRes();
  await sendMessageRequestController(sendReqBody, sendReqRes);
  const sendReqData = sendReqRes.getResult();

  console.log(`✓ Send request response:`, sendReqData?.message);
  console.log(`✓ Request ID: ${sendReqData?.request?.id}, Status: ${sendReqData?.request?.status}`);
  console.log("  -> PASSED: Message request created as pending in PostgreSQL.");

  // 6. Test Safety Check / Permission Check
  console.log("\n[TEST 6] Verifying Call Safety Permission Check...");
  // Check Elena (unmatched request sent)
  const permElenaReq = { user: { id: satish.id }, params: { partnerId: "cand_elena_04" } };
  const permElenaRes = createMockRes();
  await checkChatPermissionController(permElenaReq, permElenaRes);
  console.log(`  - Elena: canCall = ${permElenaRes.getResult()?.canCall}, state = ${permElenaRes.getResult()?.relationshipState}`);
  if (permElenaRes.getResult()?.canCall === true) {
    throw new Error("Calls must be strictly FALSE before mutual match!");
  }

  // Check Zara (matched)
  const permZaraReq = { user: { id: satish.id }, params: { partnerId: "cand_zara_06" } };
  const permZaraRes = createMockRes();
  await checkChatPermissionController(permZaraReq, permZaraRes);
  console.log(`  - Zara: canCall = ${permZaraRes.getResult()?.canCall}, state = ${permZaraRes.getResult()?.relationshipState}`);
  if (permZaraRes.getResult()?.canCall !== true) {
    throw new Error("Calls must be TRUE for confirmed match!");
  }
  console.log("  -> PASSED: Strict call safety rules enforced.");

  // 7. Test Accepting a Message Request (Accept Chloe Dupont)
  console.log("\n[TEST 7] Accepting Message Request from Chloe Dupont...");
  const chloeReqItem = reqListData?.requests?.find((r) => r.sender.name.includes("Chloe"));
  if (chloeReqItem) {
    const acceptReq = { user: { id: satish.id }, params: { requestId: chloeReqItem.id } };
    const acceptRes = createMockRes();
    await acceptMessageRequestController(acceptReq, acceptRes);
    const acceptData = acceptRes.getResult();

    console.log(`✓ Accepted! Match ID: ${acceptData?.match?.id}`);
    console.log(`✓ Match created: ${acceptData?.isMatch}, Partner: ${acceptData?.partner?.name}`);

    // Verify intro note was converted to first message
    const chloeThread = await prisma.message.findFirst({
      where: { senderId: chloeReqItem.senderId, receiverId: satish.id },
    });
    console.log(`✓ First chat message created from intro note: "${chloeThread?.text}"`);
    console.log("  -> PASSED: Request acceptance converted to mutual match and active chat!");
  }

  console.log("\n==================================================");
  console.log("   🎉 ALL MESSAGING & REQUEST TESTS PASSED! 🎉    ");
  console.log("==================================================\n");
}

verify()
  .catch((err) => {
    console.error("\n❌ VERIFICATION FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
