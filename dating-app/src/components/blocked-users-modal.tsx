import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlockedUser } from '@/types';
import { API_ENDPOINTS } from '@/constants/api';

interface BlockedUsersModalProps {
  visible: boolean;
  onClose: () => void;
  onUserUnblocked?: (userId: string) => void;
}

export const BlockedUsersModal: React.FC<BlockedUsersModalProps> = ({
  visible,
  onClose,
  onUserUnblocked,
}) => {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const fetchBlocked = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_ENDPOINTS.getBlockedUsers, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.blockedUsers)) {
        setBlockedUsers(data.blockedUsers);
      } else {
        setBlockedUsers([]);
      }
    } catch (err) {
      console.warn('Fetch blocked users error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchBlocked();
    }
  }, [visible]);

  const handleUnblock = (user: BlockedUser) => {
    const doUnblock = async () => {
      try {
        setUnblockingId(user.id);
        const res = await fetch(API_ENDPOINTS.unblockUser(user.id), {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json();
        if (data?.success) {
          setBlockedUsers((prev) => prev.filter((b) => b.id !== user.id));
          if (onUserUnblocked) {
            onUserUnblocked(user.id);
          }
          Alert.alert('Unblocked', `${user.name} has been unblocked.`);
        } else {
          Alert.alert('Unblock Failed', data?.message || 'Could not unblock user.');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to connect to safety server.');
      } finally {
        setUnblockingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to unblock ${user.name}?`)) {
        doUnblock();
      }
    } else {
      Alert.alert(
        `Unblock ${user.name}?`,
        'They will be able to see your profile on the radar and in the swipe feed again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unblock', style: 'destructive', onPress: doUnblock },
        ]
      );
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="ban-outline" size={22} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>Blocked Accounts</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subheading}>
            Blocked people cannot see your profile, message you, or find you on the radar map.
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0284C7" />
              <Text style={styles.loadingText}>Loading blocked accounts...</Text>
            </View>
          ) : blockedUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="shield-checkmark" size={36} color="#0284C7" />
              </View>
              <Text style={styles.emptyTitle}>No Blocked Accounts</Text>
              <Text style={styles.emptyDesc}>
                Profiles you block in chat or from reports will appear here. You can unblock them anytime.
              </Text>
            </View>
          ) : (
            <FlatList
              data={blockedUsers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={styles.userRow}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={20} color="#94A3B8" />
                    </View>
                  )}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.blockedDate}>Blocked on {formatDate(item.blockedAt)}</Text>
                    {item.reason && <Text style={styles.blockedReason}>Reason: {item.reason}</Text>}
                  </View>

                  <TouchableOpacity
                    style={styles.unblockBtn}
                    onPress={() => handleUnblock(item)}
                    disabled={unblockingId === item.id}
                  >
                    {unblockingId === item.id ? (
                      <ActivityIndicator size="small" color="#475569" />
                    ) : (
                      <Text style={styles.unblockBtnText}>Unblock</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '75%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
  },
  subheading: {
    fontSize: 13,
    color: '#64748B',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  blockedDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  blockedReason: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
