/**
 * AIC shared protocol.
 *
 * This file is the single source of truth for the REST payloads and the
 * WebSocket messages exchanged between the React client and the Worker /
 * ClassroomHub Durable Object. Keep it framework-free.
 *
 * Storage model (v3): D1 keeps accounts/classrooms/participants only. Board
 * definitions and worksheet PDFs live in the teacher's browser; they are sent
 * to students only while the teacher's classroom console is open. There is no
 * object storage and no permanent media upload.
 */

export const PROTOCOL_VERSION = 4;

import type { ClassSettings } from "./settings";

export type ClassroomStatus = "live" | "ended";
export type TeacherRole = "teacher" | "student";

/* ------------------------------------------------------------------ */
/* Focus / exit events                                                 */
/* ------------------------------------------------------------------ */

/**
 * Every event is an *observation of a browser state*, never a verdict about
 * a student's intent. The UI must phrase these as observations.
 */
export type FocusEventType =
  | "join"
  | "rejoin"
  | "leave"
  | "fullscreen_enter"
  | "fullscreen_exit"
  | "fullscreen_unknown"
  | "page_hidden"
  | "page_visible"
  | "page_leave"
  | "page_return"
  | "network_online"
  | "network_offline"
  | "ws_disconnected"
  | "ws_reconnected"
  | "key_escape"
  | "shortcut_observed"
  | "screen_share_started"
  | "screen_share_stopped"
  | "screen_share_denied";

export type ConnectionState = "connected" | "disconnected" | "unknown";

export interface ClassroomEventRecord {
  id: string;
  participantId: string;
  studentName: string;
  type: FocusEventType;
  detail: string | null;
  connection: ConnectionState;
  createdAt: number;
}

export type EventSeverity = "info" | "notice" | "warning";

/* ------------------------------------------------------------------ */
/* Live student state                                                  */
/* ------------------------------------------------------------------ */

export interface StudentLive {
  participantId: string;
  name: string;
  online: boolean;
  /** Team name for team games, assigned round-robin at join. */
  team: string | null;
  /** Golden-bell survival flag. Always true outside golden-bell games. */
  alive: boolean;
  /** The student tapped "손들기". */
  handRaised: boolean;
  /** null means "not reported / unknown", never treated as an exit. */
  fullscreen: boolean | null;
  visibility: "visible" | "hidden" | "unknown";
  joinedAt: number;
  lastActivityAt: number;
  lastRejoinAt: number | null;
  /** Whether this student currently publishes a screen to the teacher. */
  sharingScreen: boolean;
  eventCount: number;
  /** 0-based seat assigned by the teacher's seat layout, null when unassigned. */
  seat: number | null;
}

/** A post inside one team's private discussion board. */
export interface TeamPost {
  id: string;
  team: string;
  author: string;
  text: string;
  createdAt: number;
}

/** One team's discussion board. Students only ever receive their own team. */
export interface TeamBoard {
  team: string;
  posts: TeamPost[];
}

/** A student picked as today's presenter (or by the roulette). */
export interface PresenterPick {
  participantId: string;
  name: string;
  team: string | null;
  at: number;
}

/* ------------------------------------------------------------------ */
/* Mini games (ThinkerBell style)                                      */
/* ------------------------------------------------------------------ */

export type MiniGameKind =
  | "roulette"
  | "bomb"
  | "wordsearch"
  | "memory"
  | "ladder"
  | "speedtap"
  | "jamo";

export interface RouletteState {
  kind: "roulette";
  at: number;
  candidates: Array<{ participantId: string; name: string }>;
  picked: { participantId: string; name: string } | null;
}

/** Server-owned bomb: only the Durable Object alarm decides when it explodes. */
export interface BombState {
  kind: "bomb";
  startedAt: number;
  endsAt: number;
  holder: { participantId: string; name: string };
  status: "running" | "exploded";
  loserName: string | null;
}

export interface WordFound {
  word: string;
  by: string;
  at: number;
}

/** Rows of a square letter grid; `found` lists words students already found. */
export interface WordSearchState {
  kind: "wordsearch";
  size: number;
  grid: string[];
  words: string[];
  found: WordFound[];
}

export interface MemoryCard {
  id: string;
  label: string;
  pairId: string;
  state: "hidden" | "open" | "matched";
}

export interface MemoryState {
  kind: "memory";
  cards: MemoryCard[];
  moves: number;
  matched: number;
}

/** One rung of the ladder: `row` and `col` (between col and col + 1). */
export interface LadderRung {
  row: number;
  col: number;
}

/**
 * 사다리 타기. The server draws the ladder and resolves the mapping, so the
 * result cannot be re-rolled by a client. `winners[i]` belongs to `names[i]`.
 */
export interface LadderState {
  kind: "ladder";
  at: number;
  names: string[];
  prizes: string[];
  rows: number;
  rungs: LadderRung[];
  winners: Array<{ name: string; prize: string; start: number; end: number }>;
  revealed: boolean;
}

/** One hit in 반응 속도 대결. The server timestamps it, not the client. */
export interface SpeedTapHit {
  participantId: string;
  name: string;
  ms: number;
  points: number;
}

export interface SpeedTapScore {
  participantId: string;
  name: string;
  points: number;
  bestMs: number | null;
}

/**
 * 반응 속도 대결 (mole tapping). `startsAt` is a random delay so students
 * cannot predict the cell, and `endsAt` closes the round even if nobody taps.
 */
export interface SpeedTapState {
  kind: "speedtap";
  round: number;
  size: number;
  target: number;
  startsAt: number;
  endsAt: number;
  hits: SpeedTapHit[];
  totals: SpeedTapScore[];
}

/** One guess in the 초성 퀴즈. */
export interface JamoAttempt {
  name: string;
  text: string;
  correct: boolean;
  at: number;
}

/**
 * 초성 퀴즈. `answer` stays hidden until someone solves the word, so the
 * consonant prompt cannot be reverse-searched from the payload.
 */
export interface JamoState {
  kind: "jamo";
  index: number;
  total: number;
  prompt: string;
  answer: string | null;
  solved: boolean;
  solvedBy: string | null;
  attempts: JamoAttempt[];
  scores: Array<{ name: string; points: number }>;
  startedAt: number;
}

export type MiniGameState =
  | RouletteState
  | BombState
  | WordSearchState
  | MemoryState
  | LadderState
  | SpeedTapState
  | JamoState;

/* ------------------------------------------------------------------ */
/* Live quiz + worksheet (in-class interactive core)                   */
/* ------------------------------------------------------------------ */

export interface QuizOption {
  id: string;
  label: string;
}

/** `choice` = multiple choice, `ox` = true/false, `spell` = typed answer, `connect` = 짝 연결. */
export type QuizMode = "choice" | "ox" | "spell" | "connect";

/** Game flavour chosen by the teacher before starting a question. */
export type GameMode = "classic" | "speed" | "goldenbell" | "team" | "item";

/** Items a student can hold in 아이템전. */
export type GameItemKind = "double" | "steal" | "bonus";

export interface QuizPair {
  left: string;
  right: string;
}

export interface GameItem {
  participantId: string;
  item: GameItemKind;
  at: number;
}

export interface GameFeedEntry {
  id: string;
  at: number;
  text: string;
  tone: "info" | "good" | "warn";
}

/**
 * 팀·자리 운영 방식. 팀 이름은 항상 `1모둠` … `N모둠`으로 만들어지고, 학생 수는
 * `live.team` / `live.seat`에 저장됩니다 (자리 인덱스는 0부터).
 */
export interface RosterState {
  teamCount: number;
  /** 학생이 자기 모둠을 직접 고를 수 있는지 */
  teamOpen: boolean;
  seatRows: number;
  seatCols: number;
  /** 학생이 빈자리를 직접 고를 수 있는지 */
  seatOpen: boolean;
  /** 서버가 계산한 사용 중인 자리 인덱스 (학생 화면의 빈자리 표시용) */
  occupiedSeats?: number[];
}

export interface LiveQuiz {
  id: string;
  prompt: string;
  mode: QuizMode;
  options: QuizOption[];
  status: "open" | "closed";
  startedAt: number;
  closedAt: number | null;
  answerCount: number;
  /** Revealed to students only after the teacher closes the quiz. */
  correctAnswer: string | null;
  /** 1-based question number inside the running game. */
  round: number;
  gameMode: GameMode;
  /** Countdown length in seconds, null when untimed. */
  durationSec: number | null;
  /** Absolute end time; past it answers are rejected. */
  endsAt: number | null;
  /** 'notice'면 학생 알림 영역에 작은 문제로 표시됩니다. */
  surface: "quiz" | "notice";
  /** 짝 연결(connect) 문제의 왼쪽 항목. 오른쪽은 섞여서 내려갑니다. */
  lefts: string[];
  rights: string[];
}

export interface GameScore {
  participantId: string;
  name: string;
  team: string | null;
  points: number;
  correct: number;
  wrong: number;
  alive: boolean;
}

export interface GameTeam {
  id: string;
  label: string;
  points: number;
  players: number;
}

export interface GameState {
  mode: GameMode;
  round: number;
  totalRounds: number;
  scores: GameScore[];
  teams: GameTeam[];
  /** 대기 화면(방번호·참가자 목록)이 열려 있는지 */
  lobbyOpen: boolean;
  /** 아이템전에서 학생이 들고 있는 아이템. 학생에게는 자기 것만 전달됩니다. */
  items: GameItem[];
  /** 점수·순위 알림 피드 (최신순). */
  feed: GameFeedEntry[];
}

export interface QuizResponse {
  participantId: string;
  studentName: string;
  optionId: string;
  text?: string;
  correct?: boolean;
  /** Speed/team points earned for this answer. */
  points: number;
  elapsedMs: number | null;
  at: number;
}

export interface QuizResults {
  quizId: string;
  tallies: Record<string, number>;
  responses: QuizResponse[];
  participantCount: number;
  answerCount: number;
  correctCount: number;
  correctAnswer: string | null;
}

/**
 * Live text typed into an AIC activity field. This is deliberately limited to
 * activity inputs (worksheet / board / game answer), never global keystrokes
 * and never other apps or password fields.
 */
export interface InputPreview {
  participantId: string;
  studentName: string;
  field: string;
  text: string;
  at: number;
}

/**
 * Metadata for a worksheet PDF. The file bytes never touch the server: the
 * teacher's browser keeps them in IndexedDB and relays them to a requesting
 * student over the classroom socket while the console is open.
 */
export interface SharedMaterial {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "pdf";
}

/** `short` = one line, `long` = paragraph, `ox` = O/X buttons. */
export type WorksheetFieldType = "short" | "long" | "ox";

export interface WorksheetField {
  id: string;
  label: string;
  type: WorksheetFieldType;
  /** Optional auto-grading key. Empty means the teacher grades by hand. */
  answer: string | null;
}

export interface WorksheetState {
  id: string;
  prompt: string;
  createdAt: number;
  submissionCount: number;
  material: SharedMaterial | null;
  /** In-app questions students answer directly inside AIC. */
  fields: WorksheetField[];
}

export interface WorksheetSubmission {
  participantId: string;
  studentName: string;
  /** Legacy single-answer body, still written for PDF-only worksheets. */
  text: string;
  answers: Record<string, string>;
  score: number | null;
  maxScore: number | null;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Whole-class presentation + lesson timer                             */
/* ------------------------------------------------------------------ */

/**
 * Content the teacher pushes onto every student screen at once. `board` shows
 * the live activity board, `url` embeds a page (Padlet embeds use this), and
 * `note` shows a large text card.
 */
export type StageKind = "url" | "note" | "board";

export interface StageContent {
  id: string;
  kind: StageKind;
  title: string;
  url: string | null;
  body: string | null;
  requireFullscreen: boolean;
  openedAt: number;
}

/** A countdown the whole class can see (for example a 50-minute lesson). */
export interface ClassTimer {
  startedAt: number;
  durationSec: number;
  endsAt: number;
}

/** A public Padlet resolved from a normal board URL or pasted embed code. */
export interface PadletResolved {
  sourceUrl: string;
  embedUrl: string;
  title: string | null;
}

/* ------------------------------------------------------------------ */
/* Collaborative board (Padlet / ThinkerBell style)                    */
/* ------------------------------------------------------------------ */

export type BoardColor = "yellow" | "rose" | "sky" | "emerald" | "violet" | "slate";

export interface BoardCard {
  id: string;
  text: string;
  color: BoardColor;
  author: string;
  column: string | null;
  createdAt: number;
}

export type BoardLayout = "wall" | "columns";

/**
 * A board that is live in the classroom. It only exists while the teacher's
 * console is open; the teacher's saved copy lives in browser IndexedDB.
 */
export interface LiveBoard {
  id: string;
  title: string;
  instructions: string;
  layout: BoardLayout;
  columns: string[];
  allowStudentPosts: boolean;
  cards: BoardCard[];
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* WebRTC signaling                                                    */
/* ------------------------------------------------------------------ */

export type RtcPurpose = "teacher-screen" | "student-screen";

export interface RtcDescription {
  type: "offer" | "answer";
  sdp: string;
}

export interface RtcCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export type RtcSignal =
  | { kind: "offer"; purpose: RtcPurpose; description: RtcDescription }
  | { kind: "answer"; purpose: RtcPurpose; description: RtcDescription }
  | { kind: "candidate"; purpose: RtcPurpose; candidate: RtcCandidate }
  /** Teacher → student: "please allow sharing your screen". */
  | { kind: "request"; purpose: RtcPurpose }
  | { kind: "stop"; purpose: RtcPurpose };

/* ------------------------------------------------------------------ */
/* Snapshots and messages                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Class tools: team scoreboard + attendance                            */
/* ------------------------------------------------------------------ */

export interface AttendanceEntry {
  participantId: string;
  name: string;
  at: number;
}

/**
 * Small teacher tools that the whole class can see: a team scoreboard and a
 * one-tap attendance check. Both live only for the running class.
 */
export interface ClassToolsState {
  scores: Record<string, number>;
  checkinOpen: boolean;
  attendance: AttendanceEntry[];
}

export interface ClassroomSnapshot {
  classroomId: string;
  status: ClassroomStatus;
  serverTime: number;
  students: StudentLive[];
  quiz: LiveQuiz | null;
  quizResults: QuizResults | null;
  worksheet: WorksheetState | null;
  submissions: WorksheetSubmission[];
  board: LiveBoard | null;
  stage: StageContent | null;
  timer: ClassTimer | null;
  game: GameState;
  observing: boolean;
  inputs: InputPreview[];
  recentEvents: ClassroomEventRecord[];
  teamBoards: TeamBoard[];
  presenter: PresenterPick | null;
  minigame: MiniGameState | null;
  tools: ClassToolsState;
  roster: RosterState;
  settings: ClassSettings;
}

export interface StudentSnapshot {
  classroomId: string;
  status: ClassroomStatus;
  serverTime: number;
  self: StudentLive | null;
  quiz: LiveQuiz | null;
  myQuizAnswer: string | null;
  worksheet: WorksheetState | null;
  myWorksheet: string | null;
  myWorksheetAnswers: Record<string, string> | null;
  /** True once submitted; the student cannot edit until the teacher reopens it. */
  myWorksheetLocked: boolean;
  board: LiveBoard | null;
  stage: StageContent | null;
  timer: ClassTimer | null;
  game: GameState;
  observing: boolean;
  events: ClassroomEventRecord[];
  /** Only this student's team board, never another team's. */
  teamBoard: TeamBoard | null;
  presenter: PresenterPick | null;
  minigame: MiniGameState | null;
  tools: ClassToolsState;
  roster: RosterState;
  settings: ClassSettings;
}

export type ServerMessage =
  | { type: "snapshot"; role: "teacher"; snapshot: ClassroomSnapshot }
  | { type: "snapshot"; role: "student"; snapshot: StudentSnapshot }
  | { type: "students"; students: StudentLive[] }
  | { type: "you"; self: StudentLive }
  | { type: "event"; event: ClassroomEventRecord }
  | {
      type: "quiz";
      quiz: LiveQuiz | null;
      results?: QuizResults;
      yourAnswer?: string | null;
    }
  | {
      type: "worksheet";
      worksheet: WorksheetState | null;
      submissions?: WorksheetSubmission[];
      /** Student only: true when this student already submitted. */
      locked?: boolean;
    }
  | { type: "board"; board: LiveBoard | null }
  | { type: "stage"; stage: StageContent | null }
  | { type: "timer"; timer: ClassTimer | null }
  | { type: "game"; game: GameState }
  | { type: "teams"; boards: TeamBoard[] }
  | { type: "roster"; roster: RosterState }
  | { type: "settings"; settings: ClassSettings }
  | { type: "presenter"; presenter: PresenterPick | null }
  | { type: "minigame"; game: MiniGameState | null }
  | { type: "tools"; tools: ClassToolsState }
  | { type: "fullscreen_request"; at: number }
  | { type: "observe"; observing: boolean }
  | { type: "input_preview"; preview: InputPreview }
  | { type: "file_request"; from: string; fromName: string; materialId: string }
  | {
      type: "file_chunk";
      from: string;
      transferId: string;
      materialId: string;
      name: string;
      mime: string;
      size: number;
      index: number;
      total: number;
      data: string;
    }
  | { type: "rtc"; from: string; fromName: string; signal: RtcSignal }
  | { type: "notice"; text: string; at: number }
  | { type: "pong"; at: number }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "ping" }
  | { type: "heartbeat"; at: number }
  | {
      type: "focus";
      fullscreen: boolean | null;
      visibility: "visible" | "hidden" | "unknown";
      online: boolean;
    }
  | { type: "event"; eventType: FocusEventType; detail?: string }
  | {
      type: "quiz_start";
      prompt: string;
      options?: string[];
      mode?: QuizMode;
      answer?: string;
      durationSec?: number;
      gameMode?: GameMode;
      round?: number;
      totalRounds?: number;
      pairs?: QuizPair[];
      /** 'notice'면 프로젝터 없이 알림으로 보냅니다. */
      surface?: "quiz" | "notice";
    }
  | { type: "quiz_close" }
  | { type: "game_reset" }
  | { type: "game_lobby"; open: boolean }
  | { type: "game_teams_shuffle" }
  | { type: "team_auto" }
  | { type: "roster_set"; teamCount?: number; teamOpen?: boolean; seatRows?: number; seatCols?: number; seatOpen?: boolean }
  | { type: "settings_set"; settings: Partial<ClassSettings> }
  | { type: "seat_assign"; to: string; seat: number | null }
  | { type: "seat_take"; seat: number }
  | { type: "team_take"; team: string }
  | { type: "item_use"; item: GameItemKind }
  | { type: "game_feed_clear" }
  | { type: "presenter_pick"; team?: string | null }
  | { type: "presenter_clear" }
  | { type: "team_set"; to: string; team: string | null }
  | { type: "seat_shuffle"; rows?: number; cols?: number }
  | { type: "seat_clear" }
  | { type: "team_post"; text: string; team?: string | null }
  | { type: "team_clear"; team?: string | null }
  | { type: "fullscreen_all" }
  | { type: "worksheet_reopen"; to?: string }
  | { type: "minigame_roulette"; team?: string | null }
  | { type: "minigame_bomb_start" }
  | { type: "bomb_pass" }
  | { type: "minigame_wordsearch"; words: string[] }
  | { type: "word_found"; word: string }
  | { type: "minigame_memory"; words: string[] }
  | { type: "memory_flip"; cardId: string }
  | { type: "minigame_ladder"; names?: string[]; prizes?: string[]; rows?: number }
  | { type: "ladder_reveal" }
  | { type: "minigame_speedtap"; size?: number }
  | { type: "speedtap_next" }
  | { type: "minigame_jamo"; words: string[] }
  | { type: "jamo_next" }
  | { type: "minigame_close" }
  | { type: "score_adjust"; team: string; delta: number }
  | { type: "score_reset" }
  | { type: "checkin_open"; open: boolean }
  | { type: "checkin" }
  | { type: "speedtap_tap"; cell: number }
  | { type: "jamo_answer"; text: string }
  | { type: "quiz_answer"; optionId?: string; text?: string }
  | {
      type: "worksheet_set";
      prompt: string;
      material?: SharedMaterial | null;
      fields?: WorksheetField[];
    }
  | { type: "worksheet_save"; text: string; answers?: Record<string, string> }
  | { type: "board_share"; board: LiveBoard }
  | { type: "board_close" }
  | { type: "board_add"; text: string; color?: BoardColor; column?: string | null }
  | { type: "board_delete"; cardId: string }
  | {
      type: "stage_set";
      kind: StageKind;
      title: string;
      url?: string | null;
      body?: string | null;
      requireFullscreen?: boolean;
    }
  | { type: "stage_close" }
  | { type: "timer_set"; action: "start" | "stop"; durationSec?: number }
  | { type: "nudge"; to: string; text?: string }
  | { type: "nudge_all"; text?: string }
  | { type: "hand"; raised: boolean }
  | { type: "hand_clear"; to: string }
  | { type: "observe_set"; observing: boolean }
  | { type: "input_preview"; field: string; text: string }
  | { type: "file_request"; materialId: string }
  | {
      type: "file_chunk";
      to: string;
      transferId: string;
      materialId: string;
      name: string;
      mime: string;
      size: number;
      index: number;
      total: number;
      data: string;
    }
  | { type: "rtc"; to: string; signal: RtcSignal };

export type StudentClientMessage =
  | Extract<ClientMessage, { type: "hand" }>
  | Extract<ClientMessage, { type: "worksheet_save" }>
  | Extract<ClientMessage, { type: "seat_take" }>
  | Extract<ClientMessage, { type: "team_take" }>
  | Extract<ClientMessage, { type: "item_use" }>;

/* ------------------------------------------------------------------ */
/* REST DTOs                                                           */
/* ------------------------------------------------------------------ */

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  /** 이름 + 액세스 코드로 로그인하는 계정에만 있습니다(원래 계정은 비밀번호 사용). */
  accessCode?: string | null;
}

export interface ClassroomSettings {
  requireFullscreen: boolean;
}

export interface ClassroomSummary extends ClassroomSettings {
  id: string;
  title: string;
  subject: string;
  joinCode: string;
  status: ClassroomStatus;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  participantCount: number;
}

export interface ClassroomPublicInfo {
  id: string;
  title: string;
  subject: string;
  teacherName: string;
  status: ClassroomStatus;
  joinCode: string;
  requireFullscreen: boolean;
}

export type JoinResult =
  | {
      ok: true;
      participantToken: string;
      participant: { id: string; name: string; joinedAt: number; rejoin: boolean };
      classroom: ClassroomPublicInfo;
    }
  | { ok: false; code: "invalid_token"; message: string };

export interface StudentSessionResponse {
  classroom: ClassroomPublicInfo;
  participant: { id: string; name: string; joinedAt: number };
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

/** Chunk size for the browser-to-browser PDF relay (base64 characters). */
export const FILE_CHUNK_BASE64 = 192 * 1024;
/** Hard cap for a shared worksheet PDF. */
export const MAX_MATERIAL_BYTES = 12 * 1024 * 1024;
