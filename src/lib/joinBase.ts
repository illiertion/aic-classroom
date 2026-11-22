const STORAGE_KEY = "aic:join-base:v1";

/** 지금 브라우저가 127.0.0.1/localhost로 열려 있는지 (다른 기기에서 접속 불가). */
export function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

/**
 * 학생에게 안내할 접속 주소를 정합니다. 선생님이 127.0.0.1로 열었다면 그 주소는
 * 학생 기기에서 열리지 않으므로, 콘솔에서 따로 저장한 주소(예: http://192.168.0.5:5173)를
 * 우선 사용합니다.
 */
export function readJoinBase(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch {
    /* storage may be unavailable */
  }
  return window.location.origin;
}

export function saveJoinBase(value: string): string {
  const normalized = normalizeBase(value);
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* ignore quota/private-mode errors */
  }
  return normalized;
}

export function clearJoinBase(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** "192.168.0.5:5173" → "http://192.168.0.5:5173" */
export function normalizeBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return "";
  }
}

export function joinLink(base: string, code: string): string {
  return `${base || window.location.origin}/join/${code}`;
}

/** 저장된 주소가 이 컴퓨터에서만 열리는 주소인지 안전하게 판단합니다. */
export function isLoopbackBase(base: string): boolean {
  try {
    return isLoopbackHost(new URL(base).hostname);
  } catch {
    return true;
  }
}

/** 개발 서버에 이 PC의 와이파이 IP 후보를 물어봅니다(배포환경에서는 빈 배열). */
export async function suggestLanBases(): Promise<string[]> {
  try {
    const response = await fetch("/dev/lan-hint", { headers: { accept: "application/json" } });
    if (!response.ok) return [];
    const body = (await response.json()) as { port?: number; ips?: string[] };
    const port = body.port ?? (window.location.port || "5173");
    const score = (ip: string) =>
      ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : ip.startsWith("172.") ? 2 : 3;
    return [...(body.ips ?? [])]
      .sort((a, b) => score(a) - score(b))
      .slice(0, 3)
      .map((ip) => `http://${ip}:${port}`);
  } catch {
    return [];
  }
}
