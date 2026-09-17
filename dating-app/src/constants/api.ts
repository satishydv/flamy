/**
 * Central API & Backend URL Configuration
 * 
 * When deploying to production or pointing to a VPS / custom domain:
 * Option 1 (Recommended): Set EXPO_PUBLIC_API_URL in `dating-app/.env`
 *   EXPO_PUBLIC_API_URL=https://api.yourdomain.com
 * 
 * Option 2: Change the fallback URL below directly in this single file.
 */

export const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://localhost:5001';

// In-memory token storage (persisted to localStorage on Web)
let inMemoryAuthToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  inMemoryAuthToken = token;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      window.localStorage.setItem('dating_app_auth_token', token);
    } else {
      window.localStorage.removeItem('dating_app_auth_token');
    }
  }
};

export const getAuthToken = (): string | null => {
  if (inMemoryAuthToken) return inMemoryAuthToken;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('dating_app_auth_token');
  }
  return null;
};

export const getAuthHeaders = (additionalHeaders: Record<string, string> = {}) => {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...additionalHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }
  return headers;
};

// Automatically intercept global fetch calls targeting the backend to inject Bearer token & credentials
if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
  const originalGlobalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as any)?.url;

      if (
        url &&
        (url.startsWith(BACKEND_URL) ||
          url.includes('ckinfynity.shop') ||
          url.includes('localhost:5001'))
      ) {
        const token = getAuthToken();
        let headers: any = init?.headers;

        if (token) {
          if (typeof Headers !== 'undefined' && headers instanceof Headers) {
            if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
            if (!headers.has('x-session-token')) headers.set('x-session-token', token);
          } else if (Array.isArray(headers)) {
            headers = [...headers, ['Authorization', `Bearer ${token}`], ['x-session-token', token]];
          } else {
            headers = {
              ...headers,
              Authorization: headers?.['Authorization'] || `Bearer ${token}`,
              'x-session-token': headers?.['x-session-token'] || token,
            };
          }
        }

        const updatedInit: RequestInit = {
          ...init,
          headers,
          credentials: init?.credentials || 'include',
        };
        return originalGlobalFetch(input, updatedInit);
      }
    } catch (e) {
      // fallback
    }
    return originalGlobalFetch(input, init);
  };
}

// Automatically intercept global XMLHttpRequest calls (used for multipart image uploads) to inject Bearer token
if (typeof globalThis !== 'undefined' && typeof globalThis.XMLHttpRequest === 'function') {
  const OriginalXHR = globalThis.XMLHttpRequest;
  const originalOpen = OriginalXHR.prototype.open;
  const originalSend = OriginalXHR.prototype.send;

  OriginalXHR.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    (this as any)._requestUrl = typeof url === 'string' ? url : url.toString();
    return originalOpen.apply(this, [method, url, ...rest] as any);
  };

  OriginalXHR.prototype.send = function (body?: any) {
    const targetUrl = (this as any)._requestUrl;
    if (
      targetUrl &&
      (targetUrl.startsWith(BACKEND_URL) ||
        targetUrl.includes('ckinfynity.shop') ||
        targetUrl.includes('localhost:5001'))
    ) {
      const token = getAuthToken();
      if (token) {
        try {
          this.setRequestHeader('Authorization', `Bearer ${token}`);
          this.setRequestHeader('x-session-token', token);
        } catch (e) {}
      }
      this.withCredentials = true;
    }
    return originalSend.apply(this, [body] as any);
  };
}



export const API_ENDPOINTS = {
  // Session & Social Auth
  getSession: `${BACKEND_URL}/api/auth/get-session`,
  signOut: `${BACKEND_URL}/api/auth/sign-out`,
  socialSignIn: `${BACKEND_URL}/api/auth/sign-in/social`,

  // Phone & OTP Auth
  sendOtp: `${BACKEND_URL}/api/auth/otp/send`,
  verifyOtp: `${BACKEND_URL}/api/auth/otp/verify`,
  login: `${BACKEND_URL}/api/auth/otp/login`,
  resendOtp: `${BACKEND_URL}/api/auth/otp/resend`,

  // Profile, Questionnaire & Cloudinary Image Upload
  getProfile: `${BACKEND_URL}/api/profile/me`,
  updateProfile: `${BACKEND_URL}/api/profile`,
  updateLocation: `${BACKEND_URL}/api/profile/location`,
  savePushToken: `${BACKEND_URL}/api/profile/push-token`,
  savePreferences: `${BACKEND_URL}/api/profile/preferences`,
  uploadProfilePhoto: `${BACKEND_URL}/api/profile/upload-photo`,
  deleteProfilePhoto: `${BACKEND_URL}/api/profile/photo`,

  // Multi-Photo Gallery (Max 5 photos per user)
  getGalleryPhotos: `${BACKEND_URL}/api/profile/gallery`,
  uploadGalleryPhoto: `${BACKEND_URL}/api/profile/gallery`,
  deleteGalleryPhoto: (photoId: string) => `${BACKEND_URL}/api/profile/gallery/${photoId}`,

  // Nearby Encounters & Radar Matches
  getNearbyMatches: `${BACKEND_URL}/api/matches/nearby`,
  getEncounters: `${BACKEND_URL}/api/matches/encounters`,

  // Swiping & Matching Feed
  getFeed: `${BACKEND_URL}/api/matches/feed`,
  swipe: `${BACKEND_URL}/api/matches/swipe`,
  getMyMatches: `${BACKEND_URL}/api/matches/my-matches`,
  getReceivedLikes: `${BACKEND_URL}/api/matches/received-likes`,

  // Real Messaging & Conversations
  getConversations: `${BACKEND_URL}/api/messages/conversations`,
  getChatMessages: (partnerId: string) => `${BACKEND_URL}/api/messages/${partnerId}`,
  sendMessage: (partnerId: string) => `${BACKEND_URL}/api/messages/${partnerId}`,
  checkChatPermission: (partnerId: string) => `${BACKEND_URL}/api/messages/permission/${partnerId}`,

  // Message Requests (before match)
  getMessageRequests: `${BACKEND_URL}/api/messages/requests`,
  sendMessageRequest: `${BACKEND_URL}/api/messages/requests`,
  acceptMessageRequest: (requestId: string) => `${BACKEND_URL}/api/messages/requests/${requestId}/accept`,
  declineMessageRequest: (requestId: string) => `${BACKEND_URL}/api/messages/requests/${requestId}/decline`,

  // In-App Notifications & Alerts
  getNotifications: `${BACKEND_URL}/api/notifications`,
  getUnreadNotificationsCount: `${BACKEND_URL}/api/notifications/unread-count`,
  markNotificationRead: (notificationId: string) => `${BACKEND_URL}/api/notifications/${notificationId}/read`,
  markAllNotificationsRead: `${BACKEND_URL}/api/notifications/mark-all-read`,

  // Safety, Privacy & Moderation
  unmatch: `${BACKEND_URL}/api/matches/unmatch`,
  blockUser: `${BACKEND_URL}/api/profile/block`,
  getBlockedUsers: `${BACKEND_URL}/api/profile/blocked`,
  unblockUser: (targetUserId: string) => `${BACKEND_URL}/api/profile/blocked/${targetUserId}`,
  reportUser: `${BACKEND_URL}/api/profile/report`,
  deleteAccount: `${BACKEND_URL}/api/profile/account`,
  updatePrivacySettings: `${BACKEND_URL}/api/profile/privacy`,
};


