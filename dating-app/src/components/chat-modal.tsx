import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Profile, ChatMessage } from '@/types';
import { API_ENDPOINTS } from '@/constants/api';
import { getSocket } from '@/services/socket';
import { useWebRTC, RTCViewModule } from '@/hooks/useWebRTC';
import { ReportModal } from './report-modal';

/**
 * Web audio stream component rendering incoming voice feed on Web
 */
const WebAudioElement = ({ stream }: { stream: any }) => {
  const audioRef = useRef<any>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      try {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(() => {});
      } catch (e) {}
    }
  }, [stream]);

  if (Platform.OS !== 'web' || !stream) return null;

  return React.createElement('audio', {
    ref: audioRef,
    autoPlay: true,
    playsInline: true,
  });
};

/**
 * Web video stream component rendering real hardware video feed when available on Web
 */
const WebVideoElement = ({
  stream,
  isMuted = false,
}: {
  stream: MediaStream | null;
  isMuted?: boolean;
}) => {
  const videoRef = useRef<any>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      try {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      } catch (e) {}
    }
  }, [stream]);

  if (Platform.OS !== 'web' || !stream) return null;

  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    muted: isMuted,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      zIndex: 1,
    },
  });
};

interface ChatModalProps {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  initialCallType?: 'none' | 'audio' | 'video';
  isIncomingCallAccepted?: boolean;
  incomingCallId?: string;
  currentUser?: { id?: string; name?: string; image?: string | null } | null;
  onUnmatched?: (partnerId: string) => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  visible,
  profile,
  onClose,
  initialCallType = 'none',
  isIncomingCallAccepted = false,
  incomingCallId = '',
  currentUser,
  onUnmatched,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMatch, setIsMatch] = useState<boolean>(false);
  const [canCall, setCanCall] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active call state
  const [activeCallType, setActiveCallType] = useState<'none' | 'audio' | 'video'>(initialCallType);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── WEBRTC INTEGRATION ──
  const webrtc = useWebRTC({
    partnerId: profile?.id || '',
    currentUser: {
      id: currentUser?.id || '',
      name: currentUser?.name || 'You',
      image: currentUser?.image || null,
    },
    onCallEnded: (timeSpent) => {
      const durationStr = formatDuration(timeSpent);
      const callLabel = activeCallType === 'video' ? '📹 Video call' : '📞 Voice call';
      const logMsg: ChatMessage = {
        id: `call-${Date.now()}`,
        senderId: 'system',
        text: `${callLabel} ended • ${durationStr}`,
        timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        isMine: false,
      };
      setMessages((prev) => [...prev, logMsg]);
      setActiveCallType('none');
    },
  });

  // Fetch real messages from PostgreSQL database
  const fetchMessages = async () => {
    if (!profile) return;
    try {
      const res = await fetch(API_ENDPOINTS.getChatMessages(profile.id), {
        credentials: 'include',
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setIsMatch(Boolean(data.isMatch));
        setCanCall(Boolean(data.canCall));
      }
    } catch (err) {
      console.log('Chat fetch error:', err);
    }
  };

  // On open or profile switch: fetch history and start background sync
  useEffect(() => {
    if (visible && profile) {
      setMessages([]); // Clean state for new conversation
      fetchMessages();

      const pollTimer = setInterval(() => {
        fetchMessages();
      }, 5000);

      return () => clearInterval(pollTimer);
    } else if (!visible) {
      setMessages([]);
    }
  }, [visible, profile?.id]);

  // Real-time socket message delivery & typing events
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !profile) return;

    const handleNewMessage = (data: { message: ChatMessage; partnerId: string }) => {
      if (data.partnerId === profile.id || data.message.senderId === profile.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    const handleTyping = (data: { fromUserId: string; isTyping: boolean }) => {
      if (data.fromUserId === profile.id) {
        setIsPartnerTyping(Boolean(data.isTyping));
      }
    };

    const handleUnmatchedOrBlocked = (data: { partnerId?: string; blockerId?: string }) => {
      if (data?.partnerId === profile.id || data?.blockerId === profile.id) {
        Alert.alert('Conversation Closed', `This connection with ${profile.name} is no longer active.`);
        onClose();
        if (onUnmatched) onUnmatched(profile.id);
      }
    };

    socket.on('chat:new_message', handleNewMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:unmatched', handleUnmatchedOrBlocked);
    socket.on('chat:blocked', handleUnmatchedOrBlocked);

    return () => {
      socket.off('chat:new_message', handleNewMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:unmatched', handleUnmatchedOrBlocked);
      socket.off('chat:blocked', handleUnmatchedOrBlocked);
    };
  }, [profile?.id]);

  // Sync initialCallType when modal opens
  useEffect(() => {
    if (visible && initialCallType !== 'none') {
      if (canCall || isMatch) {
        setActiveCallType(initialCallType);
        if (isIncomingCallAccepted && incomingCallId) {
          // ACCEPTING INCOMING CALL: connect session directly WITHOUT calling startCall!
          webrtc.acceptCall(initialCallType, incomingCallId);
        } else {
          // OUTGOING CALL: user clicked call button
          webrtc.startCall(initialCallType);
        }
      } else {
        Alert.alert(
          'Calls Locked 🔒',
          `For safety and privacy, voice and video calls unlock after you and ${profile?.name || 'your match'} have mutually matched.`
        );
      }
    }
  }, [visible, initialCallType, isIncomingCallAccepted, incomingCallId, canCall, isMatch]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [visible, messages]);

  if (!profile) return null;

  const handleStartCall = (type: 'audio' | 'video') => {
    if (!canCall && !isMatch) {
      Alert.alert(
        'Calls Locked 🔒',
        `For safety and privacy, voice and video calls are only available after you and ${profile.name} have mutually matched.`
      );
      return;
    }
    setActiveCallType(type);
    webrtc.startCall(type);
  };

  const handleEndCall = () => {
    webrtc.endCall();
    setActiveCallType('none');
  };

  const handleUnmatch = () => {
    if (!profile) return;
    const doUnmatch = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.unmatch, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: profile.id }),
        });
        const data = await res.json();
        if (data?.success) {
          Alert.alert('Unmatched', `You have unmatched with ${profile.name}. Chat deleted.`);
          onClose();
          if (onUnmatched) onUnmatched(profile.id);
        } else {
          Alert.alert('Error', data?.message || 'Could not unmatch.');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to connect to server.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Unmatch with ${profile.name}? This will dissolve the match, permanently delete your chat, and prevent rematching.`)) {
        doUnmatch();
      }
    } else {
      Alert.alert(
        `Unmatch with ${profile.name}?`,
        'This will dissolve the match, permanently delete your chat history, and prevent future matching.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unmatch', style: 'destructive', onPress: doUnmatch },
        ]
      );
    }
  };

  const handleBlock = () => {
    if (!profile) return;
    const doBlock = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.blockUser, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: profile.id }),
        });
        const data = await res.json();
        if (data?.success) {
          Alert.alert('Blocked', `${profile.name} has been blocked.`);
          onClose();
          if (onUnmatched) onUnmatched(profile.id);
        } else {
          Alert.alert('Error', data?.message || 'Could not block user.');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to connect to server.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Block ${profile.name}? You will no longer see each other anywhere on the app.`)) {
        doBlock();
      }
    } else {
      Alert.alert(
        `Block ${profile.name}?`,
        'Neither of you will see each other on the radar, in the swipe feed, or in messages.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: doBlock },
        ]
      );
    }
  };

  const handleMoreOptions = () => {
    if (!profile) return;
    Alert.alert(
      `${profile.name}`,
      `Safety & conversation options for ${profile.name}`,
      [
        {
          text: 'View Full Profile',
          onPress: () => Alert.alert('Profile', `${profile.name}, ${profile.age} • ${profile.location}`),
        },
        {
          text: 'Report Profile 🛡️',
          style: 'destructive',
          onPress: () => setShowReportModal(true),
        },
        {
          text: `Unmatch with ${profile.name}`,
          style: 'destructive',
          onPress: handleUnmatch,
        },
        {
          text: `Block ${profile.name}`,
          style: 'destructive',
          onPress: handleBlock,
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleInputChange = (text: string) => {
    setInputMessage(text);
    const socket = getSocket();
    if (socket && profile) {
      socket.emit('chat:typing', { partnerId: profile.id, isTyping: true });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('chat:typing', { partnerId: profile.id, isTyping: false });
      }, 2000);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending) return;

    // Clear typing status immediately
    const socket = getSocket();
    if (socket && profile) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit('chat:typing', { partnerId: profile.id, isTyping: false });
    }

    const tempId = `temp-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: tempId,
      senderId: 'me',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      isMine: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');

    try {
      setIsSending(true);
      const res = await fetch(API_ENDPOINTS.sendMessage(profile.id), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (data?.success && data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data.message, isMine: true } : m))
        );
      } else if (data?.code === 'MATCH_REQUIRED' || res.status === 403) {
        // Fallback: automatically deliver as introductory Message Request
        try {
          const reqRes = await fetch(API_ENDPOINTS.sendMessageRequest, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId: profile.id, message: text }),
          });
          const reqData = await reqRes.json();
          if (reqData?.success) {
            Alert.alert(
              'Message Request Sent! 💌',
              `Your message request was delivered to ${profile.name}. When they accept, full mutual chat will open!`
            );
            fetchMessages();
            return;
          } else {
            Alert.alert('Notice', reqData?.message || data?.message || 'Failed to send message request.');
          }
        } catch (reqErr) {
          Alert.alert('Notice', data?.message || 'Failed to deliver message request.');
        }
      }
    } catch (err) {
      console.warn('Real message sending notice:', err);
    } finally {
      setIsSending(false);
    }

    // Refresh history in 2s as a fallback
    setTimeout(fetchMessages, 2000);
  };

  const quickReplies = ['Hey there! 👋', 'Coffee sometime? ☕', 'Great profile! ✨'];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={26} color="#1E293B" />
          </TouchableOpacity>

          <View style={styles.profileMeta}>
            <View style={styles.avatarContainer}>
              <Image source={profile.image} style={styles.headerAvatar} contentFit="cover" />
              {profile.online && <View style={styles.onlineBadge} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {profile.name}, {profile.age}
                </Text>
                {profile.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color="#0EA5E9" style={styles.verified} />
                )}
              </View>
              <Text style={styles.headerStatus}>
                {profile.online ? 'Online now' : 'Crossed paths recently'}
              </Text>
            </View>
          </View>

          {/* Header Action Buttons: Phone Call, Video Call, and More Options */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionCircle}
              activeOpacity={0.7}
              onPress={() => handleStartCall('audio')}
              accessibilityLabel="Start voice call"
            >
              <Ionicons name="call-outline" size={19} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCircle}
              activeOpacity={0.7}
              onPress={() => handleStartCall('video')}
              accessibilityLabel="Start video call"
            >
              <Ionicons name="videocam-outline" size={20} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCircle}
              activeOpacity={0.7}
              onPress={handleMoreOptions}
              accessibilityLabel="More conversation options"
            >
              <Ionicons name="ellipsis-vertical" size={19} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Crossed Paths Banner */}
        <View style={styles.encounterBanner}>
          <Ionicons name="navigate-circle" size={20} color="#0EA5E9" />
          <Text style={styles.encounterBannerText}>
            You crossed paths near <Text style={styles.boldText}>{profile.location}</Text> ({profile.encountersCount} times)
          </Text>
        </View>

        {/* Introductory Message Request Banner when not yet mutually matched */}
        {!isMatch && (
          <View style={styles.requestNoticeBanner}>
            <Ionicons name="sparkles" size={15} color="#0284C7" />
            <Text style={styles.requestNoticeText}>
              Introductory Note • Say hi to break the ice! When {profile.name} replies, full chat will unlock.
            </Text>
          </View>
        )}

        {/* Messages List */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={styles.timestampDivider}>
            <Text style={styles.timestampDividerText}>Today</Text>
          </View>

          {messages.map((msg) => {
            // Check if this is a system call log entry
            if (msg.senderId === 'system') {
              const isVideo = msg.text.includes('Video');
              return (
                <View key={msg.id} style={styles.callLogWrapper}>
                  <View style={styles.callLogPill}>
                    <Ionicons
                      name={isVideo ? 'videocam' : 'call'}
                      size={14}
                      color="#0284C7"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.callLogText}>{msg.text}</Text>
                  </View>
                </View>
              );
            }

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  msg.isMine ? styles.myMessageRow : styles.theirMessageRow,
                ]}
              >
                {!msg.isMine && (
                  <Image source={profile.image} style={styles.bubbleAvatar} contentFit="cover" />
                )}
                <View
                  style={[
                    styles.messageBubble,
                    msg.isMine ? styles.myMessageBubble : styles.theirMessageBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      msg.isMine ? styles.myMessageText : styles.theirMessageText,
                    ]}
                  >
                    {msg.text}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      msg.isMine ? styles.myMessageTime : styles.theirMessageTime,
                    ]}
                  >
                    {msg.timestamp}
                  </Text>
                </View>
              </View>
            );
          })}
          {isPartnerTyping && (
            <View style={styles.typingContainer}>
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
              <Text style={styles.typingText}>{profile.name} is typing...</Text>
            </View>
          )}
        </ScrollView>

        {/* Quick Reply Chips */}
        <View style={styles.quickRepliesRow}>
          {quickReplies.map((chip, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.quickChip}
              onPress={() => handleSendMessage(chip)}
            >
              <Text style={styles.quickChipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder={`Message ${profile.name}...`}
            placeholderTextColor="#94A3B8"
            value={inputMessage}
            onChangeText={handleInputChange}
            onSubmitEditing={() => handleSendMessage()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendButton, inputMessage.trim().length > 0 && styles.sendButtonActive]}
            onPress={() => handleSendMessage()}
            disabled={inputMessage.trim().length === 0}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ── INTERACTIVE VIDEO CALL OVERLAY ── */}
        {activeCallType === 'video' && (
          <View style={styles.callOverlayContainer}>
            {/* Full-bleed video stream of match (with hardware WebRTC feed if available) */}
            <Image
              source={profile.image}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            {Platform.OS === 'web' && webrtc.remoteStream && (
              <WebVideoElement stream={webrtc.remoteStream} isMuted={false} />
            )}
            {Platform.OS !== 'web' && webrtc.remoteStream && RTCViewModule && (
              <RTCViewModule
                streamURL={typeof webrtc.remoteStream.toURL === 'function' ? webrtc.remoteStream.toURL() : ''}
                style={StyleSheet.absoluteFill}
                objectFit="cover"
                zOrder={0}
              />
            )}
            
            <LinearGradient
              colors={['rgba(15, 23, 42, 0.75)', 'transparent', 'rgba(15, 23, 42, 0.9)']}
              style={StyleSheet.absoluteFill}
            />

            {/* Top Video Call Bar */}
            <View style={styles.callTopBar}>
              <TouchableOpacity
                style={styles.callMinimizeBtn}
                onPress={() => setActiveCallType('none')}
              >
                <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.callHeaderInfo}>
                <Text style={styles.callHeaderName}>{profile.name}, {profile.age}</Text>
                <View style={styles.callLiveRow}>
                  <View style={styles.callLiveDot} />
                  <Text style={styles.callStatusText}>
                    {webrtc.callStatus === 'calling'
                      ? 'Calling...'
                      : webrtc.callStatus === 'ringing'
                      ? 'Ringing...'
                      : webrtc.duration === 0
                      ? 'Connecting...'
                      : `Connected • ${formatDuration(webrtc.duration)}`}
                  </Text>
                </View>
              </View>

              <View style={styles.callQualityPill}>
                <Text style={styles.callQualityText}>HD 1080p</Text>
              </View>
            </View>

            {/* Picture-in-Picture (PiP) Self Preview Window */}
            <View style={styles.pipSelfWindow}>
              {webrtc.isVideoMuted ? (
                <View style={styles.pipCameraOff}>
                  <Ionicons name="videocam-off" size={22} color="#94A3B8" />
                  <Text style={styles.pipCameraOffText}>Camera Off</Text>
                </View>
              ) : (
                <>
                  {currentUser?.image ? (
                    <Image
                      source={{ uri: currentUser.image }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="person" size={24} color="#94A3B8" />
                    </View>
                  )}
                  {Platform.OS === 'web' && webrtc.localStream && (
                    <WebVideoElement stream={webrtc.localStream} isMuted={true} />
                  )}
                  {Platform.OS !== 'web' && webrtc.localStream && RTCViewModule && (
                    <RTCViewModule
                      streamURL={typeof webrtc.localStream.toURL === 'function' ? webrtc.localStream.toURL() : ''}
                      style={StyleSheet.absoluteFill}
                      objectFit="cover"
                      mirror={webrtc.isFrontCamera}
                      zOrder={1}
                    />
                  )}
                </>
              )}
              <View style={styles.pipLabelBadge}>
                <Text style={styles.pipLabelText}>You</Text>
              </View>
            </View>

            {/* Bottom Floating Control Bar */}
            <View style={styles.callControlsContainer}>
              <View style={styles.callControlsGlass}>
                {/* Flip camera */}
                <TouchableOpacity
                  style={[styles.callControlCircle, !webrtc.isFrontCamera && styles.callControlActive]}
                  onPress={webrtc.flipCamera}
                >
                  <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Mute Mic */}
                <TouchableOpacity
                  style={[styles.callControlCircle, webrtc.isMicMuted && styles.callControlMuted]}
                  onPress={webrtc.toggleMic}
                >
                  <Ionicons
                    name={webrtc.isMicMuted ? 'mic-off' : 'mic-outline'}
                    size={22}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Toggle Video */}
                <TouchableOpacity
                  style={[styles.callControlCircle, webrtc.isVideoMuted && styles.callControlMuted]}
                  onPress={webrtc.toggleVideo}
                >
                  <Ionicons
                    name={webrtc.isVideoMuted ? 'videocam-off' : 'videocam-outline'}
                    size={22}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Speaker Toggle */}
                <TouchableOpacity
                  style={[styles.callControlCircle, isSpeakerOn && styles.callControlActive]}
                  onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                >
                  <Ionicons
                    name={isSpeakerOn ? 'volume-high-outline' : 'volume-mute-outline'}
                    size={22}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* End Call Button */}
                <TouchableOpacity
                  style={styles.callEndCircle}
                  onPress={handleEndCall}
                >
                  <Ionicons
                    name="call"
                    size={24}
                    color="#FFFFFF"
                    style={{ transform: [{ rotate: '135deg' }] }}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── INTERACTIVE AUDIO CALL OVERLAY ── */}
        {activeCallType === 'audio' && (
          <View style={styles.callOverlayContainer}>
            <LinearGradient
              colors={['#0369A1', '#0F172A', '#0284C7']}
              style={StyleSheet.absoluteFill}
            />

            {/* Audio playback stream on Web */}
            {Platform.OS === 'web' && webrtc.remoteStream && (
              <WebAudioElement stream={webrtc.remoteStream} />
            )}

            {/* Top Bar */}
            <View style={styles.callTopBar}>
              <TouchableOpacity
                style={styles.callMinimizeBtn}
                onPress={() => setActiveCallType('none')}
              >
                <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.callQualityPill}>
                <Ionicons name="lock-closed" size={12} color="#38BDF8" style={{ marginRight: 4 }} />
                <Text style={styles.callQualityText}>Encrypted</Text>
              </View>
            </View>

            {/* Audio Call Center Avatar & Pulse Rings */}
            <View style={styles.audioCenterContent}>
              <View style={styles.audioPulseOuter}>
                <View style={styles.audioPulseMiddle}>
                  <Image
                    source={profile.image}
                    style={styles.audioAvatar}
                    contentFit="cover"
                  />
                </View>
              </View>

              <Text style={styles.audioProfileName}>{profile.name}, {profile.age}</Text>
              <Text style={styles.audioStatusText}>
                {webrtc.callStatus === 'calling'
                  ? 'Calling...'
                  : webrtc.callStatus === 'ringing'
                  ? 'Ringing...'
                  : webrtc.duration === 0
                  ? 'Connecting...'
                  : `In Voice Call • ${formatDuration(webrtc.duration)}`}
              </Text>
            </View>

            {/* Bottom Floating Control Bar */}
            <View style={styles.callControlsContainer}>
              <View style={styles.callControlsGlass}>
                {/* Mute Mic */}
                <TouchableOpacity
                  style={[styles.callControlCircle, webrtc.isMicMuted && styles.callControlMuted]}
                  onPress={webrtc.toggleMic}
                >
                  <Ionicons
                    name={webrtc.isMicMuted ? 'mic-off' : 'mic-outline'}
                    size={22}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Speaker Toggle */}
                <TouchableOpacity
                  style={[styles.callControlCircle, isSpeakerOn && styles.callControlActive]}
                  onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                >
                  <Ionicons
                    name={isSpeakerOn ? 'volume-high-outline' : 'volume-mute-outline'}
                    size={22}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Switch to Video */}
                <TouchableOpacity
                  style={styles.callControlCircle}
                  onPress={() => {
                    setActiveCallType('video');
                    webrtc.startCall('video');
                  }}
                >
                  <Ionicons name="videocam-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                {/* End Call Button */}
                <TouchableOpacity
                  style={styles.callEndCircle}
                  onPress={handleEndCall}
                >
                  <Ionicons
                    name="call"
                    size={24}
                    color="#FFFFFF"
                    style={{ transform: [{ rotate: '135deg' }] }}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Report User Modal */}
        <ReportModal
          visible={showReportModal}
          profile={profile}
          onClose={() => setShowReportModal(false)}
          onReportSubmitted={(reportedId, wasBlocked) => {
            if (wasBlocked) {
              onClose();
              if (onUnmatched) onUnmatched(reportedId);
            }
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  profileMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  avatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E8F0',
  },
  onlineBadge: {
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  verified: {
    marginTop: 1,
  },
  headerStatus: {
    fontSize: 12,
    color: '#64748B',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  encounterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E0F2FE',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  encounterBannerText: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1,
  },
  requestNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
  },
  requestNoticeText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '500',
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  timestampDivider: {
    alignItems: 'center',
    marginVertical: 12,
  },
  timestampDividerText: {
    fontSize: 11,
    color: '#94A3B8',
    backgroundColor: '#E2E8F0',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  callLogWrapper: {
    alignItems: 'center',
    marginVertical: 10,
  },
  callLogPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  callLogText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    gap: 8,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#0EA5E9',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#1E293B',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirMessageTime: {
    color: '#94A3B8',
  },
  quickRepliesRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  quickChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  quickChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0F172A',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#0EA5E9',
  },

  /* Call Overlay Styles */
  callOverlayContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A',
    zIndex: 999,
  },
  callTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: 20,
    paddingBottom: 14,
    zIndex: 10,
  },
  callMinimizeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callHeaderInfo: {
    alignItems: 'center',
  },
  callHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  callLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  callLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  callStatusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  callQualityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  callQualityText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pipSelfWindow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    right: 18,
    width: 105,
    height: 145,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  pipCameraOff: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    gap: 4,
  },
  pipCameraOffText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  pipLabelBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  pipLabelText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  callControlsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  callControlsGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 36,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  callControlCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callControlActive: {
    backgroundColor: '#0284C7',
  },
  callControlMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.6)',
  },
  callEndCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  /* Audio Call Overlay */
  audioCenterContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  audioPulseOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  audioPulseMiddle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#38BDF8',
  },
  audioProfileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  audioStatusText: {
    fontSize: 14,
    color: '#BAE6FD',
    fontWeight: '500',
  },

  /* Real-time Typing Indicator */
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
    marginRight: 4,
    opacity: 0.75,
  },
  typingText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginLeft: 4,
    fontWeight: '500',
  },
});
