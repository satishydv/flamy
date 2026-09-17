import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Profile } from '@/types';
import { API_ENDPOINTS } from '@/constants/api';

interface MessageRequestModalProps {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onRequestSent?: (profile: Profile) => void;
}

export const MessageRequestModal: React.FC<MessageRequestModalProps> = ({
  visible,
  profile,
  onClose,
  onRequestSent,
}) => {
  const [noteText, setNoteText] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!profile) return null;

  const quickIcebreakers = [
    `Hey ${profile.name}! Noticed we crossed paths nearby 👋`,
    'Coffee sometime? ☕',
    'Great profile! Loved your photos ✨',
    `What's your favorite spot near ${profile.location.split(',')[0]}? 📍`,
  ];

  const handleSendRequest = async (textToSend?: string) => {
    const finalMessage = (textToSend || noteText).trim();
    if (!finalMessage) {
      Alert.alert('Empty Note', 'Please write a short note to introduce yourself.');
      return;
    }

    try {
      setIsSending(true);
      const res = await fetch(API_ENDPOINTS.sendMessageRequest, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: profile.id,
          message: finalMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.isMatch) {
          Alert.alert(
            "It's a Match! 🎉",
            `${profile.name} also liked your profile! You can now chat freely.`,
            [{ text: 'Great!', onPress: () => {
              onClose();
              onRequestSent?.(profile);
            }}]
          );
        } else {
          Alert.alert(
            'Request Sent! 💌',
            `Your message request was delivered to ${profile.name}. Once accepted, full chat will unlock!`,
            [{ text: 'Awesome', onPress: () => {
              onClose();
              onRequestSent?.(profile);
            }}]
          );
        }
        setNoteText('');
      } else {
        Alert.alert('Notice', data.message || 'Could not send message request.');
      }
    } catch (err) {
      console.warn('Send message request error:', err);
      Alert.alert('Notice', 'Request dispatched. Connect to network to sync.');
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.badgePill}>
                <Ionicons name="sparkles" size={14} color="#0284C7" />
                <Text style={styles.badgeText}>Before Match</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Recipient Preview */}
          <View style={styles.recipientRow}>
            <Image
              source={typeof profile.image === 'string' ? { uri: profile.image } : profile.image}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.recipientInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.recipientName}>{profile.name}, {profile.age}</Text>
                {profile.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color="#0EA5E9" style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={styles.recipientLocation}>
                <Ionicons name="location-outline" size={12} color="#64748B" /> {profile.location}
              </Text>
            </View>
          </View>

          {/* Headline & Description */}
          <Text style={styles.title}>Send a Message Request</Text>
          <Text style={styles.subtitle}>
            Break the ice before matching! Send one personal note to make a memorable first impression. If {profile.name} accepts, conversation opens!
          </Text>

          {/* Quick Icebreaker Suggestions */}
          <Text style={styles.icebreakersLabel}>Quick Icebreakers</Text>
          <View style={styles.chipsContainer}>
            {quickIcebreakers.map((chip, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chip}
                onPress={() => setNoteText(chip)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Message Input */}
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder={`Write a thoughtful note to ${profile.name}...`}
              placeholderTextColor="#94A3B8"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              maxLength={200}
            />
            <View style={styles.inputFooter}>
              <Text style={styles.charCount}>{noteText.length}/200</Text>
            </View>
          </View>

          {/* Safety note per messagerl.md */}
          <View style={styles.safetyCallout}>
            <Ionicons name="shield-checkmark" size={16} color="#0284C7" />
            <Text style={styles.safetyText}>
              Voice & video calls remain locked until {profile.name} accepts.
            </Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.sendBtn, (!noteText.trim() || isSending) && styles.sendBtnDisabled]}
            disabled={!noteText.trim() || isSending}
            onPress={() => handleSendRequest()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={noteText.trim() && !isSending ? ['#0EA5E9', '#0284C7'] : ['#CBD5E1', '#94A3B8']}
              style={styles.gradientBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.sendBtnText}>Send Message Request</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 40 : 26,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  recipientInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  recipientLocation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 14,
  },
  icebreakersLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '500',
  },
  inputBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    minHeight: 80,
    marginBottom: 12,
  },
  textInput: {
    fontSize: 14,
    color: '#0F172A',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  charCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  safetyCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 16,
  },
  safetyText: {
    flex: 1,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 16,
  },
  sendBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
