import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWavBuffer({ sampleRate = 44100, durationSeconds, generateSample }) {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = generateSample(t);
    // Clamp to -1.0 to 1.0
    sample = Math.max(-1, Math.min(1, sample));
    const intSample = Math.floor(sample < 0 ? sample * 32768 : sample * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

// 1. Melodic marimba ringtone (3 seconds)
function generateRingtone() {
  const notes = [
    { freq: 523.25, start: 0.0, dur: 0.4 },  // C5
    { freq: 659.25, start: 0.25, dur: 0.4 }, // E5
    { freq: 783.99, start: 0.5, dur: 0.5 },  // G5
    { freq: 1046.50, start: 0.75, dur: 0.7 },// C6
    { freq: 880.00, start: 1.1, dur: 0.5 },  // A5
    { freq: 1046.50, start: 1.4, dur: 0.8 }, // C6
  ];

  return createWavBuffer({
    durationSeconds: 2.8,
    generateSample: (t) => {
      let val = 0;
      for (const n of notes) {
        if (t >= n.start && t < n.start + n.dur) {
          const dt = t - n.start;
          const decay = Math.exp(-dt * 6.5);
          // Fundamental + harmonic chime
          const s1 = Math.sin(2 * Math.PI * n.freq * dt);
          const s2 = 0.35 * Math.sin(2 * Math.PI * (n.freq * 2.01) * dt);
          const s3 = 0.15 * Math.sin(2 * Math.PI * (n.freq * 3.02) * dt);
          val += (s1 + s2 + s3) * decay * 0.45;
        }
      }
      return val;
    },
  });
}

// 2. Outgoing ringback tone ("tuut... tuut...", 3 seconds)
function generateRingback() {
  return createWavBuffer({
    durationSeconds: 3.0,
    generateSample: (t) => {
      // 1.2s tone, 1.8s silence
      if (t < 1.2) {
        // Dual-frequency ringing tone (440Hz + 480Hz)
        const tone1 = Math.sin(2 * Math.PI * 440 * t);
        const tone2 = Math.sin(2 * Math.PI * 480 * t);
        return (tone1 + tone2) * 0.25;
      }
      return 0;
    },
  });
}

// 3. Declined busy beep (two beeps)
function generateDeclined() {
  return createWavBuffer({
    durationSeconds: 0.9,
    generateSample: (t) => {
      // Beep 1: 0.0s - 0.2s, Pause: 0.2s - 0.35s, Beep 2: 0.35s - 0.55s
      if ((t >= 0.0 && t < 0.2) || (t >= 0.35 && t < 0.55)) {
        return Math.sin(2 * Math.PI * 480 * t) * 0.35;
      }
      return 0;
    },
  });
}

// Write sounds to assets/sounds and android/app/src/main/res/raw
const soundsDir = path.resolve(__dirname, '../assets/sounds');
const rawDir = path.resolve(__dirname, '../android/app/src/main/res/raw');

fs.mkdirSync(soundsDir, { recursive: true });
fs.mkdirSync(rawDir, { recursive: true });

const ringtoneWav = generateRingtone();
const ringbackWav = generateRingback();
const declinedWav = generateDeclined();

fs.writeFileSync(path.join(soundsDir, 'ringtone.wav'), ringtoneWav);
fs.writeFileSync(path.join(soundsDir, 'ringback.wav'), ringbackWav);
fs.writeFileSync(path.join(soundsDir, 'declined.wav'), declinedWav);

fs.writeFileSync(path.join(rawDir, 'ringtone.wav'), ringtoneWav);
fs.writeFileSync(path.join(rawDir, 'ringback.wav'), ringbackWav);
fs.writeFileSync(path.join(rawDir, 'declined.wav'), declinedWav);

console.log('Successfully generated ringtone.wav, ringback.wav, and declined.wav in assets/sounds and android res/raw!');
