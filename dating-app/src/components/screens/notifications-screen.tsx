import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Profile } from '@/types';
import { API_ENDPOINTS } from '@/constants/api';
import { getSocket } from '@/services/socket';

export interface NotificationItem {
  id: string;
  type: 'match' | 'crossed' | 'superlike' | 'recommendation' | 'system' | 'request';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  profileId?: string;
  profileAvatar?: any;
  senderName?: string;
  actionText?: string;
  data?: any;
}

interface NotificationsScreenProps {
  onBack: () => void;
  onOpenChat?: (profile: Profile) => void;
  onSelectProfile?: (profile: Profile) => void;
  profiles?: Profile[];
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  onOpenChat,
  onSelectProfile,
  profiles = [],
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'matches' | 'crossed' | 'activity'>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.getNotifications, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] Fetch error:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = (newNotif: NotificationItem) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch(API_ENDPOINTS.markAllNotificationsRead, {
        method: 'PATCH',
        credentials: 'include',
      });
    } catch (e) {
      console.error('[NOTIFICATIONS] Mark all read error:', e);
    }
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    // Optimistically mark clicked notification as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );

    // Call API in background if unread
    if (!item.read) {
      fetch(API_ENDPOINTS.markNotificationRead(item.id), {
        method: 'PATCH',
        credentials: 'include',
      }).catch((e) => console.error('[NOTIFICATIONS] Mark read error:', e));
    }

    if (item.profileId) {
      let targetProfile = profiles.find((p) => p.id === item.profileId);

      if (!targetProfile) {
        targetProfile = {
          id: item.profileId,
          name: item.senderName || 'Match',
          age: 24,
          isVerified: true,
          location: 'Nearby',
          jobTitle: 'Member',
          distance: 'Connected',
          encountersCount: 1,
          lastCrossed: 'Recently',
          matchPercentage: 90,
          bio: '',
          tags: [],
          image: item.profileAvatar?.uri || null,
          additionalImages: item.profileAvatar?.uri ? [item.profileAvatar.uri] : [],
          mapCoordinates: { x: 50, y: 50 },
          category: 'likes',
          online: true,
          liked: true,
        };
      }

      if (item.type === 'match' || item.type === 'superlike' || item.type === 'request') {
        if (onOpenChat) onOpenChat(targetProfile);
      } else if (item.type === 'crossed') {
        if (onSelectProfile) onSelectProfile(targetProfile);
        else if (onOpenChat) onOpenChat(targetProfile);
      }
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'matches') return item.type === 'match' || item.type === 'superlike';
    if (filter === 'crossed') return item.type === 'crossed';
    if (filter === 'activity') return item.type === 'recommendation' || item.type === 'system' || item.type === 'request';
    return true;
  });

  const getBadgeIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'match':
        return { name: 'heart', color: '#0284C7', bg: '#E0F2FE' };
      case 'crossed':
        return { name: 'location', color: '#0EA5E9', bg: '#E0F2FE' };
      case 'superlike':
        return { name: 'flash', color: '#F59E0B', bg: '#FEF3C7' };
      case 'request':
        return { name: 'mail', color: '#0284C7', bg: '#E0F2FE' };
      case 'recommendation':
        return { name: 'sparkles', color: '#8B5CF6', bg: '#EDE9FE' };
      default:
        return { name: 'notifications', color: '#64748B', bg: '#F1F5F9' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.7} style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unreadCount} new</Text>
              </View>
            )}
          </View>

          {unreadCount > 0 ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.markReadButton}
              onPress={handleMarkAllAsRead}
            >
              <Text style={styles.markReadText}>Mark read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filtersWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            {(['all', 'matches', 'crossed', 'activity'] as const).map((tab) => {
              const isActive = filter === tab;
              const label =
                tab === 'all'
                  ? 'All'
                  : tab === 'matches'
                  ? 'Matches'
                  : tab === 'crossed'
                  ? 'Crossed Paths'
                  : 'Activity';

              return (
                <TouchableOpacity
                  key={tab}
                  activeOpacity={0.8}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setFilter(tab)}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Notifications List */}
        <ScrollView
          style={styles.listScrollView}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0284C7']}
              tintColor="#0284C7"
            />
          }
        >
          {isLoading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0284C7" />
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={36} color="#0284C7" />
              </View>
              <Text style={styles.emptyTitle}>No notifications here</Text>
              <Text style={styles.emptySubtitle}>
                You&apos;re completely up to date. Keep an eye out for new encounters and matches!
              </Text>
            </View>
          ) : (
            filteredNotifications.map((item) => {
              const badge = getBadgeIcon(item.type);

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.88}
                  style={[styles.notificationCard, !item.read && styles.notificationCardUnread]}
                  onPress={() => handleNotificationPress(item)}
                >
                  {/* Avatar or Icon Column */}
                  <View style={styles.avatarContainer}>
                    {item.profileAvatar ? (
                      <Image source={item.profileAvatar} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.systemIconCircle, { backgroundColor: badge.bg }]}>
                        <Ionicons name={badge.name as any} size={22} color={badge.color} />
                      </View>
                    )}

                    {/* Small corner badge indicator */}
                    {item.profileAvatar && (
                      <View style={[styles.cornerBadge, { backgroundColor: badge.bg }]}>
                        <Ionicons name={badge.name as any} size={11} color={badge.color} />
                      </View>
                    )}
                  </View>

                  {/* Text Content */}
                  <View style={styles.textColumn}>
                    <View style={styles.itemTopRow}>
                      <Text style={[styles.itemTitle, !item.read && styles.itemTitleBold]}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemTime}>{item.timestamp}</Text>
                    </View>

                    <Text style={styles.itemMessage} numberOfLines={2}>
                      {item.message}
                    </Text>

                    {item.actionText && (
                      <View style={styles.actionRow}>
                        <View style={styles.actionPill}>
                          <Text style={styles.actionPillText}>{item.actionText}</Text>
                          <Ionicons name="chevron-forward" size={12} color="#0284C7" />
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Blue Unread Dot */}
                  {!item.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: '100%',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  unreadCountBadge: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  unreadCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  markReadButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  filtersWrapper: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  listScrollView: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  notificationCardUnread: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E0F2FE',
  },
  systemIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textColumn: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingRight: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  itemTitleBold: {
    fontWeight: '800',
    color: '#0284C7',
  },
  itemTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  itemMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
    position: 'absolute',
    top: 16,
    right: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
});
