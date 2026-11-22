/**
 * Hangul helpers shared by the Worker and the React client.
 *
 * The 초성 퀴즈 only ever sends the consonant prompt to students, so this file
 * must stay free of DOM and Worker APIs.
 */

const CHOSEONG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 21 중성 × 28 종성 */
const SYLLABLE_STRIDE = 588;

/** "사과" → "ㅅㄱ". Non-Hangul characters are kept as they are. */
export function toChosung(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      out += CHOSEONG[Math.floor((code - HANGUL_BASE) / SYLLABLE_STRIDE)] ?? char;
    } else {
      out += char;
    }
  }
  return out;
}

/** Number of Hangul syllables in the word, used for the "(3글자)" hint. */
export function hangulLength(value: string): number {
  let count = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) count += 1;
  }
  return count;
}

/** Prompt shown to the class, for example "ㅅㄱ (2글자)". */
export function jamoPrompt(answer: string): string {
  const consonants = toChosung(answer.trim());
  const length = hangulLength(answer);
  return length > 0 ? `${consonants} (${length}글자)` : consonants;
}

/** Loose comparison used for typed answers (case, spaces, punctuation). */
export function normalizeWord(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s.,!?'"`~()[\]{}]/g, "");
}
