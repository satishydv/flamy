import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TabType } from '@/types';

interface CustomTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  likesCount?: number;
  messagesCount?: number;
}

export const CustomTabBar: React.FC<CustomTabBarProps> = ({
  activeTab,
  onTabChange,
  likesCount = 5,
  messagesCount = 3,
}) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* Home Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.tabItem}
          onPress={() => onTabChange('home')}
        >
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={24}
            color={activeTab === 'home' ? '#111827' : '#9CA3AF'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'home' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        {/* Explore Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.tabItem}
          onPress={() => onTabChange('explore')}
        >
          <Ionicons
            name={activeTab === 'explore' ? 'search' : 'search-outline'}
            size={24}
            color={activeTab === 'explore' ? '#111827' : '#9CA3AF'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'explore' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Explore
          </Text>
        </TouchableOpacity>

        {/* Center Glowing Radar Orb (Map shortcut) */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.centerOrbWrapper}
          onPress={() => onTabChange('map')}
        >
          <View style={[styles.centerOrbRing, activeTab === 'map' && styles.centerOrbRingActive]}>
            <LinearGradient
              colors={['#0EA5E9', '#1E40AF', '#0F172A']}
              start={{ x: 0.2, y: 0.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={styles.centerOrbGradient}
            >
              {/* Inner highlight sphere */}
              <View style={styles.innerSphereGlow} />
              <Ionicons name="radio" size={26} color="#38BDF8" style={styles.radarIcon} />
            </LinearGradient>
          </View>
        </TouchableOpacity>

        {/* Messages Tab (Replaced Likes) */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.tabItem}
          onPress={() => onTabChange('messages')}
        >
          <View style={styles.iconWithBadge}>
            <Ionicons
              name={activeTab === 'messages' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              size={24}
              color={activeTab === 'messages' ? '#0284C7' : '#9CA3AF'}
            />
            {messagesCount > 0 && (
              <View style={styles.messagesBadge}>
                <Text style={styles.badgeText}>{messagesCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'messages' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Messages
          </Text>
        </TouchableOpacity>

        {/* Profile Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.tabItem}
          onPress={() => onTabChange('profile')}
        >
          <Ionicons
            name={activeTab === 'profile' ? 'person' : 'person-outline'}
            size={24}
            color={activeTab === 'profile' ? '#111827' : '#9CA3AF'}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'profile' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 600,
    height: Platform.OS === 'ios' ? 84 : 70,
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    ...Platform.select({
      web: {
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#111827',
    fontWeight: '600',
  },
  tabLabelInactive: {
    color: '#9CA3AF',
  },
  centerOrbWrapper: {
    width: 62,
    height: 62,
    marginTop: -28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOrbRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 3,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(14, 165, 233, 0.45)',
      },
      default: {
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  centerOrbRingActive: {
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  centerOrbGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  innerSphereGlow: {
    position: 'absolute',
    top: 4,
    left: 8,
    width: 22,
    height: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    transform: [{ rotate: '-25deg' }],
  },
  radarIcon: {
    marginTop: 2,
  },
  iconWithBadge: {
    position: 'relative',
  },
  likesBadge: {
    position: 'absolute',
    top: -3,
    right: -7,
    backgroundColor: '#E11D48',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  messagesBadge: {
    position: 'absolute',
    top: -3,
    right: -7,
    backgroundColor: '#E11D48',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
