import type { GameMode, QuizMode } from "./protocol";

/**
 * 게임 탭의 게임 목록. 띵커벨형 8종 + 일반전/아이템전.
 *
 * - `quiz`: 문제를 내는 방식(객관식·OX·주관식·짝 연결)
 * - `play`: 학생 화면에서 답을 만드는 방식(그냥 선택 / 글자 조립 / 순서 배열 / 운석)
 * - `mini`: 미니게임 탭의 엔진을 그대로 여는 경우
 */
export type QuizPlay = "plain" | "scatter" | "order" | "meteor";

export interface GameCatalogEntry {
  id: string;
  name: string;
  tagline: string;
  how: string;
  emoji: string;
  quiz: QuizMode;
  play: QuizPlay;
  /** 미니게임 탭 엔진을 열어야 하는 경우의 엔진 이름. */
  mini?: "wordsearch" | "memory";
  /** 점수 방식(일반전/아이템전). */
  mode: GameMode;
  tone: "brand" | "amber" | "emerald" | "sky" | "rose" | "violet";
}

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: "wordsearch",
    name: "가로세로 단어찾기",
    tagline: "격자에 숨은 낱말 찾기",
    how: "시작 글자부터 끝 글자까지 이어 선택하면 낱말이 표시됩니다.",
    emoji: "🔎",
    quiz: "spell",
    play: "plain",
    mini: "wordsearch",
    mode: "classic",
    tone: "brand",
  },
  {
    id: "scatter",
    name: "흩어진 단어 찾기",
    tagline: "글자를 순서대로 골라 완성",
    how: "흩어진 글자 타일을 차례대로 눌러 정답 낱말을 만듭니다.",
    emoji: "🔤",
    quiz: "spell",
    play: "scatter",
    mode: "classic",
    tone: "sky",
  },
  {
    id: "memory",
    name: "카드 짝 맞추기",
    tagline: "연관된 두 카드 찾기",
    how: "카드 두 장을 뒤집어 짝이 맞으면 그대로 공개됩니다.",
    emoji: "🃏",
    quiz: "spell",
    play: "plain",
    mini: "memory",
    mode: "classic",
    tone: "violet",
  },
  {
    id: "wordorder",
    name: "단어 순서 맞히기",
    tagline: "섞인 단어를 바르게 배열",
    how: "단어 타일을 눌러 순서를 만들고 제출합니다.",
    emoji: "🧩",
    quiz: "spell",
    play: "order",
    mode: "classic",
    tone: "amber",
  },
  {
    id: "sentenceorder",
    name: "문장 순서 맞히기",
    tagline: "문장 조각을 이어 붙이기",
    how: "문장 조각을 순서대로 놓아 완성된 문장을 만듭니다.",
    emoji: "📝",
    quiz: "spell",
    play: "order",
    mode: "classic",
    tone: "emerald",
  },
  {
    id: "blank",
    name: "빈칸 퀴즈쇼",
    tagline: "빈칸의 답을 맞히기",
    how: "빈칸에 답을 입력하거나 보기에서 고릅니다.",
    emoji: "❓",
    quiz: "choice",
    play: "plain",
    mode: "classic",
    tone: "rose",
  },
  {
    id: "meteor",
    name: "운석 터트리기",
    tagline: "정답으로 운석을 격추",
    how: "떨어지는 운석의 문제를 맞히면 운석이 터집니다.",
    emoji: "☄️",
    quiz: "choice",
    play: "meteor",
    mode: "classic",
    tone: "rose",
  },
  {
    id: "ox",
    name: "OX 퀴즈",
    tagline: "참인가요, 거짓인가요",
    how: "문제를 보고 O 또는 X를 누릅니다.",
    emoji: "⭕",
    quiz: "ox",
    play: "plain",
    mode: "classic",
    tone: "emerald",
  },
  {
    id: "item",
    name: "아이템전",
    tagline: "방해 아이템으로 뒤집기",
    how: "더블·+점은 내 이득, 훔치기는 상대 방해 아이템입니다.",
    emoji: "🎁",
    quiz: "choice",
    play: "plain",
    mode: "item",
    tone: "violet",
  },
  {
    id: "classic",
    name: "일반전",
    tagline: "정직하게 점수 쌓기",
    how: "아이템 없이 정답과 속도로만 겨룹니다.",
    emoji: "🏁",
    quiz: "choice",
    play: "plain",
    mode: "classic",
    tone: "brand",
  },
];

export function findGame(id: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((entry) => entry.id === id);
}

export const PLAY_HINT: Record<QuizPlay, string> = {
  plain: "학생 화면에서 바로 답을 고릅니다.",
  scatter: "흩어진 글자를 순서대로 눌러 낱말을 만듭니다.",
  order: "섞인 타일을 눌러 순서를 맞춥니다.",
  meteor: "운석이 떨어지기 전에 정답을 고릅니다.",
};
