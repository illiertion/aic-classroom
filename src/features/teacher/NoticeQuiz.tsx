import { useState } from "react";
import type { ClientMessage, LiveQuiz, QuizMode, QuizResults } from "../../../shared/protocol";
import type { ClassSettings } from "../../../shared/settings";
import { Badge, Button, Callout, Card, CardHeader, Field, Input, cx } from "../../components/ui";
import { IconAlert, IconCheck, IconPlus, IconX } from "../../components/Icons";

interface Props {
  quiz: LiveQuiz | null;
  results: QuizResults | null;
  settings: ClassSettings;
  connected: boolean;
  send: (message: ClientMessage) => void;
}


/**
 * 쪽지 문제: 프로젝터 창을 띄우지 않고 학생 알림 영역으로 작은 문제를 보냅니다.
 * 정답·점수 계산은 서버가 그대로 처리하므로 게임 점수와 이어집니다.
 */
export function NoticeQuiz({ quiz, results, settings, connected, send }: Props) {
  const [mode, setMode] = useState<QuizMode>("choice");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", ""]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const active = quiz?.surface === "notice" ? quiz : null;

  const reset = () => {
    setPrompt("");
    setOptions(["", "", ""]);
    setAnswer("");
    setError(null);
  };

  const submit = () => {
    if (!connected) {
      setError("실시간 연결이 끊겨 있어 지금은 보낼 수 없습니다.");
      return;
    }
    const text = prompt.trim();
    if (!text) {
      setError("문제를 입력해 주세요.");
      return;
    }
    const labels = mode === "choice" ? options.map((option) => option.trim()).filter(Boolean) : [];
    if (mode === "choice" && labels.length < 2) {
      setError("객관식은 보기가 두 개 이상 필요합니다.");
      return;
    }
    if (mode === "spell" && !answer.trim()) {
      setError("주관식은 정답을 입력해 주세요.");
      return;
    }
    if (mode === "ox" && !["O", "X"].includes(answer.toUpperCase())) {
      setError("OX 정답을 골라 주세요.");
      return;
    }
    if (mode === "choice" && !labels.includes(answer.trim())) {
      setError("정답 보기를 하나 선택해 주세요.");
      return;
    }
    setError(null);
    send({
      type: "quiz_start",
      prompt: text,
      mode,
      options: mode === "choice" ? labels : [],
      answer: mode === "ox" ? answer.toUpperCase() : answer.trim(),
      gameMode: "classic",
      round: (quiz?.round ?? 0) + 1,
      durationSec: settings.quizSeconds > 0 ? settings.quizSeconds : undefined,
      surface: "notice",
    });
    setPrompt("");
  };

  const close = () => send({ type: "quiz_close" });

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <CardHeader
          title="쪽지 문제"
          description="창을 띄우지 않고 알림으로 작은 문제를 보냅니다. 학생은 자기 자리에서 바로 답합니다."
          action={
            active ? (
              <Badge tone={active.status === "open" ? "ok" : "neutral"} dot={active.status === "open"}>
                {active.status === "open" ? "받는 중" : "마감됨"}
              </Badge>
            ) : null
          }
        />
      </div>

      <div className="space-y-3 p-5">
        {error ? (
          <Callout tone="danger" icon={<IconAlert size={15} />}>
            {error}
          </Callout>
        ) : null}

        {active ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
            <p className="text-[13px] font-bold text-slate-900">{active.prompt}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-600">
              <Badge tone="brand">응답 {active.answerCount}명</Badge>
              {active.status === "closed" && results ? (
                <Badge tone="ok">정답 {results.correctCount}명</Badge>
              ) : null}
              {active.correctAnswer ? <span>정답: {active.correctAnswer}</span> : null}
              {active.endsAt ? (
                <span>제한 {Math.max(0, Math.ceil((active.endsAt - Date.now()) / 1000))}초</span>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
              {active.status === "open" ? (
                <Button size="sm" variant="danger" onClick={close}>
                  <IconX size={13} /> 답변 마감
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={close} disabled>
                  <IconCheck size={13} /> 마감 완료
                </Button>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["choice", "객관식"],
              ["ox", "OX"],
              ["spell", "주관식"],
            ] as [QuizMode, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                setAnswer("");
              }}
              className={cx(
                "rounded-lg px-2.5 py-1 text-[11.5px] font-bold ring-1 transition",
                mode === id
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Field label="문제" htmlFor="notice-quiz-prompt">
          <Input
            id="notice-quiz-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="예: 3 × 7 = ?"
            maxLength={160}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              submit();
            }}
          />
        </Field>

        {mode === "choice" ? (
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAnswer(option)}
                  className={cx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1",
                    option && answer === option
                      ? "bg-emerald-600 text-white ring-emerald-600"
                      : "bg-white text-slate-500 ring-slate-200",
                  )}
                  aria-label={`보기 ${index + 1} 정답 지정`}
                >
                  {index + 1}
                </button>
                <Input
                  value={option}
                  onChange={(event) => {
                    const next = [...options];
                    next[index] = event.target.value;
                    setOptions(next);
                  }}
                  placeholder={`보기 ${index + 1}`}
                  maxLength={80}
                />
                {options.length > 2 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOptions(options.filter((_, position) => position !== index));
                      setAnswer("");
                    }}
                  >
                    <IconX size={13} />
                  </Button>
                ) : null}
              </div>
            ))}
            {options.length < 4 ? (
              <Button size="sm" variant="secondary" onClick={() => setOptions([...options, ""])}>
                <IconPlus size={13} /> 보기 추가
              </Button>
            ) : null}
            <p className="text-[10.5px] text-slate-400">
              왼쪽 동그라미를 누르면 그 보기가 정답이 됩니다.
            </p>
          </div>
        ) : null}

        {mode === "ox" ? (
          <div className="flex gap-2">
            {["O", "X"].map((label) => (
              <Button
                key={label}
                size="sm"
                variant={answer === label ? "primary" : "secondary"}
                onClick={() => setAnswer(label)}
              >
                {label} 정답
              </Button>
            ))}
          </div>
        ) : null}

        {mode === "spell" ? (
          <Field label="정답" htmlFor="notice-quiz-answer" hint="띄어쓰기·대소문자는 무시하고 채점합니다.">
            <Input
              id="notice-quiz-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="정답"
              maxLength={80}
            />
          </Field>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={submit} disabled={!connected}>
            <IconCheck size={14} /> 알림으로 보내기
          </Button>
          <Button variant="ghost" onClick={reset} disabled={!prompt && !answer}>
            비우기
          </Button>
          <span className="text-[10.5px] text-slate-400">
            제한 시간 {settings.quizSeconds > 0 ? `${settings.quizSeconds}초` : "없음"} · 정답{" "}
            {settings.correctPoints}점
          </span>
        </div>
      </div>
    </Card>
  );
}

