import type { BoardCard, BoardColor, BoardComment, BoardLayout, LiveBoard } from "../../shared/protocol";

/**
 * Saved activity boards live in the teacher's browser (IndexedDB), not on the
 * server. Only a board the teacher explicitly shares is mirrored to the
 * classroom Durable Object, and it disappears when the console closes.
 */
export interface SavedBoard {
  id: string;
  title: string;
  instructions: string;
  layout: BoardLayout;
  columns: string[];
  allowStudentPosts: boolean;
  cards: BoardCard[];
  createdAt: number;
  updatedAt: number;
}

export type BoardTemplate = Omit<SavedBoard, "id" | "createdAt" | "updatedAt"> & {
  templateKey: string;
  tagline: string;
};

const DB_NAME = "aic-local";
const DB_VERSION = 1;
const BOARD_STORE = "boards";
const MATERIAL_STORE = "materials";

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("이 브라우저는 로컬 저장소(IndexedDB)를 지원하지 않습니다."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BOARD_STORE)) {
          db.createObjectStore(BOARD_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(MATERIAL_STORE)) {
          db.createObjectStore(MATERIAL_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("로컬 저장소를 열지 못했습니다."));
    });
  }
  return databasePromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("로컬 저장에 실패했습니다."));
      }),
  );
}

export function newBoardId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `board_${crypto.randomUUID()}`;
  return `board_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const CARD_COLORS: BoardColor[] = ["yellow", "rose", "sky", "emerald", "violet", "slate"];

export function boardCard(text: string, author: string, color: BoardColor = "yellow", column: string | null = null): BoardCard {
  return {
    id: `card_${Math.random().toString(36).slice(2, 10)}`,
    text,
    color,
    author,
    column,
    createdAt: Date.now(),
    x: null,
    y: null,
    likes: 0,
    likedBy: [],
    comments: [],
  };
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    templateKey: "thinker-wall",
    tagline: "패들렛형 · 포스트잇 생각 모으기",
    title: "생각 모으기 보드",
    instructions: "오늘의 질문에 대한 생각을 카드로 붙여 주세요. 친구의 카드에도 답을 남길 수 있습니다.",
    layout: "wall",
    columns: [],
    allowStudentPosts: true,
    cards: [],
  },
  {
    templateKey: "group-columns",
    tagline: "띵커벨형 · 모둠별 토의 보드",
    title: "모둠 토의 보드",
    instructions: "모둠 칸에 토의 결과를 정리해 주세요. 한 사람이 한 장 이상 카드를 남깁니다.",
    layout: "columns",
    columns: ["1모둠", "2모둠", "3모둠", "4모둠", "5모둠", "6모둠"],
    allowStudentPosts: true,
    cards: [],
  },
  {
    templateKey: "question-board",
    tagline: "질문 카드 · 익명에 가까운 질문 수집",
    title: "질문 수집 보드",
    instructions: "수업 중 궁금한 점을 카드로 남겨 주세요. 선생님이 함께 확인합니다.",
    layout: "wall",
    columns: [],
    allowStudentPosts: true,
    cards: [],
  },
  {
    templateKey: "exit-ticket",
    tagline: "수업 정리 · 한 줄 소감",
    title: "오늘의 한 줄",
    instructions: "오늘 수업에서 가장 기억에 남는 것을 한 줄로 적어 주세요.",
    layout: "wall",
    columns: [],
    allowStudentPosts: true,
    cards: [],
  },
  {
    templateKey: "presentation",
    tagline: "발표 · 질문 · 칭찬 3칸",
    title: "발표 피드백 보드",
    instructions: "발표를 듣고 질문과 칭찬을 남겨 주세요. 발표자는 답을 카드로 달 수 있습니다.",
    layout: "columns",
    columns: ["발표 내용", "질문", "칭찬"],
    allowStudentPosts: true,
    cards: [],
  },
];

export function boardFromTemplate(template: BoardTemplate): SavedBoard {
  const now = Date.now();
  return {
    id: newBoardId(),
    title: template.title,
    instructions: template.instructions,
    layout: template.layout,
    columns: [...template.columns],
    allowStudentPosts: template.allowStudentPosts,
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeBoard(value: unknown): SavedBoard | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim().slice(0, 120) : "";
  if (!title) return null;
  const layout: BoardLayout = record.layout === "columns" ? "columns" : "wall";
  const columns = Array.isArray(record.columns)
    ? record.columns.map((column) => String(column).trim().slice(0, 40)).filter(Boolean).slice(0, 8)
    : [];
  const cards: BoardCard[] = Array.isArray(record.cards)
    ? record.cards
        .map((card) => {
          if (!card || typeof card !== "object") return null;
          const entry = card as Record<string, unknown>;
          const text = typeof entry.text === "string" ? entry.text.trim().slice(0, 280) : "";
          if (!text) return null;
          return {
            id: typeof entry.id === "string" ? entry.id : boardCard(text, "선생님").id,
            text,
            color: CARD_COLORS.includes(entry.color as BoardColor) ? (entry.color as BoardColor) : "yellow",
            author: typeof entry.author === "string" ? entry.author.slice(0, 40) : "선생님",
            column:
              typeof entry.column === "string" && columns.includes(entry.column) ? entry.column : null,
            createdAt: Number.isFinite(entry.createdAt) ? Number(entry.createdAt) : Date.now(),
            x: Number.isFinite(entry.x as number) ? Number(entry.x) : null,
            y: Number.isFinite(entry.y as number) ? Number(entry.y) : null,
            likes: 0,
            likedBy: [] as string[],
            comments: [] as BoardComment[],
          };
        })
        .filter((card): card is BoardCard => card !== null)
        .slice(0, 200)
    : [];
  const now = Date.now();
  return {
    id: typeof record.id === "string" && record.id ? record.id : newBoardId(),
    title,
    instructions: typeof record.instructions === "string" ? record.instructions.trim().slice(0, 400) : "",
    layout,
    columns,
    allowStudentPosts: record.allowStudentPosts !== false,
    cards,
    createdAt: Number.isFinite(record.createdAt) ? Number(record.createdAt) : now,
    updatedAt: now,
  };
}

export async function listBoards(): Promise<SavedBoard[]> {
  const rows = await tx<SavedBoard[]>(BOARD_STORE, "readonly", (store) => store.getAll());
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveBoard(board: SavedBoard): Promise<SavedBoard> {
  const normalized = normalizeBoard({ ...board, updatedAt: Date.now() });
  if (!normalized) throw new Error("보드 제목을 입력해 주세요.");
  const saved = { ...normalized, id: board.id || normalized.id };
  await tx(BOARD_STORE, "readwrite", (store) => store.put(saved));
  return saved;
}

export async function deleteBoard(id: string): Promise<void> {
  await tx(BOARD_STORE, "readwrite", (store) => store.delete(id));
}

export async function loadBoard(id: string): Promise<SavedBoard | null> {
  const row = await tx<SavedBoard | undefined>(BOARD_STORE, "readonly", (store) => store.get(id));
  return row ?? null;
}

export function boardToLive(board: SavedBoard): LiveBoard {
  return {
    id: board.id,
    title: board.title,
    instructions: board.instructions,
    layout: board.layout,
    columns: board.columns,
    allowStudentPosts: board.allowStudentPosts,
    cards: board.cards,
    updatedAt: Date.now(),
  };
}

/** Parse an exported `.json` file. Returns freshly identified boards. */
export function parseBoardExport(text: string): SavedBoard[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON 파일을 읽지 못했습니다.");
  }
  const entries = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { boards?: unknown }).boards)
      ? (data as { boards: unknown[] }).boards
      : [data];
  const boards = entries
    .map(normalizeBoard)
    .filter((board): board is SavedBoard => board !== null)
    .map((board) => ({ ...board, id: newBoardId(), updatedAt: Date.now() }));
  if (boards.length === 0) throw new Error("가져올 보드를 찾지 못했습니다.");
  return boards;
}

export function exportBoards(boards: SavedBoard[]): string {
  return JSON.stringify(
    {
      app: "AIC",
      kind: "activity-boards",
      version: 1,
      exportedAt: new Date().toISOString(),
      boards,
    },
    null,
    2,
  );
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}


