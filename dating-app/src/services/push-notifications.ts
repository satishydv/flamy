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
        shouldShowAlert: true,
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
    } catch (channelErr) {
      console.log('[PUSH NOTIFICATIONS] Android channel creation notice:', channelErr);
    }
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
      console.log('[PUSH NOTIFICATIONS] Foreground push received:', notification.request.content);
      if (handlers.onNotificationReceived) {
        handlers.onNotificationReceived(notification);
      }
      const data = notification.request.content.data;
      if (data?.type === 'incoming_call') {
        handlers.onIncomingCallNotification?.(data);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[PUSH NOTIFICATIONS] User tapped push notification:', response.notification.request.content);
      if (handlers.onNotificationResponse) {
        handlers.onNotificationResponse(response);
      }
      const data = response.notification.request.content.data;
      if (data?.type === 'incoming_call') {
        handlers.onIncomingCallNotification?.(data);
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
