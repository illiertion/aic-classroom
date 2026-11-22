import type { RosterState } from "./protocol";

/**
 * 팀·자리 운영은 학급 단위 임시 상태입니다. 정답·점수처럼 서버(Durable Object)가
 * 들고 있고, 학생에게는 자기 모둠과 자기 자리만 보여 줍니다.
 */
export const MAX_TEAMS = 8;
export const MIN_SEAT_COLS = 2;
export const MAX_SEAT_COLS = 10;
export const MAX_SEAT_ROWS = 8;

export const DEFAULT_ROSTER: RosterState = {
  teamCount: 4,
  teamOpen: false,
  seatRows: 5,
  seatCols: 6,
  seatOpen: false,
};

export function teamLabel(index: number): string {
  return `${index + 1}모둠`;
}

export function teamLabels(count: number): string[] {
  const safe = Math.max(1, Math.min(MAX_TEAMS, Math.round(count) || 1));
  return Array.from({ length: safe }, (_, index) => teamLabel(index));
}

/** "3모둠" → 2. 모르는 이름이면 null. */
export function teamIndexOf(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = /^(\d{1,2})모둠$/.exec(label.trim());
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return index >= 0 && index < MAX_TEAMS ? index : null;
}

export function isTeamLabel(label: string | null | undefined, count: number): boolean {
  const index = teamIndexOf(label);
  return index !== null && index < Math.max(1, Math.min(MAX_TEAMS, count));
}

export function clampTeamCount(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_ROSTER.teamCount;
  return Math.max(1, Math.min(MAX_TEAMS, Math.round(number)));
}

export function seatCapacity(roster: Pick<RosterState, "seatRows" | "seatCols">): number {
  const rows = Math.max(1, Math.min(MAX_SEAT_ROWS, Math.round(roster.seatRows) || 1));
  const cols = Math.max(MIN_SEAT_COLS, Math.min(MAX_SEAT_COLS, Math.round(roster.seatCols) || 1));
  return rows * cols;
}

export function normalizeRoster(value: unknown): RosterState {
  if (!value || typeof value !== "object") return { ...DEFAULT_ROSTER };
  const record = value as Partial<Record<keyof RosterState, unknown>>;
  return {
    teamCount: clampTeamCount(record.teamCount),
    teamOpen: record.teamOpen === true,
    seatRows: Math.max(1, Math.min(MAX_SEAT_ROWS, Math.round(Number(record.seatRows) || DEFAULT_ROSTER.seatRows))),
    seatCols: Math.max(
      MIN_SEAT_COLS,
      Math.min(MAX_SEAT_COLS, Math.round(Number(record.seatCols) || DEFAULT_ROSTER.seatCols)),
    ),
    seatOpen: record.seatOpen === true,
  };
}

/** 모둠 색상: 1~8모둠까지 고정 팔레트. */
export const TEAM_TONES: { chip: string; dot: string; bar: string }[] = [
  { chip: "bg-brand-50 text-brand-700 ring-brand-200", dot: "bg-brand-500", bar: "bg-brand-500" },
  { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  { chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", bar: "bg-amber-500" },
  { chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500", bar: "bg-violet-500" },
  { chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", bar: "bg-sky-500" },
  { chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", bar: "bg-rose-500" },
  { chip: "bg-teal-50 text-teal-700 ring-teal-200", dot: "bg-teal-500", bar: "bg-teal-500" },
  { chip: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500", bar: "bg-orange-500" },
];

export function teamTone(label: string | null | undefined): (typeof TEAM_TONES)[number] {
  const index = teamIndexOf(label);
  return TEAM_TONES[(index ?? 0) % TEAM_TONES.length];
}

/** 학생 목록을 모둠 수에 맞춰 균등하게 나눕니다 (앞 모둠부터 1명씩). */
export function distributeTeams<T>(items: T[], teamCount: number): T[][] {
  const count = clampTeamCount(teamCount);
  const buckets: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => {
    buckets[index % count].push(item);
  });
  return buckets;
}
