export interface Profile {
  id: string;
  name: string;
  age: number;
  isVerified: boolean;
  jobTitle: string;
  location: string;
  distance: string;
  encountersCount: number;
  lastCrossed: string;
  matchPercentage: number;
  bio: string;
  tags: string[];
  image: string;
  additionalImages?: string[];
  isNew?: boolean;
  mapCoordinates: {
    x: number; // percentage in radar circle
    y: number; // percentage in radar circle
  };
  photos?: ProfilePhoto[];
  category: 'all' | 'new' | 'online' | 'today' | 'favored' | 'likes';
  online?: boolean;
  liked?: boolean;
  superLiked?: boolean;
  datingGoal?: string;
  personality?: string;
  partnerTraits?: string;
  musicPreference?: string;
  dealBreakers?: string;
  compatibilityReason?: string;
  gender?: string;
  lookingFor?: string[];
  dob?: string;
  latitude?: number;
  longitude?: number;
  isGhostMode?: boolean;
  isIncognito?: boolean;
}

export interface ProfilePhoto {
  id: string;
  userId: string;
  url: string;
  publicId: string;
  order: number;
  createdAt?: string;
}

export interface OnboardingBasics {
  name: string;
  dob: string; // YYYY-MM-DD
  gender: string;
  lookingFor: string[];
  location: string;
  latitude?: number;
  longitude?: number;
}

export interface UserPreferences {
  datingGoal: string;
  personality: string;
  partnerTraits: string;
  musicPreference: string;
  dealBreakers: string;
}

export interface CategoryFilterItem {
  id: string;
  label: string;
  iconName: string;
  iconFamily: 'Ionicons' | 'MaterialCommunityIcons' | 'Feather' | 'FontAwesome5';
  bgGradient: [string, string];
  iconColor: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isMine: boolean;
  read?: boolean;
}

export interface MessageRequestItem {
  id: string;
  senderId: string;
  message: string;
  createdAt: string;
  timestamp: string;
  sender: Profile;
}

export interface ConversationItem {
  profileId: string;
  partner: Profile;
  lastMessage: string;
  lastMessageAt: string;
  timestamp: string;
  unreadCount: number;
  isMatch: boolean;
}

export type TabType = 'home' | 'explore' | 'map' | 'likes' | 'messages' | 'profile';

export interface BlockedUser {
  id: string;
  name: string;
  image: string | null;
  blockedAt: string;
  reason?: string | null;
}

export type ReportCategory =
  | 'Harassment'
  | 'Fake Profile'
  | 'Inappropriate Photos'
  | 'Spam & Scams'
  | 'Hate Speech & Threats'
  | 'Underage / Safety Concern'
  | 'Other';

