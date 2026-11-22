import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ClientMessage,
  GameMode,
  GameState,
  LiveQuiz,
  QuizMode,
  QuizResults,
} from "../../../shared/protocol";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  cx,
} from "../../components/ui";
import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconFileText,
  IconMonitor,
  IconPlus,
  IconRefresh,
  IconSparkles,
  IconTrophy,
  IconX,
} from "../../components/Icons";
import { GameProjector } from "./GameProjector";
import { downloadText } from "../../lib/boardStore";
import { jamoPrompt } from "../../../shared/hangul";
import {
  exportGameSets,
  loadGameSets,
  newGameQuestion,
  newGameSet,
  parseGameSets,
  saveGameSets,
  type GameQuestion,
  type GameSet,
} from "../../lib/gameStore";

const MODE_LABEL: Record<QuizMode, string> = {
  choice: "객관식",
  ox: "OX",
  spell: "스펠링·주관식",
  connect: "뜻 연결",
};

function optionsFor(mode: QuizMode, question: GameQuestion): string[] {
  if (mode === "ox") return ["O", "X"];
  if (mode === "spell" || mode === "connect") return [];
  return question.options.map((option) => option.trim()).filter(Boolean).slice(0, 6);
}

function sameAnswer(left: string, right: string): boolean {
  return left.trim().toLowerCase().replace(/\s+/g, " ") === right.trim().toLowerCase().replace(/\s+/g, " ");
}

const GAME_MODES: { id: GameMode; label: string; hint: string }[] = [
  { id: "classic", label: "일반전", hint: "정답 100점" },
  { id: "speed", label: "스피드전", hint: "빠를수록 최대 200점" },
  { id: "goldenbell", label: "골든벨", hint: "한 번 틀리면 탈락" },
  { id: "team", label: "팀전", hint: "모둠 점수 합산" },
  { id: "item", label: "아이템전", hint: "정답마다 아이템 획득" },
];

const TIMERS = [0, 20, 30, 60];

export function GameTab({
  quiz,
  results,
  game,
  send,
  connected,
  studentCount,
  joinCode,
}: {
  quiz: LiveQuiz | null;
  results: QuizResults | null;
  game: GameState;
  send: (message: ClientMessage) => void;
  connected: boolean;
  studentCount: number;
  joinCode: string;
}) {
  const [sets, setSets] = useState<GameSet[]>(() => loadGameSets());
  const [selectedId, setSelectedId] = useState(() => loadGameSets()[0]?.id ?? "");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [projector, setProjector] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = sets.find((set) => set.id === selectedId) ?? sets[0] ?? null;
  const question = selected?.questions[questionIndex] ?? null;

  useEffect(() => {
    try {
      saveGameSets(sets);
    } catch {
      setError("게임 세트를 이 컴퓨터에 저장하지 못했습니다.");
    }
  }, [sets]);

  useEffect(() => {
    setQuestionIndex(0);
  }, [selectedId]);

  useEffect(() => {
    if (!quiz?.endsAt) return;
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(tick);
  }, [quiz?.endsAt]);

  const updateSet = (patch: Partial<GameSet>) => {
    if (!selected) return;
    setSets((current) =>
      current.map((set) =>
        set.id === selected.id ? { ...set, ...patch, updatedAt: Date.now() } : set,
      ),
    );
  };

  const updateQuestion = (patch: Partial<GameQuestion>) => {
    if (!selected || !question) return;
    updateSet({
      questions: selected.questions.map((item) =>
        item.id === question.id ? { ...item, ...patch } : item,
      ),
    });
  };

  const changeMode = (mode: QuizMode) => {
    if (!selected) return;
    setError(null);
    updateSet({
      mode,
      questions: selected.questions.map((item) => {
        const answer = item.answer.trim();
        return {
          ...item,
          options:
            mode === "ox"
              ? ["O", "X"]
              : mode === "spell" || mode === "connect"
                ? []
                : item.options.length
                  ? item.options
                  : ["", "", "", ""],
          // Switching to OX with an old word answer would silently disable scoring.
          answer: mode === "ox" ? (/^[ox]$/i.test(answer) ? answer.toUpperCase() : "O") : mode === "connect" ? "" : answer,
          pairs: mode === "connect" && item.pairs.length === 0 ? [{ left: "", right: "" }, { left: "", right: "" }] : item.pairs,
        };
      }),
    });
  };

  const addQuestion = () => {
    if (!selected) return;
    const next = newGameQuestion();
    updateSet({
      questions: [
        ...selected.questions,
        {
          ...next,
          options: selected.mode === "ox" ? ["O", "X"] : next.options,
          answer: selected.mode === "ox" ? "O" : next.answer,
          pairs: selected.mode === "connect" ? [{ left: "", right: "" }, { left: "", right: "" }] : [],
        },
      ],
    });
    setQuestionIndex(selected.questions.length);
  };

  const resizeOptions = (count: number) => {
    if (!question) return;
    const next = [...question.options];
    while (next.length < count) next.push("");
    const trimmed = next.slice(0, count);
    const answerStillThere = trimmed.some((option) => sameAnswer(option, question.answer));
    updateQuestion({ options: trimmed, answer: answerStillThere ? question.answer : "" });
  };

  const removeQuestion = () => {
    if (!selected || selected.questions.length <= 1) return;
    updateSet({ questions: selected.questions.filter((item) => item.id !== question?.id) });
    setQuestionIndex(Math.max(0, questionIndex - 1));
  };

  const startQuestion = () => {
    if (!selected || !question || !connected) return;
    if (!question.prompt.trim()) {
      setError("문제를 입력해 주세요.");
      return;
    }
    const options = optionsFor(selected.mode, question);
    if (selected.mode === "choice" && options.length < 2) {
      setError("객관식은 선택지가 2개 이상 필요합니다.");
      return;
    }
    if (selected.mode === "spell" && !question.answer.trim()) {
      setError("주관식은 정답을 입력해 주세요.");
      return;
    }
    const pairs = question.pairs
      .map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() }))
      .filter((pair) => pair.left && pair.right);
    if (selected.mode === "connect" && pairs.length < 2) {
      setError("뜻 연결은 짝이 2개 이상 필요합니다.");
      return;
    }
    let answer = question.answer.trim();
    if (selected.mode === "ox") {
      answer = answer.toUpperCase();
      if (answer !== "O" && answer !== "X") {
        setError("OX 정답은 O 또는 X로 입력해 주세요.");
        return;
      }
    }
    if (selected.mode === "choice" && !options.some((option) => sameAnswer(option, answer))) {
      setError("정답이 선택지 중 하나와 같아야 채점할 수 있습니다. 정답 선택지를 눌러 주세요.");
      return;
    }
    setError(null);
    send({
      type: "quiz_start",
      prompt: question.prompt.trim(),
      mode: selected.mode,
      options,
      answer: selected.mode === "connect" ? undefined : answer,
      pairs: selected.mode === "connect" ? pairs : undefined,
      gameMode,
      round: questionIndex + 1,
      totalRounds: selected.questions.length,
      durationSec: durationSec || undefined,
    });
  };

  const answerLabel = (optionId: string) =>
    quiz?.options.find((option) => option.id === optionId)?.label ?? optionId;

  const responseLabel = (response: QuizResults["responses"][number]): string => {
    if (quiz?.mode === "connect") {
      if (!response.text) return "—";
      try {
        const mapping = JSON.parse(response.text) as Record<string, string>;
        return Object.entries(mapping)
          .map(([left, right]) => `${left}=${right}`)
          .join(", ")
          .slice(0, 60);
      } catch {
        return "—";
      }
    }
    return quiz?.mode === "spell" ? (response.text ?? "") : answerLabel(response.optionId);
  };

  const answeredStudents = useMemo(() => results?.responses ?? [], [results]);

  const quizRemaining = quiz?.endsAt
    ? Math.max(0, Math.min((quiz.durationSec ?? 0) * 1000, quiz.endsAt - now))
    : null;

  const exportResults = () => {
    const header = ["순위", "이름", "모둠", "점수", "정답", "오답", "상태"];
    const lines = [header.join(",")];
    game.scores.forEach((score, index) => {
      const row = [
        index + 1,
        score.name,
        score.team ?? "",
        score.points,
        score.correct,
        score.wrong,
        score.alive ? "생존" : "탈락",
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    });
    downloadText("aic-game-results.csv", `\ufeff${lines.join("\n")}`);
  };

  const importSets = async (file: File) => {
    try {
      const imported = parseGameSets(await file.text());
      setSets((current) => [...imported, ...current]);
      setSelectedId(imported[0]?.id ?? selectedId);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "게임 세트를 가져오지 못했습니다.");
    }
  };

  return (
    <>
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="게임 세트"
              description="띵커벨형 게임을 내 컴퓨터에 저장해 두고 수업에서 바로 엽니다. 세트는 서버에 올라가지 않습니다."
              action={<Badge tone="neutral">{sets.length}개</Badge>}
            />
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const created = newGameSet();
                setSets((current) => [created, ...current]);
                setSelectedId(created.id);
                setError(null);
              }}
            >
              <IconPlus size={14} /> 새 세트
            </Button>
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <IconFileText size={14} /> JSON 가져오기
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadText("aic-games.json", exportGameSets(sets))}
            >
              내보내기
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importSets(file);
                event.target.value = "";
              }}
            />
          </div>
          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            {sets.map((set) => (
              <button
                key={set.id}
                onClick={() => {
                  setSelectedId(set.id);
                  setError(null);
                }}
                className={cx(
                  "flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition hover:bg-slate-50",
                  selected?.id === set.id && "bg-brand-50/50",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-slate-800">
                    {set.name}
                  </span>
                  <span className="text-[10.5px] text-slate-400">
                    {MODE_LABEL[set.mode]} · {set.questions.length}문제
                  </span>
                </span>
                {selected?.id === set.id ? <IconCheck size={15} className="text-brand-600" /> : null}
              </button>
            ))}
          </div>
        </Card>

        {selected && question ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <CardHeader
                title="세트 편집"
                description="문제·선택지·정답을 고치면 바로 이 컴퓨터에 저장됩니다."
              />
            </div>
            <div className="space-y-3 p-5">
              <Field label="세트 이름" htmlFor="game-name">
                <Input
                  id="game-name"
                  value={selected.name}
                  maxLength={80}
                  onChange={(event) => updateSet({ name: event.target.value })}
                />
              </Field>
              <Field label="게임 방식" htmlFor="game-mode">
                <Select
                  id="game-mode"
                  value={selected.mode}
                  onChange={(event) => changeMode(event.target.value as QuizMode)}
                >
                  <option value="choice">객관식 · 3~6지선다</option>
                  <option value="ox">OX · 참/거짓</option>
                  <option value="spell">주관식 · 단어·문장 입력</option>
                  <option value="connect">뜻 연결 · 짝 맞히기</option>
                </Select>
              </Field>

              <div className="flex items-center justify-between gap-2">
                <p className="text-[11.5px] font-semibold text-slate-600">
                  문제 {questionIndex + 1} / {selected.questions.length}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={questionIndex === 0}
                    onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))}
                  >
                    이전
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={questionIndex >= selected.questions.length - 1}
                    onClick={() => setQuestionIndex((index) => index + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>

              <Field label="문제" htmlFor="game-prompt">
                <Input
                  id="game-prompt"
                  value={question.prompt}
                  maxLength={300}
                  placeholder="예: apple"
                  onChange={(event) => updateQuestion({ prompt: event.target.value })}
                />
              </Field>

              {selected.mode === "choice" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-slate-700">선택지</p>
                    <div className="flex gap-1">
                      {[3, 4, 5, 6].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => resizeOptions(count)}
                          className={cx(
                            "rounded-md px-2 py-1 text-[10.5px] font-semibold ring-1",
                            question.options.length === count
                              ? "bg-slate-900 text-white ring-slate-900"
                              : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100",
                          )}
                        >
                          {count}지선다
                        </button>
                      ))}
                    </div>
                  </div>
                  {question.options.map((option, index) => {
                    const isCorrect = Boolean(option.trim()) && sameAnswer(option, question.answer);
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuestion({ answer: option })}
                          aria-label={`선택지 ${index + 1} 정답으로`}
                          className={cx(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10.5px] font-bold",
                            isCorrect
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-emerald-100",
                          )}
                        >
                          {isCorrect ? <IconCheck size={13} /> : String.fromCharCode(65 + index)}
                        </button>
                        <Input
                          value={option}
                          maxLength={120}
                          placeholder={`선택지 ${index + 1}`}
                          onChange={(event) =>
                            updateQuestion({
                              options: question.options.map((value, position) =>
                                position === index ? event.target.value : value,
                              ),
                            })
                          }
                        />
                        {question.options.length > 2 ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateQuestion({
                                options: question.options.filter((_, position) => position !== index),
                              })
                            }
                            className="shrink-0 px-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600"
                          >
                            삭제
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  <p className="text-[10.5px] text-slate-400">
                    왼쪽 동그라미를 누르면 그 선택지가 정답이 됩니다.
                  </p>
                </div>
              ) : selected.mode === "connect" ? (
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold text-slate-700">짝 (왼쪽 → 오른쪽)</p>
                  {question.pairs.map((pair, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <Input
                        value={pair.left}
                        maxLength={60}
                        placeholder={`왼쪽 ${index + 1}`}
                        onChange={(event) =>
                          updateQuestion({
                            pairs: question.pairs.map((value, position) =>
                              position === index ? { ...value, left: event.target.value } : value,
                            ),
                          })
                        }
                      />
                      <span className="shrink-0 text-[11px] text-slate-400">→</span>
                      <Input
                        value={pair.right}
                        maxLength={60}
                        placeholder={`오른쪽 ${index + 1}`}
                        onChange={(event) =>
                          updateQuestion({
                            pairs: question.pairs.map((value, position) =>
                              position === index ? { ...value, right: event.target.value } : value,
                            ),
                          })
                        }
                      />
                      {question.pairs.length > 2 ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion({
                              pairs: question.pairs.filter((_, position) => position !== index),
                            })
                          }
                          className="shrink-0 px-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600"
                        >
                          삭제
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {question.pairs.length < 8 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateQuestion({ pairs: [...question.pairs, { left: "", right: "" }] })}
                    >
                      <IconPlus size={13} /> 짝 추가
                    </Button>
                  ) : null}
                  <p className="text-[10.5px] text-slate-400">
                    학생 화면에는 오른쪽 항목이 섞여서 나오고, 모두 맞히면 정답입니다.
                  </p>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
                  {selected.mode === "ox"
                    ? "학생 화면에는 O / X 버튼이 표시됩니다."
                    : "학생이 정답을 직접 입력합니다. 대소문자와 앞뒤 공백은 무시합니다."}
                </p>
              )}

              {selected.mode !== "connect" ? (
                <Field
                  label={selected.mode === "spell" ? "정답" : "정답 선택지"}
                  htmlFor="game-answer"
                  hint={
                    selected.mode === "spell"
                      ? "대소문자와 앞뒤 공백은 무시하고 채점합니다."
                      : selected.mode === "ox"
                        ? "O 또는 X를 입력하세요."
                        : "위 선택지의 동그라미를 눌러 정답을 고를 수도 있습니다."
                  }
                >
                  <Input
                    id="game-answer"
                    value={question.answer}
                    maxLength={120}
                    placeholder={selected.mode === "ox" ? "O 또는 X" : "정답"}
                    onChange={(event) => updateQuestion({ answer: event.target.value })}
                  />
                </Field>
              ) : null}

              {selected.mode === "spell" && question.answer.trim() ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-[11px] font-semibold text-slate-500">
                    초성 힌트: <span className="font-mono text-[12.5px] text-slate-800">{jamoPrompt(question.answer)}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateQuestion({ prompt: jamoPrompt(question.answer) })}
                  >
                    <IconSparkles size={13} /> 문제를 초성으로
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-between gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={selected.questions.length <= 1}
                  onClick={removeQuestion}
                >
                  <IconX size={13} /> 이 문제 삭제
                </Button>
                <Button size="sm" variant="secondary" onClick={addQuestion}>
                  <IconPlus size={13} /> 문제 추가
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <EmptyState title="게임 세트가 없습니다" description="새 세트를 만들어 주세요." />
        )}
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="게임 진행"
              description="한 문제씩 학급 전체에 띄우고, 학생 화면에서 바로 응답합니다."
              action={
                <div className="flex items-center gap-2">
                  <Badge tone={quiz?.status === "open" ? "ok" : "neutral"} dot={quiz?.status === "open"}>
                    {quiz ? (quiz.status === "open" ? "진행 중" : "마감") : "대기"}
                  </Badge>
                  <Button size="sm" variant="secondary" onClick={() => setProjector(true)}>
                    <IconMonitor size={14} /> 프로젝터
                  </Button>
                </div>
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.14em] text-brand-600">
                    대기 화면 · 방번호
                  </p>
                  <p className="mt-0.5 font-mono text-[26px] font-extrabold leading-none tracking-[0.18em] text-slate-900">
                    {joinCode}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    disabled={!connected}
                    onClick={() => send({ type: "game_lobby", open: true })}
                  >
                    <IconSparkles size={13} /> {game.lobbyOpen ? "대기 화면 다시 열기" : "대기 화면 열기"}
                  </Button>
                  {game.lobbyOpen ? (
                    <Button size="sm" variant="secondary" onClick={() => send({ type: "game_lobby", open: false })}>
                      닫기
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">
                학생은 수업 화면에서 방번호 <b className="font-mono">{joinCode}</b>와 이름을 입력해 들어옵니다.
                이미 수업에 있는 학생 {studentCount}명은 그대로 참여합니다. 대기 화면은 프로젝터에 크게 띄울 수
                있습니다.
              </p>
            </div>

            {!connected ? (
              <Callout tone="warn" icon={<IconAlert size={15} />}>
                실시간 연결이 끊겨 있습니다. 재연결되면 다시 시도해 주세요.
              </Callout>
            ) : null}
            {error ? (
              <Callout tone="danger" icon={<IconAlert size={15} />}>
                {error}
              </Callout>
            ) : null}

            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <p className="text-[11.5px] font-semibold text-slate-600">게임 방식</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {GAME_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setGameMode(mode.id)}
                    className={cx(
                      "rounded-lg px-2 py-1.5 text-left ring-1 transition",
                      gameMode === mode.id
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-100",
                    )}
                  >
                    <span className="block text-[11.5px] font-bold">{mode.label}</span>
                    <span
                      className={cx(
                        "block text-[9.5px]",
                        gameMode === mode.id ? "text-white/70" : "text-slate-400",
                      )}
                    >
                      {mode.hint}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500">제한 시간</span>
                {TIMERS.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setDurationSec(seconds)}
                    className={cx(
                      "rounded-md px-2 py-1 text-[10.5px] font-semibold ring-1",
                      durationSec === seconds
                        ? "bg-brand-600 text-white ring-brand-600"
                        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100",
                    )}
                  >
                    {seconds === 0 ? "없음" : `${seconds}초`}
                  </button>
                ))}
                {gameMode === "team" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!connected}
                    onClick={() => send({ type: "game_teams_shuffle" })}
                  >
                    <IconRefresh size={12} /> 모둠 다시 섞기
                  </Button>
                ) : null}
                {gameMode === "goldenbell" ? (
                  <span className="ml-auto text-[10px] font-semibold text-rose-600">
                    탈락 {game.scores.filter((score) => !score.alive).length}명 · 생존{" "}
                    {game.scores.filter((score) => score.alive).length}명
                  </span>
                ) : null}
              </div>
            </div>

            {selected && question ? (
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
                    {MODE_LABEL[selected.mode]}
                  </span>
                  <span className="text-[10.5px] text-slate-400">
                    {selected.name} · {questionIndex + 1}/{selected.questions.length}
                  </span>
                </div>
                <p className="mt-2 text-[16px] font-bold text-slate-900">{question.prompt || "문제를 입력하세요"}</p>
                {selected.mode === "choice" || selected.mode === "ox" ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {optionsFor(selected.mode, question).map((option, index) => (
                      <span
                        key={`${option}-${index}`}
                        className={cx(
                          "rounded-md px-2 py-1 text-[11px] ring-1",
                          selected.mode === "ox"
                            ? "bg-slate-50 text-slate-700 ring-slate-200"
                            : "bg-white text-slate-600 ring-slate-200",
                        )}
                      >
                        {selected.mode === "choice" ? `${String.fromCharCode(65 + index)}. ` : ""}
                        {option}
                      </span>
                    ))}
                  </div>
                ) : null}
                {selected.mode === "connect" ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {question.pairs
                      .filter((pair) => pair.left.trim() && pair.right.trim())
                      .map((pair, index) => (
                        <span
                          key={`${pair.left}-${index}`}
                          className="rounded-md bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200"
                        >
                          {pair.left} → {pair.right}
                        </span>
                      ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={questionIndex >= selected.questions.length - 1}
                    onClick={() => setQuestionIndex((index) => index + 1)}
                  >
                    다음 문제
                  </Button>
                  <Button size="sm" disabled={!connected} onClick={startQuestion}>
                    <IconSparkles size={14} /> 이 문제 시작
                  </Button>
                  {quiz?.status === "open" ? (
                    <Button size="sm" variant="danger" onClick={() => send({ type: "quiz_close" })}>
                      응답 마감
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {quiz ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-500">
                  <span>
                    응답 {results?.answerCount ?? quiz.answerCount}/{studentCount}
                  </span>
                  {quizRemaining !== null ? (
                    <span
                      className={cx(
                        "rounded-md px-2 py-0.5 font-mono text-[11.5px] font-bold",
                        quizRemaining <= 5000
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {String(Math.floor(quizRemaining / 60000)).padStart(2, "0")}:
                      {String(Math.ceil((quizRemaining % 60000) / 1000)).padStart(2, "0")}
                    </span>
                  ) : null}
                  {results?.correctAnswer ? (
                    <Badge tone="ok">정답 {results.correctAnswer}</Badge>
                  ) : null}
                </div>
                {answeredStudents.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-400">
                    아직 응답한 학생이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {answeredStudents.map((response) => (
                      <div
                        key={response.participantId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 text-[11.5px]"
                      >
                        <span className="truncate font-medium text-slate-700">
                          {response.studentName}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
                          {responseLabel(response)}
                          {response.correct === true ? <IconCheck size={12} className="text-emerald-600" /> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {results?.correctCount ? (
                  <p className="text-[11px] font-semibold text-emerald-700">
                    정답 {results.correctCount}명
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[11.5px] text-slate-400">
                게임을 시작하면 학생 화면에 문제가 나타납니다.
              </p>
            )}

            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-900">
                  <IconTrophy size={14} className="text-amber-500" /> 실시간 순위
                  <span className="text-[10px] font-medium text-slate-400">
                    {game.round > 0 ? `${game.round}/${game.totalRounds}문제` : "대기"}
                  </span>
                </p>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={exportResults} disabled={!game.scores.length}>
                    <IconDownload size={12} /> 결과 CSV
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!connected} onClick={() => send({ type: "game_reset" })}>
                    <IconRefresh size={12} /> 점수 초기화
                  </Button>
                </div>
              </div>

              {game.teams.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {[...game.teams]
                    .sort((left, right) => right.points - left.points)
                    .map((team, index) => (
                      <div
                        key={team.id}
                        className={cx(
                          "rounded-lg px-2.5 py-2",
                          index === 0 ? "bg-amber-50" : "bg-slate-50",
                        )}
                      >
                        <p className="text-[10.5px] font-semibold text-slate-500">
                          {team.label} · {team.players}명
                        </p>
                        <p className="text-[15px] font-extrabold text-slate-900">
                          {team.points}점 {index === 0 ? "🏆" : ""}
                        </p>
                      </div>
                    ))}
                </div>
              ) : null}

              {game.scores.length === 0 ? (
                <p className="mt-2 text-[11px] text-slate-400">
                  학생이 참가하면 점수와 순위가 여기에 표시됩니다.
                </p>
              ) : (
                <ol className="mt-2 space-y-1">
                  {game.scores.slice(0, 8).map((score, index) => (
                    <li
                      key={score.participantId}
                      className={cx(
                        "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px]",
                        index === 0 ? "bg-amber-50" : "bg-slate-50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-4 shrink-0 text-center font-bold text-slate-400">
                          {index + 1}
                        </span>
                        <span className="truncate font-semibold text-slate-800">{score.name}</span>
                        {score.team ? (
                          <span className="shrink-0 text-[9.5px] text-slate-400">{score.team}</span>
                        ) : null}
                        {!score.alive ? <Badge tone="danger">탈락</Badge> : null}
                        {score.correct > 0 ? (
                          <span className="shrink-0 text-[9.5px] text-emerald-600">
                            {score.correct}문제
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-bold text-slate-700">{score.points}점</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </Card>

        <Callout tone="info" icon={<IconRefresh size={15} />} title="게임 세트는 선생님 컴퓨터에만">
          세트와 정답은 이 브라우저에 저장되고, 수업 중에는 문제만 학생에게 전송됩니다. 수업을
          종료하면 진행 상태와 응답은 즉시 삭제됩니다.
        </Callout>
      </div>
    </div>

    {projector ? (
      <GameProjector
        quiz={quiz}
        results={results}
        game={game}
        studentCount={studentCount}
        joinCode={joinCode}
        onClose={() => setProjector(false)}
      />
    ) : null}
    </>
  );
}
