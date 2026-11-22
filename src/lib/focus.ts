import type { FocusEventType } from "../../shared/protocol";

export interface FocusSnapshot {
  fullscreen: boolean | null;
  visibility: "visible" | "hidden";
}

/**
 * Fullscreen state is only known when the browser exposes it. `null` means
 * "not reported" and is never treated as an exit.
 */
export function readFullscreen(): boolean | null {
  if (typeof document === "undefined") return null;
  if (!document.fullscreenEnabled) return null;
  return Boolean(document.fullscreenElement);
}

export function readVisibility(): "visible" | "hidden" {
  if (typeof document === "undefined") return "visible";
  return document.visibilityState === "hidden" ? "hidden" : "visible";
}

export async function requestClassroomFullscreen(): Promise<boolean> {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      // Some embedded browsers never settle this promise, so never let the UI
      // wait on it indefinitely.
      await Promise.race([
        document.documentElement.requestFullscreen({ navigationUI: "hide" }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    }
    return Boolean(document.fullscreenElement);
  } catch {
    return false;
  }
}

export interface ShortcutObservation {
  type: Extract<FocusEventType, "key_escape" | "shortcut_observed">;
  detail: string;
}

/**
 * Classifies only keystrokes the page actually receives. Chrome owns most of
 * these shortcuts before the page sees them; we never preventDefault here and
 * never infer intent from a keystroke.
 */
export function classifyKeystroke(event: KeyboardEvent): ShortcutObservation | null {
  if (event.key === "Escape") return { type: "key_escape", detail: "Esc" };
  if (event.altKey && event.key === "ArrowLeft") {
    return { type: "shortcut_observed", detail: "Alt+←" };
  }
  if (event.ctrlKey || event.metaKey) {
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    if (key === "T") return { type: "shortcut_observed", detail: "Ctrl+T" };
    if (key === "W") return { type: "shortcut_observed", detail: "Ctrl+W" };
    if (key === "Tab") return { type: "shortcut_observed", detail: "Ctrl+Tab" };
  }
  if (event.key === "Control" || event.key === "Meta") {
    return { type: "shortcut_observed", detail: "Ctrl" };
  }
  return null;
}

/** Debounces repeated identical observations to one notification per window. */
export class FocusEventThrottle {
  private readonly last = new Map<string, number>();

  constructor(private readonly windowMs = 15_000) {}

  shouldSend(type: string): boolean {
    const now = Date.now();
    const previous = this.last.get(type);
    if (previous !== undefined && now - previous < this.windowMs) return false;
    this.last.set(type, now);
    return true;
  }

  reset(): void {
    this.last.clear();
  }
}
