import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Profile } from '@/types';
import { API_ENDPOINTS } from '@/constants/api';

interface LikesScreenProps {
  profiles: Profile[];
  onOpenChat: (profile: Profile) => void;
  onLikeProfile: (profile: Profile) => void;
  onBack?: () => void;
}

export const LikesScreen: React.FC<LikesScreenProps> = ({
  profiles,
  onOpenChat,
  onLikeProfile,
  onBack,
}) => {
  const [activeSegment, setActiveSegment] = useState<'likes' | 'matches'>('matches');
  const [serverMatches, setServerMatches] = useState<Profile[] | null>(null);
  const [serverLikes, setServerLikes] = useState<Profile[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchLikesAndMatches = async () => {
      try {
        setIsLoading(true);
        const [matchesRes, likesRes] = await Promise.all([
          fetch(API_ENDPOINTS.getMyMatches, { credentials: 'include' }),
          fetch(API_ENDPOINTS.getReceivedLikes, { credentials: 'include' }),
        ]);
        const matchesData = await matchesRes.json();
        const likesData = await likesRes.json();
        if (matchesData.success && Array.isArray(matchesData.matches)) {
          setServerMatches(matchesData.matches);
        }
        if (likesData.success && Array.isArray(likesData.likes)) {
          setServerLikes(likesData.likes);
        }
      } catch (e) {
        console.log('Likes/matches fetch notice:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLikesAndMatches();
  }, []);

  const matches = serverMatches || [];
  const likesYou = serverLikes || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {onBack && (
            <TouchableOpacity activeOpacity={0.7} style={styles.backButton} onPress={onBack}>
              <Ionicons name="chevron-back" size={22} color="#0F172A" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Likes & Matches</Text>
          {onBack && <View style={styles.backPlaceholder} />}
        </View>

        {/* Segmented Switcher */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeSegment === 'matches' && styles.segmentBtnActive]}
            onPress={() => setActiveSegment('matches')}
          >
            <Ionicons
              name="sparkles"
              size={14}
              color={activeSegment === 'matches' ? '#0F172A' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeSegment === 'matches' && styles.segmentBtnTextActive,
              ]}
            >
              Matches ({matches.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeSegment === 'likes' && styles.segmentBtnActive]}
            onPress={() => setActiveSegment('likes')}
          >
            <Ionicons
              name="heart"
              size={14}
              color={activeSegment === 'likes' ? '#E11D48' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeSegment === 'likes' && styles.segmentBtnTextActive,
              ]}
            >
              Likes You ({likesYou.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollList}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeSegment === 'matches' ? (
          matches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Text style={styles.emptySubtitle}>Keep exploring and swiping to find your mutual match!</Text>
            </View>
          ) : (
            <View style={styles.matchesList}>
              {matches.map((profile) => (
                <View key={profile.id} style={styles.matchCard}>
                  <Image
                    source={typeof profile.image === 'string' ? { uri: profile.image } : profile.image}
                    style={styles.matchAvatar}
                    contentFit="cover"
                  />

                  <View style={styles.matchInfo}>
                    <View style={styles.matchNameRow}>
                      <Text style={styles.matchName}>{profile.name}, {profile.age}</Text>
                      {profile.isVerified && (
                        <Ionicons name="checkmark-circle" size={16} color="#0EA5E9" />
                      )}
                    </View>
                    <Text style={styles.matchSub}>
                      Crossed paths {profile.encountersCount} times near {profile.location.split(',')[0]}
                    </Text>
                    <View style={styles.matchScoreBadge}>
                      <Text style={styles.matchScoreText}>{profile.matchPercentage}% Match</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.chatBtn}
                    onPress={() => onOpenChat(profile)}
                  >
                    <LinearGradient
                      colors={['#0EA5E9', '#0284C7']}
                      style={styles.chatBtnGrad}
                    >
                      <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
                      <Text style={styles.chatBtnLabel}>Chat</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )
        ) : (
          likesYou.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="sparkles-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No likes yet</Text>
              <Text style={styles.emptySubtitle}>Stand out by uploading photos and answering match questions!</Text>
            </View>
          ) : (
            <View style={styles.likesGrid}>
              {likesYou.map((profile) => (
                <View key={profile.id} style={styles.likeCard}>
                  <Image
                    source={typeof profile.image === 'string' ? { uri: profile.image } : profile.image}
                    style={styles.likeCardImage}
                    contentFit="cover"
                  />

                  <LinearGradient
                    colors={['transparent', 'rgba(15, 23, 42, 0.9)']}
                    style={styles.likeCardScrim}
                  >
                    <Text style={styles.likeCardName}>{profile.name}, {profile.age}</Text>
                    <Text style={styles.likeCardDistance}>📍 {profile.location.split(',')[0]}</Text>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.likeBackBtn}
                      onPress={() => onLikeProfile(profile)}
                    >
                      <Ionicons name="heart" size={14} color="#FFFFFF" />
                      <Text style={styles.likeBackBtnText}>Match Back</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingBottom: 85,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backPlaceholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  matchesList: {
    gap: 12,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  matchAvatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  matchInfo: {
    flex: 1,
  },
  matchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  matchSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  matchScoreBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  matchScoreText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
  },
  chatBtn: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  chatBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chatBtnLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  likesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  likeCard: {
    width: '48%',
    height: 230,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  likeCardImage: {
    width: '100%',
    height: '100%',
  },
  likeCardScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    alignItems: 'center',
  },
  likeCardName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  likeCardDistance: {
    color: '#CBD5E1',
    fontSize: 11,
    marginBottom: 10,
  },
  likeBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E11D48',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  likeBackBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
