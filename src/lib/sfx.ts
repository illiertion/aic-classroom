/**
 * Tiny game sounds generated with the Web Audio API. No audio files are
 * downloaded or stored, and nothing plays until the student interacts with the
 * page (browser autoplay rules).
 */
export type Cue = "start" | "correct" | "wrong" | "win" | "tick";

const STORAGE_KEY = "aic:sfx";

let context: AudioContext | null = null;
let enabled = readEnabled();

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return context;
}

export function isSfxEnabled(): boolean {
  return enabled;
}

export function setSfxEnabled(next: boolean): void {
  enabled = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    /* preference is a convenience only */
  }
}

const PATTERNS: Record<Cue, Array<{ freq: number; at: number; duration: number }>> = {
  start: [
    { freq: 523.25, at: 0, duration: 0.12 },
    { freq: 659.25, at: 0.1, duration: 0.12 },
    { freq: 783.99, at: 0.2, duration: 0.18 },
  ],
  correct: [
    { freq: 659.25, at: 0, duration: 0.1 },
    { freq: 987.77, at: 0.09, duration: 0.16 },
  ],
  wrong: [
    { freq: 246.94, at: 0, duration: 0.14 },
    { freq: 196.0, at: 0.12, duration: 0.2 },
  ],
  win: [
    { freq: 523.25, at: 0, duration: 0.12 },
    { freq: 659.25, at: 0.12, duration: 0.12 },
    { freq: 783.99, at: 0.24, duration: 0.12 },
    { freq: 1046.5, at: 0.36, duration: 0.3 },
  ],
  tick: [{ freq: 880, at: 0, duration: 0.06 }],
};

export function playCue(cue: Cue): void {
  if (!enabled) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    const base = ctx.currentTime;
    for (const note of PATTERNS[cue]) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = cue === "wrong" ? "sawtooth" : "sine";
      oscillator.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, base + note.at);
      gain.gain.exponentialRampToValueAtTime(0.14, base + note.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, base + note.at + note.duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(base + note.at);
      oscillator.stop(base + note.at + note.duration + 0.02);
    }
  } catch {
    /* audio is optional */
  }
}
