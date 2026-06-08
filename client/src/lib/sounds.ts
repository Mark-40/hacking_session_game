// Lightweight WebAudio-based sound effects so we don't need to ship audio files.
// Tones are tuned to be short, non-jarring, and pleasant for live demos.

type SoundName = 'correct' | 'wrong' | 'victory' | 'tick';

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.15) {
  const c = getCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

export function playSound(name: SoundName) {
  switch (name) {
    case 'correct':
      tone(660, 0.18, 'triangle', 0.18);
      setTimeout(() => tone(880, 0.18, 'triangle', 0.15), 70);
      break;
    case 'wrong':
      tone(180, 0.18, 'sawtooth', 0.12);
      break;
    case 'tick':
      tone(440, 0.05, 'square', 0.08);
      break;
    case 'victory':
      tone(523, 0.16, 'triangle', 0.2);
      setTimeout(() => tone(659, 0.16, 'triangle', 0.2), 130);
      setTimeout(() => tone(784, 0.16, 'triangle', 0.2), 260);
      setTimeout(() => tone(1046, 0.28, 'triangle', 0.22), 390);
      break;
  }
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== 'undefined') window.localStorage.setItem('qmr.muted', String(value));
}

export function getMuted(): boolean {
  if (typeof window === 'undefined') return false;
  const v = window.localStorage.getItem('qmr.muted');
  if (v === 'true') muted = true;
  return muted;
}
