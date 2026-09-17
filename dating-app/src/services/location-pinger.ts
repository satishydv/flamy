import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { API_ENDPOINTS } from '@/constants/api';

let pingerInterval: any = null;
let appStateSubscription: any = null;
let isPinging = false;

/**
 * Resolve human-readable neighborhood/city from coordinates
 */
async function reverseGeocodeLocation(latitude: number, longitude: number): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        const neighborhood =
          data.address?.suburb ||
          data.address?.neighbourhood ||
          data.address?.city ||
          data.address?.town ||
          data.address?.county;
        const city = data.address?.city || data.address?.state || '';
        if (neighborhood && city && neighborhood !== city) {
          return `${neighborhood}, ${city}`;
        }
        return neighborhood || city || 'Nearby';
      } catch {
        return 'Nearby';
      }
    }

    // Native Reverse Geocoding
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const geo = results[0];
      const neighborhood = geo.district || geo.subregion || geo.name || geo.street;
      const city = geo.city || geo.region || '';
      if (neighborhood && city && neighborhood !== city) {
        return `${neighborhood}, ${city}`;
      }
      return neighborhood || city || 'Nearby';
    }
  } catch (err) {
    console.log('[LOCATION PINGER] Reverse geocode notice:', err);
  }
  return 'Nearby';
}

/**
 * Send current GPS coordinates to backend /api/profile/location
 */
export async function pingLocationNow(): Promise<boolean> {
  if (isPinging) return false;
  isPinging = true;

  try {
    let lat: number | null = null;
    let lon: number | null = null;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lon = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 8000, enableHighAccuracy: false }
          );
        });
      }
    } else {
      const { status } = await Location.getForegroundPermissionsAsync();
      let granted = status === 'granted';

      if (!granted) {
        const req = await Location.requestForegroundPermissionsAsync();
        granted = req.status === 'granted';
      }

      if (granted) {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }
    }

    if (lat !== null && lon !== null) {
      const locationName = await reverseGeocodeLocation(lat, lon);

      const response = await fetch(API_ENDPOINTS.updateLocation, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lon,
          location: locationName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.encountersTriggered && data.encountersTriggered > 0) {
          console.log(`[LOCATION PINGER] Crossed paths with ${data.encountersTriggered} user(s)!`);
        }
        return true;
      }
    }
  } catch (error) {
    console.log('[LOCATION PINGER] Background ping notice:', error);
  } finally {
    isPinging = false;
  }
  return false;
}

/**
 * Start periodic GPS location pings (every 60s while active)
 * and whenever app transitions back to foreground
 */
export function startLocationPinger(intervalMs: number = 60000) {
  stopLocationPinger();

  // Perform immediate ping on start
  pingLocationNow();

  // Schedule periodic pings
  pingerInterval = setInterval(() => {
    pingLocationNow();
  }, intervalMs);

  // Ping immediately when coming to foreground
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      pingLocationNow();
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

/**
 * Stop background GPS location pinger
 */
export function stopLocationPinger() {
  if (pingerInterval) {
    clearInterval(pingerInterval);
    pingerInterval = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}
