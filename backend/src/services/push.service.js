/**
 * Expo Push Notification Service
 * Sends OS-level push notifications to devices via the official Expo Push API
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Validate whether a string matches the Expo Push Token format
 */
export function isExpoPushToken(token) {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) &&
    token.endsWith("]")
  );
}

/**
 * Dispatch an OS-level push notification to a device via Expo Push API
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient Expo Push Token(s)
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body message
 * @param {Object} [options.data] - Custom payload for deep linking
 * @param {string} [options.sound="default"] - Notification sound
 * @param {number} [options.badge] - App icon badge counter
 * @returns {Promise<Object|null>}
 */
export async function sendExpoPushNotification({
  to,
  title,
  body,
  data = {},
  sound = "default",
  badge,
  channelId = "default",
}) {
  try {
    if (!to) {
      return null;
    }

    // Support single token or array of tokens
    const tokens = Array.isArray(to) ? to : [to];
    const validTokens = tokens.filter(isExpoPushToken);

    if (validTokens.length === 0) {
      console.log("[EXPO PUSH] No valid Expo Push Tokens provided, skipping push dispatch.");
      return null;
    }

    const messages = validTokens.map((token) => ({
      to: token,
      sound,
      title,
      body,
      data,
      priority: "high",
      channelId: channelId || "default",
      ...(typeof badge === "number" ? { badge } : {}),
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EXPO PUSH] Server returned HTTP ${response.status}:`, errorText);
      return null;
    }

    const result = await response.json();
    console.log(`[EXPO PUSH] Push dispatched to ${validTokens.length} recipient(s):`, result?.data);
    return result;
  } catch (error) {
    console.error("[EXPO PUSH] Error sending push notification:", error);
    return null;
  }
}
