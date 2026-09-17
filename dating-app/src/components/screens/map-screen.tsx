import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Profile } from '@/types';
import { API_ENDPOINTS } from '@/constants/api';

interface MapScreenProps {
  profiles: Profile[];
  onBack: () => void;
  onLikeProfile: (profile: Profile) => void;
  onUnlikeProfile?: (profile: Profile) => void;
  onOpenChat: (profile: Profile) => void;
}

const { width } = Dimensions.get('window');
const MAP_SIZE = Math.min(width * 0.92, 380);

export const MapScreen: React.FC<MapScreenProps> = ({
  profiles,
  onBack,
  onLikeProfile,
  onUnlikeProfile,
  onOpenChat,
}) => {
  const [selectedTab, setSelectedTab] = useState<'all' | 'recent' | 'nearby' | 'hotspots'>('all');
  const [nearbyList, setNearbyList] = useState<Profile[]>(profiles);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(profiles[0] || null);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);

  // Fetch real nearby matches from PostgreSQL backend
  const fetchNearby = async () => {
    try {
      setIsLoadingNearby(true);
      const res = await fetch(`${API_ENDPOINTS.getNearbyMatches}?category=${selectedTab}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data?.isGhostMode) {
        setIsGhostMode(true);
        setNearbyList([]);
        setSelectedProfile(null);
      } else if (data?.success && Array.isArray(data.profiles)) {
        setIsGhostMode(false);
        const merged: Profile[] = data.profiles.map((p: any) => {
          const globalMatch = profiles.find((gp) => gp.id === p.id);
          return {
            ...p,
            image: p.image || '',
            liked: Boolean(p.liked || globalMatch?.liked),
            superLiked: Boolean(p.superLiked || globalMatch?.superLiked),
          };
        });
        setNearbyList(merged);
        setSelectedProfile((prev) => {
          if (prev) {
            const found = merged.find((m) => m.id === prev.id);
            if (found) return found;
          }
          return merged[0] || null;
        });
      } else {
        setIsGhostMode(false);
        setNearbyList([]);
        setSelectedProfile(null);
      }
    } catch (err) {
      console.log('Nearby API fetch notice:', err);
    } finally {
      setIsLoadingNearby(false);
    }
  };

  useEffect(() => {
    fetchNearby();
  }, [selectedTab]);

  const handleToggleLike = (profile: Profile) => {
    const isCurrentlyLiked = Boolean(profile.liked);
    const nextLiked = !isCurrentlyLiked;

    // 1. Optimistically update selectedProfile and nearbyList
    setSelectedProfile((prev) => (prev && prev.id === profile.id ? { ...prev, liked: nextLiked } : prev));
    setNearbyList((prev) =>
      prev.map((p) => (p.id === profile.id ? { ...p, liked: nextLiked } : p))
    );

    // 2. Call parent handler to update global state and call backend swipe API
    if (isCurrentlyLiked) {
      if (onUnlikeProfile) {
        onUnlikeProfile(profile);
      } else {
        onLikeProfile({ ...profile, liked: false });
      }
    } else {
      onLikeProfile({ ...profile, liked: true });
    }
  };

  const displayProfiles = nearbyList;

  const mapTabs = [
    { id: 'all', label: 'All' },
    { id: 'recent', label: 'Crossed' },
    { id: 'nearby', label: 'Nearby' },
    { id: 'hotspots', label: 'Hotspots' },
  ] as const;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.8} style={styles.headerCircleBtn} onPress={onBack}>
          <Ionicons name="search" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Map</Text>

        <TouchableOpacity activeOpacity={0.8} style={styles.headerCircleBtn}>
          <Ionicons name="notifications" size={20} color="#0F172A" />
          <View style={styles.bellBadgeDot} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {mapTabs.map((tab) => {
          const isActive = selectedTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.8}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setSelectedTab(tab.id)}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Ghost Mode Privacy Alert Banner */}
      {isGhostMode && (
        <View style={styles.ghostBanner}>
          <View style={styles.ghostBannerIcon}>
            <Ionicons name="eye-off" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.ghostBannerTitle}>Ghost Mode Active 👻</Text>
            <Text style={styles.ghostBannerSub}>
              Your location is hidden and discovery is paused.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.unGhostBtn}
            activeOpacity={0.8}
            onPress={async () => {
              try {
                await fetch(API_ENDPOINTS.updatePrivacySettings, {
                  method: 'PUT',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isGhostMode: false }),
                });
                setIsGhostMode(false);
                fetchNearby();
              } catch (e) {}
            }}
          >
            <Text style={styles.unGhostBtnText}>Turn Off</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Interactive Radar Map View */}
        <View style={styles.radarWrapper}>
          <LinearGradient
            colors={['#E0F2FE', '#BAE6FD', '#E0F2FE']}
            style={styles.radarBackground}
          >
            {/* Vector Map Grid & Concentric Radar Circles */}
            <Svg width={MAP_SIZE} height={MAP_SIZE} style={StyleSheet.absoluteFill}>
              {/* Soft background grid lines */}
              <Line x1="0" y1={MAP_SIZE * 0.3} x2={MAP_SIZE} y2={MAP_SIZE * 0.3} stroke="#93C5FD" strokeWidth="1" opacity={0.35} />
              <Line x1="0" y1={MAP_SIZE * 0.7} x2={MAP_SIZE} y2={MAP_SIZE * 0.7} stroke="#93C5FD" strokeWidth="1" opacity={0.35} />
              <Line x1={MAP_SIZE * 0.3} y1="0" x2={MAP_SIZE * 0.3} y2={MAP_SIZE} stroke="#93C5FD" strokeWidth="1" opacity={0.35} />
              <Line x1={MAP_SIZE * 0.7} y1="0" x2={MAP_SIZE * 0.7} y2={MAP_SIZE} stroke="#93C5FD" strokeWidth="1" opacity={0.35} />

              {/* Diagonal road lines */}
              <Line x1="0" y1={MAP_SIZE * 0.8} x2={MAP_SIZE * 0.8} y2="0" stroke="#93C5FD" strokeWidth="1.5" opacity={0.4} />
              <Line x1={MAP_SIZE * 0.2} y1={MAP_SIZE} x2={MAP_SIZE} y2={MAP_SIZE * 0.2} stroke="#93C5FD" strokeWidth="1.5" opacity={0.4} />

              {/* Concentric radar circles */}
              <Circle cx={MAP_SIZE / 2} cy={MAP_SIZE / 2} r={MAP_SIZE * 0.44} stroke="#60A5FA" strokeWidth="1.5" fill="none" opacity={0.45} />
              <Circle cx={MAP_SIZE / 2} cy={MAP_SIZE / 2} r={MAP_SIZE * 0.32} stroke="#60A5FA" strokeWidth="1.5" fill="none" opacity={0.4} />
              <Circle cx={MAP_SIZE / 2} cy={MAP_SIZE / 2} r={MAP_SIZE * 0.20} stroke="#60A5FA" strokeWidth="1.5" fill="none" opacity={0.35} />
              <Circle cx={MAP_SIZE / 2} cy={MAP_SIZE / 2} r={MAP_SIZE * 0.08} stroke="#38BDF8" strokeWidth="1.5" fill="#BAE6FD" opacity={0.5} />
            </Svg>

            {/* Center User Location Pin */}
            <View style={styles.userLocationDot}>
              <View style={styles.userDotPulseRing} />
              <View style={styles.userDotCore} />
              <View style={styles.directionPointer} />
            </View>

            {/* Profile Encounter Pins */}
            {displayProfiles.slice(0, 6).map((profile) => {
              const isSelected = selectedProfile?.id === profile.id;
              const posX = (profile.mapCoordinates.x / 100) * (MAP_SIZE - 60);
              const posY = (profile.mapCoordinates.y / 100) * (MAP_SIZE - 60);

              return (
                <TouchableOpacity
                  key={profile.id}
                  activeOpacity={0.85}
                  style={[
                    styles.profilePinWrapper,
                    { left: posX, top: posY },
                    isSelected && styles.profilePinWrapperSelected,
                  ]}
                  onPress={() => setSelectedProfile(profile)}
                >
                  {/* Match Percentage Pill */}
                  <View style={[styles.pinMatchBadge, isSelected && styles.pinMatchBadgeSelected]}>
                    <Text style={styles.pinMatchText}>{profile.matchPercentage}%</Text>
                  </View>

                  {/* Circular Avatar */}
                  <View style={[styles.pinAvatarRing, isSelected && styles.pinAvatarRingSelected]}>
                    <Image
                      source={typeof profile.image === 'string' ? { uri: profile.image } : profile.image}
                      style={styles.pinAvatarImage}
                      contentFit="cover"
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </LinearGradient>
        </View>

        {/* Selected Profile Bottom Drawer Card */}
        {selectedProfile && (
          <View style={styles.profileSheetCard}>
            {/* Header: Avatar, Name, Job, Location & Heart button */}
            <View style={styles.sheetTopRow}>
              <Image
                source={typeof selectedProfile.image === 'string' ? { uri: selectedProfile.image } : selectedProfile.image}
                style={styles.sheetAvatar}
                contentFit="cover"
              />

              <View style={styles.sheetMetaCol}>
                <View style={styles.nameVerifiedRow}>
                  <Text style={styles.sheetName}>
                    {selectedProfile.name}, {selectedProfile.age}
                  </Text>
                  {selectedProfile.isVerified && (
                    <Ionicons name="checkmark-circle" size={18} color="#0EA5E9" style={styles.verifiedIcon} />
                  )}
                </View>

                <Text style={styles.sheetJob}>{selectedProfile.jobTitle}</Text>

                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={13} color="#64748B" />
                  <Text style={styles.sheetLocation}>{selectedProfile.location}</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.sheetHeartBtn, selectedProfile.liked && styles.sheetHeartBtnActive]}
                onPress={() => handleToggleLike(selectedProfile)}
                accessibilityLabel={selectedProfile.liked ? 'Unlike profile' : 'Like profile'}
              >
                <Ionicons
                  name={selectedProfile.liked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={selectedProfile.liked ? '#FFFFFF' : '#64748B'}
                />
              </TouchableOpacity>
            </View>

            {/* Encounter Metrics Cards (3 columns) */}
            <View style={styles.metricsRow}>
              {/* Distance */}
              <View style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="location-sharp" size={16} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.metricPrimaryText}>{selectedProfile.distance}</Text>
                  <Text style={styles.metricSecondaryText}>from you</Text>
                </View>
              </View>

              {/* Encounters */}
              <View style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="sync" size={15} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.metricPrimaryText}>
                    {selectedProfile.encountersCount ?? 0} Encounter{selectedProfile.encountersCount === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.metricSecondaryText}>with you</Text>
                </View>
              </View>

              {/* Last Crossed */}
              <View style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="time-outline" size={16} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.metricPrimaryText}>{selectedProfile.lastCrossed}</Text>
                  <Text style={styles.metricSecondaryText}>last crossed</Text>
                </View>
              </View>
            </View>

            {/* About Section */}
            <View style={styles.aboutSection}>
              <Text style={styles.aboutTitle}>About</Text>
              <Text style={styles.aboutText}>{selectedProfile.bio}</Text>
            </View>

            {/* Quick Action: Say Hi / Chat */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.chatActionBtn}
              onPress={() => onOpenChat(selectedProfile)}
            >
              <LinearGradient
                colors={['#0EA5E9', '#0284C7']}
                style={styles.chatBtnGradient}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                <Text style={styles.chatBtnText}>Say Hi to {selectedProfile.name}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State when no profiles found */}
        {!selectedProfile && !isLoadingNearby && !isGhostMode && (
          <View style={styles.emptyMapCard}>
            <Ionicons
              name={selectedTab === 'recent' ? 'footsteps' : 'radio-outline'}
              size={36}
              color="#0284C7"
            />
            <Text style={styles.emptyMapTitle}>
              {selectedTab === 'recent' ? 'No Crossed Paths Yet' : 'No Profiles in Range'}
            </Text>
            <Text style={styles.emptyMapSub}>
              {selectedTab === 'recent'
                ? 'Keep the app open while exploring your city. When you come within ~500 meters of someone, your crossed path will be logged right here!'
                : 'Try switching tabs or check back soon as more people join.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    paddingBottom: 85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  bellBadgeDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F43F5E',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButtonActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  radarWrapper: {
    width: MAP_SIZE,
    height: MAP_SIZE,
    borderRadius: MAP_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginVertical: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 30px rgba(14, 165, 233, 0.2)',
      },
      default: {
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  radarBackground: {
    flex: 1,
    position: 'relative',
  },
  userLocationDot: {
    position: 'absolute',
    top: MAP_SIZE / 2 - 12,
    left: MAP_SIZE / 2 - 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDotPulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
  },
  userDotCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  directionPointer: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 8,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#0284C7',
    transform: [{ rotate: '45deg' }],
  },
  profilePinWrapper: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  profilePinWrapperSelected: {
    zIndex: 20,
    transform: [{ scale: 1.1 }],
  },
  pinMatchBadge: {
    backgroundColor: '#0284C7',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  pinMatchBadgeSelected: {
    backgroundColor: '#0EA5E9',
  },
  pinMatchText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  pinAvatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#CBD5E1',
  },
  pinAvatarRingSelected: {
    borderColor: '#0284C7',
    borderWidth: 3,
  },
  pinAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileSheetCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  sheetAvatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  sheetMetaCol: {
    flex: 1,
  },
  nameVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  verifiedIcon: {
    marginTop: 2,
  },
  sheetJob: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sheetLocation: {
    fontSize: 12,
    color: '#64748B',
  },
  sheetHeartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  sheetHeartBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#F87171',
    borderWidth: 1.5,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.45)',
      },
      default: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  metricIconWrap: {
    marginBottom: 2,
  },
  metricPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricSecondaryText: {
    fontSize: 10,
    color: '#64748B',
  },
  aboutSection: {
    marginBottom: 16,
  },
  aboutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  aboutText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  chatActionBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  chatBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  chatBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ghostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ghostBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ghostBannerTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  ghostBannerSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  unGhostBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  unGhostBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyMapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyMapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyMapSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
