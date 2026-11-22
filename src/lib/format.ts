export function timeAgo(timestamp: number | null | undefined): string {
  if (!timestamp) return "—";
  const diff = Date.now() - timestamp;
  if (diff < 0) return "방금";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "방금";
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function elapsedLabel(startedAt: number | null, now = Date.now()): string {
  if (!startedAt) return "0:00";
  return formatDuration(now - startedAt);
}

export function pluralStudents(count: number): string {
  return `${count}명`;
}

/** 이름에 이미 경칭이 붙어 있으면 그대로, 아니면 “선생님”을 붙입니다. */
export function withHonorific(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) return "선생님";
  return /(선생님|샘|교사)$/.test(trimmed) ? trimmed : `${trimmed} 선생님`;
}
