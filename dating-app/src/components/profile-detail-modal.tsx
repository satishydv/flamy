import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Profile } from '@/types';
import { API_ENDPOINTS, getAuthHeaders } from '@/constants/api';
import { ReportModal } from './report-modal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_HEIGHT = Math.min(SCREEN_WIDTH * 1.15, 480);

interface ProfileDetailModalProps {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onLikeProfile?: (profile: Profile) => void;
  onSuperLikeProfile?: (profile: Profile) => void;
  onUnlikeProfile?: (profile: Profile) => void;
  onOpenChat?: (profile: Profile) => void;
  onOpenMessageRequest?: (profile: Profile) => void;
  onBlockUser?: (profile: Profile) => void;
}

export const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({
  visible,
  profile,
  onClose,
  onLikeProfile,
  onSuperLikeProfile,
  onUnlikeProfile,
  onOpenChat,
  onOpenMessageRequest,
  onBlockUser,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [fullProfile, setFullProfile] = useState<Profile | null>(profile);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLiked, setIsLiked] = useState(Boolean(profile?.liked));
  const [isSuperLiked, setIsSuperLiked] = useState(Boolean(profile?.superLiked));
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Sync profile prop when opened
  useEffect(() => {
    if (profile) {
      setFullProfile(profile);
      setIsLiked(Boolean(profile.liked));
      setIsSuperLiked(Boolean(profile.superLiked));
      setActivePhotoIndex(0);
      loadEnrichedProfile(profile);
    }
  }, [profile, visible]);

  // Attempt to load full profile details from backend
  const loadEnrichedProfile = async (target: Profile) => {
    try {
      setIsLoadingDetails(true);

      // 1. Try dedicated public profile endpoint by ID
      if (target.id) {
        const userRes = await fetch(API_ENDPOINTS.getUserProfile(target.id), {
          credentials: 'include',
          headers: getAuthHeaders(),
        }).catch(() => null);

        if (userRes && userRes.ok) {
          const userData = await userRes.json();
          if (userData.success && userData.profile) {
            setFullProfile((prev) => ({
              ...target,
              ...userData.profile,
              liked: prev?.liked ?? userData.profile.liked,
              superLiked: prev?.superLiked ?? userData.profile.superLiked,
            }));
            return;
          }
        }
      }

      // 2. Fallback: Check nearby matches cache
      const res = await fetch(`${API_ENDPOINTS.getNearbyMatches}?category=all`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.profiles)) {
          const found = data.profiles.find((p: any) => p.id === target.id);
          if (found) {
            setFullProfile((prev) => ({
              ...target,
              ...found,
              liked: prev?.liked ?? found.liked,
              superLiked: prev?.superLiked ?? found.superLiked,
            }));
            return;
          }
        }
      }
    } catch (e) {
      // Keep existing profile
    } finally {
      setIsLoadingDetails(false);
    }
  };

  if (!fullProfile) return null;

  // Gather all available photos
  const allPhotos: string[] = [];
  if (fullProfile.image) allPhotos.push(fullProfile.image);
  if (Array.isArray(fullProfile.photos)) {
    fullProfile.photos.forEach((p) => {
      if (p.url && !allPhotos.includes(p.url)) allPhotos.push(p.url);
    });
  }
  if (Array.isArray(fullProfile.additionalImages)) {
    fullProfile.additionalImages.forEach((url) => {
      if (url && !allPhotos.includes(url)) allPhotos.push(url);
    });
  }
  if (allPhotos.length === 0 && fullProfile.image) {
    allPhotos.push(fullProfile.image);
  }

  const currentPhotoUrl = allPhotos[activePhotoIndex] || fullProfile.image;

  const handleNextPhoto = () => {
    if (allPhotos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev < allPhotos.length - 1 ? prev + 1 : 0));
  };

  const handlePrevPhoto = () => {
    if (allPhotos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : allPhotos.length - 1));
  };

  const handleToggleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      if (onUnlikeProfile) {
        onUnlikeProfile(fullProfile);
      } else if (onLikeProfile) {
        onLikeProfile({ ...fullProfile, liked: false });
      }
    } else {
      setIsLiked(true);
      if (onLikeProfile) {
        onLikeProfile({ ...fullProfile, liked: true });
      }
    }
  };

  const handleSuperLikePress = () => {
    if (isSuperLiked) {
      Alert.alert('Super Liked ⚡', `You have already sent a Super Like to ${fullProfile.name}!`);
      return;
    }
    setIsSuperLiked(true);
    setIsLiked(true);
    if (onSuperLikeProfile) {
      onSuperLikeProfile(fullProfile);
    } else if (onLikeProfile) {
      onLikeProfile({ ...fullProfile, liked: true, superLiked: true });
    }
    Alert.alert('Super Like! ⚡', `You sent a Super Like to ${fullProfile.name}!`);
  };

  const handleBlockAction = async () => {
    setShowOptionsMenu(false);
    Alert.alert(
      'Block Profile',
      `Are you sure you want to block ${fullProfile.name}? You won't see each other or be able to message.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(API_ENDPOINTS.blockUser, {
                method: 'POST',
                credentials: 'include',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ targetUserId: fullProfile.id }),
              });
              if (onBlockUser) onBlockUser(fullProfile);
              onClose();
              Alert.alert('User Blocked', `${fullProfile.name} has been blocked.`);
            } catch (e) {
              Alert.alert('Notice', 'Failed to block user.');
            }
          },
        },
      ]
    );
  };

  const tags = fullProfile.tags && fullProfile.tags.length > 0
    ? fullProfile.tags
    : ['Coffee', 'Art', 'Travel', 'Music'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Hero Photo Carousel */}
          <View style={styles.heroWrapper}>
            {currentPhotoUrl ? (
              <Image
                source={{ uri: currentPhotoUrl }}
                style={styles.heroImage}
                contentFit="cover"
                priority="high"
              />
            ) : (
              <LinearGradient
                colors={['#0284C7', '#0369A1']}
                style={[styles.heroImage, styles.fallbackHero]}
              >
                <Text style={styles.fallbackHeroText}>
                  {fullProfile.name ? fullProfile.name.slice(0, 2).toUpperCase() : '??'}
                </Text>
              </LinearGradient>
            )}

            {/* Tap areas for photo cycling */}
            {allPhotos.length > 1 && (
              <View style={styles.tapContainer} pointerEvents="box-none">
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.tapLeft}
                  onPress={handlePrevPhoto}
                />
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.tapRight}
                  onPress={handleNextPhoto}
                />
              </View>
            )}

            {/* Multi-Photo Pagination Dashes */}
            {allPhotos.length > 1 && (
              <View style={styles.paginationBar}>
                {allPhotos.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.paginationDash,
                      idx === activePhotoIndex
                        ? styles.paginationDashActive
                        : styles.paginationDashInactive,
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Floating Top Nav: Back & Menu */}
            <SafeAreaView style={styles.topNavSafe} pointerEvents="box-none">
              <View style={styles.topNavRow} pointerEvents="box-none">
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.navCircleBtn}
                  onPress={onClose}
                >
                  <Ionicons name="chevron-back" size={22} color="#0F172A" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.navCircleBtn}
                  onPress={() => setShowOptionsMenu((prev) => !prev)}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            {/* Bottom Gradient Scrim over photo with Name & Verification */}
            <LinearGradient
              colors={['transparent', 'rgba(15, 23, 42, 0.4)', 'rgba(15, 23, 42, 0.85)']}
              style={styles.scrimGradient}
              pointerEvents="none"
            >
              <View style={styles.scrimContent}>
                <View style={styles.scrimNameRow}>
                  <Text style={styles.scrimName}>
                    {fullProfile.name}, {fullProfile.age}
                  </Text>
                  {fullProfile.isVerified && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#38BDF8"
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </View>

                {fullProfile.online && (
                  <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>Active Now</Text>
                  </View>
                )}

                <Text style={styles.scrimJob}>{fullProfile.jobTitle || 'Member'}</Text>

                <View style={styles.scrimLocationRow}>
                  <Ionicons name="location-sharp" size={15} color="#BAE6FD" />
                  <Text style={styles.scrimLocationText}>
                    {fullProfile.location || 'Nearby'}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Body Profile Sections */}
          <View style={styles.bodyWrapper}>
            {/* Compatibility Synergy Card */}
            <View style={styles.synergyCard}>
              <LinearGradient
                colors={['#0284C7', '#0EA5E9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.synergyBadgeGradient}
              >
                <Ionicons name="flame" size={20} color="#FFFFFF" />
                <Text style={styles.synergyScoreText}>
                  {fullProfile.matchPercentage || 85}% Match
                </Text>
              </LinearGradient>
              <View style={styles.synergyInfo}>
                <Text style={styles.synergyTitle}>High Compatibility</Text>
                <Text style={styles.synergySub}>
                  {fullProfile.compatibilityReason || 'Shared Lifestyle & Interests'}
                </Text>
              </View>
            </View>

            {/* Crossed Paths & Proximity Metrics (3 columns) */}
            <View style={styles.metricsCard}>
              <View style={styles.metricColumn}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="navigate-outline" size={16} color="#0284C7" />
                </View>
                <Text style={styles.metricValueText}>{fullProfile.distance || 'Nearby'}</Text>
                <Text style={styles.metricLabelText}>distance</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricColumn}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="sync" size={16} color="#0284C7" />
                </View>
                <Text style={styles.metricValueText}>
                  {fullProfile.encountersCount ?? 1}x
                </Text>
                <Text style={styles.metricLabelText}>encounters</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricColumn}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="time-outline" size={16} color="#0284C7" />
                </View>
                <Text style={styles.metricValueText} numberOfLines={1}>
                  {fullProfile.lastCrossed?.replace('Crossed paths ', '') || 'Recently'}
                </Text>
                <Text style={styles.metricLabelText}>last crossed</Text>
              </View>
            </View>

            {/* About Me Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="person-outline" size={18} color="#0284C7" />
                <Text style={styles.sectionTitle}>About Me</Text>
              </View>
              <Text style={styles.bioText}>
                {fullProfile.bio ||
                  'Looking to meet genuine, open-minded people and explore new spots around the city.'}
              </Text>
            </View>

            {/* Passions & Interests Tags */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="sparkles-outline" size={18} color="#0284C7" />
                <Text style={styles.sectionTitle}>Passions & Interests</Text>
              </View>
              <View style={styles.tagsWrap}>
                {tags.map((tag, idx) => (
                  <View key={idx} style={styles.tagPill}>
                    <Text style={styles.tagPillText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Dating Chemistry & Preferences */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="heart-half-outline" size={18} color="#0284C7" />
                <Text style={styles.sectionTitle}>Basics & Preferences</Text>
              </View>

              <View style={styles.prefGrid}>
                {fullProfile.datingGoal && (
                  <View style={styles.prefItem}>
                    <Text style={styles.prefEmoji}>🗓️</Text>
                    <View style={styles.prefTextCol}>
                      <Text style={styles.prefLabel}>Dating Goal</Text>
                      <Text style={styles.prefValue}>{fullProfile.datingGoal}</Text>
                    </View>
                  </View>
                )}

                {fullProfile.personality && (
                  <View style={styles.prefItem}>
                    <Text style={styles.prefEmoji}>✨</Text>
                    <View style={styles.prefTextCol}>
                      <Text style={styles.prefLabel}>Personality</Text>
                      <Text style={styles.prefValue}>{fullProfile.personality}</Text>
                    </View>
                  </View>
                )}

                {fullProfile.partnerTraits && (
                  <View style={styles.prefItem}>
                    <Text style={styles.prefEmoji}>💖</Text>
                    <View style={styles.prefTextCol}>
                      <Text style={styles.prefLabel}>Looking for in Partner</Text>
                      <Text style={styles.prefValue}>{fullProfile.partnerTraits}</Text>
                    </View>
                  </View>
                )}

                {fullProfile.musicPreference && (
                  <View style={styles.prefItem}>
                    <Text style={styles.prefEmoji}>🎸</Text>
                    <View style={styles.prefTextCol}>
                      <Text style={styles.prefLabel}>Music Soundtrack</Text>
                      <Text style={styles.prefValue}>{fullProfile.musicPreference}</Text>
                    </View>
                  </View>
                )}

                {fullProfile.dealBreakers && (
                  <View style={styles.prefItem}>
                    <Text style={styles.prefEmoji}>🚫</Text>
                    <View style={styles.prefTextCol}>
                      <Text style={styles.prefLabel}>Deal Breakers</Text>
                      <Text style={styles.prefValue}>{fullProfile.dealBreakers}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Safety Guidelines Card */}
            <View style={styles.safetyCard}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.safetyTitle}>Verified & Protected</Text>
                <Text style={styles.safetySub}>
                  Flamy protects your exact location coordinates. Keep conversations inside the app for maximum safety.
                </Text>
              </View>
            </View>

            <View style={{ height: 110 }} />
          </View>
        </ScrollView>

        {/* Floating Bottom Action Bar */}
        <View style={styles.bottomBar}>
          {/* Dislike / Pass Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.actionRoundBtn}
            onPress={onClose}
          >
            <Ionicons name="close" size={26} color="#64748B" />
          </TouchableOpacity>

          {/* Super Like Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionRoundBtn, isSuperLiked && styles.actionRoundBtnSuperLiked]}
            onPress={handleSuperLikePress}
          >
            <Ionicons
              name={isSuperLiked ? 'flash' : 'flash-outline'}
              size={24}
              color={isSuperLiked ? '#FFFFFF' : '#0EA5E9'}
            />
          </TouchableOpacity>

          {/* Like / Heart Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionRoundBtn, isLiked && styles.actionRoundBtnLiked]}
            onPress={handleToggleLike}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={26}
              color={isLiked ? '#FFFFFF' : '#F43F5E'}
            />
          </TouchableOpacity>

          {/* Say Hi / Chat Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.chatPrimaryBtn}
            onPress={() => {
              onClose();
              if (onOpenChat) {
                onOpenChat(fullProfile);
              } else if (onOpenMessageRequest) {
                onOpenMessageRequest(fullProfile);
              }
            }}
          >
            <LinearGradient
              colors={['#0EA5E9', '#0284C7']}
              style={styles.chatPrimaryGradient}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
              <Text style={styles.chatPrimaryText}>
                Say Hi to {fullProfile.name.split(' ')[0]}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Options Dropdown Menu */}
        {showOptionsMenu && (
          <View style={styles.optionsDropdown}>
            <TouchableOpacity
              style={styles.optionMenuItem}
              onPress={() => {
                setShowOptionsMenu(false);
                setShowReportModal(true);
              }}
            >
              <Ionicons name="flag-outline" size={18} color="#F43F5E" />
              <Text style={[styles.optionMenuText, { color: '#F43F5E' }]}>Report Profile</Text>
            </TouchableOpacity>

            <View style={styles.optionMenuDivider} />

            <TouchableOpacity
              style={styles.optionMenuItem}
              onPress={handleBlockAction}
            >
              <Ionicons name="ban-outline" size={18} color="#64748B" />
              <Text style={styles.optionMenuText}>Block User</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Report Profile Modal */}
        <ReportModal
          visible={showReportModal}
          profile={fullProfile}
          onClose={() => setShowReportModal(false)}
          onReportSubmitted={() => {
            setShowReportModal(false);
            onClose();
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroWrapper: {
    width: '100%',
    height: PHOTO_HEIGHT,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  fallbackHero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackHeroText: {
    fontSize: 54,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  tapContainer: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  tapLeft: {
    flex: 1,
    height: '100%',
  },
  tapRight: {
    flex: 1,
    height: '100%',
  },
  paginationBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 6,
    zIndex: 20,
  },
  paginationDash: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
  },
  paginationDashActive: {
    backgroundColor: '#FFFFFF',
  },
  paginationDashInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  topNavSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  navCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
  scrimGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  scrimContent: {},
  scrimNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrimName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E0F2FE',
  },
  scrimJob: {
    fontSize: 14,
    fontWeight: '600',
    color: '#BAE6FD',
    marginTop: 3,
  },
  scrimLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  scrimLocationText: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  bodyWrapper: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  synergyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  synergyBadgeGradient: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synergyScoreText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  synergyInfo: {
    flex: 1,
  },
  synergyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  synergySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricLabelText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    textTransform: 'capitalize',
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  bioText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    backgroundColor: '#F0F9FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  tagPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  prefGrid: {
    gap: 10,
  },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  prefEmoji: {
    fontSize: 20,
  },
  prefTextCol: {
    flex: 1,
  },
  prefLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  prefValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  safetyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  safetySub: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 16,
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      web: { boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  actionRoundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  actionRoundBtnLiked: {
    backgroundColor: '#F43F5E',
    borderColor: '#F43F5E',
  },
  actionRoundBtnSuperLiked: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  chatPrimaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  chatPrimaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  chatPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  optionsDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 95 : 65,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 6,
    width: 170,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 50,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.15)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 10,
      },
    }),
  },
  optionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  optionMenuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  optionMenuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
});
