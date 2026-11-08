const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const durationSec = 16;
const numSamples = sampleRate * durationSec;
const numChannels = 2;
const bytesPerSample = 2;
const blockAlign = numChannels * bytesPerSample;
const byteRate = sampleRate * blockAlign;
const dataSize = numSamples * blockAlign;

const buffer = Buffer.alloc(44 + dataSize);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);

// fmt chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // subchunk1 size
buffer.writeUInt16LE(1, 20);  // PCM
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(16, 34); // bits per sample

// data chunk
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Chords: Cmaj7, Am7, Fmaj7, G9 (4 seconds each)
const chords = [
  [261.63, 329.63, 392.00, 493.88], // C E G B
  [220.00, 261.63, 329.63, 392.00], // A C E G
  [174.61, 220.00, 261.63, 329.63], // F A C E
  [196.00, 246.94, 293.66, 349.23, 440.00] // G B D F A
];

let offset = 44;
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const chordIdx = Math.floor(t / 4) % chords.length;
  const chord = chords[chordIdx];
  const chordTime = t % 4;
  
  // Smooth envelope
  const env = Math.sin(Math.min(1, chordTime / 0.5) * Math.PI / 2) * Math.exp(-chordTime * 0.45);
  
  let sampleL = 0;
  let sampleR = 0;
  
  for (let c = 0; c < chord.length; c++) {
    const freq = chord[c];
    // Gentle sine + soft warm octave harmonic
    const wave = Math.sin(2 * Math.PI * freq * t) * 0.7 + Math.sin(2 * Math.PI * (freq * 2) * t) * 0.15;
    const pan = (c / (chord.length - 1 || 1)) * 0.6 + 0.2; // slight stereo spread
    sampleL += wave * (1 - pan);
    sampleR += wave * pan;
  }
  
  sampleL = sampleL * env * 0.22;
  sampleR = sampleR * env * 0.22;
  
  // Clamp & write 16-bit int
  const intL = Math.max(-32767, Math.min(32767, Math.floor(sampleL * 32767)));
  const intR = Math.max(-32767, Math.min(32767, Math.floor(sampleR * 32767)));
  
  buffer.writeInt16LE(intL, offset);
  buffer.writeInt16LE(intR, offset + 2);
  offset += 4;
}

const outDir = path.join(__dirname, '..', 'assets', 'audio');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'demo_preview.wav');
fs.writeFileSync(outPath, buffer);
console.log('Created audio preview file:', outPath, 'Bytes:', buffer.length);

