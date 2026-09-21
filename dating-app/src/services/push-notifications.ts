import { Platform } from 'react-native';
import type * as NotificationsType from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { API_ENDPOINTS, getAuthHeaders } from '@/constants/api';

// Android remote push notifications via expo-notifications were removed from Expo Go starting with SDK 53.
// Statically importing expo-notifications executes auto-registration that throws a fatal error in Expo Go on Android.
const isExpoGoAndroid = Platform.OS === 'android' && isRunningInExpoGo();

let Notifications: typeof NotificationsType | null = null;
if (!isExpoGoAndroid && Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (err) {
    console.warn('[PUSH NOTIFICATIONS] Could not load expo-notifications module:', err);
  }
}

// Configure how notifications behave when the app is actively in the foreground
if (Notifications?.setNotificationHandler) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('[PUSH NOTIFICATIONS] Handler setup error:', err);
  }
}

/**
 * Register device for OS-level push notifications and persist expoPushToken to PostgreSQL
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('[PUSH NOTIFICATIONS] Web platform: skipping native push registration.');
    return null;
  }

  if (isExpoGoAndroid) {
    console.log(
      '[PUSH NOTIFICATIONS] Remote push notifications are not supported in Expo Go on Android (SDK 53+). ' +
      'Use a development build (npx expo run:android) to test push notifications.'
    );
    return null;
  }

  if (!Notifications) {
    return null;
  }

  // Set up high-priority notification channel for Android
  if (Platform.OS === 'android') {
    await setupNotificationChannels();
  }

  // Push notifications work on physical devices (and in Expo Go on real devices)
  if (!Device.isDevice) {
    console.log('[PUSH NOTIFICATIONS] Push tokens are only supported on physical devices.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PUSH NOTIFICATIONS] Permission not granted for push notifications.');
      return null;
    }

    // On Android native builds, expo-notifications requires Firebase (FCM) credentials configured via googleServicesFile.
    // If not yet configured, log a friendly advisory and skip token fetch to avoid RedBox errors.
    const hasGoogleServices = Boolean(
      Constants?.expoConfig?.android?.googleServicesFile ||
      (Constants as any)?.manifest?.android?.googleServicesFile
    );

    if (Platform.OS === 'android' && !hasGoogleServices) {
      console.log(
        '[PUSH NOTIFICATIONS] FCM credentials (googleServicesFile) are not yet configured in app.json. ' +
        'Remote push registration is skipped. (Local notifications & in-app alerts remain active).'
      );
      return null;
    }

    // Resolve project ID if EAS is configured
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    let token: string | null = null;

    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = tokenResponse.data;
      console.log('[PUSH NOTIFICATIONS] Registered Expo push token:', token);
    } catch (expoErr: any) {
      console.log('[PUSH NOTIFICATIONS] getExpoPushTokenAsync notice:', expoErr?.message);
      try {
        const deviceTokenRes = await Notifications.getDevicePushTokenAsync();
        token = deviceTokenRes?.data ? String(deviceTokenRes.data) : null;
        console.log('[PUSH NOTIFICATIONS] Registered native device push token (FCM):', token);
      } catch (devErr: any) {
        console.warn('[PUSH NOTIFICATIONS] Device push token notice:', devErr?.message);
      }
    }

    // Persist token to user record in PostgreSQL backend
    if (token) {
      try {
        const headers = getAuthHeaders({ 'Content-Type': 'application/json' });
        const res = await fetch(API_ENDPOINTS.savePushToken, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ token, userId }),
        });
        const data = await res.json().catch(() => null);
        console.log('[PUSH NOTIFICATIONS] Push token synced to backend successfully:', data);
      } catch (syncErr) {
        console.warn('[PUSH NOTIFICATIONS] Push token sync warning:', syncErr);
      }
    }

    return token;
  } catch (error: any) {
    console.warn('[PUSH NOTIFICATIONS] Registration notice:', error?.message || error);
    return null;
  }
}

let isChannelSetUp = false;

/**
 * Configure Android notification channels with MAX priority for incoming calls
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android' || !Notifications) return;
  if (isChannelSetUp) return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Matches & Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0284C7',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync('incoming-calls', {
      name: 'Incoming Phone & Video Calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
      lightColor: '#FE3C72',
      enableLights: true,
      enableVibrate: true,
      sound: 'ringtone.wav',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });
    isChannelSetUp = true;
  } catch (channelErr) {
    console.log('[PUSH NOTIFICATIONS] Android channel creation notice:', channelErr);
  }
}

let isCategoryRegistered = false;

/**
 * Register interactive incoming call actions (Accept / Decline) for Android & iOS
 */
export async function registerCallNotificationCategory() {
  if (Platform.OS === 'web' || !Notifications) return;
  if (isCategoryRegistered) return;

  try {
    await Notifications.setNotificationCategoryAsync('incoming_call', [
      {
        identifier: 'accept',
        buttonTitle: 'Accept 📞',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'decline',
        buttonTitle: 'Decline ✕',
        options: {
          isDestructive: true,
          opensAppToForeground: true,
        },
      },
    ]);
    isCategoryRegistered = true;
  } catch (err) {
    console.warn('[PUSH NOTIFICATIONS] Category registration notice:', err);
  }
}

let activeNotificationCallId: string | null = null;

/**
 * Present an immediate Heads-Up incoming call notification banner on Android & iOS
 */
export async function presentIncomingCallNotification(callData: {
  callId: string;
  fromUserId: string;
  type?: 'audio' | 'video';
  callerInfo?: { id?: string; name?: string; image?: string; location?: string };
}): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null;
  if (!callData?.callId) return null;

  // Prevent multiple duplicate notifications for the same callId
  if (activeNotificationCallId === callData.callId) {
    return activeNotificationCallId;
  }
  activeNotificationCallId = callData.callId;

  try {
    await setupNotificationChannels();
    await registerCallNotificationCategory();

    const callType = callData.type === 'video' ? 'Video' : 'Voice';
    const callerName = callData.callerInfo?.name || 'Someone';

    const notifId = await Notifications.scheduleNotificationAsync({
      identifier: callData.callId,
      content: {
        title: `📞 Incoming ${callType} Call`,
        body: `${callerName} is calling you... Tap to answer`,
        data: {
          type: 'incoming_call',
          callId: callData.callId,
          fromUserId: callData.fromUserId,
          callerInfo: callData.callerInfo,
          callType: callData.type || 'audio',
          _isLocalNotification: true,
        },
        categoryIdentifier: 'incoming_call',
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: true,
        autoDismiss: false,
        sound: 'ringtone.wav',
        vibrate: [0, 1000, 500, 1000, 500, 1000],
      },
      trigger: {
        channelId: 'incoming-calls',
      },
    });

    console.log('[PUSH NOTIFICATIONS] Presented incoming call notification:', notifId);
    return notifId;
  } catch (err) {
    console.error('[PUSH NOTIFICATIONS] Failed to present incoming call notification:', err);
    return null;
  }
}

/**
 * Dismiss the active incoming call notification from Android tray / lockscreen
 */
export async function dismissIncomingCallNotification(callId?: string) {
  activeNotificationCallId = null;
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    if (callId) {
      await Notifications.dismissNotificationAsync(callId);
    } else {
      await Notifications.dismissAllNotificationsAsync();
    }
    console.log('[PUSH NOTIFICATIONS] Dismissed notification for call:', callId);
  } catch (err) {
    console.warn('[PUSH NOTIFICATIONS] Error dismissing notification:', err);
  }
}

export interface NotificationHandlers {
  onNotificationReceived?: (notification: NotificationsType.Notification) => void;
  onNotificationResponse?: (response: NotificationsType.NotificationResponse) => void;
  onIncomingCallNotification?: (callData: any) => void;
}

/**
 * Setup listeners for incoming foreground pushes and lockscreen/banner tap responses
 */
export function setupNotificationListeners(handlers: NotificationHandlers) {
  if (Platform.OS === 'web' || !Notifications) return () => {};

  try {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      console.log('[PUSH NOTIFICATIONS] Notification received:', data?.type);
      if (handlers.onNotificationReceived) {
        handlers.onNotificationReceived(notification);
      }
      // Only notify app if this is NOT a locally-scheduled notification loop
      if (data?.type === 'incoming_call' && !data?._isLocalNotification) {
        handlers.onIncomingCallNotification?.(data);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[PUSH NOTIFICATIONS] User interacted with notification:', response.actionIdentifier);
      if (handlers.onNotificationResponse) {
        handlers.onNotificationResponse(response);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  } catch (err) {
    console.warn('[PUSH NOTIFICATIONS] Error setting up notification listeners:', err);
    return () => {};
  }
}
