import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface IncomingCallModalProps {
  visible: boolean;
  caller: {
    id: string;
    name?: string;
    image?: any;
    location?: string;
  } | null;
  callType: 'audio' | 'video';
  callId: string;
  onAccept: (callType: 'audio' | 'video', callId: string) => void;
  onDecline: (callId: string) => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  visible,
  caller,
  callType,
  callId,
  onAccept,
  onDecline,
}) => {
  const [ringTime, setRingTime] = useState(30);

  const onDeclineRef = React.useRef(onDecline);
  onDeclineRef.current = onDecline;

  // 30-second auto timeout if unaddressed
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (visible) {
      setRingTime(30);
      timer = setInterval(() => {
        setRingTime((prev) => {
          if (prev <= 1) {
            onDeclineRef.current(callId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible, callId]);

  if (!visible || !caller) return null;

  const defaultAvatar =
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={() => onDecline(callId)}
    >
      <View style={styles.overlayBackdrop}>
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.95)', '#0F172A', 'rgba(15, 23, 42, 0.98)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.callContent}>
          {/* Incoming Call Badge */}
          <View style={styles.badgeContainer}>
            <View style={styles.liveDot} />
            <Text style={styles.badgeText}>
              INCOMING {callType.toUpperCase()} CALL
            </Text>
          </View>

          {/* Caller Photo with Ring Wave effect */}
          <View style={styles.avatarContainer}>
            <View style={styles.outerRing} />
            <View style={styles.middleRing} />
            <Image
              source={caller.image || defaultAvatar}
              style={styles.callerAvatar}
              contentFit="cover"
            />
          </View>

          {/* Caller Details */}
          <Text style={styles.callerName}>{caller.name || 'Your Match'}</Text>
          <Text style={styles.callerSub}>
            {caller.location || 'Mutual Match'} • Ringing...
          </Text>

          {/* Ring Timeout Indicator */}
          <Text style={styles.timerText}>Auto-decline in {ringTime}s</Text>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {/* Decline Button */}
            <View style={styles.actionCol}>
              <TouchableOpacity
                style={styles.declineButton}
                activeOpacity={0.8}
                onPress={() => onDecline(callId)}
              >
                <Ionicons
                  name="call"
                  size={30}
                  color="#FFFFFF"
                  style={{ transform: [{ rotate: '135deg' }] }}
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Decline</Text>
            </View>

            {/* Accept Button */}
            <View style={styles.actionCol}>
              <TouchableOpacity
                style={styles.acceptButton}
                activeOpacity={0.8}
                onPress={() => onAccept(callType, callId)}
              >
                <Ionicons
                  name={callType === 'video' ? 'videocam' : 'call'}
                  size={30}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Accept</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayBackdrop: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        maxWidth: 480,
        marginHorizontal: 'auto',
        width: '100%',
        boxShadow: '0 0 50px rgba(0,0,0,0.5)',
      },
    }),
  },
  callContent: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginBottom: 36,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  badgeText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  avatarContainer: {
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  outerRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  middleRing: {
    position: 'absolute',
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  callerAvatar: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 3,
    borderColor: '#38BDF8',
  },
  callerName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  callerSub: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  timerText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 48,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 280,
    marginTop: 10,
  },
  actionCol: {
    alignItems: 'center',
  },
  declineButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  acceptButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  actionLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
});
