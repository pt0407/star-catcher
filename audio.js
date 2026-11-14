import { loadItem, saveItem } from "./persist.js";

const STAR_FREQUENCY = 600;
const STAR_DURATION = 0.08;
const ROCK_FREQUENCY = 140;
const PAUSE_FREQUENCY = 220;
const PAUSE_DURATION = 0.07;
const ROCK_DURATION = 0.15;
const GUST_DURATION = 2;

let audioContext = null;
let masterGain = null;
let musicGain = null;
let muted = loadItem("starCatcherMuted", "false") === "true";
let volume = Number(loadItem("starCatcherVolume", "0.8"));
let musicVolume = Number(loadItem("starCatcherMusicVolume", "1"));
let musicMuted = loadItem("starCatcherMusicMuted", "false") === "true";

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  saveItem("starCatcherMuted", String(muted));
}

export function toggleMute() {
  setMuted(!muted);
}

export function getContext() {
  return audioContext;
}

export function getOutput() {
  return masterGain || (audioContext ? audioContext.destination : null);
}

export function getMusicBus() {
  return musicGain || masterGain;
}

export function getMusicVolume() {
  return musicVolume;
}

export function setMusicVolume(value) {
  musicVolume = Math.max(0, Math.min(1, value));
  saveItem("starCatcherMusicVolume", String(musicVolume));
  if (musicGain) musicGain.gain.value = musicMuted ? 0 : musicVolume;
}

export function isMusicMuted() {
  return musicMuted;
}

export function toggleMusicMute() {
  musicMuted = !musicMuted;
  saveItem("starCatcherMusicMuted", String(musicMuted));
  if (musicGain) musicGain.gain.value = musicMuted ? 0 : musicVolume;
}

export function getVolume() {
  return volume;
}

export function setVolume(value) {
  volume = Math.max(0, Math.min(1, value));
  saveItem("starCatcherVolume", String(volume));
  if (masterGain) masterGain.gain.value = volume;
}

export function initializeAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  if (!masterGain) {
    masterGain = audioContext.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(audioContext.destination);
    musicGain = audioContext.createGain();
    musicGain.gain.value = musicMuted ? 0 : musicVolume;
    musicGain.connect(masterGain);
  }
}

function tone({ type, frequency, duration, volume, slideTo, delay = 0 }) {
  if (muted || !audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime + delay;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(masterGain || audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

export function playCatchSound(type, pitchStep = 0) {
  const isStar = type === "star";
  tone({
    type: isStar ? "sine" : "square",
    frequency: isStar ? STAR_FREQUENCY + pitchStep : ROCK_FREQUENCY,
    duration: isStar ? STAR_DURATION : ROCK_DURATION,
    volume: 0.15,
  });
}

export function playPauseSound() {
  tone({ type: "square", frequency: PAUSE_FREQUENCY, duration: PAUSE_DURATION, volume: 0.08 });
}

export function playNewBestSound() {
  [523, 659, 784].forEach((frequency, i) => {
    tone({ type: "square", frequency, duration: 0.12, volume: 0.1, delay: i * 0.09 });
  });
}

export function playGustSound() {
  tone({ type: "sawtooth", frequency: 180, slideTo: 420, duration: GUST_DURATION, volume: 0.06 });
}

export function playMissSound() {
  tone({ type: "sine", frequency: 320, slideTo: 140, duration: 0.18, volume: 0.08 });
}
