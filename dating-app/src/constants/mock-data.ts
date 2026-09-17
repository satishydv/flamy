import { CategoryFilterItem, Profile } from '@/types';

export const CURRENT_USER = {
  id: '',
  name: '',
  greeting: 'Welcome,',
  avatar: null as any,
  location: '',
  unreadCount: 0,
};

export const CATEGORY_FILTERS: CategoryFilterItem[] = [
  {
    id: 'all',
    label: 'All',
    iconName: 'people',
    iconFamily: 'Ionicons',
    bgGradient: ['#6366F1', '#4F46E5'],
    iconColor: '#FFFFFF',
  },
  {
    id: 'new',
    label: 'New here',
    iconName: 'briefcase',
    iconFamily: 'Ionicons',
    bgGradient: ['#A855F7', '#7C3AED'],
    iconColor: '#FFFFFF',
  },
  {
    id: 'online',
    label: 'Online',
    iconName: 'person',
    iconFamily: 'Ionicons',
    bgGradient: ['#34D399', '#059669'],
    iconColor: '#FFFFFF',
  },
  {
    id: 'today',
    label: 'Today',
    iconName: 'calendar',
    iconFamily: 'Ionicons',
    bgGradient: ['#38BDF8', '#0284C7'],
    iconColor: '#FFFFFF',
  },
  {
    id: 'likes',
    label: 'Likes',
    iconName: 'heart',
    iconFamily: 'Ionicons',
    bgGradient: ['#FB7185', '#E11D48'],
    iconColor: '#FFFFFF',
  },
];

export const PROFILES_DATA: Profile[] = [];

export const ONBOARDING_QUESTIONS = {
  step1: {
    stepLabel: 'STEP 1 OF 5',
    title: "What's Your Dating Goal Preference?",
    highlightWord: 'Dating Goal',
    description: 'Choose your goal so we can help you connect with people who want the same thing.',
    options: [
      { id: '1', title: 'Long-Term Dating', icon: 'calendar-outline' as const, emoji: '🗓️' },
      { id: '2', title: 'Serious Relationship', icon: 'heart-outline' as const, emoji: '👥' },
      { id: '3', title: 'Casual Dating', icon: 'cafe-outline' as const, emoji: '👫' },
      { id: '4', title: 'Friendship First', icon: 'hand-left-outline' as const, emoji: '🤝' },
      { id: '5', title: 'Exploring Connections', icon: 'compass-outline' as const, emoji: '🌸' },
    ],
  },
  step2: {
    stepLabel: 'STEP 2 OF 5',
    title: 'How Would You Describe Your Personality?',
    highlightWord: 'Personality',
    description: 'Select the words that best describe your nature so we can find a complement.',
    options: [
      { id: '1', title: 'Introverted & Thoughtful', icon: 'chatbubble-ellipses-outline' as const, emoji: '💭' },
      { id: '2', title: 'Extroverted & Energetic', icon: 'sparkles-outline' as const, emoji: '🎆' },
      { id: '3', title: 'Balanced & Even-tempered', icon: 'scale-outline' as const, emoji: '⚖️' },
      { id: '4', title: 'Adventurous & Spontaneous', icon: 'map-outline' as const, emoji: '🗺️' },
      { id: '5', title: 'Cerebral & Deep Thinker', icon: 'book-outline' as const, emoji: '📚' },
    ],
  },
  step3: {
    stepLabel: 'STEP 3 OF 5',
    title: 'What Traits Do You Look For In A Partner?',
    highlightWord: 'Partner',
    description: 'Tell us what matters most to you in someone you connect with.',
    options: [
      { id: '1', title: 'Emotional Intelligence & Empathy', icon: 'heart-half-outline' as const, emoji: '💖' },
      { id: '2', title: 'Great Sense of Humor', icon: 'happy-outline' as const, emoji: '😂' },
      { id: '3', title: 'Ambition & Drive', icon: 'rocket-outline' as const, emoji: '🚀' },
      { id: '4', title: 'Creativity & Open-Mindedness', icon: 'color-palette-outline' as const, emoji: '🎨' },
      { id: '5', title: 'Loyalty & Dependability', icon: 'shield-checkmark-outline' as const, emoji: '🧘' },
    ],
  },
  step4: {
    stepLabel: 'STEP 4 OF 5',
    title: 'What Kind Of Music Do You Prefer?',
    highlightWord: 'Music',
    description: 'Music connects souls—find matches who vibe to your soundtrack.',
    options: [
      { id: '1', title: 'Indie Rock & Alternative', icon: 'musical-notes-outline' as const, emoji: '🎸' },
      { id: '2', title: 'Electronic, House & Techno', icon: 'headset-outline' as const, emoji: '🎧' },
      { id: '3', title: 'R&B, Soul & Jazz', icon: 'radio-outline' as const, emoji: '🎷' },
      { id: '4', title: 'Pop, Hip-Hop & Rap', icon: 'mic-outline' as const, emoji: '🎤' },
      { id: '5', title: 'Classical, Acoustic & Ambient', icon: 'musical-note-outline' as const, emoji: '🎻' },
    ],
  },
  step5: {
    stepLabel: 'STEP 5 OF 5',
    title: 'What Are Your Biggest Relationship Deal-Breakers?',
    highlightWord: 'Relationship Deal-Breakers',
    description: 'Select your core deal-breakers so we can prioritize your needs.',
    options: [
      { id: '1', title: 'Dishonesty & Lack of Trust', icon: 'heart-dislike-outline' as const, emoji: '🤞💔' },
      { id: '2', title: 'Values Mismatch', icon: 'shuffle-outline' as const, emoji: '🗯️' },
      { id: '3', title: 'Lack of Respect', icon: 'shield-outline' as const, emoji: '🤝' },
      { id: '4', title: 'Different Life Goals', icon: 'time-outline' as const, emoji: '⏰' },
      { id: '5', title: 'Communication Issues', icon: 'chatbubbles-outline' as const, emoji: '💬' },
    ],
  },
};

export function calculateMatchCompatibility(
  userPrefs: {
    datingGoal: string;
    personality: string;
    partnerTraits: string;
    musicPreference: string;
    dealBreakers: string;
  },
  profiles: Profile[]
): Profile[] {
  return profiles
    .map((profile) => {
      let score = 74;
      let reasons: string[] = [];

      // 1. Goal alignment (+12%)
      if (profile.datingGoal && userPrefs.datingGoal) {
        if (profile.datingGoal.toLowerCase() === userPrefs.datingGoal.toLowerCase()) {
          score += 12;
          reasons.push(`Shared Goal: ${profile.datingGoal}`);
        } else if (
          (profile.datingGoal.includes('Dating') && userPrefs.datingGoal.includes('Dating')) ||
          (profile.datingGoal.includes('Relationship') && userPrefs.datingGoal.includes('Relationship'))
        ) {
          score += 6;
        }
      }

      // 2. Personality chemistry (+8%)
      if (profile.personality && userPrefs.personality) {
        if (profile.personality.toLowerCase() === userPrefs.personality.toLowerCase()) {
          score += 8;
          reasons.push('Same Vibe');
        } else {
          const complements: Record<string, string[]> = {
            'Introverted & Thoughtful': ['Extroverted & Energetic', 'Cerebral & Deep Thinker', 'Balanced & Even-tempered'],
            'Extroverted & Energetic': ['Introverted & Thoughtful', 'Adventurous & Spontaneous'],
            'Balanced & Even-tempered': ['Introverted & Thoughtful', 'Extroverted & Energetic', 'Adventurous & Spontaneous'],
            'Adventurous & Spontaneous': ['Extroverted & Energetic', 'Balanced & Even-tempered'],
            'Cerebral & Deep Thinker': ['Introverted & Thoughtful', 'Balanced & Even-tempered'],
          };
          if (complements[userPrefs.personality]?.includes(profile.personality)) {
            score += 7;
            reasons.push('Complementary Energy');
          }
        }
      }

      // 3. Partner traits alignment (+8%)
      if (profile.partnerTraits && userPrefs.partnerTraits) {
        if (profile.partnerTraits.toLowerCase() === userPrefs.partnerTraits.toLowerCase()) {
          score += 8;
          reasons.push(`Top Trait: ${profile.partnerTraits.split('&')[0].trim()}`);
        }
      }

      // 4. Music synergy (+6%)
      if (profile.musicPreference && userPrefs.musicPreference) {
        if (profile.musicPreference.toLowerCase() === userPrefs.musicPreference.toLowerCase()) {
          score += 6;
          reasons.push(`Music match: ${profile.musicPreference.split('&')[0].trim()}`);
        }
      }

      // 5. Deal breaker compliance (+4%)
      if (profile.dealBreakers && userPrefs.dealBreakers) {
        if (profile.dealBreakers.toLowerCase() === userPrefs.dealBreakers.toLowerCase()) {
          score += 4;
          reasons.push('Mutual Boundaries');
        }
      }

      const finalMatch = Math.min(99, Math.max(76, score));
      const mainReason = reasons.length > 0 ? reasons[0] : `${finalMatch}% Synergy`;

      return {
        ...profile,
        matchPercentage: finalMatch,
        compatibilityReason: mainReason,
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
}

export const INITIAL_CHAT_MESSAGES: any[] = [];
