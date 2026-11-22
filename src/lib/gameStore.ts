import type { QuizMode } from "../../shared/protocol";

/** Game sets are teacher-local content; nothing here is uploaded to the server. */
export interface GamePair {
  left: string;
  right: string;
}

export interface GameQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  /** 뜻 연결(connect) 문제의 짝. */
  pairs: GamePair[];
}

export interface GameSet {
  id: string;
  name: string;
  mode: QuizMode;
  questions: GameQuestion[];
  updatedAt: number;
}

const STORAGE_KEY = "aic:game-sets:v1";

function id(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newGameQuestion(): GameQuestion {
  return { id: id("q"), prompt: "", options: ["", "", "", ""], answer: "", pairs: [] };
}

export function newGameSet(): GameSet {
  return {
    id: id("game"),
    name: "새 게임",
    mode: "choice",
    questions: [newGameQuestion()],
    updatedAt: Date.now(),
  };
}

function q(prompt: string, answer: string, options: string[] = []): GameQuestion {
  return { id: id("q"), prompt, answer, options, pairs: [] };
}

function pairQuestion(prompt: string, pairs: [string, string][]): GameQuestion {
  return {
    id: id("q"),
    prompt,
    answer: "",
    options: [],
    pairs: pairs.map(([left, right]) => ({ left, right })),
  };
}

const BUILT_INS: GameSet[] = [
  {
    id: "game_word_meaning",
    name: "영단어 뜻 맞히기",
    mode: "choice",
    updatedAt: 0,
    questions: [
      q("apple", "사과", ["사과", "바나나", "학교", "친구"]),
      q("banana", "바나나", ["물", "바나나", "책", "집"]),
      q("school", "학교", ["병원", "학교", "시장", "공원"]),
      q("friend", "친구", ["친구", "가족", "선생님", "학생"]),
      q("water", "물", ["불", "바람", "물", "흙"]),
    ],
  },
  {
    id: "game_word_meaning_2",
    name: "영단어 뜻 맞히기 2",
    mode: "choice",
    updatedAt: 0,
    questions: [
      q("tiger", "호랑이", ["호랑이", "토끼", "곰", "여우"]),
      q("rabbit", "토끼", ["사자", "토끼", "말", "개"]),
      q("elephant", "코끼리", ["코끼리", "기린", "원숭이", "펭귄"]),
      q("dolphin", "돌고래", ["상어", "고래", "돌고래", "거북이"]),
      q("penguin", "펭귄", ["독수리", "펭귄", "참새", "닭"]),
    ],
  },
  {
    id: "game_school_words",
    name: "학교 물건 영단어",
    mode: "choice",
    updatedAt: 0,
    questions: [
      q("pencil", "연필", ["연필", "지우개", "가위", "풀"]),
      q("eraser", "지우개", ["책", "지우개", "공책", "자"]),
      q("desk", "책상", ["의자", "책상", "칠판", "창문"]),
      q("chair", "의자", ["문", "의자", "가방", "시계"]),
      q("book", "책", ["책", "공책", "종이", "연필"]),
    ],
  },
  {
    id: "game_colors",
    name: "색깔 영단어",
    mode: "choice",
    updatedAt: 0,
    questions: [
      q("red", "빨강", ["빨강", "파랑", "초록", "노랑"]),
      q("blue", "파랑", ["보라", "파랑", "주황", "검정"]),
      q("green", "초록", ["초록", "분홍", "하양", "회색"]),
      q("yellow", "노랑", ["갈색", "노랑", "빨강", "파랑"]),
      q("black", "검정", ["하양", "검정", "회색", "초록"]),
    ],
  },
  {
    id: "game_fruits",
    name: "과일 영단어",
    mode: "choice",
    updatedAt: 0,
    questions: [
      q("apple", "사과", ["사과", "포도", "딸기", "오렌지"]),
      q("banana", "바나나", ["바나나", "수박", "복숭아", "배"]),
      q("grape", "포도", ["귤", "포도", "자두", "감"]),
      q("strawberry", "딸기", ["딸기", "체리", "블루베리", "레몬"]),
      q("orange", "오렌지", ["사과", "오렌지", "키위", "망고"]),
    ],
  },
  {
    id: "game_days",
    name: "요일 영단어",
    mode: "choice",
    updatedAt: 0,
    questions: [
      q("Monday", "월요일", ["월요일", "화요일", "수요일", "목요일"]),
      q("Tuesday", "화요일", ["금요일", "화요일", "토요일", "일요일"]),
      q("Wednesday", "수요일", ["월요일", "수요일", "목요일", "금요일"]),
      q("Thursday", "목요일", ["화요일", "목요일", "토요일", "일요일"]),
      q("Friday", "금요일", ["수요일", "금요일", "토요일", "월요일"]),
    ],
  },
  {
    id: "game_word_spell",
    name: "영단어 스펠링 챌린지",
    mode: "spell",
    updatedAt: 0,
    questions: [
      q("사과", "apple"),
      q("바나나", "banana"),
      q("학교", "school"),
      q("친구", "friend"),
      q("물", "water"),
    ],
  },
  {
    id: "game_animal_spell",
    name: "동물 스펠링",
    mode: "spell",
    updatedAt: 0,
    questions: [
      q("호랑이", "tiger"),
      q("토끼", "rabbit"),
      q("코끼리", "elephant"),
      q("돌고래", "dolphin"),
      q("펭귄", "penguin"),
    ],
  },
  {
    id: "game_color_spell",
    name: "색깔 스펠링",
    mode: "spell",
    updatedAt: 0,
    questions: [
      q("빨강", "red"),
      q("파랑", "blue"),
      q("초록", "green"),
      q("노랑", "yellow"),
      q("검정", "black"),
    ],
  },
  {
    id: "game_capitals",
    name: "세계 수도 퀴즈",
    mode: "choice",
    updatedAt: 0,
    questions: [
      q("대한민국의 수도는?", "서울", ["서울", "부산", "도쿄", "베이징"]),
      q("일본의 수도는?", "도쿄", ["오사카", "도쿄", "교토", "삿포로"]),
      q("프랑스의 수도는?", "파리", ["런던", "파리", "로마", "베를린"]),
      q("영국의 수도는?", "런던", ["더블린", "런던", "에든버러", "맨체스터"]),
      q("이탈리아의 수도는?", "로마", ["밀라노", "로마", "베네치아", "나폴리"]),
    ],
  },
  {
    id: "game_connect_words",
    name: "영단어 뜻 연결",
    mode: "connect",
    updatedAt: 0,
    questions: [
      pairQuestion("영단어와 뜻을 연결하세요", [
        ["apple", "사과"],
        ["school", "학교"],
        ["friend", "친구"],
        ["water", "물"],
      ]),
      pairQuestion("동물 영단어와 뜻을 연결하세요", [
        ["tiger", "호랑이"],
        ["rabbit", "토끼"],
        ["penguin", "펭귄"],
        ["dolphin", "돌고래"],
      ]),
      pairQuestion("색깔 영단어와 뜻을 연결하세요", [
        ["red", "빨강"],
        ["blue", "파랑"],
        ["green", "초록"],
        ["yellow", "노랑"],
      ]),
    ],
  },
  {
    id: "game_connect_fruit",
    name: "과일 뜻 연결",
    mode: "connect",
    updatedAt: 0,
    questions: [
      pairQuestion("과일 영단어와 뜻을 연결하세요", [
        ["grape", "포도"],
        ["strawberry", "딸기"],
        ["orange", "오렌지"],
        ["peach", "복숭아"],
      ]),
    ],
  },
  {
    id: "game_five_choice",
    name: "5지선다 상식 퀴즈",
    mode: "choice",
    updatedAt: 0,
    questions: [
      q("태양계에서 가장 큰 행성은?", "목성", ["지구", "화성", "목성", "토성", "금성"]),
      q("대한민국에서 가장 긴 강은?", "낙동강", ["한강", "낙동강", "금강", "영산강", "섬진강"]),
      q("물의 화학식은?", "H2O", ["CO2", "O2", "H2O", "NaCl", "CH4"]),
      q("1년은 몇 개월인가요?", "12개월", ["10개월", "11개월", "12개월", "13개월", "24개월"]),
    ],
  },
  {
    id: "game_ox",
    name: "OX 상식 퀴즈",
    mode: "ox",
    updatedAt: 0,
    questions: [
      q("지구는 태양 주위를 돈다.", "O"),
      q("물은 0℃에서 끓는다.", "X"),
      q("대한민국의 수도는 서울이다.", "O"),
      q("1년은 12개월이다.", "O"),
      q("빛은 소리보다 느리다.", "X"),
    ],
  },
  {
    id: "game_science_ox",
    name: "과학 OX",
    mode: "ox",
    updatedAt: 0,
    questions: [
      q("지구는 태양 주위를 돈다.", "O"),
      q("물은 100℃에서 끓는다.", "O"),
      q("달은 스스로 빛을 낸다.", "X"),
      q("식물은 광합성으로 산소를 만든다.", "O"),
      q("소리는 진공에서도 전달된다.", "X"),
    ],
  },
  {
    id: "game_korean_ox",
    name: "한국사 OX",
    mode: "ox",
    updatedAt: 0,
    questions: [
      q("훈민정음은 세종대왕이 만들었다.", "O"),
      q("고구려를 세운 인물은 왕건이다.", "X"),
      q("조선의 수도는 한양이었다.", "O"),
      q("임진왜란은 1592년에 일어났다.", "O"),
      q("신라의 마지막 왕은 세종이다.", "X"),
    ],
  },
  {
    id: "game_blank",
    name: "빈칸 채우기",
    mode: "spell",
    updatedAt: 0,
    questions: [
      q("대한민국의 수도는?", "서울"),
      q("1 + 1 = ?", "2"),
      q("태양계에서 가장 큰 행성은?", "목성"),
      q("물의 화학식은?", "H2O"),
    ],
  },
  {
    id: "game_math",
    name: "수학 계산",
    mode: "spell",
    updatedAt: 0,
    questions: [
      q("7 × 8 = ?", "56"),
      q("45 ÷ 9 = ?", "5"),
      q("12 + 29 = ?", "41"),
      q("100 - 37 = ?", "63"),
      q("6 × 9 = ?", "54"),
    ],
  },
  {
    id: "game_proverbs",
    name: "속담 빈칸 채우기",
    mode: "spell",
    updatedAt: 0,
    questions: [
      q("가는 말이 고와야 ___ 말이 곱다", "오는"),
      q("티끌 모아 ___", "태산"),
      q("낮말은 새가 듣고 ___ 말은 쥐가 듣는다", "밤"),
      q("로마에 가면 ___ 법을 따르라", "로마"),
      q("시작이 ___", "반"),
    ],
  },
];

function cloneBuiltIns(): GameSet[] {
  return BUILT_INS.map((set) => ({
    ...set,
    questions: set.questions.map((item) => ({
      ...item,
      options: [...item.options],
      pairs: item.pairs.map((pair) => ({ ...pair })),
    })),
  }));
}

/** Keep newly added built-in games visible even when old sets are in localStorage. */
function withBuiltIns(saved: GameSet[]): GameSet[] {
  const known = new Set(saved.map((set) => set.id));
  return [...saved, ...cloneBuiltIns().filter((set) => !known.has(set.id))];
}

function normalizeQuestion(value: unknown): GameQuestion | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const prompt = typeof record.prompt === "string" ? record.prompt.trim().slice(0, 300) : "";
  if (!prompt) return null;
  const options = Array.isArray(record.options)
    ? record.options.map((option) => String(option).trim().slice(0, 120)).filter(Boolean).slice(0, 6)
    : [];
  const pairs = Array.isArray(record.pairs)
    ? record.pairs
        .map((pair) => {
          if (!pair || typeof pair !== "object") return null;
          const entry = pair as Record<string, unknown>;
          const left = typeof entry.left === "string" ? entry.left.trim().slice(0, 60) : "";
          const right = typeof entry.right === "string" ? entry.right.trim().slice(0, 60) : "";
          return left && right ? { left, right } : null;
        })
        .filter((pair): pair is GamePair => pair !== null)
        .slice(0, 8)
    : [];
  return {
    id: typeof record.id === "string" && record.id ? record.id : id("q"),
    prompt,
    options,
    answer: typeof record.answer === "string" ? record.answer.trim().slice(0, 120) : "",
    pairs,
  };
}

function normalizeSet(value: unknown): GameSet | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim().slice(0, 80) : "";
  if (!name) return null;
  const mode: QuizMode =
    record.mode === "spell"
      ? "spell"
      : record.mode === "ox"
        ? "ox"
        : record.mode === "connect"
          ? "connect"
          : "choice";
  const questions = Array.isArray(record.questions)
    ? record.questions.map(normalizeQuestion).filter((item): item is GameQuestion => item !== null)
    : [];
  if (!questions.length) return null;
  return {
    id: typeof record.id === "string" && record.id ? record.id : id("game"),
    name,
    mode,
    questions,
    updatedAt: Number.isFinite(record.updatedAt) ? Number(record.updatedAt) : Date.now(),
  };
}

export function loadGameSets(): GameSet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneBuiltIns();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("invalid");
    const sets = parsed.map(normalizeSet).filter((set): set is GameSet => set !== null);
    return sets.length ? withBuiltIns(sets) : cloneBuiltIns();
  } catch {
    return cloneBuiltIns();
  }
}

export function saveGameSets(sets: GameSet[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(sets.map((set) => ({ ...set, updatedAt: Date.now() }))),
  );
}

export function exportGameSets(sets: GameSet[]): string {
  return JSON.stringify(
    { app: "AIC", kind: "game-sets", version: 1, exportedAt: new Date().toISOString(), sets },
    null,
    2,
  );
}

export function parseGameSets(text: string): GameSet[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON 파일을 읽지 못했습니다.");
  }
  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { sets?: unknown }).sets)
      ? (parsed as { sets: unknown[] }).sets
      : [parsed];
  const sets = entries
    .map(normalizeSet)
    .filter((set): set is GameSet => set !== null)
    .map((set) => ({ ...set, id: id("game"), updatedAt: Date.now() }));
  if (!sets.length) throw new Error("가져올 게임 세트를 찾지 못했습니다.");
  return sets;
}
