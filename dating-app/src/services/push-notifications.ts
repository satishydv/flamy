import { Platform } from 'react-native';
import type * as NotificationsType from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { API_ENDPOINTS } from '@/constants/api';

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
export async function registerForPushNotificationsAsync(): Promise<string | null> {
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
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0284C7',
        enableLights: true,
        enableVibrate: true,
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

    // Resolve project ID if EAS is configured
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenResponse.data;
    console.log('[PUSH NOTIFICATIONS] Registered device push token:', token);

    // Persist token to user record in PostgreSQL backend
    if (token) {
      await fetch(API_ENDPOINTS.savePushToken, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      console.log('[PUSH NOTIFICATIONS] Push token synced to backend successfully.');
    }

    return token;
  } catch (error) {
    console.error('[PUSH NOTIFICATIONS] Registration error:', error);
    return null;
  }
}

export interface NotificationHandlers {
  onNotificationReceived?: (notification: NotificationsType.Notification) => void;
  onNotificationResponse?: (response: NotificationsType.NotificationResponse) => void;
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
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[PUSH NOTIFICATIONS] User tapped push notification:', response.notification.request.content);
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
