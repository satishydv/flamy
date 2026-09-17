import { useState, useRef, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { getSocket } from '@/services/socket';

// Conditional native WebRTC load to avoid crashes in Expo Go sandbox
let RTCPeerConnectionModule: any = null;
let RTCSessionDescriptionModule: any = null;
let RTCIceCandidateModule: any = null;
let mediaDevicesModule: any = null;
let RTCViewModule: any = null;

if (Platform.OS !== 'web') {
  try {
    const webrtc = require('react-native-webrtc');
    RTCPeerConnectionModule = webrtc.RTCPeerConnection;
    RTCSessionDescriptionModule = webrtc.RTCSessionDescription;
    RTCIceCandidateModule = webrtc.RTCIceCandidate;
    mediaDevicesModule = webrtc.mediaDevices;
    RTCViewModule = webrtc.RTCView;
  } catch (e) {
    console.warn('[WebRTC] react-native-webrtc not available in current environment (Expo Go sandbox):', e);
  }
}

export { RTCViewModule };

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface UseWebRTCOptions {
  partnerId: string;
  currentUser?: { id: string; name?: string; image?: any };
  onCallEnded?: (duration: number) => void;
  onCallConnected?: () => void;
}

export function useWebRTC({
  partnerId,
  currentUser,
  onCallEnded,
  onCallConnected,
}: UseWebRTCOptions) {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [activeCallType, setActiveCallType] = useState<'none' | 'audio' | 'video'>('none');
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [duration, setDuration] = useState(0);

  const pcRef = useRef<any | null>(null);
  const localStreamRef = useRef<any | null>(null);
  const isCallerRef = useRef<boolean>(false);
  const pendingCandidatesRef = useRef<any[]>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  durationRef.current = duration;

  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
  const isNativeWebRTC = Platform.OS !== 'web' && !!RTCPeerConnectionModule && !!mediaDevicesModule;
  const hasWebRTC = (isWeb && !!((window as any).RTCPeerConnection && navigator.mediaDevices)) || isNativeWebRTC;

  // Stop local hardware tracks and reset refs
  const stopLocalTracks = useCallback(() => {
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track: any) => {
          try {
            track.stop();
          } catch (e) {}
        });
      } catch (e) {}
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  // Cleanup all active connections and timers
  const cleanup = useCallback(() => {
    stopLocalTracks();
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }
    setRemoteStream(null);
    pendingCandidatesRef.current = [];
    isCallerRef.current = false;
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, [stopLocalTracks]);

  // Request user camera and microphone
  const acquireMedia = useCallback(
    async (type: 'audio' | 'video'): Promise<any | null> => {
      if (!hasWebRTC) {
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Mobile Development Build Required 📱',
            'Native camera and microphone access requires an Android development build (APK) with native WebRTC.\n\nStandard Expo Go does not include the WebRTC C++ binary. You can build the APK via:\n  npx expo run:android\n\nOr test live video/audio calls on web:\n  npx expo start --web',
            [{ text: 'Got It' }]
          );
        }
        return null;
      }

      try {
        const constraints: any = {
          audio: true,
          video:
            type === 'video'
              ? {
                  facingMode: isFrontCamera ? 'user' : 'environment',
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }
              : false,
        };

        let stream: any = null;
        if (isWeb) {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } else if (mediaDevicesModule) {
          stream = await mediaDevicesModule.getUserMedia(constraints);
        }

        if (stream) {
          localStreamRef.current = stream;
          setLocalStream(stream);
        }
        return stream;
      } catch (err) {
        console.warn('[WebRTC] Media acquisition error:', err);
        return null;
      }
    },
    [hasWebRTC, isWeb, isFrontCamera]
  );

  // Initialize RTCPeerConnection and bind event handlers
  const createPeerConnection = useCallback(() => {
    if (!hasWebRTC) return null;

    const PeerConnectionClass = isWeb ? (window as any).RTCPeerConnection : RTCPeerConnectionModule;
    if (!PeerConnectionClass) return null;

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    const pc = new PeerConnectionClass(ICE_SERVERS);
    pcRef.current = pc;

    // Send candidate packets to partner
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('call:signal', {
          toUserId: partnerId,
          signalData: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // Attach inbound remote media tracks
    pc.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Connection state:', state);
      if (state === 'connected') {
        setCallStatus('connected');
        onCallConnected?.();
      } else if (
        state === 'disconnected' ||
        state === 'failed' ||
        state === 'closed'
      ) {
        setCallStatus('ended');
      }
    };

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((track: any) => {
          try {
            pc.addTrack(track, localStreamRef.current);
          } catch (e) {}
        });
      } catch (e) {}
    }

    return pc;
  }, [hasWebRTC, isWeb, partnerId, onCallConnected]);

  // Duration ticker when call is active
  useEffect(() => {
    if (callStatus === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [callStatus]);

  // Socket event subscriptions
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Recipient phone is ringing
    const handleRinging = () => {
      setCallStatus('ringing');
    };

    // Recipient accepted call -> ONLY CALLER generates SDP Offer
    const handleAccepted = async (data: { isDemoSimulation?: boolean }) => {
      setCallStatus('connected');
      onCallConnected?.();

      if (data?.isDemoSimulation) {
        return;
      }

      // ONLY the initiator/caller creates the offer
      if (isCallerRef.current && hasWebRTC) {
        try {
          let pc = pcRef.current;
          if (!pc) {
            pc = createPeerConnection();
          }
          if (pc) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('call:signal', {
              toUserId: partnerId,
              signalData: { type: 'offer', sdp: offer.sdp },
            });
          }
        } catch (e) {
          console.warn('[WebRTC] Offer generation error:', e);
        }
      }
    };

    // Call was rejected by callee
    const handleRejected = () => {
      setCallStatus('ended');
      cleanup();
    };

    // Recipient is offline or busy
    const handleUnavailable = () => {
      setCallStatus('ended');
      cleanup();
    };

    // WebRTC Signaling packet (Offer / Answer / ICE Candidate)
    const handleSignal = async ({ signalData }: { signalData: any }) => {
      if (!signalData || !hasWebRTC) return;

      const SessionDescClass = isWeb ? (window as any).RTCSessionDescription : RTCSessionDescriptionModule;
      const IceCandidateClass = isWeb ? (window as any).RTCIceCandidate : RTCIceCandidateModule;

      try {
        if (signalData.type === 'offer') {
          // CALLEE receives offer from Caller
          let pc = pcRef.current;
          if (!pc) {
            pc = createPeerConnection();
          }
          if (pc && SessionDescClass) {
            await pc.setRemoteDescription(new SessionDescClass(signalData));

            // Apply any queued ICE candidates
            if (pendingCandidatesRef.current.length > 0 && IceCandidateClass) {
              for (const cand of pendingCandidatesRef.current) {
                try {
                  await pc.addIceCandidate(new IceCandidateClass(cand));
                } catch (e) {}
              }
              pendingCandidatesRef.current = [];
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit('call:signal', {
              toUserId: partnerId,
              signalData: { type: 'answer', sdp: answer.sdp },
            });

            setCallStatus('connected');
            onCallConnected?.();
          }
        } else if (signalData.type === 'answer') {
          // CALLER receives answer from Callee
          if (pcRef.current && SessionDescClass) {
            await pcRef.current.setRemoteDescription(new SessionDescClass(signalData));

            // Apply any queued ICE candidates
            if (pendingCandidatesRef.current.length > 0 && IceCandidateClass) {
              for (const cand of pendingCandidatesRef.current) {
                try {
                  await pcRef.current.addIceCandidate(new IceCandidateClass(cand));
                } catch (e) {}
              }
              pendingCandidatesRef.current = [];
            }
          }
        } else if (signalData.type === 'candidate' && signalData.candidate) {
          const pc = pcRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type && IceCandidateClass) {
            await pc.addIceCandidate(new IceCandidateClass(signalData.candidate));
          } else {
            pendingCandidatesRef.current.push(signalData.candidate);
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Signal handling error:', err);
      }
    };

    // Partner ended call
    const handleEnded = ({ duration: finalDur }: { duration?: number }) => {
      setCallStatus('ended');
      const timeSpent = finalDur || durationRef.current;
      cleanup();
      onCallEnded?.(timeSpent);
    };

    socket.on('call:ringing', handleRinging);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:rejected', handleRejected);
    socket.on('call:unavailable', handleUnavailable);
    socket.on('call:signal', handleSignal);
    socket.on('call:ended', handleEnded);

    return () => {
      socket.off('call:ringing', handleRinging);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:rejected', handleRejected);
      socket.off('call:unavailable', handleUnavailable);
      socket.off('call:signal', handleSignal);
      socket.off('call:ended', handleEnded);
    };
  }, [partnerId, hasWebRTC, isWeb, createPeerConnection, cleanup, onCallConnected, onCallEnded]);

  // Initiate an outgoing call (Caller role)
  const startCall = useCallback(
    async (type: 'audio' | 'video') => {
      isCallerRef.current = true;
      pendingCandidatesRef.current = [];
      setActiveCallType(type);
      setCallStatus('calling');
      setDuration(0);

      const stream = await acquireMedia(type);
      const pc = createPeerConnection();

      if (stream && pc) {
        try {
          stream.getTracks().forEach((track: any) => {
            try {
              pc.addTrack(track, stream);
            } catch (e) {}
          });
        } catch (e) {}
      }

      const socket = getSocket();
      socket?.emit('call:initiate', {
        toUserId: partnerId,
        type,
        callerInfo: currentUser,
      });
    },
    [partnerId, currentUser, acquireMedia, createPeerConnection]
  );

  // Accept an incoming call (Callee role)
  const acceptCall = useCallback(
    async (type: 'audio' | 'video', callId: string) => {
      isCallerRef.current = false;
      pendingCandidatesRef.current = [];
      setActiveCallType(type);
      setCallStatus('connected');
      setDuration(0);

      const stream = await acquireMedia(type);
      const pc = createPeerConnection();

      if (stream && pc) {
        try {
          stream.getTracks().forEach((track: any) => {
            try {
              pc.addTrack(track, stream);
            } catch (e) {}
          });
        } catch (e) {}
      }

      const socket = getSocket();
      socket?.emit('call:accept', {
        toUserId: partnerId,
        callId,
      });
      onCallConnected?.();
    },
    [partnerId, acquireMedia, createPeerConnection, onCallConnected]
  );

  // Reject an incoming call
  const rejectCall = useCallback(
    (callId: string, reason = 'declined') => {
      const socket = getSocket();
      socket?.emit('call:reject', {
        toUserId: partnerId,
        callId,
        reason,
      });
      setCallStatus('ended');
      cleanup();
    },
    [partnerId, cleanup]
  );

  // End an active call
  const endCall = useCallback(
    (callId = '') => {
      const finalDur = durationRef.current;
      const socket = getSocket();
      socket?.emit('call:end', {
        toUserId: partnerId,
        callId,
        duration: finalDur,
        type: activeCallType,
      });
      setCallStatus('ended');
      setActiveCallType('none');
      cleanup();
      onCallEnded?.(finalDur);
    },
    [partnerId, activeCallType, cleanup, onCallEnded]
  );

  // Toggle Microphone
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getAudioTracks().forEach((t: any) => {
          t.enabled = !t.enabled;
        });
      } catch (e) {}
    }
    setIsMicMuted((prev) => !prev);
  }, []);

  // Toggle Video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getVideoTracks().forEach((t: any) => {
          t.enabled = !t.enabled;
        });
      } catch (e) {}
    }
    setIsVideoMuted((prev) => !prev);
  }, []);

  // Flip Camera
  const flipCamera = useCallback(async () => {
    setIsFrontCamera((prev) => !prev);
    if (activeCallType === 'video' && hasWebRTC) {
      if (!isWeb && localStreamRef.current) {
        try {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack && typeof (videoTrack as any)._switchCamera === 'function') {
            (videoTrack as any)._switchCamera();
            return;
          }
        } catch (e) {}
      }

      stopLocalTracks();
      const newStream = await acquireMedia('video');
      if (newStream && pcRef.current && pcRef.current.getSenders) {
        try {
          const videoTrack = newStream.getVideoTracks()[0];
          const senders = pcRef.current.getSenders();
          const videoSender = senders.find((s: any) => s.track?.kind === 'video');
          if (videoSender && videoTrack) {
            videoSender.replaceTrack(videoTrack);
          }
        } catch (e) {}
      }
    }
  }, [activeCallType, hasWebRTC, isWeb, acquireMedia, stopLocalTracks]);

  return {
    callStatus,
    activeCallType,
    localStream,
    remoteStream,
    duration,
    isMicMuted,
    isVideoMuted,
    isFrontCamera,
    hasWebRTC,
    isNativeWebRTC,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleVideo,
    flipCamera,
    cleanup,
  };
}
