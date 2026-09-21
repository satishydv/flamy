import { prisma } from "../config/prisma.js";
import { emitToUser } from "../socket/index.js";
import { createAndSendNotification } from "../services/notification.service.js";
import { getBlockedUserIds } from "./match.controller.js";

/**
 * Format timestamp into readable format (e.g., "9:52 AM" or "Yesterday")
 */
function formatMessageTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Get all conversation threads for current user
 */
export const getConversationsController = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // 1. Find all matches for this user
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      },
      include: {
        user1: {
          include: {
            profile: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
        user2: {
          include: {
            profile: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    // 2. Find all distinct conversation partners from Message table
    const sentMessages = await prisma.message.findMany({
      where: { senderId: currentUserId },
      select: { receiverId: true },
      distinct: ["receiverId"],
    });
    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: currentUserId },
      select: { senderId: true },
      distinct: ["senderId"],
    });

    const partnerIdSet = new Set();
    matches.forEach((m) => {
      partnerIdSet.add(m.user1Id === currentUserId ? m.user2Id : m.user1Id);
    });
    sentMessages.forEach((m) => partnerIdSet.add(m.receiverId));
    receivedMessages.forEach((m) => partnerIdSet.add(m.senderId));

    const blockedIds = new Set(await getBlockedUserIds(currentUserId));
    const conversations = [];

    for (const partnerId of partnerIdSet) {
      if (blockedIds.has(partnerId)) continue;
      const partner = await prisma.user.findUnique({
        where: { id: partnerId },
        include: {
          profile: true,
          photos: { orderBy: { order: "asc" } },
        },
      });

      if (!partner) continue;

      // Check if mutually matched
      const isMatch = matches.some(
        (m) =>
          (m.user1Id === currentUserId && m.user2Id === partnerId) ||
          (m.user2Id === currentUserId && m.user1Id === partnerId)
      );

      // Latest message
      const latestMessage = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: partnerId },
            { senderId: partnerId, receiverId: currentUserId },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      // Unread count
      const unreadCount = await prisma.message.count({
        where: {
          senderId: partnerId,
          receiverId: currentUserId,
          read: false,
        },
      });

      const p = partner.profile;
      const gallery = (partner.photos || []).map((ph) => ph.url);

      conversations.push({
        profileId: partner.id,
        partner: {
          id: partner.id,
          name: partner.name,
          age: p?.age || 25,
          isVerified: true,
          location: p?.location || "Nearby",
          jobTitle: p?.jobTitle || "Creative Professional",
          bio: p?.bio || "",
          image: partner.image || p?.avatarUrl || gallery[0] || null,
          online: true,
          encountersCount: Math.max(1, (partner.id.charCodeAt(0) || 1) % 4),
          matchPercentage: 92,
        },
        lastMessage: latestMessage?.text || (isMatch ? "You matched! Say hi 👋" : "Message Request"),
        lastMessageAt: latestMessage?.createdAt || new Date(0),
        timestamp: latestMessage ? formatMessageTime(latestMessage.createdAt) : "New",
        unreadCount,
        isMatch,
      });
    }

    // Sort by latest message date descending
    conversations.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    return res.json({
      success: true,
      count: conversations.length,
      conversations,
    });
  } catch (error) {
    console.error("[MESSAGE CONTROLLER] getConversations error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load conversations.",
    });
  }
};

/**
 * Get message history with a specific partner
 */
export const getChatMessagesController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { partnerId } = req.params;

    if (!partnerId) {
      return res.status(400).json({ success: false, message: "partnerId is required." });
    }

    // Find partner
    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      include: {
        profile: true,
        photos: { orderBy: { order: "asc" } },
      },
    });

    if (!partner) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Check if either user has blocked the other
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: partnerId },
          { blockerId: partnerId, blockedId: currentUserId },
        ],
      },
    });

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        code: "USER_BLOCKED",
        message: "You cannot view messages from a blocked profile.",
      });
    }

    // Mark messages from partner as read
    await prisma.message.updateMany({
      where: {
        senderId: partnerId,
        receiverId: currentUserId,
        read: false,
      },
      data: { read: true },
    });

    // Fetch conversation messages
    const rawMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: partnerId },
          { senderId: partnerId, receiverId: currentUserId },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // Mark unread incoming messages as read when the user actually opens the chat
    await prisma.message.updateMany({
      where: {
        senderId: partnerId,
        receiverId: currentUserId,
        read: false,
      },
      data: { read: true },
    }).catch(() => {});

    // Check match status for call authorization (strictly per messagerl.md)
    const isMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id: currentUserId, user2Id: partnerId },
          { user1Id: partnerId, user2Id: currentUserId },
        ],
      },
    });

    const acceptedRequest = await prisma.messageRequest.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: partnerId, status: "accepted" },
          { senderId: partnerId, receiverId: currentUserId, status: "accepted" },
        ],
      },
    });

    const formattedMessages = rawMessages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      text: m.text,
      timestamp: formatMessageTime(m.createdAt),
      isMine: m.senderId === currentUserId,
      read: m.read,
      createdAt: m.createdAt,
    }));

    const p = partner.profile;
    const gallery = (partner.photos || []).map((ph) => ph.url);

    return res.json({
      success: true,
      messages: formattedMessages,
      isMatch: Boolean(isMatch || acceptedRequest),
      canCall: Boolean(isMatch), // calls strictly forbidden before mutual match
      partner: {
        id: partner.id,
        name: partner.name,
        age: p?.age || 25,
        isVerified: true,
        location: p?.location || "Nearby",
        jobTitle: p?.jobTitle || "Creative Professional",
        bio: p?.bio || "",
        image: partner.image || p?.avatarUrl || gallery[0] || null,
        online: true,
        encountersCount: Math.max(1, (partner.id.charCodeAt(0) || 1) % 4),
        matchPercentage: 92,
      },
    });
  } catch (error) {
    console.error("[MESSAGE CONTROLLER] getChatMessages error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load chat messages.",
    });
  }
};

/**
 * Send a real message to a partner
 */
export const sendMessageController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { partnerId } = req.params;
    const { text } = req.body;

    if (!partnerId) {
      return res.status(400).json({ success: false, message: "partnerId is required." });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message text cannot be empty." });
    }

    // Check if either user has blocked the other
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: partnerId },
          { blockerId: partnerId, blockedId: currentUserId },
        ],
      },
    });

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        code: "USER_BLOCKED",
        message: "You cannot send messages to a blocked profile.",
      });
    }

    // Check relationship state
    const isMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id: currentUserId, user2Id: partnerId },
          { user1Id: partnerId, user2Id: currentUserId },
        ],
      },
    });

    const acceptedRequest = await prisma.messageRequest.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: partnerId, status: "accepted" },
          { senderId: partnerId, receiverId: currentUserId, status: "accepted" },
        ],
      },
    });

    let isMessageRequest = false;

    // If not matched and no accepted request, automatically create/record the introductory Message Request!
    if (!isMatch && !acceptedRequest) {
      isMessageRequest = true;

      // 1. Record Like from current user
      await prisma.like.upsert({
        where: {
          userId_targetUserId: {
            userId: currentUserId,
            targetUserId: partnerId,
          },
        },
        update: { action: "like" },
        create: {
          userId: currentUserId,
          targetUserId: partnerId,
          action: "like",
        },
      }).catch(() => {});

      // 2. Check if partner already liked current user (reciprocal match!)
      const reciprocalLike = await prisma.like.findFirst({
        where: {
          userId: partnerId,
          targetUserId: currentUserId,
          action: { in: ["like", "superlike"] },
        },
      });

      if (reciprocalLike) {
        const [u1, u2] = [currentUserId, partnerId].sort();
        await prisma.match.upsert({
          where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
          update: {},
          create: { user1Id: u1, user2Id: u2 },
        }).catch(() => {});

        await prisma.messageRequest.upsert({
          where: { senderId_receiverId: { senderId: currentUserId, receiverId: partnerId } },
          update: { status: "accepted", message: text.trim() },
          create: { senderId: currentUserId, receiverId: partnerId, message: text.trim(), status: "accepted" },
        }).catch(() => {});
      } else {
        // Create or update pending message request
        await prisma.messageRequest.upsert({
          where: { senderId_receiverId: { senderId: currentUserId, receiverId: partnerId } },
          update: { status: "pending", message: text.trim() },
          create: {
            senderId: currentUserId,
            receiverId: partnerId,
            message: text.trim(),
            status: "pending",
          },
        }).catch(() => {});
      }
    }

    // Create the message
    const newMessage = await prisma.message.create({
      data: {
        senderId: currentUserId,
        receiverId: partnerId,
        text: text.trim(),
      },
    });

    const formattedMessage = {
      id: newMessage.id,
      senderId: newMessage.senderId,
      text: newMessage.text,
      timestamp: formatMessageTime(newMessage.createdAt),
      isMine: false,
      read: newMessage.read,
      createdAt: newMessage.createdAt,
    };

    // Emit real-time message to the recipient instantly via Socket.IO
    emitToUser(partnerId, "chat:new_message", {
      message: formattedMessage,
      partnerId: currentUserId,
      isMessageRequest,
    });

    // Send OS-level push notification + in-app notification to the recipient
    const senderUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { name: true },
    });
    const senderName = senderUser?.name || "New Message";
    const previewText = text.trim().length > 60 ? text.trim().substring(0, 60) + "..." : text.trim();

    createAndSendNotification({
      userId: partnerId,
      senderId: currentUserId,
      type: isMessageRequest ? "request" : "message",
      title: isMessageRequest ? `${senderName} sent you a message request! 💌` : `${senderName} 💬`,
      message: previewText,
      data: {
        partnerId: currentUserId,
        senderName,
        messageId: newMessage.id,
        isMessageRequest,
      },
    }).catch((notifErr) => {
      console.log("[MESSAGE CONTROLLER] Message push notice:", notifErr);
    });

    // If the recipient is one of the demo/candidate profiles, schedule/save a realistic candidate reply in DB!
    if (partnerId.startsWith("cand_")) {
      setTimeout(async () => {
        try {
          const lower = text.toLowerCase();
          let replyText = "Haha exactly! Have you lived around this area long?";
          if (lower.includes("coffee") || lower.includes("flat white") || lower.includes("latte") || lower.includes("cafe")) {
            replyText = "Their iced flat whites are unmatched ☕ You live nearby?";
          } else if (lower.includes("great profile") || lower.includes("hey there") || lower.includes("hello") || lower.includes("hi")) {
            replyText = "Hey there! 👋 Thanks so much, noticed we crossed paths earlier!";
          } else if (lower.includes("sometime") || lower.includes("meet") || lower.includes("weekend")) {
            replyText = "I'd love that! This weekend works great for me ✨";
          } else if (lower.includes("how are you")) {
            replyText = "Doing well, just grabbing coffee and working on some projects! How is your day?";
          }

          const botMsg = await prisma.message.create({
            data: {
              senderId: partnerId,
              receiverId: currentUserId,
              text: replyText,
            },
          });

          // Emit real-time bot response to the current user via Socket.IO
          emitToUser(currentUserId, "chat:new_message", {
            message: {
              id: botMsg.id,
              senderId: botMsg.senderId,
              text: botMsg.text,
              timestamp: formatMessageTime(botMsg.createdAt),
              isMine: false,
              read: botMsg.read,
              createdAt: botMsg.createdAt,
            },
            partnerId: partnerId,
          });

          // Also trigger push notification for bot response if user locks device
          const botUser = await prisma.user.findUnique({
            where: { id: partnerId },
            select: { name: true },
          });
          createAndSendNotification({
            userId: currentUserId,
            senderId: partnerId,
            type: "message",
            title: `${botUser?.name || "Match"} 💬`,
            message: replyText,
            data: {
              partnerId,
              senderName: botUser?.name || "Match",
              messageId: botMsg.id,
            },
          }).catch(() => {});
        } catch (botErr) {
          console.error("Bot reply error:", botErr);
        }
      }, 1200);
    }

    return res.json({
      success: true,
      message: {
        id: newMessage.id,
        senderId: newMessage.senderId,
        text: newMessage.text,
        timestamp: formatMessageTime(newMessage.createdAt),
        isMine: true,
        read: newMessage.read,
        createdAt: newMessage.createdAt,
      },
    });
  } catch (error) {
    console.error("[MESSAGE CONTROLLER] sendMessage error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message.",
    });
  }
};

/**
 * Send an introductory Message Request BEFORE matching (per messagerl.md)
 */
export const sendMessageRequestController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { targetUserId, message } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "targetUserId is required." });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: "Cannot send message request to yourself." });
    }

    // Check if either user has blocked the other
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUserId },
        ],
      },
    });

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        code: "USER_BLOCKED",
        message: "Cannot send a message request to a blocked user.",
      });
    }

    const noteText = message && message.trim().length > 0
      ? message.trim()
      : "Hey! Noticed we crossed paths and wanted to say hi! 👋";

    // 1. Check if already mutually matched
    const isAlreadyMatched = await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id: currentUserId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: currentUserId },
        ],
      },
    });

    if (isAlreadyMatched) {
      return res.json({
        success: true,
        isMatch: true,
        message: "You are already matched! You can chat directly.",
      });
    }

    // 2. Record Like
    await prisma.like.upsert({
      where: {
        userId_targetUserId: {
          userId: currentUserId,
          targetUserId,
        },
      },
      update: { action: "like" },
      create: {
        userId: currentUserId,
        targetUserId,
        action: "like",
      },
    });

    // 3. Check if target user has already liked current user
    const reciprocalLike = await prisma.like.findFirst({
      where: {
        userId: targetUserId,
        targetUserId: currentUserId,
        action: { in: ["like", "superlike"] },
      },
    });

    if (reciprocalLike) {
      // Reciprocal match formed!
      const [u1, u2] = [currentUserId, targetUserId].sort();
      const matchRecord = await prisma.match.upsert({
        where: {
          user1Id_user2Id: { user1Id: u1, user2Id: u2 },
        },
        update: {},
        create: { user1Id: u1, user2Id: u2 },
      });

      // Save intro note as first chat message
      await prisma.message.create({
        data: {
          senderId: currentUserId,
          receiverId: targetUserId,
          text: noteText,
        },
      });

      // Also upsert MessageRequest as accepted
      await prisma.messageRequest.upsert({
        where: {
          senderId_receiverId: { senderId: currentUserId, receiverId: targetUserId },
        },
        update: { status: "accepted", message: noteText },
        create: { senderId: currentUserId, receiverId: targetUserId, message: noteText, status: "accepted" },
      });

      const matchedTarget = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: { profile: true },
      });

      return res.json({
        success: true,
        isMatch: true,
        match: matchRecord,
        matchedUser: matchedTarget,
        message: "It's a mutual match! Conversation opened.",
      });
    }

    // 4. Create or update pending MessageRequest
    const requestRecord = await prisma.messageRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId: currentUserId,
          receiverId: targetUserId,
        },
      },
      update: {
        message: noteText,
        status: "pending",
        updatedAt: new Date(),
      },
      create: {
        senderId: currentUserId,
        receiverId: targetUserId,
        message: noteText,
        status: "pending",
      },
    });

    // Send in-app notification to target user about incoming message request
    const senderUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { name: true },
    });
    const senderName = senderUser?.name || "Someone";
    createAndSendNotification({
      userId: targetUserId,
      senderId: currentUserId,
      type: "request",
      title: "New Message Request ✉️",
      message: `${senderName} sent you a message: "${noteText.length > 50 ? noteText.substring(0, 50) + '...' : noteText}"`,
      data: { profileId: currentUserId, requestId: requestRecord.id },
    }).catch((err) => console.error("[REQUEST NOTIFICATION] Error:", err));

    return res.json({
      success: true,
      isMatch: false,
      request: requestRecord,
      message: "Message request sent successfully! They will see it in their Requests inbox.",
    });
  } catch (error) {
    console.error("[MESSAGE CONTROLLER] sendMessageRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message request.",
    });
  }
};

/**
 * Get all incoming pending message requests for current user
 */
export const getReceivedMessageRequestsController = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const pendingRequests = await prisma.messageRequest.findMany({
      where: {
        receiverId: currentUserId,
        status: "pending",
      },
      include: {
        sender: {
          include: {
            profile: true,
            preference: true,
            photos: { orderBy: { order: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedRequests = pendingRequests.map((reqItem) => {
      const sender = reqItem.sender;
      const p = sender.profile;
      const pref = sender.preference;
      const gallery = (sender.photos || []).map((ph) => ph.url);

      return {
        id: reqItem.id,
        senderId: sender.id,
        message: reqItem.message,
        createdAt: reqItem.createdAt,
        timestamp: formatMessageTime(reqItem.createdAt),
        sender: {
          id: sender.id,
          name: sender.name,
          age: p?.age || 25,
          isVerified: true,
          location: p?.location || "Nearby",
          jobTitle: p?.jobTitle || "Creative Professional",
          bio: p?.bio || "",
          image: sender.image || p?.avatarUrl || gallery[0] || null,
          photos: sender.photos || [],
          encountersCount: Math.max(1, (sender.id.charCodeAt(0) || 1) % 4),
          matchPercentage: 90,
          datingGoal: pref?.datingGoal || "",
          personality: pref?.personality || "",
          online: true,
        },
      };
    });

    return res.json({
      success: true,
      count: formattedRequests.length,
      requests: formattedRequests,
    });
  } catch (error) {
    console.error("[MESSAGE CONTROLLER] getReceivedMessageRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load message requests.",
    });
  }
};

/**
 * Accept a Message Request
 * -> Marks request accepted, forms mutual Match, and converts intro note into the first message!
 */
export const acceptMessageRequestController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { requestId } = req.params;

    const requestItem = await prisma.messageRequest.findUnique({
      where: { id: requestId },
      include: { sender: { include: { profile: true } } },
    });

    if (!requestItem || requestItem.receiverId !== currentUserId) {
      return res.status(404).json({ success: false, message: "Message request not found." });
    }

    // Mark as accepted
    await prisma.messageRequest.update({
      where: { id: requestId },
      data: { status: "accepted" },
    });

    // Create mutual Match
    const [u1, u2] = [requestItem.senderId, currentUserId].sort();
    const match = await prisma.match.upsert({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
      update: {},
      create: { user1Id: u1, user2Id: u2 },
    });

    // Ensure reciprocal likes
    await prisma.like.upsert({
      where: { userId_targetUserId: { userId: currentUserId, targetUserId: requestItem.senderId } },
      update: { action: "like" },
      create: { userId: currentUserId, targetUserId: requestItem.senderId, action: "like" },
    });

    // Notify the original sender that their request was accepted!
    const acceptor = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { name: true },
    });
    const acceptorName = acceptor?.name || "Someone";
    createAndSendNotification({
      userId: requestItem.senderId,
      senderId: currentUserId,
      type: "match",
      title: "Request Accepted! 🎉",
      message: `${acceptorName} accepted your message request! You are now matched.`,
      data: { matchId: match.id, profileId: currentUserId },
    }).catch((err) => console.error("[ACCEPT REQUEST NOTIFICATION] Error:", err));

    // Add intro note as first chat message if not already present
    const existingMsg = await prisma.message.findFirst({
      where: {
        senderId: requestItem.senderId,
        receiverId: currentUserId,
        text: requestItem.message,
      },
    });

    if (!existingMsg) {
      await prisma.message.create({
        data: {
          senderId: requestItem.senderId,
          receiverId: currentUserId,
          text: requestItem.message,
        },
      });
    }

    const partner = {
      id: requestItem.sender.id,
      name: requestItem.sender.name,
      age: requestItem.sender.profile?.age || 25,
      isVerified: true,
      image: requestItem.sender.image || requestItem.sender.profile?.avatarUrl,
      location: requestItem.sender.profile?.location || "Nearby",
      jobTitle: requestItem.sender.profile?.jobTitle || "Creative Professional",
    };

    return res.json({
      success: true,
      isMatch: true,
      match,
      partner,
      message: "Message request accepted! You can now chat freely.",
    });
  } catch (error) {
    console.error("[MESSAGE CONTROLLER] acceptMessageRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to accept message request.",
    });
  }
};

/**
 * Decline a Message Request
 */
export const declineMessageRequestController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { requestId } = req.params;

    const requestItem = await prisma.messageRequest.findUnique({
      where: { id: requestId },
    });

    if (!requestItem || requestItem.receiverId !== currentUserId) {
      return res.status(404).json({ success: false, message: "Message request not found." });
    }

    await prisma.messageRequest.update({
      where: { id: requestId },
      data: { status: "declined" },
    });

    return res.json({
      success: true,
      message: "Message request declined.",
    });
  } catch (error) {
    console.error("[MESSAGE CONTROLLER] declineMessageRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to decline message request.",
    });
  }
};

/**
 * Check permission to chat or call
 */
export const checkChatPermissionController = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { partnerId } = req.params;

    // Check if either user has blocked the other
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: partnerId },
          { blockerId: partnerId, blockedId: currentUserId },
        ],
      },
    });

    if (isBlocked) {
      return res.json({
        success: true,
        canChat: false,
        canCall: false,
        isBlocked: true,
        relationshipState: "BLOCKED",
      });
    }

    const isMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id: currentUserId, user2Id: partnerId },
          { user1Id: partnerId, user2Id: currentUserId },
        ],
      },
    });

    const acceptedRequest = await prisma.messageRequest.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: partnerId, status: "accepted" },
          { senderId: partnerId, receiverId: currentUserId, status: "accepted" },
        ],
      },
    });

    const pendingSent = await prisma.messageRequest.findFirst({
      where: { senderId: currentUserId, receiverId: partnerId, status: "pending" },
    });

    const pendingReceived = await prisma.messageRequest.findFirst({
      where: { senderId: partnerId, receiverId: currentUserId, status: "pending" },
    });

    let relationshipState = "NONE";
    if (isMatch) relationshipState = "MATCHED";
    else if (acceptedRequest) relationshipState = "REQUEST_ACCEPTED";
    else if (pendingSent) relationshipState = "REQUEST_SENT";
    else if (pendingReceived) relationshipState = "REQUEST_RECEIVED";

    return res.json({
      success: true,
      canChat: Boolean(isMatch || acceptedRequest),
      canCall: Boolean(isMatch), // calls strictly forbidden before mutual match
      relationshipState,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
