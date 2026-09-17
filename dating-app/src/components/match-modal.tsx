import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Profile } from '@/types';

interface MatchModalProps {
  visible: boolean;
  profile: Profile | null;
  currentUserImage?: string | null;
  onClose: () => void;
  onSendMessage: (profile: Profile) => void;
}

const { width } = Dimensions.get('window');

export const MatchModal: React.FC<MatchModalProps> = ({
  visible,
  profile,
  currentUserImage,
  onClose,
  onSendMessage,
}) => {
  if (!profile) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.92)', 'rgba(30, 58, 138, 0.95)', 'rgba(15, 23, 42, 0.98)']}
          style={styles.gradientBackdrop}
        >
          {/* Sparkles / Floating Icons */}
          <View style={styles.sparkleTopLeft}>
            <Ionicons name="sparkles" size={28} color="#FBBF24" />
          </View>
          <View style={styles.sparkleTopRight}>
            <Ionicons name="heart" size={24} color="#F43F5E" />
          </View>

          {/* Title */}
          <Text style={styles.matchHeading}>It&apos;s a Match!</Text>
          <Text style={styles.matchSubheading}>
            You and <Text style={styles.highlightName}>{profile.name}</Text> have crossed paths and
            liked each other.
          </Text>

          {/* Side by side Avatars */}
          <View style={styles.avatarsContainer}>
            <View style={styles.avatarWrapper}>
              {currentUserImage ? (
                <Image
                  source={{ uri: currentUserImage }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatarImage, { backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="person" size={32} color="#94A3B8" />
                </View>
              )}
            </View>

            <View style={styles.heartCenterBadge}>
              <LinearGradient colors={['#F43F5E', '#E11D48']} style={styles.heartGradient}>
                <Ionicons name="heart" size={24} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <View style={styles.avatarWrapper}>
              <Image source={profile.image} style={styles.avatarImage} contentFit="cover" />
            </View>
          </View>

          {/* Encounter badge reminder */}
          <View style={styles.encounterBadge}>
            <Ionicons name="location-sharp" size={14} color="#38BDF8" />
            <Text style={styles.encounterText}>
              Crossed paths {profile.encountersCount} times near {profile.location.split(',')[0]}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.sendMsgBtn}
              onPress={() => {
                onClose();
                onSendMessage(profile);
              }}
            >
              <LinearGradient
                colors={['#0EA5E9', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
                <Text style={styles.sendMsgText}>Send a Message</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} style={styles.keepSwipingBtn} onPress={onClose}>
              <Text style={styles.keepSwipingText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientBackdrop: {
    width: Math.min(width * 0.9, 440),
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
  },
  sparkleTopLeft: {
    position: 'absolute',
    top: 24,
    left: 28,
  },
  sparkleTopRight: {
    position: 'absolute',
    top: 24,
    right: 28,
  },
  matchHeading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  matchSubheading: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  highlightName: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#334155',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  heartCenterBadge: {
    position: 'absolute',
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  encounterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 32,
  },
  encounterText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '500',
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  sendMsgBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  btnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendMsgText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  keepSwipingBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  keepSwipingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
