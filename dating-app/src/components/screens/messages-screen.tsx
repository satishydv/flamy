import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Profile, MessageRequestItem, ConversationItem } from '@/types';
import { API_ENDPOINTS } from '@/constants/api';
import { getSocket } from '@/services/socket';

interface MessagesScreenProps {
  profiles: Profile[];
  onOpenChat: (profile: Profile, callType?: 'none' | 'audio' | 'video') => void;
}

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  profiles,
  onOpenChat,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [requests, setRequests] = useState<MessageRequestItem[]>([]);
  const [serverMatches, setServerMatches] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // Fetch real conversations, message requests, and matches from backend
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [convRes, reqRes, matchesRes] = await Promise.all([
        fetch(API_ENDPOINTS.getConversations, { credentials: 'include' }).catch(() => null),
        fetch(API_ENDPOINTS.getMessageRequests, { credentials: 'include' }).catch(() => null),
        fetch(API_ENDPOINTS.getMyMatches, { credentials: 'include' }).catch(() => null),
      ]);

      if (convRes && convRes.ok) {
        const convData = await convRes.json();
        if (convData.success && Array.isArray(convData.conversations)) {
          setConversations(convData.conversations);
        }
      }

      if (reqRes && reqRes.ok) {
        const reqData = await reqRes.json();
        if (reqData.success && Array.isArray(reqData.requests)) {
          setRequests(reqData.requests);
        }
      }

      if (matchesRes && matchesRes.ok) {
        const matchesData = await matchesRes.json();
        if (matchesData.success && Array.isArray(matchesData.matches)) {
          setServerMatches(matchesData.matches);
        }
      }
    } catch (e) {
      console.log('Messages screen data fetch notice:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = getSocket();
    if (socket) {
      socket.on('chat:unmatched', fetchData);
      socket.on('chat:blocked', fetchData);
    }
    return () => {
      if (socket) {
        socket.off('chat:unmatched', fetchData);
        socket.off('chat:blocked', fetchData);
      }
    };
  }, []);

  // Handle Accept Message Request
  const handleAcceptRequest = async (item: MessageRequestItem) => {
    try {
      setProcessingRequestId(item.id);
      const res = await fetch(API_ENDPOINTS.acceptMessageRequest(item.id), {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        // Remove from requests list
        setRequests((prev) => prev.filter((r) => r.id !== item.id));
        // Refresh conversations & matches
        fetchData();
        Alert.alert(
          'Request Accepted! 🎉',
          `You and ${item.sender.name} are now mutually matched! Opening chat...`,
          [{ text: 'Start Chatting', onPress: () => onOpenChat(item.sender) }]
        );
      } else {
        Alert.alert('Notice', data.message || 'Could not accept request.');
      }
    } catch (err) {
      console.warn('Accept request error:', err);
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Handle Decline Message Request
  const handleDeclineRequest = async (item: MessageRequestItem) => {
    try {
      setProcessingRequestId(item.id);
      const res = await fetch(API_ENDPOINTS.declineMessageRequest(item.id), {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setRequests((prev) => prev.filter((r) => r.id !== item.id));
      }
    } catch (err) {
      console.warn('Decline request error:', err);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const activeConversations = conversations;

  // Filter conversations
  const filteredConversations = activeConversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.partner.name.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q) ||
      c.partner.location.toLowerCase().includes(q)
    );
  });

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.sender.name.toLowerCase().includes(q) ||
      r.message.toLowerCase().includes(q) ||
      r.sender.location.toLowerCase().includes(q)
    );
  });

  const displayMatches = serverMatches;
  const totalUnread = activeConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.totalUnreadBadge}>
              <Text style={styles.totalUnreadText}>{totalUnread} new</Text>
            </View>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations & requests..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Switcher: Chats vs Requests (Before Match) */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'chats' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('chats')}
          >
            <Ionicons
              name="chatbubbles"
              size={15}
              color={activeTab === 'chats' ? '#0284C7' : '#64748B'}
            />
            <Text style={[styles.segmentText, activeTab === 'chats' && styles.segmentTextActive]}>
              Chats
            </Text>
            {totalUnread > 0 && (
              <View style={styles.segmentBadge}>
                <Text style={styles.segmentBadgeText}>{totalUnread}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'requests' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Ionicons
              name="mail-unread"
              size={15}
              color={activeTab === 'requests' ? '#0284C7' : '#64748B'}
            />
            <Text style={[styles.segmentText, activeTab === 'requests' && styles.segmentTextActive]}>
              Requests
            </Text>
            {requests.length > 0 && (
              <View style={[styles.segmentBadge, styles.requestBadgeColor]}>
                <Text style={styles.segmentBadgeText}>{requests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── TAB 1: CHATS ── */}
      {activeTab === 'chats' && (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* New Matches Carousel */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>New Matches</Text>
            <Text style={styles.matchesCountBadge}>{displayMatches.length}</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.newMatchesScrollView}
            contentContainerStyle={styles.newMatchesScroll}
          >
            {displayMatches.map((profile) => (
              <TouchableOpacity
                key={profile.id}
                activeOpacity={0.8}
                style={styles.matchAvatarItem}
                onPress={() => onOpenChat(profile)}
              >
                <View style={styles.matchAvatarWrapper}>
                  <Image
                    source={typeof profile.image === 'string' ? { uri: profile.image } : profile.image}
                    style={styles.matchAvatar}
                    contentFit="cover"
                  />
                  {profile.online && <View style={styles.onlineDot} />}
                  <View style={styles.matchPercentageBadge}>
                    <Text style={styles.matchPercentageText}>{profile.matchPercentage}%</Text>
                  </View>
                </View>
                <Text style={styles.matchName} numberOfLines={1}>
                  {profile.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Pending Requests Banner Callout if any */}
          {requests.length > 0 && (
            <TouchableOpacity
              style={styles.requestsBanner}
              activeOpacity={0.85}
              onPress={() => setActiveTab('requests')}
            >
              <View style={styles.requestsBannerIcon}>
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestsBannerTitle}>
                  {requests.length} new Message {requests.length === 1 ? 'Request' : 'Requests'}
                </Text>
                <Text style={styles.requestsBannerSubtitle}>
                  Someone reached out to break the ice before matching!
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#0284C7" />
            </TouchableOpacity>
          )}

          {/* Recent Conversations */}
          <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>Recent Chats</Text>
          </View>

          <View style={styles.conversationsList}>
            {filteredConversations.map((item) => (
              <TouchableOpacity
                key={item.profileId}
                activeOpacity={0.8}
                style={[
                  styles.conversationItem,
                  item.unreadCount > 0 && styles.conversationItemUnread,
                ]}
                onPress={() => onOpenChat(item.partner)}
              >
                <View style={styles.convAvatarWrapper}>
                  <Image
                    source={
                      typeof item.partner.image === 'string'
                        ? { uri: item.partner.image }
                        : item.partner.image
                    }
                    style={styles.convAvatar}
                    contentFit="cover"
                  />
                  {item.partner.online && <View style={styles.convOnlineDot} />}
                </View>

                <View style={styles.convContent}>
                  <View style={styles.convTopRow}>
                    <View style={styles.nameRow}>
                      <Text style={styles.convName}>
                        {item.partner.name}, {item.partner.age}
                      </Text>
                      {item.partner.isVerified && (
                        <Ionicons name="checkmark-circle" size={16} color="#0EA5E9" style={{ marginLeft: 4 }} />
                      )}
                    </View>
                    <Text style={[styles.convTime, item.unreadCount > 0 && styles.convTimeActive]}>
                      {item.timestamp}
                    </Text>
                  </View>

                  <View style={styles.convBottomRow}>
                    <Text
                      style={[styles.convLastMessage, item.unreadCount > 0 && styles.convLastMessageUnread]}
                      numberOfLines={1}
                    >
                      {item.lastMessage}
                    </Text>
                    <View style={styles.convRightMeta}>
                      {item.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.convVideoBtn}
                        activeOpacity={0.7}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          onOpenChat(item.partner, 'video');
                        }}
                        accessibilityLabel={`Start video call with ${item.partner.name}`}
                      >
                        <Ionicons name="videocam-outline" size={17} color="#0284C7" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── TAB 2: MESSAGE REQUESTS (BEFORE MATCH) ── */}
      {activeTab === 'requests' && (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Requests Informational Banner */}
          <View style={styles.requestsIntroCard}>
            <Ionicons name="shield-checkmark" size={24} color="#0284C7" style={{ marginBottom: 6 }} />
            <Text style={styles.requestsIntroTitle}>Message Requests</Text>
            <Text style={styles.requestsIntroSubtitle}>
              People who sent an introductory note before matching. Accepting creates a mutual match and opens continuous chat. Calls remain locked until accepted.
            </Text>
          </View>

          {filteredRequests.length === 0 ? (
            <View style={styles.emptyRequestsContainer}>
              <Ionicons name="mail-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyRequestsTitle}>No Pending Requests</Text>
              <Text style={styles.emptyRequestsSubtitle}>
                When someone sends you an introductory message before matching, it will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {filteredRequests.map((reqItem) => {
                const isProcessing = processingRequestId === reqItem.id;
                return (
                  <View key={reqItem.id} style={styles.requestCard}>
                    {/* Top Sender Row */}
                    <View style={styles.requestTopRow}>
                      <Image
                        source={
                          typeof reqItem.sender.image === 'string'
                            ? { uri: reqItem.sender.image }
                            : reqItem.sender.image
                        }
                        style={styles.requestAvatar}
                        contentFit="cover"
                      />
                      <View style={styles.requestSenderMeta}>
                        <View style={styles.nameRow}>
                          <Text style={styles.requestName}>
                            {reqItem.sender.name}, {reqItem.sender.age}
                          </Text>
                          {reqItem.sender.isVerified && (
                            <Ionicons name="checkmark-circle" size={15} color="#0EA5E9" style={{ marginLeft: 4 }} />
                          )}
                        </View>
                        <Text style={styles.requestLocation}>
                          <Ionicons name="navigate" size={12} color="#0EA5E9" /> Crossed paths near {reqItem.sender.location}
                        </Text>
                      </View>
                      <Text style={styles.requestTime}>{reqItem.timestamp}</Text>
                    </View>

                    {/* Introductory Message Bubble */}
                    <View style={styles.introMessageBubble}>
                      <Ionicons name="chatbox-ellipses" size={16} color="#0284C7" style={{ marginRight: 6 }} />
                      <Text style={styles.introMessageText}>“{reqItem.message}”</Text>
                    </View>

                    {/* Accept & Decline Buttons */}
                    <View style={styles.requestActionsRow}>
                      <TouchableOpacity
                        style={[styles.requestDeclineBtn, isProcessing && { opacity: 0.6 }]}
                        disabled={isProcessing}
                        onPress={() => handleDeclineRequest(reqItem)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle-outline" size={18} color="#64748B" />
                        <Text style={styles.requestDeclineText}>Decline</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.requestAcceptBtn, isProcessing && { opacity: 0.6 }]}
                        disabled={isProcessing}
                        onPress={() => handleAcceptRequest(reqItem)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#0EA5E9', '#0284C7']}
                          style={styles.requestAcceptGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          {isProcessing ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.requestAcceptText}>Accept & Match</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
    paddingBottom: 85, // CustomTabBar clearance
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  totalUnreadBadge: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  totalUnreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  segmentBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  requestBadgeColor: {
    backgroundColor: '#F59E0B',
  },
  segmentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  matchesCountBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newMatchesScrollView: {
    marginHorizontal: -18,
  },
  newMatchesScroll: {
    paddingHorizontal: 18,
    gap: 14,
  },
  matchAvatarItem: {
    alignItems: 'center',
    width: 68,
  },
  matchAvatarWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  matchAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  matchPercentageBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  matchPercentageText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  matchName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  requestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  requestsBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  requestsBannerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  conversationsList: {
    gap: 10,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  conversationItemUnread: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F8FCFF',
  },
  convAvatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  convAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  convOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  convContent: {
    flex: 1,
  },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  convName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  convTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  convTimeActive: {
    color: '#0284C7',
    fontWeight: '600',
  },
  convBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convLastMessage: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
    marginRight: 8,
  },
  convLastMessageUnread: {
    color: '#0F172A',
    fontWeight: '600',
  },
  convRightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    backgroundColor: '#0EA5E9',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  convVideoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Requests Tab Styles
  requestsIntroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  requestsIntroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  requestsIntroSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  emptyRequestsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyRequestsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
  },
  emptyRequestsSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  requestsList: {
    gap: 14,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  requestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  requestSenderMeta: {
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  requestLocation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  requestTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  introMessageBubble: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  introMessageText: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  requestActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  requestDeclineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 10,
    gap: 6,
  },
  requestDeclineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  requestAcceptBtn: {
    flex: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  requestAcceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  requestAcceptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
