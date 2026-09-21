import { Vibration, Platform } from 'react-native';

let ExpoAudio: typeof import('expo-audio') | null = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {
  console.log('[SOUND SERVICE] Native expo-audio not loaded:', e);
}

const RINGTONE_ASSET = require('../../assets/sounds/ringtone.wav');
const RINGBACK_ASSET = require('../../assets/sounds/ringback.wav');
const DECLINED_ASSET = require('../../assets/sounds/declined.wav');

class SoundService {
  private incomingPlayer: any = null;
  private outgoingPlayer: any = null;
  private isIncomingPlaying = false;
  private isOutgoingPlaying = false;

  /**
   * Play incoming ringtone on loop + continuous phone vibration
   */
  async playIncomingRingtone() {
    try {
      await this.stopIncomingRingtone();
      this.isIncomingPlaying = true;

      // Continuous rhythmic phone vibration
      if (Platform.OS !== 'web') {
        try {
          Vibration.vibrate([0, 1000, 1000], true);
        } catch (vErr) {}
      }

      if (ExpoAudio?.createAudioPlayer) {
        try {
          if (ExpoAudio.setAudioModeAsync) {
            await ExpoAudio.setAudioModeAsync({
              playsInSilentMode: true,
              shouldPlayInBackground: true,
            }).catch(() => {});
          }

          const player = ExpoAudio.createAudioPlayer(RINGTONE_ASSET);
          player.loop = true;
          player.volume = 1.0;
          this.incomingPlayer = player;

          if (this.isIncomingPlaying) {
            player.play();
          } else {
            try { player.remove(); } catch (e) {}
          }
        } catch (audioErr) {
          console.log('[SOUND SERVICE] Native incoming ringtone notice:', audioErr);
        }
      } else if (Platform.OS === 'web' && typeof Audio !== 'undefined') {
        try {
          const webAudio = new Audio(RINGTONE_ASSET);
          webAudio.loop = true;
          this.incomingPlayer = webAudio;
          if (this.isIncomingPlaying) {
            webAudio.play().catch(() => {});
          }
        } catch (wErr) {}
      }
    } catch (err) {
      console.log('[SOUND SERVICE] Play incoming notice:', err);
    }
  }

  /**
   * Stop and unload incoming ringtone + cancel vibration
   */
  async stopIncomingRingtone() {
    this.isIncomingPlaying = false;
    try {
      Vibration.cancel();
      if (this.incomingPlayer) {
        const p = this.incomingPlayer;
        this.incomingPlayer = null;
        if (typeof p.pause === 'function') {
          p.pause();
        }
        if (typeof p.remove === 'function') {
          p.remove();
        }
      }
    } catch (err) {}
  }

  /**
   * Play outgoing ringback tone while waiting for recipient to answer
   */
  async playOutgoingRingback() {
    try {
      await this.stopOutgoingRingback();
      this.isOutgoingPlaying = true;

      if (ExpoAudio?.createAudioPlayer) {
        try {
          if (ExpoAudio.setAudioModeAsync) {
            await ExpoAudio.setAudioModeAsync({
              playsInSilentMode: true,
              shouldPlayInBackground: true,
            }).catch(() => {});
          }

          const player = ExpoAudio.createAudioPlayer(RINGBACK_ASSET);
          player.loop = true;
          player.volume = 0.8;
          this.outgoingPlayer = player;

          if (this.isOutgoingPlaying) {
            player.play();
          } else {
            try { player.remove(); } catch (e) {}
          }
        } catch (audioErr) {
          console.log('[SOUND SERVICE] Native outgoing ringback notice:', audioErr);
        }
      } else if (Platform.OS === 'web' && typeof Audio !== 'undefined') {
        try {
          const webAudio = new Audio(RINGBACK_ASSET);
          webAudio.loop = true;
          this.outgoingPlayer = webAudio;
          if (this.isOutgoingPlaying) {
            webAudio.play().catch(() => {});
          }
        } catch (wErr) {}
      }
    } catch (err) {
      console.log('[SOUND SERVICE] Play outgoing notice:', err);
    }
  }

  /**
   * Stop outgoing ringback tone
   */
  async stopOutgoingRingback() {
    this.isOutgoingPlaying = false;
    try {
      if (this.outgoingPlayer) {
        const p = this.outgoingPlayer;
        this.outgoingPlayer = null;
        if (typeof p.pause === 'function') {
          p.pause();
        }
        if (typeof p.remove === 'function') {
          p.remove();
        }
      }
    } catch (err) {}
  }

  /**
   * Play short busy/declined audio prompt
   */
  async playDeclinedTone() {
    try {
      await this.stopIncomingRingtone();
      await this.stopOutgoingRingback();

      if (ExpoAudio?.createAudioPlayer) {
        try {
          const player = ExpoAudio.createAudioPlayer(DECLINED_ASSET);
          player.loop = false;
          player.volume = 0.8;
          player.play();
          setTimeout(() => {
            try { player.remove(); } catch (e) {}
          }, 2000);
        } catch (e) {}
      } else if (Platform.OS === 'web' && typeof Audio !== 'undefined') {
        try {
          const webAudio = new Audio(DECLINED_ASSET);
          webAudio.play().catch(() => {});
        } catch (e) {}
      }
    } catch (err) {}
  }
}

export const soundService = new SoundService();
