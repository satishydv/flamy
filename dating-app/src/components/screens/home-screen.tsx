import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Profile } from '@/types';
import { CATEGORY_FILTERS } from '@/constants/mock-data';

export interface AuthUser {
  id?: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  image?: string | null;
}

interface HomeScreenProps {
  currentUser?: AuthUser | null;
  profiles: Profile[];
  onOpenMap: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onOpenLikes?: () => void;
  likesCount?: number;
  onLikeProfile: (profile: Profile) => void;
  onSuperLikeProfile?: (profile: Profile) => void;
  onUnlikeProfile?: (profile: Profile) => void;
  onOpenChat: (profile: Profile) => void;
  onOpenMessageRequest?: (profile: Profile) => void;
  onPassProfile: (profile: Profile) => void;
  onRefresh?: () => void;
}

const { width } = Dimensions.get('window');

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentUser,
  profiles,
  onOpenMap,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onOpenLikes,
  likesCount = 5,
  onLikeProfile,
  onSuperLikeProfile,
  onUnlikeProfile,
  onOpenChat,
  onOpenMessageRequest,
  onPassProfile,
  onRefresh,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);

  // Filter profiles based on category
  const filteredProfiles = profiles.filter((p) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'new') return p.isNew;
    if (selectedCategory === 'online') return p.online;
    if (selectedCategory === 'today') return p.lastCrossed.includes('Today');
    if (selectedCategory === 'favored' || selectedCategory === 'likes') return p.liked || p.matchPercentage > 90;
    return true;
  });

  const currentProfile = filteredProfiles[currentIndex] || filteredProfiles[0];

  // Consolidate candidate photos into array (supports up to 5 photos)
  const allPhotos: string[] = React.useMemo(() => {
    if (!currentProfile) return [];
    const list: string[] = [];
    if (currentProfile.image) list.push(currentProfile.image);
    if (currentProfile.photos && currentProfile.photos.length > 0) {
      currentProfile.photos.forEach((p) => {
        if (p.url && !list.includes(p.url)) list.push(p.url);
      });
    } else if (currentProfile.additionalImages && currentProfile.additionalImages.length > 0) {
      currentProfile.additionalImages.forEach((img) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    return list.length > 0 ? list : [currentProfile.image];
  }, [currentProfile]);

  const activePhotoUri = allPhotos[currentPhotoIndex] || currentProfile?.image;

  const handleNext = () => {
    setCurrentPhotoIndex(0);
    if (currentIndex < filteredProfiles.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleNextPhoto = () => {
    if (currentPhotoIndex < allPhotos.length - 1) {
      setCurrentPhotoIndex((prev) => prev + 1);
    } else {
      setCurrentPhotoIndex(0);
    }
  };

  const handlePrevPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex((prev) => prev - 1);
    } else {
      setCurrentPhotoIndex(allPhotos.length - 1);
    }
  };

  const isCurrentLiked = !!currentProfile?.liked;
  const isCurrentSuperLiked = !!currentProfile?.superLiked;

  const handleLike = () => {
    if (!currentProfile) return;
    if (isCurrentLiked) {
      // Toggle off / unlike if tapped again
      if (onUnlikeProfile) {
        onUnlikeProfile(currentProfile);
      } else {
        onLikeProfile({ ...currentProfile, liked: false, superLiked: false });
      }
    } else {
      onLikeProfile(currentProfile);
      handleNext();
    }
  };

  const handlePass = () => {
    if (currentProfile) {
      onPassProfile(currentProfile);
      handleNext();
    }
  };

  const handleSuperLike = () => {
    if (!currentProfile) return;
    if (isCurrentSuperLiked) {
      Alert.alert('Super Like Active ⚡', `You already sent a Super Like to ${currentProfile.name}!`);
    } else {
      if (onSuperLikeProfile) {
        onSuperLikeProfile(currentProfile);
      } else {
        onLikeProfile({ ...currentProfile, liked: true, superLiked: true });
      }
      Alert.alert('Super Like! ⚡', `You sent a Super Like to ${currentProfile.name}!`);
      handleNext();
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        {/* User Info Left */}
        <View style={styles.userInfoRow}>
          {currentUser?.image ? (
            <Image
              source={{ uri: currentUser.image }}
              style={styles.userAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
              <Ionicons name="person" size={20} color="#94A3B8" />
            </View>
          )}
          <View style={styles.userTextContainer}>
            <Text style={styles.greetingText}>Welcome, 👋</Text>
            <Text style={styles.userNameText}>{currentUser?.name || 'Explorer'}</Text>
          </View>
        </View>

        {/* Right Header Buttons: Map Pill + Bell */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity activeOpacity={0.8} style={styles.mapPillButton} onPress={onOpenMap}>
            <Ionicons name="map" size={16} color="#0F172A" />
            <Text style={styles.mapPillText}>Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.bellButton}
            onPress={onOpenNotifications}
          >
            <Ionicons name="notifications" size={18} color="#0F172A" />
            {unreadNotificationsCount > 0 && <View style={styles.bellBadgeDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Categories Filter Row */}
      <View style={styles.categoriesSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORY_FILTERS.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const isLikesTab = cat.id === 'likes' || cat.id === 'favored';
            return (
              <TouchableOpacity
                key={cat.id}
                activeOpacity={0.8}
                style={styles.categoryItem}
                onPress={() => {
                  if (isLikesTab && onOpenLikes) {
                    onOpenLikes();
                  } else {
                    setSelectedCategory(cat.id);
                    setCurrentIndex(0);
                  }
                }}
              >
                <View style={styles.categorySquircleWrapper}>
                  <LinearGradient
                    colors={isSelected ? cat.bgGradient : ['#F1F5F9', '#E2E8F0']}
                    style={[styles.categorySquircle, isSelected && styles.categorySquircleActive]}
                  >
                    <Ionicons
                      name={cat.iconName as any}
                      size={22}
                      color={isSelected ? cat.iconColor : '#64748B'}
                    />
                  </LinearGradient>
                  {isLikesTab && likesCount > 0 && (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{likesCount}</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected ? styles.categoryLabelActive : styles.categoryLabelInactive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Profile Card Section */}
      <View style={styles.cardSection}>
        {currentProfile ? (
          <View style={styles.cardContainer}>
            {/* Background Profile Photo */}
            <Image
              source={typeof activePhotoUri === 'string' ? { uri: activePhotoUri } : activePhotoUri}
              style={styles.cardImage}
              contentFit="cover"
              priority="high"
            />

            {/* Multi-Photo Indicator Bar (Up to 5 photos) */}
            {allPhotos.length > 1 && (
              <View style={styles.photoIndicatorBar}>
                {allPhotos.map((_, pIdx) => (
                  <View
                    key={pIdx}
                    style={[
                      styles.photoIndicatorDash,
                      pIdx === currentPhotoIndex
                        ? styles.photoIndicatorDashActive
                        : styles.photoIndicatorDashInactive,
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Tap areas for photo switching (left & right halves) */}
            {allPhotos.length > 1 && (
              <View style={styles.photoTapContainer} pointerEvents="box-none">
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.photoTapLeft}
                  onPress={handlePrevPhoto}
                />
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.photoTapRight}
                  onPress={handleNextPhoto}
                />
              </View>
            )}

            {/* Top Badges */}
            <View style={styles.topBadgesRow}>
              <View style={styles.topBadgesLeft}>
                {currentProfile.isNew && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>New</Text>
                  </View>
                )}
                {isCurrentSuperLiked ? (
                  <View style={styles.superLikedBadge}>
                    <Ionicons name="flash" size={12} color="#FFFFFF" />
                    <Text style={styles.superLikedBadgeText}>Super Liked</Text>
                  </View>
                ) : isCurrentLiked ? (
                  <View style={styles.likedBadge}>
                    <Ionicons name="heart" size={12} color="#FFFFFF" />
                    <Text style={styles.likedBadgeText}>Liked</Text>
                  </View>
                ) : !currentProfile.isNew ? (
                  <View style={styles.emptyBadgeSpacer} />
                ) : null}
              </View>

              <View style={styles.matchBadge}>
                <Ionicons name="flame" size={15} color="#FFFFFF" />
                <View>
                  <Text style={styles.matchPercentageText}>{currentProfile.matchPercentage}%</Text>
                  <Text style={styles.matchSubText}>Match</Text>
                </View>
              </View>
            </View>

            {/* Bottom Gradient Scrim & Info */}
            <LinearGradient
              colors={['transparent', 'rgba(15, 23, 42, 0.4)', 'rgba(14, 165, 233, 0.85)', 'rgba(2, 132, 199, 0.95)']}
              style={styles.cardBottomGradient}
            >
              {/* Name, Age & Verified badge */}
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>
                  {currentProfile.name}, {currentProfile.age}
                </Text>
                {currentProfile.isVerified && (
                  <Ionicons name="checkmark-circle" size={20} color="#38BDF8" style={styles.verifiedIcon} />
                )}
              </View>

              {/* Job Title */}
              <Text style={styles.profileJob}>{currentProfile.jobTitle}</Text>

              {/* Match Synergy & Dating Goal Badges */}
              {currentProfile.datingGoal && (
                <View style={styles.goalRow}>
                  <View style={styles.goalPill}>
                    <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                    <Text style={styles.goalPillText}>
                      {currentProfile.compatibilityReason || currentProfile.datingGoal}
                    </Text>
                  </View>
                  <View style={styles.goalSecondaryPill}>
                    <Text style={styles.goalSecondaryText}>🎯 {currentProfile.datingGoal}</Text>
                  </View>
                </View>
              )}

              {/* Interest Tags */}
              <View style={styles.tagsRow}>
                {currentProfile.tags.map((tag, idx) => (
                  <View key={idx} style={styles.tagPill}>
                    <Text style={styles.tagPillText}>
                      {idx === 0 ? '☕ ' : idx === 1 ? '📷 ' : '🎵 '}
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </LinearGradient>

            {/* Floating Action Column on the Right */}
            <View style={styles.floatingActionsColumn}>
              {/* Message Request / Chat Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionCircleBtn}
                onPress={() => {
                  if (currentProfile.liked) {
                    onOpenChat(currentProfile);
                  } else if (onOpenMessageRequest) {
                    onOpenMessageRequest(currentProfile);
                  } else {
                    onOpenChat(currentProfile);
                  }
                }}
                accessibilityLabel="Send message request"
              >
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Like Heart Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.actionCircleBtn,
                  isCurrentLiked ? styles.heartBtnLiked : styles.heartBtnInactive,
                ]}
                onPress={handleLike}
                accessibilityLabel={isCurrentLiked ? "Unlike profile" : "Like profile"}
              >
                <Ionicons name="heart" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Lightning Boost Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.actionCircleBtn,
                  isCurrentSuperLiked ? styles.thunderBtnSuperLiked : styles.thunderBtnInactive,
                ]}
                onPress={handleSuperLike}
                accessibilityLabel="Super like profile"
              >
                <Ionicons name="flash" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Pass / Dismiss Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionCircleBtn}
                onPress={handlePass}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCardContainer}>
            <Ionicons name="sparkles" size={48} color="#0EA5E9" />
            <Text style={styles.emptyTitle}>You&apos;re all caught up!</Text>
            <Text style={styles.emptySubtitle}>
              Check back soon or look around on the radar map to see more people who crossed paths with you.
            </Text>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setSelectedCategory('all');
                setCurrentIndex(0);
                if (onRefresh) onRefresh();
              }}
            >
              <Text style={styles.resetButtonText}>Refresh Profiles</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    paddingBottom: 85, // Space for CustomTabBar
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userAvatarPlaceholder: {
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTextContainer: {
    justifyContent: 'center',
  },
  greetingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  mapPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  bellBadgeDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F43F5E',
  },
  categoriesSection: {
    paddingVertical: 10,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  categoryItem: {
    alignItems: 'center',
  },
  categorySquircleWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E11D48',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(225, 29, 72, 0.45)',
      },
      default: {
        shadowColor: '#E11D48',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 3,
        elevation: 4,
      },
    }),
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  categorySquircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  categorySquircleActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryLabelActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  categoryLabelInactive: {
    color: '#64748B',
  },
  cardSection: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 8,
  },
  cardContainer: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0284C7',
    ...Platform.select({
      web: {
        boxShadow: '0 12px 36px rgba(14, 165, 233, 0.25)',
      },
      default: {
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  photoIndicatorBar: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 6,
    zIndex: 30,
  },
  photoIndicatorDash: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  photoIndicatorDashActive: {
    backgroundColor: '#FFFFFF',
  },
  photoIndicatorDashInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  photoTapContainer: {
    position: 'absolute',
    top: 60,
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    zIndex: 15,
  },
  photoTapLeft: {
    width: '45%',
    height: '100%',
  },
  photoTapRight: {
    width: '55%',
    height: '100%',
  },
  topBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    zIndex: 10,
  },
  newBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBadgeSpacer: {
    width: 50,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  matchPercentageText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 14,
  },
  matchSubText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 10,
  },
  cardBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 80,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  verifiedIcon: {
    marginTop: 2,
  },
  profileJob: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginBottom: 10,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    maxWidth: '80%',
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  goalPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  goalSecondaryPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  goalSecondaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    maxWidth: '78%',
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  tagPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  floatingActionsColumn: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    gap: 12,
    alignItems: 'center',
    zIndex: 20,
  },
  actionCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(125, 185, 235, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
  topBadgesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  likedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  likedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  superLikedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  superLikedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heartBtnInactive: {
    backgroundColor: 'rgba(125, 185, 235, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  heartBtnLiked: {
    backgroundColor: '#EF4444',
    borderColor: '#F87171',
    borderWidth: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.6)',
      },
      default: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.55,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  thunderBtnInactive: {
    backgroundColor: 'rgba(125, 185, 235, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  thunderBtnSuperLiked: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
    borderWidth: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(2, 132, 199, 0.6)',
      },
      default: {
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.55,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  emptyCardContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  resetButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
