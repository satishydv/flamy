import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Profile, TabType, UserPreferences, OnboardingBasics } from '@/types';
import { calculateMatchCompatibility } from '@/constants/mock-data';
import { WelcomeScreen } from '@/components/screens/welcome-screen';
import { MatchQuestionsScreen } from '@/components/screens/match-questions-screen';
import { HomeScreen } from '@/components/screens/home-screen';
import { MapScreen } from '@/components/screens/map-screen';
import { ExploreScreen } from '@/components/screens/explore-screen';
import { LikesScreen } from '@/components/screens/likes-screen';
import { ProfileScreen } from '@/components/screens/profile-screen';
import { CustomTabBar } from '@/components/custom-tab-bar';
import { MatchModal } from '@/components/match-modal';
import { ChatModal } from '@/components/chat-modal';
import { MessageRequestModal } from '@/components/message-request-modal';
import { IncomingCallModal } from '@/components/incoming-call-modal';
import { AuthScreen } from '@/components/screens/auth-screen';
import { NotificationsScreen } from '@/components/screens/notifications-screen';
import { MessagesScreen } from '@/components/screens/messages-screen';
import { API_ENDPOINTS, getAuthHeaders, setAuthToken, getAuthToken } from '@/constants/api';
import { connectSocket, disconnectSocket, getSocket, IncomingCallData } from '@/services/socket';
import { startLocationPinger, stopLocationPinger } from '@/services/location-pinger';
import { registerForPushNotificationsAsync, setupNotificationListeners } from '@/services/push-notifications';

export interface AuthUser {
  id?: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  image?: string | null;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [onboardingFlow, setOnboardingFlow] = useState<'welcome' | 'questions' | null>('welcome');
  const [isAuthScreen, setIsAuthScreen] = useState<boolean>(false);
  const [isNotificationsScreen, setIsNotificationsScreen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Profile | null>(null);
  const [activeChatProfile, setActiveChatProfile] = useState<Profile | null>(null);
  const [activeRequestProfile, setActiveRequestProfile] = useState<Profile | null>(null);
  const [activeCallType, setActiveCallType] = useState<'none' | 'audio' | 'video'>('none');
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isIncomingCallAccepted, setIsIncomingCallAccepted] = useState<boolean>(false);
  const [acceptedCallId, setAcceptedCallId] = useState<string>('');
  const [likesCount, setLikesCount] = useState<number>(0);
  const [matchesCount, setMatchesCount] = useState<number>(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    datingGoal: 'Long-Term Dating',
    personality: 'Extroverted & Energetic',
    partnerTraits: 'Great Sense of Humor',
    musicPreference: 'Indie Rock & Alternative',
    dealBreakers: 'Dishonesty & Lack of Trust',
  });

  // Fetch real candidate feed excluding already swiped profiles
  const fetchFeed = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.getFeed, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      console.log('[APP] Feed API response count:', data?.count, 'feed length:', data?.feed?.length);
      if (data.success && Array.isArray(data.feed)) {
        setProfiles(data.feed);
      } else {
        setProfiles([]);
      }
    } catch (err) {
      console.log('Feed fetch notice:', err);
    }
  };

  // Fetch real counts for likes, matches, and unread notifications
  const fetchCounts = async () => {
    try {
      const [likesRes, matchesRes, notifsRes] = await Promise.all([
        fetch(API_ENDPOINTS.getReceivedLikes, { credentials: 'include', headers: getAuthHeaders() }).catch(() => null),
        fetch(API_ENDPOINTS.getMyMatches, { credentials: 'include', headers: getAuthHeaders() }).catch(() => null),
        fetch(API_ENDPOINTS.getUnreadNotificationsCount, { credentials: 'include', headers: getAuthHeaders() }).catch(() => null),
      ]);
      const likesData = likesRes ? await likesRes.json().catch(() => null) : null;
      const matchesData = matchesRes ? await matchesRes.json().catch(() => null) : null;
      const notifsData = notifsRes ? await notifsRes.json().catch(() => null) : null;
      if (likesData?.success && typeof likesData.count === 'number') {
        setLikesCount(likesData.count);
      }
      if (matchesData?.success && typeof matchesData.count === 'number') {
        setMatchesCount(matchesData.count);
      }
      if (notifsData?.success && typeof notifsData.count === 'number') {
        setUnreadNotificationsCount(notifsData.count);
      }
    } catch (e) {
      // offline notice
    }
  };

  // Load session from backend and hydrate profile & preferences
  const checkSession = async (explicitToken?: string | null): Promise<AuthUser | null> => {
    try {
      if (explicitToken) {
        setAuthToken(explicitToken);
      }
      const res = await fetch(API_ENDPOINTS.getSession, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data?.user) {
        const user: AuthUser = {
          id: data.user.id,
          name: data.user.name || 'User',
          email: data.user.email,
          phoneNumber: data.user.phoneNumber,
          image: data.user.image,
        };

        // Also fetch saved profile & matchmaking preferences from backend
        try {
          const profileRes = await fetch(API_ENDPOINTS.getProfile, {
            credentials: 'include',
            headers: getAuthHeaders(),
          });
          const profileData = await profileRes.json();
          if (profileData?.success) {
            if (profileData.user?.image) {
              user.image = profileData.user.image;
            }
            if (profileData.preference) {
              setUserPreferences((prev) => ({
                datingGoal: profileData.preference.datingGoal || prev.datingGoal,
                personality: profileData.preference.personality || prev.personality,
                partnerTraits: profileData.preference.partnerTraits || prev.partnerTraits,
                musicPreference: profileData.preference.musicPreference || prev.musicPreference,
                dealBreakers: profileData.preference.dealBreakers || prev.dealBreakers,
              }));
            }
          }
        } catch (pErr) {
          console.log('Profile hydration notice:', pErr);
        }

        setCurrentUser(user);
        fetchFeed();
        fetchCounts();
        return user;
      }
    } catch (e) {
      console.log('Session check: backend offline or unauthenticated');
    }
    return null;
  };

  // Handle OAuth callback flow (e.g. ?flow=signup or ?flow=login from BetterAuth)
  useEffect(() => {
    let tokenFromUrl: string | null = null;
    let flowFromUrl: string | null = null;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const authError = urlParams.get('auth_error') || urlParams.get('error');
      if (authError) {
        window.history.replaceState({}, document.title, window.location.pathname);
        alert('Authentication failed or was cancelled. Please try again.');
        return;
      }
      flowFromUrl = urlParams.get('flow');
      tokenFromUrl = urlParams.get('token');
      if (tokenFromUrl) {
        setAuthToken(tokenFromUrl);
      }
      if (flowFromUrl) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    // Check initial active session with the extracted or stored token
    checkSession(tokenFromUrl).then((user) => {
      if (user) {
        setIsAuthScreen(false);
        if (flowFromUrl === 'signup') {
          setOnboardingFlow('questions');
        } else if (flowFromUrl === 'login') {
          setOnboardingFlow(null);
          setActiveTab('home');
        }
        fetchFeed();
        fetchCounts();
      } else {
        if (flowFromUrl) {
          setIsAuthScreen(true);
        }
      }
    });
  }, []);

  // Connect Socket.IO when currentUser is active and listen for incoming calls globally
  useEffect(() => {
    if (currentUser?.id) {
      const socket = connectSocket(currentUser.id);

      // Start periodic GPS location pings (every 60s & on foreground)
      startLocationPinger(60000);

      // Register for OS-level push notifications and save expoPushToken to DB
      registerForPushNotificationsAsync();

      // Listen for lockscreen/system notification taps
      const removeNotificationListeners = setupNotificationListeners({
        onNotificationResponse: (response) => {
          const data = response.notification.request.content.data;
          if (data?.type === 'match' || data?.type === 'message') {
            const partnerId = data.partnerId || data.profileId;
            if (partnerId) {
              const target = profiles.find((p) => p.id === partnerId);
              if (target) {
                setActiveChatProfile(target);
              }
            }
          } else if (data?.type === 'crossed' || data?.type === 'request') {
            setIsNotificationsScreen(true);
          }
        },
      });

      const handleIncomingCall = (callData: IncomingCallData) => {
        console.log('[APP] Incoming call event received:', callData);
        setIncomingCall(callData);
      };

      const handleIncomingNotification = (notifData?: any) => {
        setUnreadNotificationsCount((prev) => prev + 1);
        if (notifData?.type === 'crossed') {
          fetchCounts();
        }
      };

      socket.on('call:incoming', handleIncomingCall);
      socket.on('notification:new', handleIncomingNotification);

      return () => {
        socket.off('call:incoming', handleIncomingCall);
        socket.off('notification:new', handleIncomingNotification);
        removeNotificationListeners();
        stopLocationPinger();
      };
    } else {
      disconnectSocket();
      stopLocationPinger();
    }
  }, [currentUser?.id]);

  const handleAcceptIncomingCall = (callType: 'audio' | 'video', callId: string) => {
    if (!incomingCall) return;

    const existing = profiles.find((p) => p.id === incomingCall.fromUserId);
    const callerProfile: Profile = existing || {
      id: incomingCall.fromUserId,
      name: incomingCall.callerInfo?.name || 'Your Match',
      age: 24,
      image: incomingCall.callerInfo?.image || '',
      location: incomingCall.callerInfo?.location || 'Mutual Match',
      distance: 'Nearby',
      bio: '',
      jobTitle: '',
      isVerified: true,
      tags: [],
      matchPercentage: 95,
      encountersCount: 1,
      lastCrossed: 'Just now',
      mapCoordinates: { x: 50, y: 50 },
      category: 'online',
    };

    setIncomingCall(null);
    setIsIncomingCallAccepted(true);
    setAcceptedCallId(callId);
    setActiveChatProfile(callerProfile);
    setActiveCallType(callType);
  };

  const handleDeclineIncomingCall = (callId: string) => {
    if (!incomingCall) return;
    const socket = getSocket();
    socket?.emit('call:reject', {
      toUserId: incomingCall.fromUserId,
      callId,
      reason: 'declined',
    });
    setIncomingCall(null);
  };

  const handleLogout = async () => {
    disconnectSocket();
    stopLocationPinger();
    setAuthToken(null);
    try {
      await fetch(API_ENDPOINTS.signOut, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.warn('Sign-out error:', e);
    }
    setCurrentUser(null);
    setIsAuthScreen(false);
    setOnboardingFlow('welcome');
    setActiveTab('home');
  };

  const handleLike = async (profile: Profile) => {
    // Optimistically mark as liked in local state
    setProfiles((prev) =>
      prev.map((p) => (p.id === profile.id ? { ...p, liked: true } : p))
    );

    try {
      const res = await fetch(API_ENDPOINTS.swipe, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.id, action: 'like' }),
      });
      const data = await res.json();
      if (data.success && data.isMatch) {
        // Mutual match detected!
        setSelectedMatch({
          ...profile,
          name: data.matchedUser?.name || profile.name,
          age: data.matchedUser?.age || profile.age,
          image: data.matchedUser?.image || profile.image,
          location: data.matchedUser?.location || profile.location,
          bio: data.matchedUser?.bio || profile.bio,
          jobTitle: data.matchedUser?.jobTitle || profile.jobTitle,
        });
        fetchCounts();
      }
    } catch (err) {
      console.warn('Swipe error:', err);
      if (profile.matchPercentage > 85) {
        setSelectedMatch(profile);
      }
    }
  };

  const handleUnlike = async (profile: Profile) => {
    // Optimistically revert liked and superLiked state
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profile.id ? { ...p, liked: false, superLiked: false } : p
      )
    );

    try {
      await fetch(API_ENDPOINTS.swipe, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.id, action: 'unlike' }),
      });
    } catch (err) {
      console.warn('Unlike error:', err);
    }
  };

  const handleSuperLike = async (profile: Profile) => {
    // Optimistically mark as superLiked and liked
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profile.id ? { ...p, liked: true, superLiked: true } : p
      )
    );

    try {
      const res = await fetch(API_ENDPOINTS.swipe, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.id, action: 'superlike' }),
      });
      const data = await res.json();
      if (data.success && data.isMatch) {
        setSelectedMatch({
          ...profile,
          name: data.matchedUser?.name || profile.name,
          age: data.matchedUser?.age || profile.age,
          image: data.matchedUser?.image || profile.image,
          location: data.matchedUser?.location || profile.location,
          bio: data.matchedUser?.bio || profile.bio,
          jobTitle: data.matchedUser?.jobTitle || profile.jobTitle,
        });
        fetchCounts();
      }
    } catch (err) {
      console.warn('Super Like error:', err);
    }
  };

  const handlePass = async (profile: Profile) => {
    try {
      await fetch(API_ENDPOINTS.swipe, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.id, action: 'pass' }),
      });
    } catch (err) {
      console.warn('Pass error:', err);
    }
  };

  const handleOpenChat = (profile: Profile, callType: 'none' | 'audio' | 'video' = 'none') => {
    setActiveChatProfile(profile);
    setActiveCallType(callType);
  };

  const handleCompleteQuestions = async (
    preferences: UserPreferences,
    basics?: OnboardingBasics
  ) => {
    setUserPreferences(preferences);
    const updatedProfiles = calculateMatchCompatibility(preferences, profiles);
    setProfiles(updatedProfiles);
    setOnboardingFlow(null);
    setActiveTab('home');

    // 1. Persist basics (Name, DOB, Gender, Looking For, Location, Coordinates)
    if (basics) {
      if (basics.name && currentUser) {
        setCurrentUser((prev) => (prev ? { ...prev, name: basics.name } : prev));
      }
      try {
        await fetch(API_ENDPOINTS.updateProfile, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basics),
        });
      } catch (bErr) {
        console.warn('Basics persistence error:', bErr);
      }
    }

    // 2. Persist questionnaire answers to backend PostgreSQL
    try {
      await fetch(API_ENDPOINTS.savePreferences, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
    } catch (err) {
      console.warn('Preferences persistence error:', err);
    }

    // Refresh candidate feed and radar based on new preferences and location
    fetchFeed();
    fetchCounts();
  };

  // If in Auth Screen flow (Login / Sign up)
  if (isAuthScreen) {
    return (
      <View style={styles.rootContainer}>
        <AuthScreen
          onBack={() => setIsAuthScreen(false)}
          onLoginSuccess={(user) => {
            if (user) setCurrentUser(user);
            setIsAuthScreen(false);
            setOnboardingFlow(null);
            setActiveTab('home');
          }}
          onSignUpSuccess={(user) => {
            if (user) setCurrentUser(user);
            setIsAuthScreen(false);
            setOnboardingFlow('questions');
          }}
        />
      </View>
    );
  }

  // If in Welcome screen flow
  if (onboardingFlow === 'welcome') {
    return (
      <View style={styles.rootContainer}>
        <WelcomeScreen onGetStarted={() => setIsAuthScreen(true)} />
      </View>
    );
  }

  // If in Matchmaking Questions flow (6 Steps total)
  if (onboardingFlow === 'questions') {
    return (
      <View style={styles.rootContainer}>
        <MatchQuestionsScreen
          onBackToWelcome={() => {
            setOnboardingFlow('welcome');
            setIsAuthScreen(true);
          }}
          onComplete={handleCompleteQuestions}
          onSkip={() => setOnboardingFlow(null)}
          initialPreferences={userPreferences}
          initialBasics={{
            name: currentUser?.name || '',
          }}
        />
      </View>
    );
  }

  // If in Notifications Screen flow
  if (isNotificationsScreen) {
    return (
      <View style={styles.rootContainer}>
        <NotificationsScreen
          onBack={() => {
            setIsNotificationsScreen(false);
            fetchCounts();
          }}
          profiles={profiles}
          onOpenChat={(profile) => {
            setIsNotificationsScreen(false);
            fetchCounts();
            setActiveChatProfile(profile);
          }}
          onSelectProfile={(profile) => {
            setIsNotificationsScreen(false);
            fetchCounts();
            setActiveChatProfile(profile);
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.rootContainer}>
      <View style={styles.contentContainer}>
        {activeTab === 'home' && (
          <HomeScreen
            currentUser={currentUser}
            profiles={profiles}
            onOpenMap={() => setActiveTab('map')}
            onOpenNotifications={() => setIsNotificationsScreen(true)}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenLikes={() => setActiveTab('likes')}
            likesCount={likesCount}
            onLikeProfile={handleLike}
            onSuperLikeProfile={handleSuperLike}
            onUnlikeProfile={handleUnlike}
            onOpenChat={handleOpenChat}
            onOpenMessageRequest={(profile) => setActiveRequestProfile(profile)}
            onPassProfile={handlePass}
            onRefresh={fetchFeed}
          />
        )}

        {activeTab === 'explore' && (
          <ExploreScreen
            profiles={profiles}
            onSelectProfile={handleOpenChat}
            onLikeProfile={handleLike}
          />
        )}

        {activeTab === 'map' && (
          <MapScreen
            profiles={profiles}
            onBack={() => setActiveTab('home')}
            onLikeProfile={handleLike}
            onUnlikeProfile={handleUnlike}
            onOpenChat={handleOpenChat}
          />
        )}

        {activeTab === 'likes' && (
          <LikesScreen
            profiles={profiles}
            onOpenChat={handleOpenChat}
            onLikeProfile={handleLike}
            onBack={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'messages' && (
          <MessagesScreen
            profiles={profiles}
            onOpenChat={handleOpenChat}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            currentUser={currentUser}
            onLogout={handleLogout}
            userPreferences={userPreferences}
            matchesCount={matchesCount}
            likesCount={likesCount}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onShowWelcomeScreen={() => setOnboardingFlow('welcome')}
            onRetakeQuestions={() => setOnboardingFlow('questions')}
            onShowAuthScreen={() => setIsAuthScreen(true)}
            onOpenNotifications={() => setIsNotificationsScreen(true)}
          />
        )}
      </View>

      {/* Floating 5-Tab Navigation Bar with Center Glowing Orb */}
      <CustomTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        likesCount={likesCount}
        messagesCount={matchesCount}
      />

      {/* "It's a Match!" Celebration Overlay */}
      <MatchModal
        visible={!!selectedMatch}
        profile={selectedMatch}
        currentUserImage={currentUser?.image}
        onClose={() => setSelectedMatch(null)}
        onSendMessage={(profile) => {
          setSelectedMatch(null);
          setActiveChatProfile(profile);
        }}
      />

      {/* Before-Match Message Request Modal */}
      <MessageRequestModal
        visible={!!activeRequestProfile}
        profile={activeRequestProfile}
        onClose={() => setActiveRequestProfile(null)}
        onRequestSent={() => {
          fetchCounts();
          fetchFeed();
        }}
      />

      {/* In-app Chat Dialog */}
      <ChatModal
        visible={!!activeChatProfile}
        profile={activeChatProfile}
        initialCallType={activeCallType}
        isIncomingCallAccepted={isIncomingCallAccepted}
        incomingCallId={acceptedCallId}
        currentUser={currentUser}
        onClose={() => {
          setActiveChatProfile(null);
          setActiveCallType('none');
          setIsIncomingCallAccepted(false);
          setAcceptedCallId('');
          fetchCounts();
        }}
        onUnmatched={() => {
          setActiveChatProfile(null);
          setActiveCallType('none');
          setIsIncomingCallAccepted(false);
          setAcceptedCallId('');
          fetchFeed();
          fetchCounts();
        }}
      />

      {/* Global Incoming Call Ringing Overlay */}
      <IncomingCallModal
        visible={!!incomingCall}
        caller={incomingCall ? {
          id: incomingCall.fromUserId,
          name: incomingCall.callerInfo?.name,
          image: incomingCall.callerInfo?.image,
          location: incomingCall.callerInfo?.location,
        } : null}
        callType={incomingCall?.type || 'audio'}
        callId={incomingCall?.callId || ''}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F9FF',
    ...Platform.select({
      web: {
        maxWidth: 480,
        width: '100%',
        marginHorizontal: 'auto',
        height: '100%',
        boxShadow: '0 0 40px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden',
      },
    }),
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
