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
  /** 모둠별 토의 글쓰기 잠금 */
  teamChatLocked: boolean;
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
  /** 자리 뽑기 규칙: 무작위 · 이름순 · 입장순 · 모둠별 */
  seatRule: SeatRule;
  /** 미니게임별 라운드 수·제한시간. */
  miniRules: MiniRules;
}

/** 미니게임(사다리·폭탄·단어찾기·기억력·순발력·자모·룰렛) 공통 규칙. */
export type MiniRules = Record<string, { rounds: number; seconds: number }>;

export const MINI_GAME_IDS = [
  "wordsearch",
  "memory",
  "jamo",
  "speedtap",
  "bomb",
  "ladder",
  "roulette",
] as const;

export const MINI_GAME_LABEL: Record<string, string> = {
  wordsearch: "가로세로 단어찾기",
  memory: "카드 짝 맞추기",
  jamo: "자모 낱말 만들기",
  speedtap: "순발력 숫자 찾기",
  bomb: "폭탄 돌리기",
  ladder: "사다리 타기",
  roulette: "룰렛 뽑기",
};

export const MINI_ROUND_HINT: Record<string, string> = {
  wordsearch: "찾을 단어 수",
  memory: "짝 수",
  jamo: "낱말 수",
  speedtap: "판 수",
  bomb: "폭탄 개수",
  ladder: "사다리 수",
  roulette: "뽑을 인원",
};

export const DEFAULT_MINI_RULES: MiniRules = {
  wordsearch: { rounds: 5, seconds: 120 },
  memory: { rounds: 6, seconds: 120 },
  jamo: { rounds: 4, seconds: 90 },
  speedtap: { rounds: 3, seconds: 60 },
  bomb: { rounds: 3, seconds: 20 },
  ladder: { rounds: 3, seconds: 0 },
  roulette: { rounds: 1, seconds: 0 },
};

/** 자리 뽑기에 쓰는 규칙. */
export type SeatRule = "random" | "name" | "joined" | "team";

export const SEAT_RULES: { id: SeatRule; label: string; hint: string }[] = [
  { id: "random", label: "무작위", hint: "완전히 섞어서 뽑습니다." },
  { id: "name", label: "이름순", hint: "가나다순으로 앞자리부터 차례로 앉힙니다." },
  { id: "joined", label: "입장순", hint: "수업에 들어온 순서대로 앉힙니다." },
  { id: "team", label: "모둠별", hint: "같은 모둠 학생끼리 옆자리에 모아 앉힙니다." },
];

export const DEFAULT_SETTINGS: ClassSettings = {
  className: "",
  joinNotice: "",
  requireFullscreen: true,
  allowStudentShare: true,
  allowHandRaise: true,
  allowStudentPosts: true,
  teamChatLocked: false,
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
  seatRule: "random",
  miniRules: DEFAULT_MINI_RULES,
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

function seatRule(value: unknown, fallback: SeatRule): SeatRule {
  return SEAT_RULES.some((rule) => rule.id === value) ? (value as SeatRule) : fallback;
}

function miniRules(value: unknown, fallback: MiniRules): MiniRules {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next: MiniRules = {};
  for (const id of MINI_GAME_IDS) {
    const base = fallback[id] ?? DEFAULT_MINI_RULES[id] ?? { rounds: 3, seconds: 60 };
    const entry = raw[id] && typeof raw[id] === "object" ? (raw[id] as Record<string, unknown>) : {};
    next[id] = {
      rounds: num(entry.rounds, 1, 50, base.rounds),
      seconds: num(entry.seconds, 0, 900, base.seconds),
    };
  }
  return next;
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
    teamChatLocked: flag(raw.teamChatLocked, defaults.teamChatLocked),
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
    seatRule: seatRule(raw.seatRule, defaults.seatRule),
    miniRules: miniRules(raw.miniRules, defaults.miniRules),
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
      { key: "teamChatLocked", label: "모둠 대화 잠그기", hint: "잠그면 학생이 모둠 토의에 글을 쓰지 못합니다." },
      { key: "showLeaderboard", label: "내 순위 표시" },
      { key: "soundEnabled", label: "효과음 기본 켜기" },
    ],
  },
  {
    id: "seat",
    title: "자리·모둠",
    hint: "모둠·자리 탭의 자리 뽑기에 적용됩니다.",
    items: [{ key: "seatRule", label: "자리 뽑기 규칙" }],
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

