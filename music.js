import { getContext, getMusicBus, isMuted, isMusicMuted } from "./audio.js";

const TEMPO = { title: 96, game: 132 };
const STEPS = 16;

// two bars of a little loop, frequencies in hz, 0 = rest
const LEAD = [
  523, 0, 659, 0, 784, 0, 659, 0,
  523, 0, 659, 0, 880, 784, 659, 0,
];
const BASS = [
  131, 0, 0, 131, 0, 0, 175, 0,
  131, 0, 0, 131, 196, 0, 175, 0,
];

let mode = null;
let step = 0;
let nextTime = 0;
let timer = null;
let level = 1;
let ducked = false;

function schedule() {
  const ctx = getContext();
  const out = getMusicBus();
  if (!ctx || !out) return;

  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  const stepDur = 60 / (mode === "game" ? TEMPO.game * (1 + (level - 1) * 0.04) : TEMPO.title) / 2;
  while (nextTime < ctx.currentTime + 0.15) {
    if (!isMuted() && !isMusicMuted() && !ducked) {
      const lead = LEAD[step % LEAD.length];
      const bass = BASS[step % BASS.length];
      if (lead) note(ctx, out, lead, nextTime, stepDur * 0.9, "square", 0.035);
      if (bass) note(ctx, out, bass, nextTime, stepDur * 1.8, "triangle", 0.06);
    }
    nextTime += stepDur;
    step += 1;
  }
}

function note(ctx, out, freq, when, dur, type, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(vol, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain);
  gain.connect(out);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

export function play(name) {
  if (mode === name) return;
  mode = name;
  step = 0;
  const ctx = getContext();
  nextTime = ctx ? ctx.currentTime + 0.06 : 0;
  if (!timer) {
    timer = setInterval(schedule, 40);
  }
}

export function stop() {
  mode = null;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function setLevel(value) {
  level = value;
}

export function setPaused(paused) {
  ducked = paused;
}
