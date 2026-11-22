/**
 * 선생님이 수업마다 직접 조정하는 값들.
 *
 * 값은 수업(ClassroomHub Durable Object)의 `config` 테이블에 `settings` 키로 저장되고,
 * 스냅샷에 함께 실려 학생 화면에도 전달됩니다. 점수·아이템·제한시간처럼 규칙에 영향을
 * 주는 값은 반드시 서버에서 다시 계산하므로, 학생이 값을 바꿔도 점수는 조작되지 않습니다.
 */
export interface ClassSettings {
  /** 학생 화면 상단에 보이는 학급 이름. 빈 문자열이면 표시하지 않습니다. */
  className: string;
  /** 참가 화면 안내 문구(예: 준비물, 입장 안내). */
  joinNotice: string;

  /** 수업 입장 시 전체화면 요청 */
  requireFullscreen: boolean;
  /** 학생 화면 공유 허용 */
  allowStudentShare: boolean;
  /** 손들기 허용 */
  allowHandRaise: boolean;
  /** 학생이 보드에 카드를 붙일 수 있는 기본값 */
  allowStudentPosts: boolean;
  /** 학생 화면에 내 순위 표시 */
  showLeaderboard: boolean;

  /** 정답 1개당 기본 점수 */
  correctPoints: number;
  /** 오답 1개당 점수(감점은 음수, 0이면 변화 없음) */
  wrongPoints: number;
  /** 새 문제의 기본 제한 시간(초). 0이면 제한 없음 */
  quizSeconds: number;
  /** 속도전에서 빨리 답할수록 가점 */
  speedBonus: boolean;
  /** 랭킹판에 보여 줄 인원 */
  leaderboardSize: number;

  /** 더블 아이템 배수 */
  itemDoubleMultiplier: number;
  /** 훔치기 아이템으로 가져올 비율(%) */
  itemStealPercent: number;
  /** +점 아이템 지급 점수 */
  itemBonusPoints: number;
  /** 한 학생이 들고 있을 수 있는 아이템 개수 */
  itemMaxHeld: number;

  /** 스톱워치 기본 시간(분) */
  timerMinutes: number;
  /** 효과음 기본 켜짐 */
  soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: ClassSettings = {
  className: "",
  joinNotice: "",
  requireFullscreen: true,
  allowStudentShare: true,
  allowHandRaise: true,
  allowStudentPosts: true,
  showLeaderboard: true,
  correctPoints: 100,
  wrongPoints: 0,
  quizSeconds: 30,
  speedBonus: true,
  leaderboardSize: 10,
  itemDoubleMultiplier: 2,
  itemStealPercent: 10,
  itemBonusPoints: 50,
  itemMaxHeld: 3,
  timerMinutes: 5,
  soundEnabled: true,
};

function text(value: unknown, maxLength: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function num(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** 어떤 입력이 와도 안전한 설정으로 바꿉니다(부분 patch 허용). */
export function normalizeSettings(input: unknown): ClassSettings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const defaults = DEFAULT_SETTINGS;
  return {
    className: text(raw.className, 40, defaults.className),
    joinNotice: text(raw.joinNotice, 200, defaults.joinNotice),
    requireFullscreen: flag(raw.requireFullscreen, defaults.requireFullscreen),
    allowStudentShare: flag(raw.allowStudentShare, defaults.allowStudentShare),
    allowHandRaise: flag(raw.allowHandRaise, defaults.allowHandRaise),
    allowStudentPosts: flag(raw.allowStudentPosts, defaults.allowStudentPosts),
    showLeaderboard: flag(raw.showLeaderboard, defaults.showLeaderboard),
    correctPoints: num(raw.correctPoints, 0, 1000, defaults.correctPoints),
    wrongPoints: num(raw.wrongPoints, -500, 1000, defaults.wrongPoints),
    quizSeconds: num(raw.quizSeconds, 0, 3600, defaults.quizSeconds),
    speedBonus: flag(raw.speedBonus, defaults.speedBonus),
    leaderboardSize: num(raw.leaderboardSize, 3, 50, defaults.leaderboardSize),
    itemDoubleMultiplier: num(raw.itemDoubleMultiplier, 2, 5, defaults.itemDoubleMultiplier),
    itemStealPercent: num(raw.itemStealPercent, 1, 50, defaults.itemStealPercent),
    itemBonusPoints: num(raw.itemBonusPoints, 10, 500, defaults.itemBonusPoints),
    itemMaxHeld: num(raw.itemMaxHeld, 1, 6, defaults.itemMaxHeld),
    timerMinutes: num(raw.timerMinutes, 1, 120, defaults.timerMinutes),
    soundEnabled: flag(raw.soundEnabled, defaults.soundEnabled),
  };
}

/** 설정 탭에서 보여 줄 항목 묶음(선생님 화면 전용). */
export const SETTINGS_GROUPS: {
  id: string;
  title: string;
  hint: string;
  items: { key: keyof ClassSettings; label: string; hint?: string }[];
}[] = [
  {
    id: "score",
    title: "점수 규칙",
    hint: "게임·퀴즈 점수는 서버가 이 값으로 계산합니다.",
    items: [
      { key: "correctPoints", label: "정답 점수", hint: "기본 100점" },
      { key: "wrongPoints", label: "오답 점수", hint: "감점은 음수(예: -20)" },
      { key: "speedBonus", label: "속도 가점", hint: "속도전에서 빨리 답할수록 더 받기" },
      { key: "leaderboardSize", label: "랭킹 표시 인원" },
    ],
  },
  {
    id: "quiz",
    title: "문제 진행",
    hint: "새 문제를 낼 때 기본으로 채워집니다.",
    items: [{ key: "quizSeconds", label: "기본 제한 시간(초)", hint: "0 = 제한 없음" }],
  },
  {
    id: "items",
    title: "아이템전",
    hint: "아이템 효과와 보유 개수를 조정합니다.",
    items: [
      { key: "itemDoubleMultiplier", label: "더블 배수" },
      { key: "itemStealPercent", label: "훔치기 비율(%)" },
      { key: "itemBonusPoints", label: "+점 아이템" },
      { key: "itemMaxHeld", label: "최대 보유 개수" },
    ],
  },
  {
    id: "students",
    title: "학생 화면 허용",
    hint: "수업 흐름에 맞게 학생 기능을 켜고 끕니다.",
    items: [
      { key: "requireFullscreen", label: "입장 시 전체화면 요청" },
      { key: "allowStudentShare", label: "화면 공유 허용" },
      { key: "allowHandRaise", label: "손들기 허용" },
      { key: "allowStudentPosts", label: "보드 카드 붙이기 허용" },
      { key: "showLeaderboard", label: "내 순위 표시" },
      { key: "soundEnabled", label: "효과음 기본 켜기" },
    ],
  },
  {
    id: "class",
    title: "학급 표시",
    hint: "학생 화면에 보이는 문구입니다.",
    items: [
      { key: "className", label: "학급 이름", hint: "예: 3학년 2반" },
      { key: "joinNotice", label: "참가 안내 문구", hint: "입장 화면 아래에 표시" },
    ],
  },
];
