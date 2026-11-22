import { useEffect, useMemo, useRef, useState } from "react";
import type { ClassToolsState, ClientMessage, RosterState, StudentLive } from "../../../shared/protocol";
import { teamLabels, teamTone } from "../../../shared/roster";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Select,
  cx,
} from "../../components/ui";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconInfo,
  IconPlay,
  IconRefresh,
  IconSparkles,
  IconUsers,
  IconX,
} from "../../components/Icons";
import { formatTime } from "../../lib/format";

function stopwatch(ms: number): string {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centis = Math.floor((total % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

/**
 * Microphone level meter. Nothing is recorded or uploaded: the analyser only
 * reads the current RMS level while the teacher keeps it on.
 */
function NoiseMeter() {
  const [running, setRunning] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);

  const stop = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    setRunning(false);
    setLevel(0);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("이 브라우저는 마이크를 지원하지 않습니다.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const context = new AudioContext();
      contextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      setRunning(true);
      const tick = () => {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const value of buffer) sum += value * value;
        const rms = Math.sqrt(sum / buffer.length);
        // 0..1 scale with a gentle curve so quiet classrooms still move.
        const next = Math.min(1, Math.pow(rms * 9, 0.7));
        setLevel(next);
        setPeak((current) => Math.max(current * 0.995, next));
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch {
      setError("마이크 권한이 필요합니다. 브라우저 주소창의 권한을 허용해 주세요.");
      stop();
    }
  };

  const label = level > 0.72 ? "매우 시끄러움" : level > 0.45 ? "조금 시끄러움" : level > 0.2 ? "보통" : "조용함";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button size="sm" variant="danger" onClick={stop}>
            <IconX size={13} /> 측정 끄기
          </Button>
        ) : (
          <Button size="sm" onClick={() => void start()}>
            <IconPlay size={13} /> 소음 측정 시작
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={!running} onClick={() => setPeak(0)}>
          <IconRefresh size={12} /> 최고치 초기화
        </Button>
        <Badge tone={level > 0.72 ? "danger" : level > 0.45 ? "warn" : running ? "ok" : "neutral"} dot={running}>
          {running ? label : "꺼짐"}
        </Badge>
      </div>
      <div className="h-8 overflow-hidden rounded-xl bg-slate-100">
        <div
          className={cx(
            "h-full rounded-xl transition-[width] duration-100",
            level > 0.72 ? "bg-rose-500" : level > 0.45 ? "bg-amber-400" : "bg-emerald-400",
          )}
          style={{ width: `${Math.round(level * 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10.5px] text-slate-400">
        <span>최고 {Math.round(peak * 100)}%</span>
        <span>마이크 음량만 재고, 소리는 저장·전송하지 않습니다.</span>
      </div>
      {error ? <p className="text-[11.5px] font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

/** Teacher-only stopwatch with laps, for timing activities on the projector. */
function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const startedAt = useRef(0);
  const base = useRef(0);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const tick = window.setInterval(() => {
      setElapsed(base.current + (Date.now() - startedAt.current));
    }, 50);
    return () => window.clearInterval(tick);
  }, [running]);

  const pause = () => {
    base.current += Date.now() - startedAt.current;
    setRunning(false);
    setElapsed(base.current);
  };

  const reset = () => {
    base.current = 0;
    setRunning(false);
    setElapsed(0);
    setLaps([]);
  };

  return (
    <div className="space-y-3">
      <p className="text-center font-mono text-[38px] font-extrabold leading-none tracking-tight text-slate-900">
        {stopwatch(elapsed)}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant={running ? "secondary" : "primary"} onClick={() => (running ? pause() : setRunning(true))}>
          {running ? "일시정지" : elapsed > 0 ? "이어서" : "시작"}
        </Button>
        <Button size="sm" variant="secondary" disabled={!elapsed} onClick={() => setLaps((laps) => [elapsed, ...laps].slice(0, 20))}>
          구간 기록
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          <IconRefresh size={12} /> 초기화
        </Button>
      </div>
      {laps.length ? (
        <div className="max-h-32 space-y-1 overflow-y-auto">
          {laps.map((lap, index) => (
            <div key={`${lap}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1 text-[11.5px]">
              <span className="text-slate-400">{laps.length - index}구간</span>
              <span className="font-mono font-bold text-slate-700">{stopwatch(lap)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ToolboxTab({
  tools,
  students,
  roster,
  send,
  connected,
}: {
  tools: ClassToolsState;
  students: StudentLive[];
  roster: RosterState;
  send: (message: ClientMessage) => void;
  connected: boolean;
}) {
  const teams = teamLabels(roster.teamCount);
  const [step, setStep] = useState(1);
  // 도구는 기본으로 덮어 두고, 버튼을 눌러서 열어 씁니다.
  const [openTool, setOpenTool] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const TOOL_LIST: [string, string, string][] = [
    ["score", "🏆 모둠 점수판", "점수 모둠 +1 +5 +10 점수판 초기화"],
    ["attendance", "✅ 출석 체크", "출석 체크 출석 명단 확인 누구"],
    ["noise", "🔊 소음 측정기", "소음 시끄러움 마이크 소리 수준"],
    ["stopwatch", "⏱ 스톱워치", "스톱워치 시간 재기 구간 랩 타이머"],
  ];
  const keyword = query.replace(/\s+/g, "").toLowerCase();
  const visibleTools = keyword
    ? TOOL_LIST.filter(([, label, tags]) =>
        `${label}${tags}`.replace(/\s+/g, "").toLowerCase().includes(keyword),
      )
    : TOOL_LIST;
  const online = students.filter((student) => student.online);
  const checkedIn = useMemo(
    () => new Set(tools.attendance.map((entry) => entry.participantId)),
    [tools.attendance],
  );
  const missing = students.filter((student) => !checkedIn.has(student.participantId));
  const attendanceText = tools.attendance
    .map((entry, index) => `${index + 1}. ${entry.name} (${formatTime(entry.at)})`)
    .join("\n");

  return (
    <div className="space-y-4">
      <Callout tone="info" icon={<IconSparkles size={15} />} title="수업 중 바로 쓰는 도구 모음">
        모둠 점수판과 출석 체크는 <strong>학생 화면에도 함께 표시</strong>됩니다. 소음 측정기와 스톱워치는
        선생님 화면에서만 동작하고 아무것도 저장하지 않습니다.
      </Callout>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="도구 검색: 점수, 출석, 소음, 시간…"
            maxLength={40}
            className="h-9 w-full max-w-[240px] text-[12px]"
            aria-label="도구 검색"
          />
          {query ? (
            <Button size="sm" variant="ghost" onClick={() => setQuery("")}>
              <IconX size={13} /> 지우기
            </Button>
          ) : null}
          {openTool ? (
            <Button size="sm" variant="secondary" onClick={() => setOpenTool(null)}>
              열린 도구 닫기
            </Button>
          ) : null}
        </div>
        {visibleTools.length === 0 ? (
          <p className="text-[11.5px] text-slate-400">검색 결과가 없습니다. 다른 키워드로 찾아 보세요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {visibleTools.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOpenTool((current) => (current === id ? null : id))}
                className={cx(
                  "rounded-xl px-3.5 py-2 text-[12.5px] font-bold ring-1 transition",
                  openTool === id
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 열린 도구는 버튼 바로 아래에 붙어서 빈칸 없이 채웁니다. */}
      {openTool === "score" ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="🏆 모둠 점수판"
              description="모둠 점수를 직접 올리고 내립니다. 점수는 학생 화면에도 실시간으로 보여 줍니다."
              action={
                <div className="flex items-center gap-1.5">
                  <Badge tone="neutral">{teams.length}모둠</Badge>
                  <Button size="sm" variant="ghost" disabled={!connected} onClick={() => send({ type: "score_reset" })}>
                    <IconRefresh size={12} /> 초기화
                  </Button>
                </div>
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] font-semibold text-slate-500">한 번에 더할 점수</span>
              {[1, 5, 10].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStep(value)}
                  className={cx(
                    "rounded-md px-2 py-1 text-[10.5px] font-bold ring-1",
                    step === value
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                  )}
                >
                  {value}점
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {teams.map((team) => {
                const score = tools.scores[team] ?? 0;
                const members = students.filter((student) => student.team === team).length;
                return (
                  <div key={team} className={cx("rounded-xl p-3 ring-1", teamTone(team).chip)}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-bold">{team}</p>
                      <span className="text-[10px] opacity-70">{members}명</span>
                    </div>
                    <p className="mt-1 text-[24px] font-extrabold leading-none text-slate-900">{score}점</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={!connected}
                        onClick={() => send({ type: "score_adjust", team, delta: -step })}
                        className="rounded-md bg-white/80 px-2 py-1 text-[10.5px] font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-white disabled:opacity-50"
                      >
                        -{step}
                      </button>
                      <button
                        type="button"
                        disabled={!connected}
                        onClick={() => send({ type: "score_adjust", team, delta: step })}
                        className="rounded-md bg-slate-900 px-2 py-1 text-[10.5px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        +{step}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {Object.keys(tools.scores).length === 0 ? (
              <p className="text-[11px] text-slate-400">아직 점수가 없습니다. 모둠 점수를 더하면 학생 화면에 나타납니다.</p>
            ) : null}
          </div>
        </Card>
        ) : null}

        {openTool === "attendance" ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="✅ 출석 체크"
              description="학생 화면에 ‘출석’ 버튼이 나타납니다. 누른 학생과 아직 안 누른 학생을 바로 확인합니다."
              action={
                <Badge tone={tools.checkinOpen ? "ok" : "neutral"} dot={tools.checkinOpen}>
                  {tools.checkinOpen ? "받는 중" : "꺼짐"}
                </Badge>
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={tools.checkinOpen ? "danger" : "primary"}
                disabled={!connected}
                onClick={() => send({ type: "checkin_open", open: !tools.checkinOpen })}
              >
                {tools.checkinOpen ? <IconX size={13} /> : <IconCheck size={13} />}
                {tools.checkinOpen ? "출석 마감" : "출석 받기"}
              </Button>
              <span className="text-[11.5px] font-semibold text-slate-500">
                {tools.attendance.length}/{students.length}명 확인
              </span>
              {tools.attendance.length ? <CopyButton value={attendanceText} label="명단 복사" /> : null}
            </div>
            {students.length === 0 ? (
              <EmptyState
                icon={<IconUsers size={20} />}
                title="학생이 아직 없습니다"
                description="학생이 입장하면 여기에서 확인할 수 있습니다."
                className="py-6"
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {tools.attendance.map((entry) => (
                  <div
                    key={entry.participantId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-800"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <IconCheck size={12} className="shrink-0" />
                      <span className="truncate font-semibold">{entry.name}</span>
                    </span>
                    <span className="shrink-0 text-[10px] opacity-70">{formatTime(entry.at)}</span>
                  </div>
                ))}
                {missing.map((student) => (
                  <div
                    key={student.participantId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-500"
                  >
                    <span className="truncate">{student.name}</span>
                    <span className="shrink-0 text-[10px]">{student.online ? "미확인" : "오프라인"}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-slate-400">
              <IconInfo size={12} className="mt-0.5 shrink-0" />
              출석 기록은 이 수업이 진행되는 동안만 저장되고 수업을 종료하면 삭제됩니다.
            </p>
          </div>
        </Card>
        ) : null}

        {openTool === "noise" ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="🔊 소음 측정기"
              description="모둠 활동 소리를 눈으로 확인합니다. 마이크는 이 브라우저에서만 쓰고 소리는 저장하지 않습니다."
              action={<IconAlert size={16} className="text-amber-500" />}
            />
          </div>
          <div className="p-5">
            <NoiseMeter />
          </div>
        </Card>
        ) : null}

        {openTool === "stopwatch" ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="⏱ 스톱워치"
              description="활동 시간을 재고 구간을 기록합니다. 수업 타이머와 달리 학생 화면에는 표시되지 않습니다."
              action={<IconClock size={17} className="text-brand-600" />}
            />
          </div>
          <div className="p-5">
            <Stopwatch />
          </div>
        </Card>
        ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-[12px] font-bold text-slate-800">수업 중 접속 현황</p>
          <p className="mt-1 text-[11.5px] text-slate-500">
            접속 {online.length}명 · 전체 {students.length}명
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {students.length === 0 ? (
              <span className="text-[11px] text-slate-400">학생이 입장하면 표시됩니다.</span>
            ) : (
              students.map((student) => (
                <span
                  key={student.participantId}
                  className={cx(
                    "rounded-md px-2 py-0.5 text-[10.5px] font-semibold ring-1",
                    student.online
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-slate-50 text-slate-400 ring-slate-200",
                  )}
                >
                  {student.name}
                  {student.team ? ` · ${student.team}` : ""}
                </span>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Field label="빠른 안내" htmlFor="toolbox-hint" className="flex-1">
              <Select id="toolbox-hint" disabled className="h-9 text-[12px]">
                <option>띄우기·타이머 탭에서 전체 알림을 보낼 수 있습니다</option>
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            모둠 점수와 출석은 학생 화면에 카드로 표시됩니다. 점수는 게임 점수와 별도로 계산됩니다.
          </p>
        </Card>
      </div>
    </div>
  );
}
