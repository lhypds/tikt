// Press feedback tone: a sine wave that steps up in pitch with the intensity
// meter, from 220Hz at 1 to 880Hz at 10. iOS only allows an AudioContext to
// start inside a user gesture, so the context is created lazily from the
// press handlers themselves.
const MUTE_STORAGE_KEY = "soundMuted";
const BASE_FREQUENCY = 220;
const OCTAVE_RANGE = 2;
const TONE_GAIN = 0.06;

let context = null;
let oscillator = null;
let gain = null;
let pressToken = 0;

let muted = readStoredMute();
const muteListeners = new Set();

function readStoredMute() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

export function isSoundMuted() {
  return muted;
}

export function setSoundMuted(next) {
  muted = Boolean(next);
  if (muted) stopPressTone();
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? "yes" : "no");
  } catch {
    // best effort — the choice just won't persist
  }
  muteListeners.forEach((listener) => listener());
}

export function subscribeSoundMuted(listener) {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}

function toneFrequency(intensity) {
  const step = Math.max(1, Math.min(10, intensity)) - 1;
  return BASE_FREQUENCY * Math.pow(2, (step / 9) * OCTAVE_RANGE);
}

function ensureContext() {
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
  }
  if (context.state === "suspended") context.resume();
  return context;
}

// Call from inside a pointerdown/touchstart/keydown handler.
export function startPressTone(intensity) {
  if (muted) return;
  const activeContext = ensureContext();
  if (!activeContext) return;
  stopPressTone();
  const now = activeContext.currentTime;
  oscillator = activeContext.createOscillator();
  gain = activeContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(toneFrequency(intensity), now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(TONE_GAIN, now + 0.04);
  oscillator.connect(gain);
  gain.connect(activeContext.destination);
  oscillator.start(now);
}

// One short blip at the given intensity's pitch, e.g. when the user taps a
// meter box. Self-contained nodes, so it never interferes with a press tone.
export function playIntensityBlip(intensity) {
  if (muted) return;
  const activeContext = ensureContext();
  if (!activeContext) return;
  const now = activeContext.currentTime;
  const blipOscillator = activeContext.createOscillator();
  const blipGain = activeContext.createGain();
  blipOscillator.type = "sine";
  blipOscillator.frequency.setValueAtTime(toneFrequency(intensity), now);
  blipGain.gain.setValueAtTime(0.0001, now);
  blipGain.gain.exponentialRampToValueAtTime(TONE_GAIN, now + 0.02);
  blipGain.gain.setTargetAtTime(0.0001, now + 0.12, 0.03);
  blipOscillator.connect(blipGain);
  blipGain.connect(activeContext.destination);
  blipOscillator.start(now);
  blipOscillator.stop(now + 0.3);
}

export function updatePressTone(intensity) {
  if (!oscillator || !context) return;
  oscillator.frequency.setTargetAtTime(toneFrequency(intensity), context.currentTime, 0.05);
}

export function stopPressTone() {
  if (!oscillator || !gain || !context) return;
  const now = context.currentTime;
  const finishedOscillator = oscillator;
  const finishedGain = gain;
  oscillator = null;
  gain = null;
  try {
    finishedGain.gain.cancelScheduledValues(now);
    finishedGain.gain.setTargetAtTime(0.0001, now, 0.02);
    finishedOscillator.stop(now + 0.15);
  } catch {
    // already stopped
  }
}
