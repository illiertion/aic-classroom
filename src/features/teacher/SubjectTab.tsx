import { useEffect, useRef, useState } from "react";
import type { ClientMessage, LiveQuiz, QuizMode, StudentLive } from "../../../shared/protocol";
import type { ClassSettings } from "../../../shared/settings";
import { Badge, Button, Callout, Card, CardHeader, EmptyState, cx } from "../../components/ui";
import { IconCheck, IconPlay, IconSparkles } from "../../components/Icons";

interface Question {
  prompt: string;
  mode: QuizMode;
  options?: string[];
  answer?: string;
  pairs?: { left: string; right: string }[];
}

interface Drill {
  id: string;
  label: string;
  hint: string;
  count: number;
  build: () => Question[];
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const shuffle = <T,>(list: T[]): T[] => {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};
const unique = (values: number[]): number[] => [...new Set(values)];

/* ------------------------------- 문제 생성 ------------------------------- */

function mathDrills(): Drill[] {
  const makeAdd = (): Question => {
    const a = 2 + Math.floor(Math.random() * 48);
    const b = 2 + Math.floor(Math.random() * 48);
    const answer = String(a + b);
    const options = unique([a + b, a + b + 10, Math.abs(a - b), a + b - 1]).map(String);
    return { prompt: `${a} + ${b} = ?`, mode: "choice", options: shuffle(options), answer };
  };
  const makeMul = (): Question => {
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    const answer = String(a * b);
    const options = unique([a * b, a * b + a, a * b - b, a * (b + 1)]).map(String);
    return { prompt: `${a} × ${b} = ?`, mode: "choice", options: shuffle(options), answer };
  };
  const makeSub = (): Question => {
    const a = 20 + Math.floor(Math.random() * 60);
    const b = 2 + Math.floor(Math.random() * (a - 2));
    const answer = String(a - b);
    const options = unique([a - b, a - b + 2, a - b - 1, a + b]).map(String);
    return { prompt: `${a} − ${b} = ?`, mode: "choice", options: shuffle(options), answer };
  };
  return [
    { id: "add", label: "덧셈 5문제", hint: "두 자리 덧셈을 연속으로 냅니다.", count: 5, build: () => Array.from({ length: 5 }, makeAdd) },
    { id: "sub", label: "뺄셈 5문제", hint: "받아내림이 있는 뺄셈", count: 5, build: () => Array.from({ length: 5 }, makeSub) },
    { id: "mul", label: "구구단 5문제", hint: "곱셈구구 확인", count: 5, build: () => Array.from({ length: 5 }, makeMul) },
  ];
}

const WORDS: { en: string; ko: string }[] = [
  { en: "apple", ko: "사과" },
  { en: "water", ko: "물" },
  { en: "school", ko: "학교" },
  { en: "friend", ko: "친구" },
  { en: "teacher", ko: "선생님" },
  { en: "pencil", ko: "연필" },
  { en: "window", ko: "창문" },
  { en: "market", ko: "시장" },
  { en: "mountain", ko: "산" },
  { en: "weather", ko: "날씨" },
];

function englishDrills(): Drill[] {
  const spelling = (): Question => {
    const word = pick(WORDS);
    return { prompt: `‘${word.ko}’를 영어로 쓰세요.`, mode: "spell", answer: word.en };
  };
  const meaning = (): Question => {
    const target = pick(WORDS);
    const distractors = shuffle(WORDS.filter((word) => word.en !== target.en))
      .slice(0, 3)
      .map((word) => word.ko);
    return {
      prompt: `‘${target.en}’의 뜻은?`,
      mode: "choice",
      options: shuffle([...new Set([target.ko, ...distractors])]),
      answer: target.ko,
    };
  };
  const connect = (): Question => {
    const chosen = shuffle(WORDS).slice(0, 4);
    return {
      prompt: "영단어와 뜻을 연결하세요.",
      mode: "connect",
      pairs: chosen.map((word) => ({ left: word.en, right: word.ko })),
    };
  };
  return [
    { id: "spell", label: "단어 쓰기 5문제", hint: "뜻을 보고 철자를 입력합니다.", count: 5, build: () => Array.from({ length: 5 }, spelling) },
    { id: "meaning", label: "뜻 고르기 5문제", hint: "4지선다 뜻 확인", count: 5, build: () => Array.from({ length: 5 }, meaning) },
    { id: "connect", label: "뜻 연결 4쌍", hint: "짝을 이어 붙이는 문제", count: 1, build: () => [connect()] },
  ];
}

const KOREAN: { word: string; hint: string; meaning: string }[] = [
  { word: "민들레", hint: "ㄷㅇㄹ", meaning: "봄에 피는 노란 꽃" },
  { word: "가을", hint: "ㄱㅇ", meaning: "단풍이 드는 계절" },
  { word: "우체국", hint: "ㅇㅊㄱ", meaning: "편지를 보내는 곳" },
  { word: "겨울잠", hint: "ㄱㅇㅈ", meaning: "동물이 겨울에 자는 잠" },
  { word: "무지개", hint: "ㅁㅈㄱ", meaning: "비 온 뒤 하늘에 뜨는 것" },
  { word: "도서관", hint: "ㄷㅅㄱ", meaning: "책을 읽는 곳" },
];

function koreanDrills(): Drill[] {
  const dictation = (): Question => {
    const item = pick(KOREAN);
    return { prompt: `뜻: ${item.meaning}. 이 낱말은?`, mode: "spell", answer: item.word };
  };
  const meaningChoice = (): Question => {
    const target = pick(KOREAN);
    const others = shuffle(KOREAN.filter((entry) => entry.word !== target.word))
      .slice(0, 3)
      .map((entry) => entry.meaning);
    return {
      prompt: `‘${target.word}’의 뜻으로 알맞은 것은?`,
      mode: "choice",
      options: shuffle([target.meaning, ...others]),
      answer: target.meaning,
    };
  };
  return [
    { id: "dictation", label: "받아쓰기 5문제", hint: "뜻을 보고 낱말을 씁니다.", count: 5, build: () => Array.from({ length: 5 }, dictation) },
    { id: "meaning", label: "낱말 뜻 5문제", hint: "낱말의 뜻을 고릅니다.", count: 5, build: () => Array.from({ length: 5 }, meaningChoice) },
  ];
}

const SCIENCE: { prompt: string; answer: "O" | "X"; note: string }[] = [
  { prompt: "물은 100℃에서 끓는다.", answer: "O", note: "1기압 기준" },
  { prompt: "지구는 태양 주위를 돈다.", answer: "O", note: "" },
  { prompt: "소리는 진공에서도 전달된다.", answer: "X", note: "매질 필요" },
  { prompt: "식물은 밤에만 산소를 만든다.", answer: "X", note: "낮에 광합성" },
  { prompt: "달은 스스로 빛을 낸다.", answer: "X", note: "반사" },
  { prompt: "얼음은 물보다 밀도가 크다.", answer: "X", note: "물이 더 큼" },
];

function scienceDrills(): Drill[] {
  return [
    {
      id: "ox",
      label: "OX 6문제",
      hint: "핵심 개념을 O/X로 확인합니다.",
      count: 6,
      build: () =>
        shuffle(SCIENCE).map((item) => ({
          prompt: item.prompt,
          mode: "ox" as QuizMode,
          answer: item.answer,
        })),
    },
  ];
}

function drillsFor(subject: string): Drill[] {
  if (subject.includes("수학")) return mathDrills();
  if (subject.includes("영어")) return englishDrills();
  if (subject.includes("국어")) return koreanDrills();
  if (subject.includes("과학") || subject.includes("사회")) return scienceDrills();
  return [...englishDrills().slice(0, 1), ...koreanDrills().slice(0, 1), ...mathDrills().slice(0, 1)];
}

interface Props {
  subject: string;
  quiz: LiveQuiz | null;
  students: StudentLive[];
  settings: ClassSettings;
  send: (message: ClientMessage) => void;
  connected: boolean;
}

/**
 * 과목별 빠른 문제 탭. 수업 과목에 맞는 문제 묶음을 만들어 바로 내고,
 * 선생님이 문제를 닫으면 다음 문제로 자동으로 넘깁니다.
 */
export function SubjectTab({ subject, quiz, students, settings, send, connected }: Props) {
  const drills = drillsFor(subject);
  const [queue, setQueue] = useState<Question[]>([]);
  const [drillLabel, setDrillLabel] = useState("");
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const start = (drill: Drill) => {
    if (!connected) {
      setError("실시간 연결이 끊겨 있어 지금은 문제를 낼 수 없습니다.");
      return;
    }
    const questions = drill.build();
    if (!questions.length) return;
    setError(null);
    setQueue(questions);
    setDrillLabel(drill.label);
    sentRef.current = null;
    sendQuestion(questions[0], 0, questions.length);
  };

  const sendQuestion = (question: Question, index: number, total: number) => {
    sentRef.current = question.prompt;
    send({
      type: "quiz_start",
      prompt: question.prompt,
      mode: question.mode,
      options: question.options,
      answer: question.answer,
      pairs: question.pairs,
      durationSec: settings.quizSeconds > 0 ? settings.quizSeconds : undefined,
      gameMode: "classic",
      round: index + 1,
      totalRounds: total,
    });
  };

  // 선생님이 문제를 닫으면 다음 문제로 넘어갑니다(자동 넘기기).
  const closedId = quiz && quiz.status === "closed" ? quiz.id : null;
  useEffect(() => {
    if (!auto || !queue.length) return;
    if (!closedId) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setQueue((current) => {
        if (!current.length) return current;
        const answeredCount = quiz?.round ?? 0;
        if (answeredCount >= current.length) return [];
        sendQuestion(current[answeredCount], answeredCount, current.length);
        return current;
      });
    }, 1500);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, closedId, queue.length]);

  const stop = () => {
    setQueue([]);
    setDrillLabel("");
  };

  const currentIndex = quiz ? Math.max(0, quiz.round - 1) : 0;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <CardHeader
          title={`${subject || "공통"} 빠른 문제`}
          description="과목에 맞는 문제를 묶음으로 만들어 연속으로 냅니다. 점수는 수업 설정의 점수 규칙을 따릅니다."
          action={
            <div className="flex items-center gap-2">
              <Badge tone={auto ? "ok" : "neutral"}>{auto ? "자동 넘기기" : "직접 넘기기"}</Badge>
              <Button size="sm" variant={auto ? "secondary" : "ghost"} onClick={() => setAuto((value) => !value)}>
                {auto ? "자동 끄기" : "자동 켜기"}
              </Button>
            </div>
          }
        />
        {error ? <Callout tone="danger" className="mt-3">{error}</Callout> : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {drills.map((drill) => (
            <button
              key={drill.id}
              type="button"
              disabled={!connected}
              onClick={() => start(drill)}
              className={cx(
                "flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition",
                "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50",
              )}
            >
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
                <IconPlay size={13} className="text-brand-600" /> {drill.label}
              </span>
              <span className="text-[11.5px] text-slate-500">{drill.hint}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <CardHeader
          title="진행 중인 묶음"
          description={drillLabel ? `${drillLabel} · ${queue.length}문제` : "아직 시작하지 않았습니다."}
          action={
            queue.length ? (
              <Button size="sm" variant="secondary" onClick={stop}>
                묶음 끝내기
              </Button>
            ) : null
          }
        />
        {queue.length ? (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
              <Badge tone="brand">
                {Math.min(currentIndex + 1, queue.length)} / {queue.length}
              </Badge>
              <span className="truncate">{queue[currentIndex]?.prompt ?? "다음 문제를 준비 중입니다."}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${((currentIndex + (quiz?.status === "closed" ? 1 : 0)) / queue.length) * 100}%` }}
              />
            </div>
            <p className="text-[11.5px] leading-relaxed text-slate-400">
              학생 {students.filter((student) => student.online).length}명 접속 중 ·{" "}
              {quiz?.status === "open" ? `응답 ${quiz.answerCount}명` : "다음 문제를 기다리는 중"}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={<IconSparkles size={20} />}
            title="문제 묶음을 골라 주세요"
            description="위에서 과목 문제를 고르면 학생 화면에 바로 뜹니다. 자동 넘기기를 켜 두면 닫을 때마다 다음 문제가 나갑니다."
            className="mt-4"
          />
        )}
      </Card>

      <Callout tone="info" icon={<IconCheck size={15} />}>
        문제를 하나만 내고 싶다면 <strong>게임·미니게임</strong> 탭에서 세트를 고르거나,{" "}
        <strong>학습지·문제</strong> 탭에서 문항을 만들 수 있습니다.
      </Callout>
    </div>
  );
}
