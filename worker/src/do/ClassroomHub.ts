import { DurableObject } from "cloudflare:workers";
import type { Env } from "../types";
import { randomId } from "../lib/crypto";
import { DEFAULT_SETTINGS, normalizeSettings, type ClassSettings } from "../../../shared/settings";
import type {
  BoardCard,
  BoardColor,
  BoardLayout,
  ClassroomEventRecord,
  InputPreview,
  QuizMode,
  ClassroomSnapshot,
  ClientMessage,
  ConnectionState,
  FocusEventType,
  LiveBoard,
  LiveQuiz,
  QuizResults,
  RtcSignal,
  ServerMessage,
  SharedMaterial,
  StudentLive,
  StudentSnapshot,
  WorksheetState,
  WorksheetSubmission,
  ClassroomStatus,
  ClassTimer,
  GameMode,
  GameState,
  GameScore,
  StageContent,
  StageKind,
  WorksheetField,
  TeamBoard,
  TeamPost,
  PresenterPick,
  MiniGameState,
  RouletteState,
  BombState,
  WordSearchState,
  MemoryState,
  MemoryCard,
  LadderState,
  LadderRung,
  SpeedTapState,
  JamoState,
  ClassToolsState,
  AttendanceEntry,
  RosterState,
  QuizPair,
  GameItem,
  GameItemKind,
  GameFeedEntry,
} from "../../../shared/protocol";
import { jamoPrompt, normalizeWord } from "../../../shared/hangul";
import {
  MAX_TEAMS,
  MAX_SEAT_COLS,
  MAX_SEAT_ROWS,
  MIN_SEAT_COLS,
  clampTeamCount,
  isTeamLabel,
  normalizeRoster,
  seatCapacity,
  teamLabels,
} from "../../../shared/roster";

interface Attachment {
  role: "teacher" | "student";
  participantId?: string;
  name?: string;
}

interface LiveRow {
  participant_id: string;
  name: string;
  online: number;
  fullscreen: number | null;
  visibility: string;
  joined_at: number;
  last_activity_at: number;
  last_rejoin_at: number | null;
  sharing: number;
  event_count: number;
  team: string | null;
  hand: number;
  alive: number;
  seat: number | null;
}

interface EventRow {
  id: string;
  participant_id: string;
  student_name: string;
  type: string;
  detail: string | null;
  connection: string;
  created_at: number;
}

interface QuizRow {
  id: string;
  prompt: string;
  mode: string;
  options_json: string;
  correct_option: string | null;
  correct_text: string | null;
  status: string;
  started_at: number;
  closed_at: number | null;
  round: number;
  duration_sec: number | null;
  ends_at: number | null;
  game_mode: string;
  pairs_json: string | null;
}

interface AnswerRow {
  participant_id: string;
  student_name: string;
  option_id: string;
  text: string | null;
  at: number;
  points: number;
  elapsed_ms: number | null;
  correct: number | null;
}

interface InputRow {
  participant_id: string;
  student_name: string;
  field: string;
  text: string;
  at: number;
}

interface WorksheetRow {
  id: string;
  prompt: string;
  created_at: number;
  material_json: string | null;
  fields_json: string | null;
}

interface SubmissionRow {
  participant_id: string;
  student_name: string;
  text: string;
  updated_at: number;
  answers_json: string | null;
  score: number | null;
  max_score: number | null;
  locked: number | null;
}

interface BoardRow {
  id: string;
  title: string;
  instructions: string;
  layout: string;
  columns_json: string;
  allow_posts: number;
  updated_at: number;
}

interface CardRow {
  id: string;
  board_id: string;
  text: string;
  color: string;
  author: string;
  column_name: string | null;
  created_at: number;
}

const EVENT_TYPES: ReadonlySet<string> = new Set<FocusEventType>([
  "join",
  "rejoin",
  "leave",
  "fullscreen_enter",
  "fullscreen_exit",
  "fullscreen_unknown",
  "page_hidden",
  "page_visible",
  "page_leave",
  "page_return",
  "network_online",
  "network_offline",
  "ws_disconnected",
  "ws_reconnected",
  "key_escape",
  "shortcut_observed",
  "screen_share_started",
  "screen_share_stopped",
  "screen_share_denied",
]);

/** Events a student page is allowed to report about its own browser. */
const STUDENT_REPORTABLE: ReadonlySet<string> = new Set<FocusEventType>([
  "page_hidden",
  "page_visible",
  "page_leave",
  "page_return",
  "network_online",
  "network_offline",
  "key_escape",
  "shortcut_observed",
  "screen_share_started",
  "screen_share_stopped",
  "screen_share_denied",
]);

const BOARD_COLORS: ReadonlySet<string> = new Set<BoardColor>([
  "yellow",
  "rose",
  "sky",
  "emerald",
  "violet",
  "slate",
]);

/** Repeated identical observations inside this window are one alert. */
const DEDUPE_WINDOW_MS = 25_000;
const EVENT_RETENTION_DAYS = 7;
const EVENT_ROW_CAP = 1500;
const QUIZ_OPTION_IDS = ["a", "b", "c", "d", "e", "f"];
const BOARD_CARD_CAP = 200;
const BOARD_CARD_MAX_CHARS = 280;
/** Base64 characters per relayed PDF chunk (stays under the 1 MiB frame cap). */
const FILE_CHUNK_MAX_CHARS = 300_000;
const FILE_CHUNK_MAX_TOTAL = 96;

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 짝 연결 문제의 왼쪽·오른쪽 쌍을 정리합니다. */
function sanitizePairs(value: unknown): QuizPair[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pairs: QuizPair[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const left = typeof record.left === "string" ? record.left.trim().slice(0, 60) : "";
    const right = typeof record.right === "string" ? record.right.trim().slice(0, 60) : "";
    if (!left || !right || seen.has(left)) continue;
    seen.add(left);
    pairs.push({ left, right });
    if (pairs.length >= 8) break;
  }
  return pairs;
}

function parsePairs(raw: string | null): QuizPair[] {
  if (!raw) return [];
  try {
    return sanitizePairs(JSON.parse(raw));
  } catch {
    return [];
  }
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS live (
    participant_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    online INTEGER NOT NULL DEFAULT 0,
    fullscreen INTEGER,
    visibility TEXT NOT NULL DEFAULT 'unknown',
    joined_at INTEGER NOT NULL,
    last_activity_at INTEGER NOT NULL,
    last_rejoin_at INTEGER,
    sharing INTEGER NOT NULL DEFAULT 0,
    event_count INTEGER NOT NULL DEFAULT 0,
    team TEXT,
    hand INTEGER NOT NULL DEFAULT 0,
    alive INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    type TEXT NOT NULL,
    detail TEXT,
    connection TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_events_participant ON events (participant_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS quiz (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'choice',
    options_json TEXT NOT NULL,
    correct_option TEXT,
    correct_text TEXT,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    closed_at INTEGER,
    round INTEGER NOT NULL DEFAULT 1,
    duration_sec INTEGER,
    ends_at INTEGER,
    game_mode TEXT NOT NULL DEFAULT 'classic'
  )`,
  `CREATE TABLE IF NOT EXISTS quiz_answers (
    quiz_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    option_id TEXT NOT NULL,
    text TEXT,
    at INTEGER NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    elapsed_ms INTEGER,
    correct INTEGER,
    PRIMARY KEY (quiz_id, participant_id)
  )`,
  `CREATE TABLE IF NOT EXISTS worksheet (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    material_json TEXT,
    fields_json TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS worksheet_submissions (
    participant_id TEXT PRIMARY KEY,
    student_name TEXT NOT NULL,
    text TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    answers_json TEXT,
    score INTEGER,
    max_score INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS board (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    layout TEXT NOT NULL DEFAULT 'wall',
    columns_json TEXT NOT NULL DEFAULT '[]',
    allow_posts INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS board_cards (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    text TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'yellow',
    author TEXT NOT NULL,
    column_name TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS team_posts (
    id TEXT PRIMARY KEY,
    team TEXT NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS input_previews (
    participant_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    field TEXT NOT NULL,
    text TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (participant_id, field)
  )`,
  `CREATE TABLE IF NOT EXISTS game_items (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    item TEXT NOT NULL,
    granted_at INTEGER NOT NULL,
    used_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS game_feed (
    id TEXT PRIMARY KEY,
    at INTEGER NOT NULL,
    text TEXT NOT NULL,
    tone TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS game_bonus (
    participant_id TEXT PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS game_effects (
    participant_id TEXT PRIMARY KEY,
    double_on INTEGER NOT NULL DEFAULT 0
  )`,
];

const COLUMN_MIGRATIONS = [
  "ALTER TABLE live ADD COLUMN sharing INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE worksheet ADD COLUMN material_json TEXT",
  "ALTER TABLE quiz ADD COLUMN mode TEXT NOT NULL DEFAULT 'choice'",
  "ALTER TABLE quiz ADD COLUMN correct_option TEXT",
  "ALTER TABLE quiz ADD COLUMN correct_text TEXT",
  "ALTER TABLE quiz_answers ADD COLUMN text TEXT",
  "ALTER TABLE live ADD COLUMN team TEXT",
  "ALTER TABLE live ADD COLUMN hand INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE live ADD COLUMN alive INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE quiz ADD COLUMN round INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE quiz ADD COLUMN duration_sec INTEGER",
  "ALTER TABLE quiz ADD COLUMN ends_at INTEGER",
  "ALTER TABLE quiz ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'classic'",
  "ALTER TABLE quiz_answers ADD COLUMN points INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE quiz_answers ADD COLUMN elapsed_ms INTEGER",
  "ALTER TABLE quiz_answers ADD COLUMN correct INTEGER",
  "ALTER TABLE worksheet ADD COLUMN fields_json TEXT",
  "ALTER TABLE worksheet_submissions ADD COLUMN answers_json TEXT",
  "ALTER TABLE worksheet_submissions ADD COLUMN score INTEGER",
  "ALTER TABLE worksheet_submissions ADD COLUMN max_score INTEGER",
  "ALTER TABLE worksheet_submissions ADD COLUMN locked INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE live ADD COLUMN seat INTEGER",
  "ALTER TABLE quiz ADD COLUMN pairs_json TEXT",
];

const GAME_ITEM_KINDS: ReadonlySet<string> = new Set(["double", "steal", "bonus"]);
const ITEM_LABEL: Record<GameItemKind, string> = {
  double: "더블",
  steal: "훔치기",
  bonus: "+50점",
};
const FEED_CAP = 24;

const FIELD_TYPES: ReadonlySet<string> = new Set(["short", "long", "ox"]);
const GAME_MODES: ReadonlySet<string> = new Set(["classic", "speed", "goldenbell", "team", "item"]);
const STAGE_KINDS: ReadonlySet<string> = new Set(["url", "note", "board"]);
const MINI_WORDS_MAX = 6;
const WORDSEARCH_SIZE = 12;
/** The bomb fires somewhere in this window; only the alarm decides when. */
const BOMB_MIN_MS = 12_000;
const BOMB_MAX_MS = 28_000;
const TEAM_POST_MAX_CHARS = 400;
const TEAM_POST_CAP = 120;
/** A console reload reconnects within this window, so shared content survives it. */
const TEACHER_GRACE_MS = 10_000;
const SPEEDTAP_ROUND_MS = 12_000;
const SPEEDTAP_MAX_SIZE = 5;
const JAMO_MAX_ATTEMPTS = 40;
const JAMO_MAX_WORDS = 30;
const TOOLS_ATTENDANCE_CAP = 200;

const SEARCH_LETTERS = "가나다라마바사아자차카타파하ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomOf<T>(items: T[]): T | null {
  return items.length ? items[Math.floor(Math.random() * items.length)] : null;
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * Math.max(1, max - min));
}

/**
 * Places the teacher's words horizontally or vertically in a square grid and
 * fills the rest with random letters. Unplaceable (too long) words are dropped.
 */
function buildWordSearch(words: string[]): { rows: string[]; placed: string[] } {
  const size = WORDSEARCH_SIZE;
  const grid: Array<Array<string | null>> = Array.from({ length: size }, () =>
    Array<string | null>(size).fill(null),
  );
  const placed: string[] = [];
  for (const word of words) {
    if (word.length > size) continue;
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const horizontal = Math.random() < 0.5;
      const span = horizontal ? word.length : 1;
      const height = horizontal ? 1 : word.length;
      const row = Math.floor(Math.random() * (size - height + 1));
      const col = Math.floor(Math.random() * (size - span + 1));
      let fits = true;
      for (let index = 0; index < word.length; index += 1) {
        const cell = grid[row + (horizontal ? 0 : index)][col + (horizontal ? index : 0)];
        if (cell && cell !== word[index]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      for (let index = 0; index < word.length; index += 1) {
        grid[row + (horizontal ? 0 : index)][col + (horizontal ? index : 0)] = word[index];
      }
      placed.push(word);
      break;
    }
  }
  const rows = grid.map((row) =>
    row
      .map((cell) => cell ?? SEARCH_LETTERS[Math.floor(Math.random() * SEARCH_LETTERS.length)])
      .join(""),
  );
  return { rows, placed };
}

type SqlValue = string | number | null;

/**
 * One Durable Object per classroom. Owns all ephemeral live state and the
 * per-classroom event log so D1 only stores durable metadata. WebSockets use
 * the Hibernation API; presence is recovered from serialized attachments.
 */
export class ClassroomHub extends DurableObject<Env> {
  private readonly classroomId: string;
  private readonly lastFlush = new Map<string, number>();
  private insertCounter = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.classroomId = ctx.id.name ?? "";
    for (const statement of SCHEMA) ctx.storage.sql.exec(statement);
    for (const statement of COLUMN_MIGRATIONS) {
      try {
        ctx.storage.sql.exec(statement);
      } catch {
        /* column already exists */
      }
    }
  }

  /* ------------------------------ storage ----------------------------- */

  private rows<T>(query: string, ...bindings: SqlValue[]): T[] {
    const cursor = this.ctx.storage.sql.exec(query, ...bindings);
    return cursor.toArray() as unknown as T[];
  }

  private first<T>(query: string, ...bindings: SqlValue[]): T | null {
    return this.rows<T>(query, ...bindings)[0] ?? null;
  }

  private run(query: string, ...bindings: SqlValue[]): void {
    this.ctx.storage.sql.exec(query, ...bindings);
  }

  /* ------------------------------ sockets ----------------------------- */

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("ClassroomHub accepts WebSocket upgrades only", { status: 426 });
    }
    const role = request.headers.get("x-aic-role") === "teacher" ? "teacher" : "student";
    const participantId = request.headers.get("x-aic-participant") ?? undefined;
    let name = "";
    try {
      name = decodeURIComponent(request.headers.get("x-aic-name") ?? "");
    } catch {
      name = "";
    }
    if (role === "student" && !participantId) {
      return new Response("missing participant", { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = { role, participantId, name };
    server.serializeAttachment(attachment);

    if (role === "teacher") {
      this.cancelTeacherTeardown();
      this.send(server, { type: "snapshot", role: "teacher", snapshot: this.teacherSnapshot() });
    } else {
      await this.attachStudent(server, participantId!, name || "이름 없음");
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  private async attachStudent(ws: WebSocket, participantId: string, name: string): Promise<void> {
    const now = Date.now();
    const existing = this.first<LiveRow>("SELECT * FROM live WHERE participant_id = ?", participantId);
    if (!existing) {
      const seat = Number(
        this.first<{ count: number }>("SELECT COUNT(*) AS count FROM live")?.count ?? 0,
      );
      const labels = this.teamLabels();
      const team = labels[seat % labels.length] ?? labels[0];
      this.run(
        `INSERT INTO live (participant_id, name, online, fullscreen, visibility, joined_at, last_activity_at, last_rejoin_at, sharing, event_count, team, hand, alive)
         VALUES (?, ?, 1, NULL, 'unknown', ?, ?, NULL, 0, 0, ?, 0, 1)`,
        participantId,
        name,
        now,
        now,
        team,
      );
    } else {
      this.run(
        "UPDATE live SET name = ?, online = 1, last_activity_at = ?, last_rejoin_at = ? WHERE participant_id = ?",
        name,
        now,
        now,
        participantId,
      );
    }
    this.lastFlush.set(participantId, now);

    if (!existing) {
      this.logEvent(participantId, name, "join", "수업 화면에 접속했다.", "connected");
    } else if (!existing.online) {
      this.logEvent(participantId, name, "rejoin", "수업에 다시 접속했다.", "connected");
      this.sendToTeachers({ type: "notice", text: `${name} 학생이 수업에 다시 접속했습니다.`, at: now });
    }

    this.broadcastStudents();
    this.send(ws, { type: "snapshot", role: "student", snapshot: this.studentSnapshot(participantId) });
  }

  private socketsFor(role: "teacher" | "student", participantId?: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (!attachment || attachment.role !== role) return false;
      if (participantId && attachment.participantId !== participantId) return false;
      return true;
    });
  }

  private onlineIds(): Set<string> {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (attachment?.role === "student" && attachment.participantId) ids.add(attachment.participantId);
    }
    return ids;
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      /* socket already closed */
    }
  }

  private sendToTeachers(message: ServerMessage): void {
    for (const ws of this.socketsFor("teacher")) this.send(ws, message);
  }

  private sendToStudents(message: ServerMessage): void {
    for (const ws of this.socketsFor("student")) this.send(ws, message);
  }

  private sendToParticipant(participantId: string, message: ServerMessage): void {
    for (const ws of this.socketsFor("student", participantId)) this.send(ws, message);
  }

  private broadcastStudents(): void {
    const students = this.students();
    for (const ws of this.socketsFor("teacher")) this.send(ws, { type: "students", students });
    // Each student also gets their own row so a teacher's team/seat change is
    // reflected immediately without exposing the whole roster.
    const online = this.onlineIds();
    for (const ws of this.socketsFor("student")) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      const participantId = attachment?.participantId;
      if (!participantId) continue;
      const row = this.first<LiveRow>("SELECT * FROM live WHERE participant_id = ?", participantId);
      if (row) this.send(ws, { type: "you", self: this.liveRowToStudent(row, online) });
    }
    this.broadcastGame();
  }

  /* --------------------------- message loop --------------------------- */

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (!attachment) return;
    let data: ClientMessage;
    try {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      data = JSON.parse(text) as ClientMessage;
    } catch {
      return;
    }
    if (!data || typeof data.type !== "string") return;
    // Timers are owned by the alarm, but a message arriving first should still
    // see a quiz that is already past its deadline as closed.
    this.expireDueContent();

    if (data.type === "ping") {
      this.send(ws, { type: "pong", at: Date.now() });
      return;
    }

    if (attachment.role === "teacher") {
      this.handleTeacherMessage(ws, data);
      return;
    }

    const participantId = attachment.participantId;
    if (!participantId) return;
    this.handleStudentMessage(ws, attachment.name ?? "", participantId, data);
  }

  private handleTeacherMessage(ws: WebSocket, data: ClientMessage): void {
    switch (data.type) {
      case "quiz_start": {
        const prompt = typeof data.prompt === "string" ? data.prompt.trim().slice(0, 300) : "";
        const mode: QuizMode =
          data.mode === "spell"
            ? "spell"
            : data.mode === "ox"
              ? "ox"
              : data.mode === "connect"
                ? "connect"
                : "choice";
        const supplied = Array.isArray(data.options)
          ? data.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 6)
          : [];
        const options = mode === "spell" || mode === "connect" ? [] : mode === "ox" ? ["O", "X"] : supplied;
        const pairs: QuizPair[] = mode === "connect" ? sanitizePairs(data.pairs) : [];
        if (!prompt) {
          this.send(ws, { type: "error", message: "질문을 입력해 주세요." });
          return;
        }
        if (mode === "choice" && options.length < 2) {
          this.send(ws, { type: "error", message: "객관식은 선택지가 두 개 이상 필요합니다." });
          return;
        }
        if (mode === "connect" && pairs.length < 2) {
          this.send(ws, { type: "error", message: "짝 연결 문제는 두 쌍 이상 필요합니다." });
          return;
        }
        const answerRaw = typeof data.answer === "string" ? data.answer.trim().slice(0, 120) : "";
        const answer = answerRaw ? normalizeAnswer(answerRaw) : "";
        let correctOption: string | null = null;
        let correctText: string | null = null;
        if (answer) {
          if (mode === "spell") {
            correctText = answer;
          } else if (mode === "choice" || mode === "ox") {
            const index = options.findIndex((option) => normalizeAnswer(option) === answer);
            if (index >= 0) correctOption = QUIZ_OPTION_IDS[index];
          }
        }
        const id = randomId("quiz_");
        const gameMode: GameMode = GAME_MODES.has(String(data.gameMode))
          ? (data.gameMode as GameMode)
          : "classic";
        const previous = this.quizRow();
        const round = Math.min(200, Math.max(1, Math.round(Number(data.round) || (previous ? previous.round + 1 : 1))));
        const totalRounds = Math.min(
          200,
          Math.max(round, Math.round(Number(data.totalRounds) || Number(this.configValue("total_rounds") ?? 0) || round)),
        );
        const durationRaw = Number(data.durationSec);
        const settings = this.settings();
        const durationSec = Number.isFinite(durationRaw) && durationRaw > 0
          ? Math.min(3600, Math.max(5, Math.round(durationRaw)))
          : data.durationSec === null || durationRaw === 0
            ? null
            : settings.quizSeconds > 0
              ? settings.quizSeconds
              : null;
        const now = Date.now();
        // Round 1 or a different game flavour starts a brand new scoreboard.
        if (round === 1 || gameMode !== (previous?.game_mode ?? "classic")) {
          this.run("DELETE FROM quiz");
          this.run("DELETE FROM quiz_answers");
          this.run("DELETE FROM game_items");
          this.run("DELETE FROM game_effects");
          this.run("DELETE FROM game_bonus");
          this.run("DELETE FROM game_feed");
          this.run("UPDATE live SET alive = 1");
        }
        this.setConfig("game_lobby", "0");
        this.run(
          `INSERT INTO quiz
            (id, prompt, mode, options_json, correct_option, correct_text, status, started_at, closed_at, round, duration_sec, ends_at, game_mode, pairs_json)
           VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NULL, ?, ?, ?, ?, ?)`,
          id,
          prompt,
          mode,
          JSON.stringify(options.map((label, index) => ({ id: QUIZ_OPTION_IDS[index], label }))),
          correctOption,
          correctText,
          now,
          round,
          durationSec,
          durationSec ? now + durationSec * 1000 : null,
          gameMode,
          pairs.length ? JSON.stringify(pairs) : null,
        );
        this.setConfig("total_rounds", String(totalRounds));
        this.broadcastQuiz();
        this.broadcastStudents();
        this.scheduleAlarm();
        return;
      }
      case "observe_set": {
        this.run(
          "INSERT INTO config (key, value) VALUES ('observing', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
          data.observing ? "1" : "0",
        );
        this.broadcastObserve();
        return;
      }
      case "quiz_close": {
        const quiz = this.quizRow();
        if (!quiz) return;
        this.run("UPDATE quiz SET status = 'closed', closed_at = ? WHERE id = ?", Date.now(), quiz.id);
        this.broadcastQuiz();
        this.scheduleAlarm();
        return;
      }
      case "game_reset": {
        this.run("DELETE FROM quiz");
        this.run("DELETE FROM quiz_answers");
        this.run("DELETE FROM game_items");
        this.run("DELETE FROM game_effects");
        this.run("DELETE FROM game_bonus");
        this.run("DELETE FROM game_feed");
        this.run("UPDATE live SET alive = 1");
        this.setConfig("total_rounds", null);
        this.setConfig("game_lobby", "0");
        this.broadcastQuiz();
        this.broadcastStudents();
        this.broadcastGame();
        this.scheduleAlarm();
        return;
      }
      case "game_teams_shuffle": {
        this.assignTeamsEvenly();
        return;
      }
      case "team_auto": {
        this.assignTeamsEvenly();
        return;
      }
      case "roster_set": {
        this.updateRoster(data);
        return;
      }
      case "settings_set": {
        this.saveSettings(data.settings);
        return;
      }
      case "seat_assign": {
        this.assignSeat(
          typeof data.to === "string" ? data.to : "",
          data.seat === null ? null : Number(data.seat),
        );
        return;
      }
      case "game_lobby": {
        this.setGameLobby(data.open === true);
        return;
      }
      case "game_feed_clear": {
        this.run("DELETE FROM game_feed");
        this.broadcastGame();
        return;
      }
      case "presenter_pick": {
        this.pickPresenter(typeof data.team === "string" ? data.team : null);
        return;
      }
      case "presenter_clear": {
        this.setConfig("presenter", null);
        this.sendToTeachers({ type: "presenter", presenter: null });
        this.sendToStudents({ type: "presenter", presenter: null });
        return;
      }
      case "team_set": {
        const to = typeof data.to === "string" ? data.to : "";
        if (!to) return;
        const team = isTeamLabel(typeof data.team === "string" ? data.team : null, this.rosterPublic().teamCount)
          ? (data.team as string)
          : null;
        this.run("UPDATE live SET team = ? WHERE participant_id = ?", team, to);
        this.broadcastStudents();
        this.broadcastGame();
        this.broadcastTeams();
        return;
      }
      case "seat_shuffle": {
        this.shuffleSeats(data.rows, data.cols);
        return;
      }
      case "seat_clear": {
        this.run("UPDATE live SET seat = NULL");
        this.broadcastStudents();
        return;
      }
      case "team_post": {
        const team = isTeamLabel(typeof data.team === "string" ? data.team : null, this.rosterPublic().teamCount)
          ? (data.team as string)
          : null;
        if (!team) return;
        this.addTeamPost(team, "선생님", data.text);
        return;
      }
      case "team_clear": {
        const team = isTeamLabel(typeof data.team === "string" ? data.team : null, this.rosterPublic().teamCount)
          ? (data.team as string)
          : null;
        if (team) this.run("DELETE FROM team_posts WHERE team = ?", team);
        else this.run("DELETE FROM team_posts");
        this.broadcastTeams();
        return;
      }
      case "fullscreen_all": {
        this.sendToStudents({ type: "fullscreen_request", at: Date.now() });
        this.sendToTeachers({ type: "notice", text: "모든 학생에게 전체화면을 요청했습니다.", at: Date.now() });
        return;
      }
      case "worksheet_reopen": {
        const to = typeof data.to === "string" ? data.to : "";
        if (to) this.run("UPDATE worksheet_submissions SET locked = 0 WHERE participant_id = ?", to);
        else this.run("UPDATE worksheet_submissions SET locked = 0");
        this.broadcastWorksheet();
        return;
      }
      case "minigame_roulette": {
        this.startRoulette(typeof data.team === "string" ? data.team : null);
        return;
      }
      case "minigame_bomb_start": {
        this.startBomb();
        return;
      }
      case "minigame_wordsearch": {
        this.startWordSearch(data.words);
        return;
      }
      case "minigame_memory": {
        this.startMemory(data.words);
        return;
      }
      case "memory_flip": {
        this.flipMemoryCard(typeof data.cardId === "string" ? data.cardId : "");
        return;
      }
      case "minigame_ladder": {
        this.startLadder(data.names, data.prizes, data.rows);
        return;
      }
      case "ladder_reveal": {
        this.revealLadder();
        return;
      }
      case "minigame_speedtap": {
        this.startSpeedTap(data.size);
        return;
      }
      case "speedtap_next": {
        this.nextSpeedTapRound();
        return;
      }
      case "minigame_jamo": {
        this.startJamo(data.words);
        return;
      }
      case "jamo_next": {
        this.nextJamoWord();
        return;
      }
      case "minigame_close": {
        this.setConfig("minigame", null);
        this.broadcastMiniGame();
        this.scheduleAlarm();
        return;
      }
      case "score_adjust": {
        this.adjustScore(data.team, Number(data.delta));
        return;
      }
      case "score_reset": {
        this.setTools({ ...this.toolsPublic(), scores: {} });
        this.broadcastTools();
        return;
      }
      case "checkin_open": {
        this.setTools({ ...this.toolsPublic(), checkinOpen: data.open === true });
        this.broadcastTools();
        return;
      }
      case "worksheet_set": {
        const prompt = typeof data.prompt === "string" ? data.prompt.trim().slice(0, 500) : "";
        if (!prompt) {
          this.send(ws, { type: "error", message: "학습지 안내 문구를 입력해 주세요." });
          return;
        }
        const material = this.sanitizeMaterial(data.material);
        const fields = this.sanitizeFields(data.fields);
        this.run("DELETE FROM worksheet");
        this.run("DELETE FROM worksheet_submissions");
        this.run(
          "INSERT INTO worksheet (id, prompt, created_at, material_json, fields_json) VALUES (?, ?, ?, ?, ?)",
          randomId("ws_"),
          prompt,
          Date.now(),
          material ? JSON.stringify(material) : null,
          fields.length ? JSON.stringify(fields) : null,
        );
        this.broadcastWorksheet();
        return;
      }
      case "stage_set": {
        this.setStage(ws, data);
        return;
      }
      case "stage_close": {
        this.clearStage(true);
        return;
      }
      case "timer_set": {
        this.setTimer(data.action, data.durationSec);
        return;
      }
      case "nudge_all": {
        const text = typeof data.text === "string" ? data.text.trim().slice(0, 140) : "";
        this.sendToStudents({
          type: "notice",
          text: text || "선생님이 모두의 화면을 확인하고 있습니다.",
          at: Date.now(),
        });
        return;
      }
      case "hand_clear": {
        const to = typeof data.to === "string" ? data.to : "";
        if (!to) return;
        this.run("UPDATE live SET hand = 0 WHERE participant_id = ?", to);
        this.broadcastStudents();
        return;
      }
      case "nudge": {
        const to = typeof data.to === "string" ? data.to : "";
        const text = typeof data.text === "string" ? data.text.trim().slice(0, 120) : "";
        if (!to) return;
        this.sendToParticipant(to, {
          type: "notice",
          text: text || "선생님이 화면을 확인해 달라고 했습니다.",
          at: Date.now(),
        });
        return;
      }
      case "board_share": {
        this.shareBoard(ws, data.board);
        return;
      }
      case "board_close": {
        this.clearBoard(true);
        return;
      }
      case "board_add": {
        this.addCard("선생님", data.text, data.color, data.column, true);
        return;
      }
      case "board_delete": {
        const cardId = typeof data.cardId === "string" ? data.cardId.slice(0, 80) : "";
        if (!cardId) return;
        this.run("DELETE FROM board_cards WHERE id = ?", cardId);
        this.broadcastBoard();
        return;
      }
      case "file_chunk": {
        this.relayFileChunk(data);
        return;
      }
      case "rtc": {
        this.relayRtc("teacher", "선생님", data.to, data.signal);
        return;
      }
      default:
        return;
    }
  }

  private handleStudentMessage(
    ws: WebSocket,
    name: string,
    participantId: string,
    data: ClientMessage,
  ): void {
    const row = this.first<LiveRow>("SELECT * FROM live WHERE participant_id = ?", participantId);
    if (!row) return;
    const now = Date.now();

    switch (data.type) {
      case "heartbeat": {
        this.run("UPDATE live SET last_activity_at = ?, online = 1 WHERE participant_id = ?", now, participantId);
        this.lastFlush.set(participantId, now);
        this.send(ws, { type: "pong", at: now });
        return;
      }
      case "focus": {
        const fullscreen = data.fullscreen === true ? 1 : data.fullscreen === false ? 0 : null;
        const visibility =
          data.visibility === "hidden" ? "hidden" : data.visibility === "visible" ? "visible" : "unknown";
        const connection: ConnectionState = data.online ? "connected" : "disconnected";
        this.run(
          "UPDATE live SET fullscreen = ?, visibility = ?, last_activity_at = ?, online = 1 WHERE participant_id = ?",
          fullscreen,
          visibility,
          now,
          participantId,
        );
        if (row.fullscreen === 1 && fullscreen === 0) {
          this.logEvent(participantId, name, "fullscreen_exit", "전체화면이 해제되었다.", connection);
        } else if (fullscreen === 1 && row.fullscreen !== 1) {
          this.logEvent(participantId, name, "fullscreen_enter", "전체화면 상태가 확인되었다.", connection);
        }
        if (row.visibility !== "hidden" && visibility === "hidden") {
          this.logEvent(participantId, name, "page_hidden", "페이지가 숨겨졌다.", connection);
        } else if (row.visibility === "hidden" && visibility === "visible") {
          this.logEvent(participantId, name, "page_visible", "페이지가 다시 표시되었다.", connection);
        }
        this.broadcastStudentUpdate(participantId);
        return;
      }
      case "event": {
        if (!STUDENT_REPORTABLE.has(data.eventType) || !EVENT_TYPES.has(data.eventType)) return;
        const detail = typeof data.detail === "string" ? data.detail.slice(0, 160) : null;
        if (data.eventType === "screen_share_started") {
          this.run("UPDATE live SET sharing = 1 WHERE participant_id = ?", participantId);
          this.broadcastStudentUpdate(participantId);
        } else if (data.eventType === "screen_share_stopped" || data.eventType === "screen_share_denied") {
          this.run("UPDATE live SET sharing = 0 WHERE participant_id = ?", participantId);
          this.broadcastStudentUpdate(participantId);
        }
        this.logEvent(participantId, name, data.eventType, detail, "connected");
        return;
      }
      case "quiz_answer": {
        const quiz = this.quizRow();
        if (!quiz || quiz.status !== "open") {
          this.send(ws, { type: "error", message: "진행 중인 퀴즈가 없습니다." });
          return;
        }
        if (quiz.ends_at !== null && now > quiz.ends_at) {
          this.send(ws, { type: "error", message: "응답 시간이 끝났습니다." });
          return;
        }
        const options = JSON.parse(quiz.options_json) as { id: string; label: string }[];
        const pairs = parsePairs(quiz.pairs_json);
        const gameMode = (GAME_MODES.has(quiz.game_mode) ? quiz.game_mode : "classic") as GameMode;
        const existing = this.first<AnswerRow>(
          "SELECT * FROM quiz_answers WHERE quiz_id = ? AND participant_id = ?",
          quiz.id,
          participantId,
        );
        if (gameMode === "goldenbell" && existing) {
          this.send(ws, { type: "error", message: "골든벨은 첫 답만 인정됩니다." });
          return;
        }
        let optionId = "";
        let text: string | null = null;
        let correct: number | null = null;
        if (quiz.mode === "spell") {
          const value = typeof data.text === "string" ? data.text.trim().slice(0, 120) : "";
          if (!value) return;
          text = value;
          if (quiz.correct_text) correct = normalizeAnswer(value) === quiz.correct_text ? 1 : 0;
        } else if (quiz.mode === "connect") {
          const value = typeof data.text === "string" ? data.text.slice(0, 4000) : "";
          if (!value) return;
          let mapping: Record<string, string> = {};
          try {
            const parsed = JSON.parse(value) as unknown;
            if (parsed && typeof parsed === "object") {
              for (const [left, right] of Object.entries(parsed as Record<string, unknown>)) {
                if (typeof right === "string") mapping[left] = right;
              }
            }
          } catch {
            this.send(ws, { type: "error", message: "연결 답변을 읽지 못했습니다." });
            return;
          }
          const answered = Object.keys(mapping).length;
          if (!answered) return;
          text = value;
          correct = pairs.every(
            (pair) => normalizeAnswer(mapping[pair.left] ?? "") === normalizeAnswer(pair.right),
          )
            ? 1
            : 0;
        } else {
          const value = String(data.optionId ?? "");
          if (!options.some((option) => option.id === value)) return;
          optionId = value;
          if (quiz.correct_option) correct = value === quiz.correct_option ? 1 : 0;
        }
        const elapsedMs = Math.max(0, now - quiz.started_at);
        const settings = this.settings();
        const speedPoints =
          settings.speedBonus && quiz.duration_sec && quiz.duration_sec > 0
            ? Math.round(Math.max(0, 1 - elapsedMs / (quiz.duration_sec * 1000)) * settings.correctPoints)
            : 0;
        let points =
          correct === 1
            ? settings.correctPoints + (gameMode === "speed" ? speedPoints : 0)
            : correct === 0
              ? settings.wrongPoints
              : 0;
        // 아이템전: 더블 아이템이 켜져 있으면 이번 정답이 몇 배로 오른다.
        if (correct === 1 && gameMode === "item") {
          const effect = this.first<{ double_on: number }>(
            "SELECT double_on FROM game_effects WHERE participant_id = ?",
            participantId,
          );
          if (effect?.double_on === 1) {
            points *= settings.itemDoubleMultiplier;
            this.run("UPDATE game_effects SET double_on = 0 WHERE participant_id = ?", participantId);
          }
        }
        const leaderBefore = this.leaderId();
        this.run(
          `INSERT INTO quiz_answers (quiz_id, participant_id, student_name, option_id, text, at, points, elapsed_ms, correct)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (quiz_id, participant_id) DO UPDATE SET option_id = excluded.option_id, text = excluded.text, at = excluded.at, points = excluded.points, elapsed_ms = excluded.elapsed_ms, correct = excluded.correct, student_name = excluded.student_name`,
          quiz.id,
          participantId,
          name,
          optionId,
          text,
          now,
          points,
          elapsedMs,
          correct,
        );
        if (correct === 1 && points > 0) {
          this.addFeed(`${name} 학생이 ${points}점을 얻었습니다.`, "good");
        }        if (correct === 1 && gameMode === "item") {
          this.grantItem(participantId, name);
        }
        if (gameMode === "goldenbell" && correct === 0) {
          this.run("UPDATE live SET alive = 0 WHERE participant_id = ?", participantId);
          this.send(ws, {
            type: "notice",
            text: "골든벨에서 탈락했습니다. 끝까지 다른 친구들을 응원해 주세요.",
            at: now,
          });
          this.sendToTeachers({ type: "notice", text: `${name} 학생이 골든벨에서 탈락했습니다.`, at: now });
        }
        if (correct === 1) {
          const leaderAfter = this.leaderId();
          if (leaderAfter && leaderAfter !== leaderBefore) {
            const leader = this.first<{ name: string }>(
              "SELECT name FROM live WHERE participant_id = ?",
              leaderAfter,
            );
            if (leader) this.addFeed(`${leader.name} 학생이 1위로 올라섰습니다!`, "warn");
          }
        }
        this.broadcastQuiz();
        this.broadcastStudents();
        return;
      }
      case "hand": {
        const raised = data.raised === true;
        this.run("UPDATE live SET hand = ? WHERE participant_id = ?", raised ? 1 : 0, participantId);
        this.broadcastStudents();
        if (raised) {
          this.sendToTeachers({ type: "notice", text: `${name} 학생이 손을 들었습니다.`, at: now });
        }
        return;
      }
      case "input_preview": {
        if (!this.observing()) return;
        const field = typeof data.field === "string" ? data.field.trim().slice(0, 40) : "";
        const text = typeof data.text === "string" ? data.text.slice(0, 2000) : "";
        if (!field) return;
        this.run(
          `INSERT INTO input_previews (participant_id, student_name, field, text, at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (participant_id, field) DO UPDATE SET text = excluded.text, at = excluded.at, student_name = excluded.student_name`,
          participantId,
          name,
          field,
          text,
          now,
        );
        this.sendToTeachers({
          type: "input_preview",
          preview: { participantId, studentName: name, field, text, at: now },
        });
        return;
      }
      case "worksheet_save": {
        const worksheet = this.worksheetRow();
        if (!worksheet) {
          this.send(ws, { type: "error", message: "진행 중인 학습지가 없습니다." });
          return;
        }
        const previous = this.first<SubmissionRow>(
          "SELECT * FROM worksheet_submissions WHERE participant_id = ?",
          participantId,
        );
        if (previous?.locked === 1) {
          this.send(ws, {
            type: "error",
            message: "이미 제출한 학습지입니다. 선생님이 다시 제출을 열어 주면 수정할 수 있습니다.",
          });
          return;
        }
        const text = typeof data.text === "string" ? data.text.slice(0, 8000) : "";
        const fields = this.fieldsOf(worksheet);
        const answers: Record<string, string> = {};
        if (data.answers && typeof data.answers === "object") {
          for (const field of fields) {
            const raw = (data.answers as Record<string, unknown>)[field.id];
            if (typeof raw === "string") answers[field.id] = raw.slice(0, 2000);
          }
        }
        const graded = fields.filter((field) => field.answer);
        const score = graded.length
          ? graded.filter(
              (field) => normalizeAnswer(answers[field.id] ?? "") === normalizeAnswer(field.answer ?? ""),
            ).length
          : null;
        const maxScore = graded.length ? graded.length : null;
        this.run(
          `INSERT INTO worksheet_submissions (participant_id, student_name, text, updated_at, answers_json, score, max_score, locked)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT (participant_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at, student_name = excluded.student_name, answers_json = excluded.answers_json, score = excluded.score, max_score = excluded.max_score, locked = 1`,
          participantId,
          name,
          text,
          now,
          JSON.stringify(answers),
          score,
          maxScore,
        );
        this.broadcastWorksheet();
        this.send(ws, {
          type: "worksheet",
          worksheet: { ...this.worksheetPublic(worksheet), submissionCount: this.submissionCount() },
          locked: true,
        });
        return;
      }
      case "team_post": {
        if (!row.team) {
          this.send(ws, { type: "error", message: "모둠이 아직 배정되지 않았습니다." });
          return;
        }
        if (this.settings().teamChatLocked) {
          this.send(ws, {
            type: "notice",
            text: "선생님이 모둠 대화를 잠갔습니다.",
            at: Date.now(),
          });
          return;
        }
        this.addTeamPost(row.team, name, data.text);
        return;
      }
      case "bomb_pass": {
        this.passBomb(participantId, name);
        return;
      }
      case "memory_flip": {
        // Anyone in the class can flip: a shared board is more fun than one
        // student tapping while everyone watches.
        this.flipMemoryCard(typeof data.cardId === "string" ? data.cardId : "");
        return;
      }
      case "speedtap_tap": {
        this.tapSpeedTarget(participantId, name, Number(data.cell));
        return;
      }
      case "jamo_answer": {
        this.answerJamo(name, typeof data.text === "string" ? data.text : "");
        return;
      }
      case "checkin": {
        this.recordCheckin(participantId, name);
        return;
      }
      case "word_found": {
        this.markWordFound(typeof data.word === "string" ? data.word : "", name);
        return;
      }
      case "team_take": {
        this.takeTeam(participantId, name, typeof data.team === "string" ? data.team : "");
        return;
      }
      case "seat_take": {
        this.takeSeat(participantId, name, Number(data.seat));
        return;
      }
      case "item_use": {
        this.useItem(participantId, name, data.item);
        return;
      }
      case "board_add": {
        const board = this.boardRow();
        if (!board) {
          this.send(ws, { type: "error", message: "선생님이 아직 보드를 열지 않았습니다." });
          return;
        }
        if (board.allow_posts !== 1) {
          this.send(ws, { type: "error", message: "이 보드는 학생 글쓰기가 꺼져 있습니다." });
          return;
        }
        this.addCard(name, data.text, data.color, data.column, false);
        return;
      }
      case "file_request": {
        const worksheet = this.worksheetRow();
        const material = this.materialOf(worksheet);
        const materialId = typeof data.materialId === "string" ? data.materialId : "";
        if (!material || material.id !== materialId) {
          this.send(ws, { type: "error", message: "내려받을 학습지 파일이 없습니다." });
          return;
        }
        this.sendToTeachers({ type: "file_request", from: participantId, fromName: name, materialId });
        return;
      }
      case "rtc": {
        this.relayRtc(participantId, name, data.to, data.signal);
        return;
      }
      default:
        return;
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (!attachment) return;

    if (attachment.role === "teacher") {
      const remaining = this.socketsFor("teacher").filter((socket) => socket !== ws);
      // Shared content lives on the teacher's computer. When the last console
      // closes, students must stop seeing it — but a reload reconnects within a
      // second, so allow a short grace window before wiping the room.
      if (remaining.length === 0) {
        this.setConfig("teardown_at", String(Date.now() + TEACHER_GRACE_MS));
        this.scheduleAlarm();
      }
      return;
    }

    if (!attachment.participantId) return;
    const participantId = attachment.participantId;
    const stillConnected =
      this.onlineIds().has(participantId) &&
      this.socketsFor("student", participantId).some((socket) => socket !== ws);
    if (stillConnected) return;
    const row = this.first<LiveRow>("SELECT * FROM live WHERE participant_id = ?", participantId);
    if (!row) return;
    this.run(
      "UPDATE live SET online = 0, sharing = 0, last_activity_at = ? WHERE participant_id = ?",
      Date.now(),
      participantId,
    );
    this.logEvent(participantId, row.name, "ws_disconnected", "실시간 연결이 끊겨 상태를 확인할 수 없습니다.", "disconnected");
    this.broadcastStudents();
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    await this.webSocketClose(ws, 1011, "socket_error", false);
  }

  /* -------------------------- timers (alarm) -------------------------- */

  /**
   * The Durable Object alarm is the single source of truth for countdowns, so
   * a quiz still closes when the teacher switches tabs or closes the console.
   */
  async alarm(): Promise<void> {
    this.expireDueContent();
    this.scheduleAlarm();
  }

  private scheduleAlarm(): void {
    const now = Date.now();
    const deadlines: number[] = [];
    const quiz = this.quizRow();
    if (quiz && quiz.status === "open" && quiz.ends_at !== null && quiz.ends_at > now) {
      deadlines.push(quiz.ends_at);
    }
    const mini = this.miniGame();
    if (mini?.kind === "bomb" && mini.status === "running") deadlines.push(mini.endsAt);
    if (mini?.kind === "speedtap" && mini.endsAt > now) deadlines.push(mini.endsAt);
    const timer = this.timerPublic();
    if (timer) deadlines.push(timer.endsAt);
    const teardownAt = Number(this.configValue("teardown_at") ?? 0);
    if (Number.isFinite(teardownAt) && teardownAt > now) deadlines.push(teardownAt);
    if (!deadlines.length) {
      void this.ctx.storage.deleteAlarm();
      return;
    }
    void this.ctx.storage.setAlarm(Math.min(...deadlines) + 60);
  }

  private expireDueContent(): void {
    const now = Date.now();
    const quiz = this.quizRow();
    if (quiz && quiz.status === "open" && quiz.ends_at !== null && now >= quiz.ends_at) {
      this.run("UPDATE quiz SET status = 'closed', closed_at = ? WHERE id = ?", now, quiz.id);
      this.broadcastQuiz();
      this.sendNoticeToAll("⏰ 제한 시간이 끝나 자동으로 응답을 마감했습니다.");
    }
    const mini = this.miniGame();
    if (mini?.kind === "bomb" && mini.status === "running" && now >= mini.endsAt) {
      this.explodeBomb(mini);
    }
    if (mini?.kind === "speedtap" && now >= mini.endsAt) {
      // Keep the board so the class can read the result; only announce once.
      if (this.configValue("speedtap_ended") !== String(mini.round)) {
        this.setConfig("speedtap_ended", String(mini.round));
        const best = [...mini.totals].sort((left, right) => right.points - left.points).slice(0, 3);
        this.sendNoticeToAll(
          best.length
            ? `⏱ 반응 속도 대결 ${mini.round}라운드 끝! ${best.map((score) => `${score.name} ${score.points}점`).join(" · ")}`
            : "⏱ 라운드가 끝났습니다. 아무도 두더지를 잡지 못했어요.",
        );
      }
    }
    // The class timer clears itself so every screen stops showing a stale clock.
    const timer = this.timerPublic();
    if (!timer && this.configValue("timer")) {
      this.setConfig("timer", null);
      this.broadcastTimer();
      this.sendNoticeToAll("⏰ 수업 타이머가 끝났습니다.");
    }
    // A teacher console reload drops its socket for a moment; only tear down
    // shared content when nobody came back inside the grace window.
    const teardownAt = Number(this.configValue("teardown_at") ?? 0);
    if (Number.isFinite(teardownAt) && teardownAt > 0 && now >= teardownAt) {
      this.setConfig("teardown_at", null);
      if (this.socketsFor("teacher").length === 0) {
        this.clearBoard(false);
        this.clearStage(false);
        this.setMiniGame(null);
        this.broadcastMiniGame();
      }
    }
  }

  private cancelTeacherTeardown(): void {
    if (this.configValue("teardown_at")) this.setConfig("teardown_at", null);
  }

  /* ---------------------------- people -------------------------------- */

  private onlineStudentList(): Array<{ participantId: string; name: string; team: string | null }> {
    return this.students()
      .filter((student) => student.online)
      .map((student) => ({
        participantId: student.participantId,
        name: student.name,
        team: student.team,
      }));
  }

  private sendNoticeToAll(text: string): void {
    const payload: ServerMessage = { type: "notice", text, at: Date.now() };
    this.sendToTeachers(payload);
    this.sendToStudents(payload);
  }

  private presenterPublic(): PresenterPick | null {
    const raw = this.configValue("presenter");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PresenterPick;
      return parsed && typeof parsed.participantId === "string" ? parsed : null;
    } catch {
      return null;
    }
  }

  private pickPresenter(team: string | null): void {
    const pool = this.onlineStudentList().filter((student) => !team || student.team === team);
    const picked = randomOf(pool);
    if (!picked) {
      this.sendToTeachers({
        type: "notice",
        text: "뽑을 학생이 없습니다. 학생이 접속했는지 확인해 주세요.",
        at: Date.now(),
      });
      return;
    }
    const presenter: PresenterPick = {
      participantId: picked.participantId,
      name: picked.name,
      team: picked.team,
      at: Date.now(),
    };
    this.setConfig("presenter", JSON.stringify(presenter));
    this.sendToTeachers({ type: "presenter", presenter });
    this.sendToStudents({ type: "presenter", presenter });
    this.sendNoticeToAll(`🎤 오늘의 발표자: ${picked.name}님!`);
  }

  /* ---------------------------- team boards --------------------------- */

  private teamBoardFor(team: string): TeamBoard {
    const posts = this.rows<{ id: string; team: string; author: string; text: string; created_at: number }>(
      "SELECT * FROM team_posts WHERE team = ? ORDER BY created_at ASC",
      team,
    ).map<TeamPost>((row) => ({
      id: row.id,
      team: row.team,
      author: row.author,
      text: row.text,
      createdAt: row.created_at,
    }));
    return { team, posts };
  }

  private teamBoards(): TeamBoard[] {
    return this.teamLabels().map((team) => this.teamBoardFor(team));
  }

  private addTeamPost(team: string, author: string, rawText: unknown): void {
    const text = typeof rawText === "string" ? rawText.trim().slice(0, TEAM_POST_MAX_CHARS) : "";
    if (!text) return;
    const count = Number(
      this.first<{ count: number }>("SELECT COUNT(*) AS count FROM team_posts WHERE team = ?", team)
        ?.count ?? 0,
    );
    if (count >= TEAM_POST_CAP) return;
    this.run(
      "INSERT INTO team_posts (id, team, author, text, created_at) VALUES (?, ?, ?, ?, ?)",
      randomId("tpost_"),
      team,
      author.slice(0, 40) || "학생",
      text,
      Date.now(),
    );
    this.broadcastTeams();
  }

  /** Teachers see every team; each student receives only their own team board. */
  private broadcastTeams(): void {
    this.sendToTeachers({ type: "teams", boards: this.teamBoards() });
    for (const ws of this.socketsFor("student")) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      const row = attachment?.participantId
        ? this.first<LiveRow>("SELECT * FROM live WHERE participant_id = ?", attachment.participantId)
        : null;
      this.send(ws, { type: "teams", boards: row?.team ? [this.teamBoardFor(row.team)] : [] });
    }
  }

  /* ----------------------------- mini games --------------------------- */

  private miniGame(): MiniGameState | null {
    const raw = this.configValue("minigame");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as MiniGameState;
      return parsed && typeof parsed.kind === "string" ? parsed : null;
    } catch {
      return null;
    }
  }

  private setMiniGame(state: MiniGameState | null): void {
    this.setConfig("minigame", state ? JSON.stringify(state) : null);
  }

  private broadcastMiniGame(): void {
    const game = this.miniGame();
    this.sendToTeachers({ type: "minigame", game });
    this.sendToStudents({ type: "minigame", game });
  }

  private startRoulette(team: string | null): void {
    const candidates = this.onlineStudentList().filter((student) => !team || student.team === team);
    if (!candidates.length) {
      this.sendToTeachers({
        type: "notice",
        text: "룰렛을 돌릴 학생이 없습니다. 학생이 접속했는지 확인해 주세요.",
        at: Date.now(),
      });
      return;
    }
    const winner = randomOf(candidates)!;
    const state: RouletteState = {
      kind: "roulette",
      at: Date.now(),
      candidates: candidates.map(({ participantId, name }) => ({ participantId, name })),
      picked: { participantId: winner.participantId, name: winner.name },
    };
    this.setMiniGame(state);
    this.broadcastMiniGame();
    this.sendNoticeToAll(`🎡 룰렛 결과: ${winner.name}님!`);
  }

  private startBomb(): void {
    const players = this.onlineStudentList();
    if (!players.length) {
      this.sendToTeachers({
        type: "notice",
        text: "폭탄을 돌릴 학생이 없습니다.",
        at: Date.now(),
      });
      return;
    }
    const holder = randomOf(players)!;
    const now = Date.now();
    const state: BombState = {
      kind: "bomb",
      startedAt: now,
      endsAt: now + randomBetween(BOMB_MIN_MS, BOMB_MAX_MS),
      holder: { participantId: holder.participantId, name: holder.name },
      status: "running",
      loserName: null,
    };
    this.setMiniGame(state);
    this.broadcastMiniGame();
    this.sendNoticeToAll("💣 폭탄 돌리기 시작! 폭탄을 든 사람이 ‘넘기기’를 눌러 다음 사람에게 넘기세요.");
    this.scheduleAlarm();
  }

  private passBomb(participantId: string, name: string): void {
    const state = this.miniGame();
    if (state?.kind !== "bomb" || state.status !== "running") return;
    if (state.holder.participantId !== participantId) return;
    const others = this.onlineStudentList().filter((player) => player.participantId !== participantId);
    const next = randomOf(others);
    if (!next) {
      this.sendToParticipant(participantId, {
        type: "notice",
        text: "넘길 다른 학생이 없습니다. 폭탄을 들고 버티세요!",
        at: Date.now(),
      });
      return;
    }
    this.setMiniGame({ ...state, holder: { participantId: next.participantId, name: next.name } });
    this.broadcastMiniGame();
    this.sendToParticipant(next.participantId, {
      type: "notice",
      text: `${name}님이 폭탄을 넘겼습니다! 다음 사람에게 넘기세요.`,
      at: Date.now(),
    });
  }

  private explodeBomb(state: BombState): void {
    this.setMiniGame({ ...state, status: "exploded", loserName: state.holder.name });
    this.broadcastMiniGame();
    this.sendNoticeToAll(`💥 폭탄이 터졌습니다! ${state.holder.name}님이 걸렸어요.`);
    this.scheduleAlarm();
  }

  private sanitizeWords(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const words: string[] = [];
    for (const entry of value) {
      const word = String(entry ?? "")
        .replace(/[^0-9A-Za-z가-힣]/g, "")
        .toUpperCase()
        .slice(0, 10);
      if (word.length < 2 || seen.has(word)) continue;
      seen.add(word);
      words.push(word);
      if (words.length >= MINI_WORDS_MAX) break;
    }
    return words;
  }

  private startWordSearch(raw: unknown): void {
    const words = this.sanitizeWords(raw);
    if (words.length < 2) {
      this.sendToTeachers({
        type: "notice",
        text: "낱말을 2~6개 입력해 주세요. (2~10글자)",
        at: Date.now(),
      });
      return;
    }
    const built = buildWordSearch(words);
    const state: WordSearchState = {
      kind: "wordsearch",
      size: WORDSEARCH_SIZE,
      grid: built.rows,
      words: built.placed,
      found: [],
    };
    this.setMiniGame(state);
    this.broadcastMiniGame();
    this.sendNoticeToAll("🔎 낱말 찾기 시작! 그리드에서 찾은 낱말을 입력하세요.");
  }

  private markWordFound(raw: string, by: string): void {
    const state = this.miniGame();
    if (state?.kind !== "wordsearch") return;
    const word = raw.replace(/[^0-9A-Za-z가-힣]/g, "").toUpperCase();
    if (!state.words.includes(word) || state.found.some((item) => item.word === word)) return;
    const updated: WordSearchState = {
      ...state,
      found: [...state.found, { word, by, at: Date.now() }],
    };
    this.setMiniGame(updated);
    this.broadcastMiniGame();
    this.sendNoticeToAll(`🎯 ${by}님이 ‘${word}’를 찾았습니다!`);
  }

  private startMemory(raw: unknown): void {
    const words = this.sanitizeWords(raw);
    const labels = words.length >= 2 ? words : ["사과", "바나나", "포도", "딸기"];
    const cards: MemoryCard[] = [];
    labels.forEach((label, index) => {
      for (let copy = 0; copy < 2; copy += 1) {
        cards.push({
          id: `card_${index}_${copy}_${Math.random().toString(36).slice(2, 7)}`,
          label,
          pairId: `pair_${index}`,
          state: "hidden",
        });
      }
    });
    for (let index = cards.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [cards[index], cards[swap]] = [cards[swap], cards[index]];
    }
    const state: MemoryState = { kind: "memory", cards, moves: 0, matched: 0 };
    this.setMiniGame(state);
    this.broadcastMiniGame();
    this.sendNoticeToAll("🃏 카드 짝 맞추기 시작! 같은 그림 두 장을 찾아보세요.");
  }

  private flipMemoryCard(cardId: string): void {
    const state = this.miniGame();
    if (state?.kind !== "memory" || !cardId) return;
    const cards = state.cards.map((card) => ({ ...card }));
    const target = cards.find((card) => card.id === cardId);
    if (!target || target.state !== "hidden") return;
    // Two open cards that were not a pair close as soon as the next card is flipped.
    for (const card of cards) if (card.state === "open") card.state = "hidden";
    target.state = "open";
    const open = cards.filter((card) => card.state === "open");
    let matched = state.matched;
    if (open.length === 2 && open[0].pairId === open[1].pairId) {
      open[0].state = "matched";
      open[1].state = "matched";
      matched += 1;
      this.sendNoticeToAll("👏 짝을 찾았습니다!");
    }
    this.setMiniGame({ ...state, cards, matched, moves: state.moves + 1 });
    this.broadcastMiniGame();
    if (matched === cards.length / 2) this.sendNoticeToAll("🎉 모든 짝을 찾았습니다!");
  }

  /* ----------------------------- 사다리 타기 -------------------------- */

  private sanitizeNameList(value: unknown, fallback: string[], max: number): string[] {
    const source = Array.isArray(value) ? value : [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const entry of source) {
      const name = String(entry ?? "").trim().slice(0, 24);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
      if (out.length >= max) break;
    }
    return out.length ? out : fallback.slice(0, max);
  }

  private sanitizePrizeList(value: unknown, max: number): string[] {
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    for (const entry of value) {
      const prize = String(entry ?? "").trim().slice(0, 24);
      if (!prize) continue;
      out.push(prize);
      if (out.length >= max) break;
    }
    return out;
  }

  private startLadder(rawNames: unknown, rawPrizes: unknown, rawRows: unknown): void {
    const fallbackNames = this.onlineStudentList().map((student) => student.name);
    const names = this.sanitizeNameList(rawNames, fallbackNames, 10);
    if (names.length < 2) {
      this.sendToTeachers({
        type: "notice",
        text: "사다리 타기는 이름이 2개 이상 필요합니다. 학생을 접속시키거나 이름을 직접 입력해 주세요.",
        at: Date.now(),
      });
      return;
    }
    const defaultPrizes = names.map((_, index) => `${index + 1}번`);
    const supplied = this.sanitizePrizeList(rawPrizes, 10).slice(0, names.length);
    const prizes = names.map((_, index) => supplied[index] ?? defaultPrizes[index]);
    const rows = Math.min(14, Math.max(4, Math.round(Number(rawRows) || 8)));

    const rungs: LadderRung[] = [];
    for (let row = 0; row < rows; row += 1) {
      let col = 0;
      while (col < names.length - 1) {
        if (Math.random() < 0.42) {
          rungs.push({ row, col });
          col += 2;
        } else {
          col += 1;
        }
      }
    }

    const winners = names.map((name, start) => {
      let col = start;
      for (let row = 0; row < rows; row += 1) {
        if (rungs.some((rung) => rung.row === row && rung.col === col)) col += 1;
        else if (col > 0 && rungs.some((rung) => rung.row === row && rung.col === col - 1)) col -= 1;
      }
      return { name, prize: prizes[col] ?? prizes[prizes.length - 1], start, end: col };
    });

    const state: LadderState = {
      kind: "ladder",
      at: Date.now(),
      names,
      prizes,
      rows,
      rungs,
      winners,
      revealed: false,
    };
    this.setMiniGame(state);
    this.broadcastMiniGame();
    this.sendNoticeToAll("🪜 사다리 준비 완료! 선생님이 결과를 공개합니다.");
  }

  private revealLadder(): void {
    const state = this.miniGame();
    if (state?.kind !== "ladder" || state.revealed) return;
    this.setMiniGame({ ...state, revealed: true });
    this.broadcastMiniGame();
    const summary = state.winners
      .map((winner) => `${winner.name} → ${winner.prize}`)
      .slice(0, 6)
      .join(" · ");
    this.sendNoticeToAll(`🪜 사다리 결과: ${summary}`);
  }

  /* ---------------------------- 반응 속도 ----------------------------- */

  private startSpeedTap(rawSize: unknown): void {
    const size = Math.min(
      SPEEDTAP_MAX_SIZE,
      Math.max(3, Math.round(Number(rawSize) || 3)),
    );
    const players = this.onlineStudentList();
    if (!players.length) {
      this.sendToTeachers({
        type: "notice",
        text: "반응 속도 대결은 접속한 학생이 필요합니다.",
        at: Date.now(),
      });
      return;
    }
    this.beginSpeedTapRound(size, 1, []);
    this.sendNoticeToAll("⏱ 반응 속도 대결! 두더지가 나타나면 가장 빠르게 누르세요.");
  }

  private beginSpeedTapRound(
    size: number,
    round: number,
    totals: SpeedTapState["totals"],
  ): void {
    const now = Date.now();
    const state: SpeedTapState = {
      kind: "speedtap",
      round,
      size,
      target: Math.floor(Math.random() * size * size),
      // A random delay stops students from predicting the cell.
      startsAt: now + randomBetween(1400, 3800),
      endsAt: now + SPEEDTAP_ROUND_MS,
      hits: [],
      totals,
    };
    this.setConfig("speedtap_ended", String(round - 1));
    this.setMiniGame(state);
    this.broadcastMiniGame();
    this.scheduleAlarm();
  }

  private nextSpeedTapRound(): void {
    const state = this.miniGame();
    if (state?.kind !== "speedtap") return;
    const nextRound = state.round + 1;
    this.beginSpeedTapRound(state.size, nextRound, state.totals);
    this.sendNoticeToAll(`⏱ ${nextRound}라운드 시작! 준비하세요.`);
  }

  /** Points by reaction rank, so the fastest tap wins the round. */
  private static speedPoints(rank: number): number {
    if (rank === 0) return 10;
    if (rank === 1) return 7;
    if (rank === 2) return 5;
    return 3;
  }

  private tapSpeedTarget(participantId: string, name: string, cell: number): void {
    const state = this.miniGame();
    if (state?.kind !== "speedtap") return;
    const now = Date.now();
    if (!Number.isInteger(cell) || cell < 0 || cell >= state.size * state.size) return;
    if (now < state.startsAt) {
      this.sendToParticipant(participantId, {
        type: "notice",
        text: "아직 두더지가 나오지 않았습니다. 준비하세요!",
        at: now,
      });
      return;
    }
    if (now > state.endsAt) return;
    if (cell !== state.target) return;
    if (state.hits.some((hit) => hit.participantId === participantId)) return;

    const ms = now - state.startsAt;
    const points = ClassroomHub.speedPoints(state.hits.length);
    const hits = [...state.hits, { participantId, name, ms, points }].slice(0, 30);
    const totals = state.totals.map((score) => ({ ...score }));
    const existing = totals.find((score) => score.participantId === participantId);
    if (existing) {
      existing.points += points;
      existing.name = name;
      existing.bestMs = existing.bestMs === null ? ms : Math.min(existing.bestMs, ms);
    } else {
      totals.push({ participantId, name, points, bestMs: ms });
    }
    const next: SpeedTapState = { ...state, hits, totals };
    this.setMiniGame(next);
    this.broadcastMiniGame();
    if (hits.length === 1) this.sendNoticeToAll(`⚡ ${name}님이 가장 빨랐습니다! ${ms}ms`);
    const online = this.onlineStudentList().length;
    if (online > 0 && hits.length >= online) {
      this.sendNoticeToAll("⏱ 모두 잡았습니다! 선생님이 다음 라운드를 시작합니다.");
    }
  }

  /* ----------------------------- 초성 퀴즈 ---------------------------- */

  private sanitizeJamoWords(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const words: string[] = [];
    for (const entry of raw) {
      const word = String(entry ?? "")
        .replace(/[^0-9A-Za-z가-힣]/g, "")
        .trim()
        .slice(0, 12);
      if (word.length < 2) continue;
      const key = normalizeWord(word);
      if (seen.has(key)) continue;
      seen.add(key);
      words.push(word);
      if (words.length >= JAMO_MAX_WORDS) break;
    }
    return words;
  }

  private startJamo(raw: unknown): void {
    const words = this.sanitizeJamoWords(raw);
    if (!words.length) {
      this.sendToTeachers({
        type: "notice",
        text: "초성 퀴즈에 쓸 낱말을 1개 이상 입력해 주세요. (2~12글자)",
        at: Date.now(),
      });
      return;
    }
    this.setConfig("jamo_queue", JSON.stringify(words.slice(1)));
    this.beginJamoWord(words[0], 1, words.length, [], []);
    this.sendNoticeToAll("🔤 초성 퀴즈! 초성을 보고 낱말을 입력하세요.");
  }

  private beginJamoWord(
    answer: string,
    index: number,
    total: number,
    attempts: JamoState["attempts"],
    scores: JamoState["scores"],
  ): void {
    // The answer is kept server-side; students only receive the consonants.
    this.setConfig("jamo_answer", answer);
    const state: JamoState = {
      kind: "jamo",
      index,
      total,
      prompt: jamoPrompt(answer),
      answer: null,
      solved: false,
      solvedBy: null,
      attempts,
      scores,
      startedAt: Date.now(),
    };
    this.setMiniGame(state);
    this.broadcastMiniGame();
  }

  private answerJamo(name: string, raw: string): void {
    const state = this.miniGame();
    if (state?.kind !== "jamo" || state.solved) return;
    const text = raw.trim().slice(0, 24);
    if (!text) return;
    const answer = this.configValue("jamo_answer") ?? "";
    if (!answer) return;
    const correct = normalizeWord(text) === normalizeWord(answer);
    const attempts = [...state.attempts, { name, text, correct, at: Date.now() }].slice(-
      JAMO_MAX_ATTEMPTS,
    );
    const scores = state.scores.map((score) => ({ ...score }));
    if (correct) {
      const existing = scores.find((score) => score.name === name);
      if (existing) existing.points += 10;
      else scores.push({ name, points: 10 });
      this.setMiniGame({
        ...state,
        attempts,
        scores,
        answer,
        solved: true,
        solvedBy: name,
      });
      this.broadcastMiniGame();
      this.sendNoticeToAll(`🎯 정답! ${name}님 → ${answer}`);
      return;
    }
    this.setMiniGame({ ...state, attempts, scores });
    this.broadcastMiniGame();
  }

  private nextJamoWord(): void {
    const state = this.miniGame();
    if (state?.kind !== "jamo") return;
    let queue: string[] = [];
    try {
      const parsed = JSON.parse(this.configValue("jamo_queue") ?? "[]") as unknown;
      if (Array.isArray(parsed)) queue = parsed.map(String);
    } catch {
      queue = [];
    }
    if (!queue.length) {
      const best = [...state.scores].sort((left, right) => right.points - left.points).slice(0, 3);
      this.setMiniGame(null);
      this.broadcastMiniGame();
      this.sendNoticeToAll(
        best.length
          ? `🔤 초성 퀴즈 끝! ${best.map((score) => `${score.name} ${score.points}점`).join(" · ")}`
          : "🔤 초성 퀴즈를 마쳤습니다.",
      );
      return;
    }
    const [next, ...rest] = queue;
    this.setConfig("jamo_queue", JSON.stringify(rest));
    this.beginJamoWord(next, state.index + 1, state.total, state.attempts, state.scores);
    this.sendNoticeToAll(`🔤 ${state.index + 1}번 문제! 초성을 보고 낱말을 입력하세요.`);
  }

  /* ------------------------------ class tools -------------------------- */

  private toolsPublic(): ClassToolsState {
    const empty: ClassToolsState = { scores: {}, checkinOpen: false, attendance: [] };
    const raw = this.configValue("tools");
    if (!raw) return empty;
    try {
      const parsed = JSON.parse(raw) as Partial<ClassToolsState>;
      const scores: Record<string, number> = {};
      if (parsed.scores && typeof parsed.scores === "object") {
        for (const [team, rawValue] of Object.entries(parsed.scores as Record<string, unknown>)) {
          if (!isTeamLabel(team, MAX_TEAMS)) continue;
          const value = Number(rawValue);
          if (Number.isFinite(value) && value !== 0) {
            scores[team] = Math.max(-999, Math.min(9999, Math.round(value)));
          }
        }
      }
      const attendance: AttendanceEntry[] = Array.isArray(parsed.attendance)
        ? parsed.attendance
            .filter(
              (entry): entry is AttendanceEntry =>
                Boolean(entry) &&
                typeof entry.participantId === "string" &&
                typeof entry.name === "string" &&
                Number.isFinite(Number(entry.at)),
            )
            .map((entry) => ({
              participantId: entry.participantId.slice(0, 80),
              name: entry.name.slice(0, 24),
              at: Number(entry.at),
            }))
            .slice(0, TOOLS_ATTENDANCE_CAP)
        : [];
      return { scores, checkinOpen: parsed.checkinOpen === true, attendance };
    } catch {
      return empty;
    }
  }

  private setTools(tools: ClassToolsState): void {
    this.setConfig("tools", JSON.stringify(tools));
  }

  private broadcastTools(): void {
    const tools = this.toolsPublic();
    this.sendToTeachers({ type: "tools", tools });
    // Each student only learns whether *they* checked in; the full list stays
    // with the teacher so the class never sees who is missing.
    for (const ws of this.socketsFor("student")) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      const participantId = attachment?.participantId;
      this.send(ws, {
        type: "tools",
        tools: {
          ...tools,
          attendance: tools.attendance.filter((entry) => entry.participantId === participantId),
        },
      });
    }
  }

  private adjustScore(rawTeam: unknown, rawDelta: number): void {
    const team = String(rawTeam ?? "");
    if (!isTeamLabel(team, this.rosterPublic().teamCount)) return;
    const delta = Math.max(-100, Math.min(100, Math.round(Number(rawDelta) || 0)));
    if (!delta) return;
    const tools = this.toolsPublic();
    const current = tools.scores[team] ?? 0;
    const next = Math.max(-999, Math.min(9999, current + delta));
    tools.scores = { ...tools.scores, [team]: next };
    this.setTools(tools);
    this.broadcastTools();
  }

  private recordCheckin(participantId: string, name: string): void {
    const tools = this.toolsPublic();
    if (!tools.checkinOpen) {
      this.sendToParticipant(participantId, {
        type: "notice",
        text: "지금은 출석 체크 시간이 아닙니다.",
        at: Date.now(),
      });
      return;
    }
    if (tools.attendance.some((entry) => entry.participantId === participantId)) {
      this.sendToParticipant(participantId, {
        type: "notice",
        text: "이미 출석을 확인했습니다.",
        at: Date.now(),
      });
      return;
    }
    tools.attendance = [
      ...tools.attendance,
      { participantId, name: name.slice(0, 24), at: Date.now() },
    ].slice(-TOOLS_ATTENDANCE_CAP);
    this.setTools(tools);
    this.broadcastTools();
    this.sendToParticipant(participantId, {
      type: "notice",
      text: "✅ 출석이 확인되었습니다.",
      at: Date.now(),
    });
  }

  /* ------------------------------ roster ------------------------------ */

  private rosterPublic(): RosterState {
    const base = this.rosterBase();
    const occupied = this.rows<{ seat: number }>("SELECT seat FROM live WHERE seat IS NOT NULL")
      .map((row) => Number(row.seat))
      .filter((seat) => Number.isFinite(seat) && seat >= 0 && seat < seatCapacity(base));
    return { ...base, occupiedSeats: occupied };
  }

  private rosterBase(): RosterState {
    const raw = this.configValue("roster");
    if (!raw) return normalizeRoster(null);
    try {
      return normalizeRoster(JSON.parse(raw));
    } catch {
      return normalizeRoster(null);
    }
  }

  private teamLabels(): string[] {
    return teamLabels(this.rosterBase().teamCount);
  }

  /* ------------------------------ settings ---------------------------- */

  /** 선생님이 조정한 수업 설정(없으면 기본값). */
  private settings(): ClassSettings {
    const raw = this.configValue("settings");
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      return normalizeSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  /** 부분 patch를 합쳐 저장하고, 교사·학생 모두에게 새 설정을 알립니다. */
  private saveSettings(patch: unknown): void {
    if (!patch || typeof patch !== "object") return;
    const next = normalizeSettings({ ...this.settings(), ...(patch as Record<string, unknown>) });
    this.setConfig("settings", JSON.stringify(next));
    this.sendToTeachers({ type: "settings", settings: next });
    this.sendToStudents({ type: "settings", settings: next });
  }

  private broadcastRoster(): void {
    const roster = this.rosterPublic();
    this.sendToTeachers({ type: "roster", roster });
    this.sendToStudents({ type: "roster", roster });
  }

  private updateRoster(patch: {
    teamCount?: unknown;
    teamOpen?: unknown;
    seatRows?: unknown;
    seatCols?: unknown;
    seatOpen?: unknown;
  }): void {
    const current = this.rosterPublic();
    const roster = normalizeRoster({
      teamCount: patch.teamCount === undefined ? current.teamCount : clampTeamCount(patch.teamCount),
      teamOpen: patch.teamOpen === undefined ? current.teamOpen : patch.teamOpen === true,
      seatRows:
        patch.seatRows === undefined
          ? current.seatRows
          : Math.max(1, Math.min(MAX_SEAT_ROWS, Math.round(Number(patch.seatRows) || current.seatRows))),
      seatCols:
        patch.seatCols === undefined
          ? current.seatCols
          : Math.max(
              MIN_SEAT_COLS,
              Math.min(MAX_SEAT_COLS, Math.round(Number(patch.seatCols) || current.seatCols)),
            ),
      seatOpen: patch.seatOpen === undefined ? current.seatOpen : patch.seatOpen === true,
    });
    this.setConfig("roster", JSON.stringify(roster));

    // 모둠 수가 줄면 사라진 모둠의 학생은 미배정으로 돌린다.
    const labels = new Set(teamLabels(roster.teamCount));
    const liveRows = this.rows<LiveRow>("SELECT * FROM live");
    for (const row of liveRows) {
      if (row.team && !labels.has(row.team)) {
        this.run("UPDATE live SET team = NULL WHERE participant_id = ?", row.participant_id);
      }
    }
    // 자리 수가 줄면 범위를 벗어난 자리는 비운다.
    const capacity = seatCapacity(roster);
    for (const row of liveRows) {
      if (row.seat !== null && Number(row.seat) >= capacity) {
        this.run("UPDATE live SET seat = NULL WHERE participant_id = ?", row.participant_id);
      }
    }
    this.broadcastRoster();
    this.broadcastStudents();
    this.broadcastTeams();
    this.broadcastGame();
  }

  /** 모둠 수에 맞춰 입장 순서대로 균등하게 나눕니다. */
  private assignTeamsEvenly(): void {
    const labels = this.teamLabels();
    const rows = this.rows<{ participant_id: string }>(
      "SELECT participant_id FROM live ORDER BY joined_at ASC",
    );
    rows.forEach((row, index) => {
      this.run(
        "UPDATE live SET team = ? WHERE participant_id = ?",
        labels[index % labels.length],
        row.participant_id,
      );
    });
    this.broadcastStudents();
    this.broadcastGame();
    this.broadcastTeams();
  }

  private takeTeam(participantId: string, name: string, rawTeam: string): void {
    const roster = this.rosterPublic();
    if (!roster.teamOpen) {
      this.sendToParticipant(participantId, {
        type: "notice",
        text: "지금은 모둠을 직접 고를 수 없습니다.",
        at: Date.now(),
      });
      return;
    }
    if (!isTeamLabel(rawTeam, roster.teamCount)) {
      this.sendToParticipant(participantId, { type: "notice", text: "없는 모둠입니다.", at: Date.now() });
      return;
    }
    this.run("UPDATE live SET team = ? WHERE participant_id = ?", rawTeam, participantId);
    this.broadcastStudents();
    this.broadcastGame();
    this.broadcastTeams();
    this.sendToParticipant(participantId, {
      type: "notice",
      text: `${name} 학생이 ${rawTeam}에 들어갔습니다.`,
      at: Date.now(),
    });
  }

  /** 자리 뽑기: 그리드 크기를 정하고 학생을 무작위 순서로 배치합니다. */
  private shuffleSeats(rawRows: unknown, rawCols: unknown): void {
    const current = this.rosterPublic();
    const roster = normalizeRoster({
      ...current,
      seatRows:
        rawRows === undefined || rawRows === null
          ? current.seatRows
          : Math.max(1, Math.min(MAX_SEAT_ROWS, Math.round(Number(rawRows) || current.seatRows))),
      seatCols:
        rawCols === undefined || rawCols === null
          ? current.seatCols
          : Math.max(
              MIN_SEAT_COLS,
              Math.min(MAX_SEAT_COLS, Math.round(Number(rawCols) || current.seatCols)),
            ),
    });
    this.setConfig("roster", JSON.stringify(roster));
    const capacity = seatCapacity(roster);
    const indexes = Array.from({ length: capacity }, (_, index) => index);
    for (let index = indexes.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
    }
    const rows = this.rows<{ participant_id: string }>(
      "SELECT participant_id FROM live ORDER BY joined_at ASC",
    );
    rows.forEach((row, index) => {
      this.run(
        "UPDATE live SET seat = ? WHERE participant_id = ?",
        index < capacity ? indexes[index] : null,
        row.participant_id,
      );
    });
    this.broadcastRoster();
    this.broadcastStudents();
  }

  private assignSeat(to: string, rawSeat: number | null): void {
    const target = this.first<LiveRow>("SELECT * FROM live WHERE participant_id = ?", to);
    if (!target) return;
    const capacity = seatCapacity(this.rosterPublic());
    if (rawSeat === null) {
      this.run("UPDATE live SET seat = NULL WHERE participant_id = ?", to);
      this.broadcastStudents();
      return;
    }
    const seat = Math.round(Number(rawSeat));
    if (!Number.isFinite(seat) || seat < 0 || seat >= capacity) return;
    const occupant = this.first<LiveRow>(
      "SELECT * FROM live WHERE seat = ? AND participant_id <> ?",
      seat,
      to,
    );
    // 자리를 바꾸는 경우 상대는 원래 자리로 옮긴다.
    if (occupant) {
      this.run("UPDATE live SET seat = ? WHERE participant_id = ?", target.seat, occupant.participant_id);
    }
    this.run("UPDATE live SET seat = ? WHERE participant_id = ?", seat, to);
    this.broadcastStudents();
  }

  private takeSeat(participantId: string, name: string, rawSeat: number): void {
    const roster = this.rosterPublic();
    if (!roster.seatOpen) {
      this.sendToParticipant(participantId, {
        type: "notice",
        text: "지금은 자리를 직접 고를 수 없습니다.",
        at: Date.now(),
      });
      return;
    }
    const seat = Math.round(Number(rawSeat));
    if (!Number.isFinite(seat) || seat < 0 || seat >= seatCapacity(roster)) {
      this.sendToParticipant(participantId, { type: "notice", text: "없는 자리입니다.", at: Date.now() });
      return;
    }
    const occupant = this.first<LiveRow>(
      "SELECT * FROM live WHERE seat = ? AND participant_id <> ?",
      seat,
      participantId,
    );
    if (occupant) {
      this.sendToParticipant(participantId, {
        type: "notice",
        text: "이미 다른 친구가 앉은 자리입니다. 빈자리를 골라 주세요.",
        at: Date.now(),
      });
      return;
    }
    this.run("UPDATE live SET seat = ? WHERE participant_id = ?", seat, participantId);
    this.broadcastStudents();
    this.sendToParticipant(participantId, {
      type: "notice",
      text: `${name} 학생이 ${seat + 1}번 자리에 앉았습니다.`,
      at: Date.now(),
    });
  }

  /* ---------------------------- game lobby ---------------------------- */

  private lobbyOpen(): boolean {
    return this.configValue("game_lobby") === "1";
  }

  private setGameLobby(open: boolean): void {
    if (open) {
      // 대기 화면을 열면 새 판을 시작한다: 점수·응답·아이템·알림을 모두 비운다.
      this.run("DELETE FROM quiz");
      this.run("DELETE FROM quiz_answers");
      this.run("DELETE FROM game_items");
      this.run("DELETE FROM game_effects");
      this.run("DELETE FROM game_bonus");
      this.run("DELETE FROM game_feed");
      this.run("UPDATE live SET alive = 1");
      this.setConfig("total_rounds", null);
      this.setConfig("game_lobby", "1");
      this.addFeed("대기 화면이 열렸습니다. 학생들이 입장하고 있습니다.", "info");
    } else {
      this.setConfig("game_lobby", "0");
    }
    this.broadcastQuiz();
    this.broadcastGame();
    this.broadcastStudents();
    this.scheduleAlarm();
  }

  private gameFeed(): GameFeedEntry[] {
    return this.rows<{ id: string; at: number; text: string; tone: string }>(
      "SELECT * FROM game_feed ORDER BY at DESC LIMIT ?",
      FEED_CAP,
    ).map((row) => ({
      id: row.id,
      at: Number(row.at),
      text: row.text,
      tone: row.tone === "good" || row.tone === "warn" ? row.tone : "info",
    }));
  }

  private addFeed(text: string, tone: GameFeedEntry["tone"]): void {
    this.run(
      "INSERT INTO game_feed (id, at, text, tone) VALUES (?, ?, ?, ?)",
      randomId("feed_"),
      Date.now(),
      text.slice(0, 140),
      tone,
    );
    this.run(
      "DELETE FROM game_feed WHERE id IN (SELECT id FROM game_feed ORDER BY at DESC LIMIT -1 OFFSET ?)",
      FEED_CAP,
    );
  }

  private gameItems(participantId?: string): GameItem[] {
    const rows = participantId
      ? this.rows<{ participant_id: string; item: string; granted_at: number }>(
          "SELECT * FROM game_items WHERE used_at IS NULL AND participant_id = ? ORDER BY granted_at ASC",
          participantId,
        )
      : this.rows<{ participant_id: string; item: string; granted_at: number }>(
          "SELECT * FROM game_items WHERE used_at IS NULL ORDER BY granted_at ASC",
        );
    return rows
      .filter((row) => GAME_ITEM_KINDS.has(row.item))
      .map((row) => ({
        participantId: row.participant_id,
        item: row.item as GameItemKind,
        at: Number(row.granted_at),
      }));
  }

  private grantItem(participantId: string, name: string): void {
    const settings = this.settings();
    const held = this.first<{ count: number }>(
      "SELECT COUNT(*) AS count FROM game_items WHERE used_at IS NULL AND participant_id = ?",
      participantId,
    );
    if (Number(held?.count ?? 0) >= settings.itemMaxHeld) return;
    const pool: GameItemKind[] = ["bonus", "double", "steal"];
    const item = pool[Math.floor(Math.random() * pool.length)];
    this.run(
      "INSERT INTO game_items (id, participant_id, student_name, item, granted_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)",
      randomId("item_"),
      participantId,
      name,
      item,
      Date.now(),
    );
    this.addFeed(`${name} 학생이 ${ITEM_LABEL[item]} 아이템을 얻었습니다.`, "info");
  }

  private useItem(participantId: string, name: string, rawItem: unknown): void {
    const item = String(rawItem ?? "");
    if (!GAME_ITEM_KINDS.has(item)) return;
    const row = this.first<{ id: string }>(
      "SELECT id FROM game_items WHERE used_at IS NULL AND participant_id = ? AND item = ? ORDER BY granted_at ASC LIMIT 1",
      participantId,
      item,
    );
    if (!row) {
      this.sendToParticipant(participantId, {
        type: "notice",
        text: "사용할 수 있는 아이템이 없습니다.",
        at: Date.now(),
      });
      return;
    }
    this.run("UPDATE game_items SET used_at = ? WHERE id = ?", Date.now(), row.id);
    const settings = this.settings();
    if (item === "bonus") {
      const bonus = settings.itemBonusPoints;
      this.addBonus(participantId, bonus);
      this.addFeed(`${name} 학생이 +${bonus}점 아이템을 사용했습니다.`, "good");
    } else if (item === "double") {
      this.run(
        `INSERT INTO game_effects (participant_id, double_on) VALUES (?, 1)
         ON CONFLICT (participant_id) DO UPDATE SET double_on = 1`,
        participantId,
      );
      this.addFeed(
        `${name} 학생이 더블 아이템을 사용했습니다. 다음 정답은 ${settings.itemDoubleMultiplier}배!`,
        "good",
      );
    } else {
      const scores = this.scoreRows();
      const leader = scores.find(
        (score) => score.participantId !== participantId && score.points > 0,
      );
      if (!leader) {
        this.sendToParticipant(participantId, {
          type: "notice",
          text: "훔칠 점수가 아직 없습니다.",
          at: Date.now(),
        });
      } else {
        const amount = Math.max(
          1,
          Math.min(500, Math.floor((leader.points * settings.itemStealPercent) / 100)),
        );
        this.addBonus(participantId, amount);
        this.addBonus(leader.participantId, -amount);
        this.addFeed(
          `${name} 학생이 ${leader.name} 학생에게서 ${amount}점을 훔쳤습니다!`,
          "warn",
        );
      }
    }
    this.broadcastGame();
  }

  private addBonus(participantId: string, delta: number): void {
    if (!delta) return;
    this.run(
      `INSERT INTO game_bonus (participant_id, points) VALUES (?, ?)
       ON CONFLICT (participant_id) DO UPDATE SET points = points + excluded.points`,
      participantId,
      Math.round(delta),
    );
  }

  /* ------------------------------- board ------------------------------ */

  private sanitizeMaterial(value: unknown): SharedMaterial | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.slice(0, 80) : "";
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 160) : "";
    const mime = typeof record.mime === "string" ? record.mime.slice(0, 80) : "application/pdf";
    const size = Number(record.size);
    if (!id || !name) return null;
    if (!Number.isFinite(size) || size <= 0 || size > 12 * 1024 * 1024) return null;
    if (mime !== "application/pdf") return null;
    return { id, name, mime, size, kind: "pdf" };
  }

  private shareBoard(ws: WebSocket, value: LiveBoard | undefined): void {
    if (!value || typeof value !== "object") return;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
    if (!title) {
      this.send(ws, { type: "error", message: "보드 제목이 필요합니다." });
      return;
    }
    const layout: BoardLayout = value.layout === "columns" ? "columns" : "wall";
    const columns = Array.isArray(value.columns)
      ? value.columns.map((column) => String(column).trim().slice(0, 40)).filter(Boolean).slice(0, 8)
      : [];
    const boardId = typeof value.id === "string" ? value.id.slice(0, 80) : randomId("board_");
    const cards = Array.isArray(value.cards) ? value.cards.slice(0, BOARD_CARD_CAP) : [];

    this.run("DELETE FROM board");
    this.run("DELETE FROM board_cards");
    this.run(
      `INSERT INTO board (id, title, instructions, layout, columns_json, allow_posts, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      boardId,
      title,
      typeof value.instructions === "string" ? value.instructions.trim().slice(0, 400) : "",
      layout,
      JSON.stringify(columns),
      value.allowStudentPosts === true ? 1 : 0,
      Date.now(),
    );
    for (const card of cards) {
      const text = typeof card.text === "string" ? card.text.trim().slice(0, BOARD_CARD_MAX_CHARS) : "";
      if (!text) continue;
      this.run(
        `INSERT INTO board_cards (id, board_id, text, color, author, column_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        typeof card.id === "string" ? card.id.slice(0, 80) : randomId("card_"),
        boardId,
        text,
        BOARD_COLORS.has(String(card.color)) ? String(card.color) : "yellow",
        typeof card.author === "string" ? card.author.slice(0, 40) : "선생님",
        typeof card.column === "string" && columns.includes(card.column) ? card.column : null,
        Number.isFinite(card.createdAt) ? Number(card.createdAt) : Date.now(),
      );
    }
    this.broadcastBoard();
  }

  private addCard(
    author: string,
    rawText: unknown,
    rawColor: unknown,
    rawColumn: unknown,
    teacher: boolean,
  ): void {
    const board = this.boardRow();
    if (!board) return;
    const text = typeof rawText === "string" ? rawText.trim().slice(0, BOARD_CARD_MAX_CHARS) : "";
    if (!text) return;
    const count = Number(
      this.first<{ count: number }>("SELECT COUNT(*) AS count FROM board_cards")?.count ?? 0,
    );
    if (count >= BOARD_CARD_CAP) return;
    const columns = JSON.parse(board.columns_json) as string[];
    const color = BOARD_COLORS.has(String(rawColor)) ? String(rawColor) : "yellow";
    const column =
      typeof rawColumn === "string" && columns.includes(rawColumn) ? rawColumn : null;
    this.run(
      `INSERT INTO board_cards (id, board_id, text, color, author, column_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomId("card_"),
      board.id,
      text,
      color,
      teacher ? "선생님" : author.slice(0, 40) || "학생",
      column,
      Date.now(),
    );
    this.broadcastBoard();
  }

  private boardRow(): BoardRow | null {
    return this.first<BoardRow>("SELECT * FROM board ORDER BY updated_at DESC LIMIT 1");
  }

  private boardCards(boardId: string): BoardCard[] {
    return this.rows<CardRow>(
      "SELECT * FROM board_cards WHERE board_id = ? ORDER BY created_at ASC",
      boardId,
    ).map((row) => ({
      id: row.id,
      text: row.text,
      color: (BOARD_COLORS.has(row.color) ? row.color : "yellow") as BoardColor,
      author: row.author,
      column: row.column_name,
      createdAt: row.created_at,
    }));
  }

  private boardPublic(): LiveBoard | null {
    const row = this.boardRow();
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      instructions: row.instructions,
      layout: row.layout === "columns" ? "columns" : "wall",
      columns: JSON.parse(row.columns_json) as string[],
      allowStudentPosts: row.allow_posts === 1,
      cards: this.boardCards(row.id),
      updatedAt: row.updated_at,
    };
  }

  private broadcastBoard(): void {
    const board = this.boardPublic();
    this.sendToTeachers({ type: "board", board });
    this.sendToStudents({ type: "board", board });
  }

  private clearBoard(notify: boolean): void {
    const existing = this.boardRow();
    if (!existing) return;
    this.run("DELETE FROM board");
    this.run("DELETE FROM board_cards");
    if (notify) this.broadcastBoard();
    else {
      // The teacher is gone; students simply lose access to the shared board.
      this.sendToTeachers({ type: "board", board: null });
      this.sendToStudents({ type: "board", board: null });
    }
  }

  /* ----------------------------- file relay --------------------------- */

  private relayFileChunk(data: Extract<ClientMessage, { type: "file_chunk" }>): void {
    const to = typeof data.to === "string" ? data.to : "";
    if (!to) return;
    const index = Number(data.index);
    const total = Number(data.total);
    const size = Number(data.size);
    const payload = typeof data.data === "string" ? data.data : "";
    if (!Number.isInteger(index) || !Number.isInteger(total)) return;
    if (index < 0 || total < 1 || total > FILE_CHUNK_MAX_TOTAL || index >= total) return;
    if (!payload || payload.length > FILE_CHUNK_MAX_CHARS) return;
    if (!Number.isFinite(size) || size <= 0 || size > 12 * 1024 * 1024) return;
    if (!this.onlineIds().has(to)) return;
    const materialId = typeof data.materialId === "string" ? data.materialId.slice(0, 80) : "";
    const transferId = typeof data.transferId === "string" ? data.transferId.slice(0, 80) : "";
    const name = typeof data.name === "string" ? data.name.slice(0, 160) : "worksheet.pdf";
    const mime = data.mime === "application/pdf" ? "application/pdf" : "application/pdf";
    if (!materialId || !transferId) return;
    this.sendToParticipant(to, {
      type: "file_chunk",
      from: "teacher",
      transferId,
      materialId,
      name,
      mime,
      size,
      index,
      total,
      data: payload,
    });
  }

  /* ------------------------------- rtc -------------------------------- */

  private relayRtc(
    from: string,
    fromName: string,
    target: unknown,
    signal: RtcSignal | undefined,
  ): void {
    if (!signal || typeof signal !== "object") return;
    const kind = (signal as { kind?: unknown }).kind;
    if (kind !== "offer" && kind !== "answer" && kind !== "candidate" && kind !== "request" && kind !== "stop") {
      return;
    }
    const to = typeof target === "string" ? target : "";
    if (!to) return;
    const payload: ServerMessage = { type: "rtc", from, fromName, signal };
    if (to === "teacher") {
      this.sendToTeachers(payload);
      return;
    }
    if (!this.onlineIds().has(to)) return;
    this.sendToParticipant(to, payload);
  }

  /* ---------------------------- event log ----------------------------- */

  private logEvent(
    participantId: string,
    studentName: string,
    type: FocusEventType,
    detail: string | null,
    connection: ConnectionState,
    skipDedupe = false,
  ): ClassroomEventRecord | null {
    const now = Date.now();
    if (!skipDedupe) {
      const recent = this.first<{ created_at: number }>(
        "SELECT created_at FROM events WHERE participant_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1",
        participantId,
        type,
      );
      if (recent && now - recent.created_at < DEDUPE_WINDOW_MS) return null;
    }
    const event: ClassroomEventRecord = {
      id: randomId("evt_"),
      participantId,
      studentName,
      type,
      detail,
      connection,
      createdAt: now,
    };
    this.run(
      "INSERT INTO events (id, participant_id, student_name, type, detail, connection, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      event.id,
      participantId,
      studentName,
      type,
      detail,
      connection,
      now,
    );
    this.run(
      "UPDATE live SET event_count = event_count + 1 WHERE participant_id = ?",
      participantId,
    );
    this.insertCounter += 1;
    if (this.insertCounter % 25 === 0) this.pruneEvents();
    this.sendToTeachers({ type: "event", event });
    return event;
  }

  private pruneEvents(): void {
    const cutoff = Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    this.run("DELETE FROM events WHERE created_at < ?", cutoff);
    this.run(
      "DELETE FROM events WHERE id IN (SELECT id FROM events ORDER BY created_at DESC LIMIT -1 OFFSET ?)",
      EVENT_ROW_CAP,
    );
  }

  private eventRecord(row: EventRow): ClassroomEventRecord {
    return {
      id: row.id,
      participantId: row.participant_id,
      studentName: row.student_name,
      type: row.type as FocusEventType,
      detail: row.detail,
      connection: row.connection as ConnectionState,
      createdAt: row.created_at,
    };
  }

  /* ----------------------------- projections -------------------------- */

  private liveRowToStudent(row: LiveRow, online: Set<string>): StudentLive {
    return {
      participantId: row.participant_id,
      name: row.name,
      online: online.has(row.participant_id),
      team: row.team ?? null,
      alive: row.alive !== 0,
      handRaised: row.hand === 1,
      fullscreen: row.fullscreen === null ? null : row.fullscreen === 1,
      visibility: (row.visibility as StudentLive["visibility"]) ?? "unknown",
      joinedAt: row.joined_at,
      lastActivityAt: row.last_activity_at,
      lastRejoinAt: row.last_rejoin_at,
      sharingScreen: row.sharing === 1,
      eventCount: row.event_count,
      seat: row.seat === null || row.seat === undefined ? null : Number(row.seat),
    };
  }

  students(): StudentLive[] {
    const rows = this.rows<LiveRow>("SELECT * FROM live ORDER BY joined_at ASC");
    const online = this.onlineIds();
    return rows.map((row) => this.liveRowToStudent(row, online));
  }

  private broadcastStudentUpdate(participantId: string): void {
    const row = this.first<LiveRow>("SELECT * FROM live WHERE participant_id = ?", participantId);
    if (!row) return;
    const students = this.students();
    for (const ws of this.socketsFor("teacher")) this.send(ws, { type: "students", students });
  }

  private quizRow(): QuizRow | null {
    return this.first<QuizRow>("SELECT * FROM quiz ORDER BY started_at DESC LIMIT 1");
  }

  private quizPublic(row: QuizRow): LiveQuiz {
    const answerCount = this.first<{ count: number }>(
      "SELECT COUNT(*) AS count FROM quiz_answers WHERE quiz_id = ?",
      row.id,
    );
    const options = JSON.parse(row.options_json) as LiveQuiz["options"];
    const pairs = parsePairs(row.pairs_json);
    const mode: QuizMode =
      row.mode === "spell"
        ? "spell"
        : row.mode === "ox"
          ? "ox"
          : row.mode === "connect"
            ? "connect"
            : "choice";
    const closed = row.status === "closed";
    const correctAnswer = !closed
      ? null
      : mode === "spell"
        ? row.correct_text
        : mode === "connect"
          ? pairs.map((pair) => `${pair.left} = ${pair.right}`).join(" · ")
          : (options.find((option) => option.id === row.correct_option)?.label ?? null);
    return {
      id: row.id,
      prompt: row.prompt,
      mode,
      options,
      status: closed ? "closed" : "open",
      startedAt: row.started_at,
      closedAt: row.closed_at,
      answerCount: Number(answerCount?.count ?? 0),
      correctAnswer,
      round: Number(row.round ?? 1),
      gameMode: (GAME_MODES.has(row.game_mode) ? row.game_mode : "classic") as GameMode,
      durationSec: row.duration_sec === null ? null : Number(row.duration_sec),
      endsAt: row.ends_at === null ? null : Number(row.ends_at),
      lefts: pairs.map((pair) => pair.left),
      rights: pairs.map((pair) => pair.right),
    };
  }

  /** Whether the teacher currently mirrors activity-field text. */
  observing(): boolean {
    return this.first<{ value: string }>("SELECT value FROM config WHERE key = 'observing'")?.value === "1";
  }

  private inputs(): InputPreview[] {
    return this.rows<InputRow>(
      "SELECT * FROM input_previews ORDER BY at DESC LIMIT 50",
    ).map((row) => ({
      participantId: row.participant_id,
      studentName: row.student_name,
      field: row.field,
      text: row.text,
      at: row.at,
    }));
  }

  private broadcastObserve(): void {
    const observing = this.observing();
    this.sendToTeachers({ type: "observe", observing });
    this.sendToStudents({ type: "observe", observing });
  }

  private quizOptional(): LiveQuiz | null {
    const row = this.quizRow();
    return row ? this.quizPublic(row) : null;
  }

  private results(): QuizResults | null {
    const row = this.quizRow();
    if (!row) return null;
    const quiz = this.quizPublic(row);
    const answers = this.rows<AnswerRow>(
      "SELECT * FROM quiz_answers WHERE quiz_id = ? ORDER BY at ASC",
      row.id,
    );
    const tallies: Record<string, number> = {};
    for (const option of quiz.options) tallies[option.id] = 0;
    for (const answer of answers) {
      if (!answer.option_id) continue;
      if (tallies[answer.option_id] === undefined) tallies[answer.option_id] = 0;
      tallies[answer.option_id] += 1;
    }
    const responses = answers.map((answer) => ({
      participantId: answer.participant_id,
      studentName: answer.student_name,
      optionId: answer.option_id,
      text: answer.text ?? undefined,
      correct: answer.correct === null ? undefined : answer.correct === 1,
      points: Number(answer.points ?? 0),
      elapsedMs: answer.elapsed_ms === null ? null : Number(answer.elapsed_ms),
      at: answer.at,
    }));
    return {
      quizId: quiz.id,
      tallies,
      responses,
      participantCount: this.first<{ count: number }>("SELECT COUNT(*) AS count FROM live")?.count ?? 0,
      answerCount: answers.length,
      correctCount: responses.filter((response) => response.correct === true).length,
      correctAnswer: quiz.correctAnswer,
    };
  }

  private worksheetRow(): WorksheetRow | null {
    return this.first<WorksheetRow>("SELECT * FROM worksheet ORDER BY created_at DESC LIMIT 1");
  }

  private materialOf(row: WorksheetRow | null): SharedMaterial | null {
    if (!row?.material_json) return null;
    try {
      return JSON.parse(row.material_json) as SharedMaterial;
    } catch {
      return null;
    }
  }

  private submissionCount(): number {
    return Number(this.first<{ count: number }>("SELECT COUNT(*) AS count FROM worksheet_submissions")?.count ?? 0);
  }

  private worksheetPublic(row: WorksheetRow): WorksheetState {
    return {
      id: row.id,
      prompt: row.prompt,
      createdAt: row.created_at,
      submissionCount: this.submissionCount(),
      material: this.materialOf(row),
      fields: this.fieldsOf(row),
    };
  }

  private fieldsOf(row: WorksheetRow | null): WorksheetField[] {
    if (!row?.fields_json) return [];
    try {
      const parsed = JSON.parse(row.fields_json) as WorksheetField[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (field) =>
          field &&
          typeof field.id === "string" &&
          typeof field.label === "string" &&
          FIELD_TYPES.has(String(field.type)),
      );
    } catch {
      return [];
    }
  }

  private sanitizeFields(value: unknown): WorksheetField[] {
    if (!Array.isArray(value)) return [];
    const fields: WorksheetField[] = [];
    for (const entry of value.slice(0, 12)) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim().slice(0, 140) : "";
      if (!label) continue;
      const type = FIELD_TYPES.has(String(record.type))
        ? (record.type as WorksheetField["type"])
        : "short";
      const answer =
        typeof record.answer === "string" && record.answer.trim()
          ? record.answer.trim().slice(0, 200)
          : null;
      fields.push({ id: `f${fields.length + 1}`, label, type, answer });
    }
    return fields;
  }

  private parseAnswers(raw: string | null): Record<string, string> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") out[key] = value;
      }
      return out;
    } catch {
      return {};
    }
  }

  private worksheetOptional(): WorksheetState | null {
    const row = this.worksheetRow();
    return row ? this.worksheetPublic(row) : null;
  }

  private submissions(): WorksheetSubmission[] {
    return this.rows<SubmissionRow>(
      "SELECT * FROM worksheet_submissions ORDER BY updated_at DESC",
    ).map((row) => ({
      participantId: row.participant_id,
      studentName: row.student_name,
      text: row.text,
      answers: this.parseAnswers(row.answers_json),
      score: row.score === null ? null : Number(row.score),
      maxScore: row.max_score === null ? null : Number(row.max_score),
      updatedAt: row.updated_at,
    }));
  }

  private events(participantId: string | null, limit: number): ClassroomEventRecord[] {
    const capped = Math.min(Math.max(limit, 1), 300);
    const rows = participantId
      ? this.rows<EventRow>(
          "SELECT * FROM events WHERE participant_id = ? ORDER BY created_at DESC LIMIT ?",
          participantId,
          capped,
        )
      : this.rows<EventRow>("SELECT * FROM events ORDER BY created_at DESC LIMIT ?", capped);
    return rows.map((row) => this.eventRecord(row));
  }

  private broadcastQuiz(): void {
    const quiz = this.quizOptional();
    const results = this.results();
    for (const ws of this.socketsFor("teacher")) {
      this.send(ws, { type: "quiz", quiz, results: results ?? undefined });
    }
    for (const ws of this.socketsFor("student")) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      const participantId = attachment?.participantId;
      const answer = quiz && participantId
        ? this.first<AnswerRow>(
            "SELECT participant_id, student_name, option_id, text, at FROM quiz_answers WHERE quiz_id = ? AND participant_id = ?",
            quiz.id,
            participantId,
          )
        : null;
      this.send(ws, {
        type: "quiz",
        quiz,
        yourAnswer: quiz?.mode === "spell" ? (answer?.text ?? null) : (answer?.option_id ?? null),
      });
    }
  }

  private broadcastWorksheet(): void {
    const worksheet = this.worksheetOptional();
    const submissions = this.submissions();
    // Students receive only the prompt; other students' submissions stay private.
    for (const ws of this.socketsFor("teacher")) {
      this.send(ws, { type: "worksheet", worksheet, submissions });
    }
    for (const ws of this.socketsFor("student")) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      const mine = attachment?.participantId
        ? this.first<SubmissionRow>(
            "SELECT * FROM worksheet_submissions WHERE participant_id = ?",
            attachment.participantId,
          )
        : null;
      this.send(ws, { type: "worksheet", worksheet, locked: mine?.locked === 1 });
    }
  }

  /* --------------------------- stage & timer -------------------------- */

  private configValue(key: string): string | null {
    return this.first<{ value: string }>("SELECT value FROM config WHERE key = ?", key)?.value ?? null;
  }

  private setConfig(key: string, value: string | null): void {
    if (value === null) {
      this.run("DELETE FROM config WHERE key = ?", key);
      return;
    }
    this.run(
      "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
  }

  private stagePublic(): StageContent | null {
    const raw = this.configValue("stage");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StageContent;
      if (!parsed || !STAGE_KINDS.has(String(parsed.kind))) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private setStage(ws: WebSocket, data: Extract<ClientMessage, { type: "stage_set" }>): void {
    const kind = STAGE_KINDS.has(String(data.kind)) ? (data.kind as StageKind) : "note";
    const title = typeof data.title === "string" ? data.title.trim().slice(0, 120) : "";
    const rawUrl = typeof data.url === "string" ? data.url.trim().slice(0, 2000) : "";
    let url: string | null = null;
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") url = parsed.toString();
      } catch {
        url = null;
      }
    }
    if (kind === "url" && !url) {
      this.send(ws, { type: "error", message: "http(s) 주소를 입력해 주세요." });
      return;
    }
    const body = typeof data.body === "string" ? data.body.slice(0, 4000) : null;
    if (kind === "note" && !body?.trim()) {
      this.send(ws, { type: "error", message: "학생 화면에 띄울 내용을 입력해 주세요." });
      return;
    }
    const stage: StageContent = {
      id: randomId("stage_"),
      kind,
      title: title || (kind === "board" ? "활동 보드" : kind === "url" ? "함께 보기" : "알림"),
      url: kind === "board" ? null : url,
      body: kind === "board" ? null : body,
      requireFullscreen: data.requireFullscreen === true,
      openedAt: Date.now(),
    };
    this.setConfig("stage", JSON.stringify(stage));
    this.broadcastStage();
  }

  private clearStage(notify: boolean): void {
    if (!this.stagePublic()) return;
    this.setConfig("stage", null);
    if (notify) {
      this.broadcastStage();
      return;
    }
    this.sendToTeachers({ type: "stage", stage: null });
    this.sendToStudents({ type: "stage", stage: null });
  }

  private broadcastStage(): void {
    const stage = this.stagePublic();
    this.sendToTeachers({ type: "stage", stage });
    this.sendToStudents({ type: "stage", stage });
  }

  private timerPublic(): ClassTimer | null {
    const raw = this.configValue("timer");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ClassTimer;
      if (!parsed || !Number.isFinite(parsed.endsAt) || parsed.endsAt <= Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private setTimer(action: "start" | "stop", durationSec: unknown): void {
    if (action === "stop") {
      this.setConfig("timer", null);
      this.broadcastTimer();
      return;
    }
    const duration = Math.min(7200, Math.max(60, Math.round(Number(durationSec) || 3000)));
    const now = Date.now();
    const timer: ClassTimer = { startedAt: now, durationSec: duration, endsAt: now + duration * 1000 };
    this.setConfig("timer", JSON.stringify(timer));
    this.broadcastTimer();
  }

  private broadcastTimer(): void {
    const timer = this.timerPublic();
    this.sendToTeachers({ type: "timer", timer });
    this.sendToStudents({ type: "timer", timer });
  }

  private scoreRows(): (GameScore & { bonus: number })[] {
    const rows = this.rows<{
      participant_id: string;
      name: string;
      team: string | null;
      alive: number;
      answer_points: number;
      bonus_points: number;
      correct: number;
      wrong: number;
    }>(
      `SELECT l.participant_id, l.name, l.team, l.alive,
         COALESCE((SELECT SUM(points) FROM quiz_answers a WHERE a.participant_id = l.participant_id), 0) AS answer_points,
         COALESCE((SELECT points FROM game_bonus b WHERE b.participant_id = l.participant_id), 0) AS bonus_points,
         COALESCE((SELECT SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) FROM quiz_answers a WHERE a.participant_id = l.participant_id), 0) AS correct,
         COALESCE((SELECT SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) FROM quiz_answers a WHERE a.participant_id = l.participant_id), 0) AS wrong
       FROM live l`,
    );
    return rows
      .map((row) => ({
        participantId: row.participant_id,
        name: row.name,
        team: row.team ?? null,
        points: Number(row.answer_points ?? 0) + Number(row.bonus_points ?? 0),
        bonus: Number(row.bonus_points ?? 0),
        correct: Number(row.correct ?? 0),
        wrong: Number(row.wrong ?? 0),
        alive: row.alive !== 0,
      }))
      .sort(
        (left, right) =>
          right.points - left.points ||
          right.correct - left.correct ||
          left.name.localeCompare(right.name, "ko"),
      );
  }

  private leaderId(): string | null {
    const top = this.scoreRows()[0];
    return top && top.points > 0 ? top.participantId : null;
  }

  private gameState(forParticipant?: string): GameState {
    const quiz = this.quizRow();
    const mode = (quiz && GAME_MODES.has(quiz.game_mode) ? quiz.game_mode : "classic") as GameMode;
    const totalRounds = Math.max(1, Number(this.configValue("total_rounds") ?? 0) || Number(quiz?.round ?? 1));
    const scores = this.scoreRows().map((score) => ({
      participantId: score.participantId,
      name: score.name,
      team: score.team,
      points: score.points,
      correct: score.correct,
      wrong: score.wrong,
      alive: score.alive,
    }));
    const teams = this.teamLabels()
      .map((label) => {
        const members = scores.filter((score) => score.team === label);
        return {
          id: label,
          label,
          points: members.reduce((sum, score) => sum + score.points, 0),
          players: members.length,
        };
      })
      .filter((team) => team.players > 0);
    return {
      mode,
      round: Number(quiz?.round ?? 0),
      totalRounds,
      scores,
      teams,
      lobbyOpen: this.lobbyOpen(),
      items: this.gameItems(forParticipant),
      feed: this.gameFeed(),
    };
  }

  private broadcastGame(): void {
    const game = this.gameState();
    this.sendToTeachers({ type: "game", game });
    // 각 학생에게는 자기 아이템만 보여 준다.
    for (const ws of this.socketsFor("student")) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      const participantId = attachment?.participantId;
      this.send(ws, {
        type: "game",
        game: {
          ...game,
          items: participantId ? game.items.filter((item) => item.participantId === participantId) : [],
        },
      });
    }
  }

  /* ------------------------------- RPC -------------------------------- */

  teacherSnapshot(): ClassroomSnapshot {
    return {
      classroomId: this.classroomId,
      status: "live" as ClassroomStatus,
      serverTime: Date.now(),
      students: this.students(),
      quiz: this.quizOptional(),
      quizResults: this.results(),
      worksheet: this.worksheetOptional(),
      submissions: this.submissions(),
      board: this.boardPublic(),
      stage: this.stagePublic(),
      timer: this.timerPublic(),
      game: this.gameState(),
      observing: this.observing(),
      inputs: this.inputs(),
      recentEvents: this.events(null, 50),
      teamBoards: this.teamBoards(),
      presenter: this.presenterPublic(),
      minigame: this.miniGame(),
      tools: this.toolsPublic(),
      roster: this.rosterPublic(),
      settings: this.settings(),
    };
  }

  studentSnapshot(participantId: string): StudentSnapshot {
    const row = this.first<LiveRow>("SELECT * FROM live WHERE participant_id = ?", participantId);
    const tools = this.toolsPublic();
    const quiz = this.quizOptional();
    const answer = quiz
      ? this.first<AnswerRow>(
          "SELECT * FROM quiz_answers WHERE quiz_id = ? AND participant_id = ?",
          quiz.id,
          participantId,
        )
      : null;
    const worksheet = this.worksheetOptional();
    const mine = this.first<SubmissionRow>(
      "SELECT * FROM worksheet_submissions WHERE participant_id = ?",
      participantId,
    );
    return {
      classroomId: this.classroomId,
      status: "live" as ClassroomStatus,
      serverTime: Date.now(),
      self: row ? this.liveRowToStudent(row, this.onlineIds()) : null,
      quiz,
      myQuizAnswer:
        quiz?.mode === "spell" || quiz?.mode === "connect"
          ? (answer?.text ?? null)
          : (answer?.option_id ?? null),
      worksheet,
      myWorksheet: mine?.text ?? null,
      myWorksheetAnswers: mine ? this.parseAnswers(mine.answers_json) : null,
      myWorksheetLocked: mine?.locked === 1,
      board: this.boardPublic(),
      stage: this.stagePublic(),
      timer: this.timerPublic(),
      game: this.gameState(participantId),
      observing: this.observing(),
      events: this.events(participantId, 30),
      teamBoard: row?.team ? this.teamBoardFor(row.team) : null,
      presenter: this.presenterPublic(),
      minigame: this.miniGame(),
      tools: {
        ...tools,
        attendance: tools.attendance.filter((entry) => entry.participantId === participantId),
      },
      roster: this.rosterPublic(),
      settings: this.settings(),
    };
  }

  eventHistory(participantId: string | null, limit = 100): ClassroomEventRecord[] {
    return this.events(participantId, limit);
  }

  /** Called by the Worker when a student page sends a leave beacon. */
  recordServerEvent(
    participantId: string,
    studentName: string,
    type: FocusEventType,
    detail: string | null,
  ): void {
    if (!EVENT_TYPES.has(type)) return;
    this.run("UPDATE live SET online = 0, sharing = 0 WHERE participant_id = ?", participantId);
    this.logEvent(participantId, studentName, type, detail, "disconnected");
    this.broadcastStudents();
  }

  /**
   * Called by the Worker when the teacher ends the class. Live content is
   * destroyed immediately: board, quiz, worksheet, submissions, events,
   * input previews and presence. Only the classroom row (title/code/history)
   * stays in D1 so the teacher can see the class in their list.
   */
  endClass(): void {
    this.clearBoard(true);
    const payload: ServerMessage = {
      type: "notice",
      text: "선생님이 수업을 종료했습니다. 수업 내용은 즉시 삭제되었습니다.",
      at: Date.now(),
    };
    this.sendToStudents(payload);
    this.sendToTeachers(payload);
    for (const table of [
      "live",
      "events",
      "quiz",
      "quiz_answers",
      "worksheet",
      "worksheet_submissions",
      "board",
      "board_cards",
      "team_posts",
      "input_previews",
      "game_items",
      "game_feed",
      "game_bonus",
      "game_effects",
      "config",
    ]) {
      this.run(`DELETE FROM ${table}`);
    }
    void this.ctx.storage.deleteAlarm();
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(4001, "class_ended");
      } catch {
        /* already closed */
      }
    }
  }
}


