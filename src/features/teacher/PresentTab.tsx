import { useEffect, useMemo, useState } from "react";
import type {
  ClassTimer,
  ClientMessage,
  LiveBoard,
  LiveQuiz,
  QuizResults,
  StageContent,
  StageKind,
  StudentLive,
} from "../../../shared/protocol";
import type { ClassSettings } from "../../../shared/settings";
import { NoticeQuiz } from "./NoticeQuiz";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Textarea,
  Toggle,
  cx,
} from "../../components/ui";
import {
  IconAlert,
  IconCast,
  IconCheck,
  IconClock,
  IconExternal,
  IconHand,
  IconInfo,
  IconLayout,
  IconMaximize,
  IconPlay,
  IconRefresh,
  IconX,
} from "../../components/Icons";
import { formatTime } from "../../lib/format";

const TIMER_PRESETS = [50, 40, 30, 15, 5];
const HISTORY_KEY = "aic:stage-history";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readHistory(): StageContent[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as StageContent[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

/**
 * Opens the material in its own browser window so the teacher can move it to a
 * projector or make it fullscreen without losing the classroom console.
 */
function openStageWindow(payload: {
  kind: StageKind;
  title: string;
  url?: string | null;
  body?: string | null;
}): boolean {
  const win = window.open("", "aic-teacher-stage", "popup=yes,width=1280,height=840");
  if (!win) return false;
  const title = escapeHtml(payload.title || "AIC 수업 자료");
  const content =
    payload.kind === "url" && payload.url
      ? `<iframe src="${escapeHtml(payload.url)}" allow="camera; microphone; fullscreen; display-capture; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>`
      : `<div class="note"><p class="kicker">${title}</p><p class="body">${escapeHtml(payload.body ?? "")}</p></div>`;
  win.document.open();
  win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>
    *{box-sizing:border-box}html,body{margin:0;height:100%;font-family:system-ui,-apple-system,"Malgun Gothic",sans-serif;background:#0f172a;color:#fff}
    #bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#111827;border-bottom:1px solid rgba(255,255,255,.12)}
    #bar p{margin:0;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    button{border:0;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
    button:hover{background:rgba(255,255,255,.24)}
    iframe{display:block;width:100%;height:calc(100% - 45px);border:0;background:#fff}
    .note{display:flex;min-height:calc(100% - 45px);flex-direction:column;align-items:center;justify-content:center;padding:48px;text-align:center;background:linear-gradient(135deg,#4f46e5,#1e1b4b)}
    .kicker{margin:0;font-size:14px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#c7d2fe}
    .body{margin:16px 0 0;font-size:clamp(24px,4vw,52px);font-weight:800;line-height:1.35;white-space:pre-wrap}
  </style></head><body><div id="bar"><p>${title}</p><div><button id="fs">전체화면</button> <button id="close">닫기</button></div></div>${content}</body></html>`);
  win.document.close();
  win.document.getElementById("fs")?.addEventListener("click", () => {
    const root = win.document.documentElement;
    if (win.document.fullscreenElement) void win.document.exitFullscreen();
    else void root.requestFullscreen?.().catch(() => undefined);
  });
  win.document.getElementById("close")?.addEventListener("click", () => win.close());
  win.focus();
  return true;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Re-read the clock as soon as the timer starts so the first frame is not
    // computed from a stale mount time.
    setNow(Date.now());
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PresentTab({
  stage,
  timer,
  students,
  board,
  send,
  connected,
  settings,
  quiz,
  results,
}: {
  stage: StageContent | null;
  timer: ClassTimer | null;
  students: StudentLive[];
  board: LiveBoard | null;
  send: (message: ClientMessage) => void;
  connected: boolean;
  settings: ClassSettings;
  quiz: LiveQuiz | null;
  results: QuizResults | null;
}) {
  const [kind, setKind] = useState<StageKind>("url");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [requireFullscreen, setRequireFullscreen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [duration, setDuration] = useState(() =>
    Math.min(120, Math.max(1, Math.round(settings.timerMinutes))),
  );
  const [history, setHistory] = useState<StageContent[]>(readHistory);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const now = useNow(Boolean(timer));
  const remaining = timer
    ? Math.max(0, Math.min(timer.durationSec * 1000, timer.endsAt - now))
    : 0;
  const hands = useMemo(() => students.filter((student) => student.handRaised && student.online), [students]);
  const online = students.filter((student) => student.online);

  const announce = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const remember = (entry: StageContent) => {
    setHistory((current) => {
      const next = [entry, ...current.filter((item) => !(item.kind === entry.kind && item.url === entry.url && item.title === entry.title))].slice(0, 8);
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* history is a convenience only */
      }
      return next;
    });
  };

  const push = (payload: {
    kind: StageKind;
    title: string;
    url?: string | null;
    body?: string | null;
    requireFullscreen?: boolean;
  }) => {
    if (!connected) return;
    send({ type: "stage_set", ...payload });
    remember({
      id: `local_${Date.now()}`,
      kind: payload.kind,
      title: payload.title || "수업 자료",
      url: payload.url ?? null,
      body: payload.body ?? null,
      requireFullscreen: Boolean(payload.requireFullscreen),
      openedAt: Date.now(),
    });
    announce("학생 화면에 띄웠습니다.");
  };

  const openWindow = (payload: { kind: StageKind; title: string; url?: string | null; body?: string | null }) => {
    const opened = openStageWindow(payload);
    setPopupBlocked(!opened);
  };

  const toggleConsoleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      announce("브라우저가 전체화면을 허용하지 않았습니다.");
    }
  };

  const reopen = (entry: StageContent) => {
    push({
      kind: entry.kind,
      title: entry.title,
      url: entry.url,
      body: entry.body,
      requireFullscreen: entry.requireFullscreen,
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="학생 화면에 띄우기"
              description="접속한 학생 모두의 화면에 같은 내용을 동시에 띄웁니다. 패들렛·유튜브·문제 사이트 주소를 그대로 붙여 넣어도 됩니다."
              action={
                <Badge tone={stage ? "ok" : "neutral"} dot={Boolean(stage)}>
                  {stage ? "띄우는 중" : "대기"}
                </Badge>
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="무엇을 띄울까요?" htmlFor="stage-kind">
                <Select
                  id="stage-kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as StageKind)}
                >
                  <option value="url">웹 페이지·패들렛 주소</option>
                  <option value="note">큰 글씨 안내문</option>
                  <option value="board">지금 활동 보드</option>
                </Select>
              </Field>
              <Field label="제목 (선택)" htmlFor="stage-title">
                <Input
                  id="stage-title"
                  value={title}
                  maxLength={120}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 오늘의 탐구 활동"
                />
              </Field>
            </div>

            {kind === "url" ? (
              <Field
                label="주소"
                htmlFor="stage-url"
                hint="Padlet은 패들렛 탭에서 ‘학생에게 띄우기’를 누르면 자동으로 채워집니다."
              >
                <Input
                  id="stage-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://..."
                />
              </Field>
            ) : kind === "note" ? (
              <Field label="내용" htmlFor="stage-body" hint="학생 화면에 큰 글씨로 표시됩니다.">
                <Textarea
                  id="stage-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="min-h-24"
                  maxLength={4000}
                  placeholder="예: 3번 문제까지 풀고 손을 들어 주세요."
                />
              </Field>
            ) : (
              <Callout tone={board ? "info" : "warn"} icon={<IconLayout size={15} />}>
                {board
                  ? `“${board.title}” 보드를 학생 화면 가득 띄웁니다. 보드에 카드를 붙이면 그 자리에서 함께 보입니다.`
                  : "아직 공유 중인 보드가 없습니다. 활동 보드 탭에서 보드를 먼저 열어 주세요."}
              </Callout>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
              <div>
                <p className="text-[12px] font-semibold text-slate-700">학생 화면 전체화면 요청</p>
                <p className="text-[10.5px] text-slate-400">
                  브라우저 정책상 학생이 한 번 눌러야 전체화면이 됩니다. 학생 화면에 큰 버튼이 뜹니다.
                </p>
              </div>
              <Toggle
                checked={requireFullscreen}
                onChange={setRequireFullscreen}
                label="학생 화면 전체화면 요청"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!connected || (kind === "url" && !url.trim()) || (kind === "note" && !body.trim()) || (kind === "board" && !board)}
                onClick={() =>
                  push({
                    kind,
                    title: title.trim() || (kind === "board" ? board?.title ?? "" : ""),
                    url: kind === "url" ? url.trim() : null,
                    body: kind === "note" ? body.trim() : null,
                    requireFullscreen,
                  })
                }
              >
                <IconCast size={15} /> 지금 띄우기
              </Button>
              {stage ? (
                <Button variant="secondary" onClick={() => send({ type: "stage_close" })}>
                  <IconX size={14} /> 내리기
                </Button>
              ) : null}
              {board ? (
                <Button
                  variant="secondary"
                  disabled={!connected}
                  onClick={() =>
                    push({ kind: "board", title: board.title, requireFullscreen })
                  }
                >
                  <IconLayout size={14} /> 보드 바로 띄우기
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={() =>
                  openWindow({
                    kind,
                    title: title.trim() || "AIC 수업 자료",
                    url: kind === "url" ? url.trim() : null,
                    body: kind === "note" ? body.trim() : null,
                  })
                }
                disabled={kind === "board" || (kind === "url" && !url.trim())}
              >
                <IconExternal size={14} /> 팝업으로 열기
              </Button>
              <Button
                variant="secondary"
                disabled={!connected}
                onClick={() => {
                  send({ type: "fullscreen_all" });
                  announce("모든 학생에게 전체화면을 요청했습니다.");
                }}
              >
                <IconMaximize size={14} /> 학생 전체화면 요청
              </Button>
              <Button variant="ghost" onClick={() => void toggleConsoleFullscreen()}>
                <IconMaximize size={14} /> 교사 화면 전체화면
              </Button>
            </div>
            {popupBlocked ? (
              <p className="text-[11px] font-medium text-rose-600">
                팝업이 차단되었습니다. 주소창 오른쪽의 ‘팝업 및 리디렉션 허용’을 켜 주세요.
              </p>
            ) : null}

            {notice ? (
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-600">
                <IconCheck size={13} /> {notice}
              </p>
            ) : null}

            {stage ? (
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-slate-800">{stage.title}</p>
                    <p className="text-[10.5px] text-slate-400">
                      {stage.kind === "url" ? "웹 페이지" : stage.kind === "note" ? "안내문" : "활동 보드"} ·{" "}
                      {formatTime(stage.openedAt)}부터
                    </p>
                  </div>
                  <Badge tone={stage.requireFullscreen ? "info" : "neutral"}>
                    {stage.requireFullscreen ? "전체화면 요청" : "창 크기 유지"}
                  </Badge>
                </div>
                {stage.url ? (
                  <p className="mt-1 break-all text-[10.5px] text-slate-500">{stage.url}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      openWindow({ kind: stage.kind, title: stage.title, url: stage.url, body: stage.body });
                    }}
                    disabled={stage.kind === "board"}
                  >
                    <IconExternal size={13} /> 새 창으로 열기
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => send({ type: "stage_close" })}>
                    <IconX size={13} /> 학생 화면에서 내리기
                  </Button>
                </div>
              </div>
            ) : null}

            {history.length ? (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700">
                  <IconRefresh size={12} /> 최근에 띄운 자료
                </p>
                <div className="mt-2 space-y-1">
                  {history.map((entry) => (
                    <div
                      key={`${entry.id}-${entry.title}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[11.5px] font-semibold text-slate-700">
                          {entry.title}
                        </span>
                        <span className="block truncate text-[9.5px] text-slate-400">
                          {entry.kind === "url" ? entry.url : entry.kind === "note" ? "안내문" : "활동 보드"}
                        </span>
                      </span>
                      <button
                        onClick={() => reopen(entry)}
                        disabled={!connected || (entry.kind === "board" && !board)}
                        className="shrink-0 rounded-md bg-white px-2 py-1 text-[10.5px] font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50"
                      >
                        다시 띄우기
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="손든 학생"
              description="학생이 손들기를 누르면 실시간으로 표시됩니다. 확인을 누르면 학생 화면에 알림이 갑니다."
            />
            <Badge tone={hands.length ? "warn" : "neutral"} dot={hands.length > 0}>
              {hands.length}명
            </Badge>
          </div>
          {hands.length === 0 ? (
            <p className="px-5 py-5 text-[11.5px] text-slate-400">
              손든 학생이 없습니다. 학생 화면의 “손들기” 버튼을 누르면 여기에 나타납니다.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {hands.map((student) => (
                <div key={student.participantId} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={student.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-slate-900">{student.name}</p>
                      <p className="text-[10.5px] text-slate-400">{student.team ?? "모둠 미지정"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        send({ type: "nudge", to: student.participantId, text: "손 들었어요. 선생님이 곧 갑니다." })
                      }
                    >
                      확인
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => send({ type: "hand_clear", to: student.participantId })}
                    >
                      내리기
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="수업 타이머"
              description="50분 수업을 기준으로 전체 학생 화면에 남은 시간을 함께 표시합니다."
              action={<IconClock size={18} className="text-brand-600" />}
            />
          </div>
          <div className="space-y-3 p-5">
            <div
              className={cx(
                "rounded-2xl px-4 py-6 text-center ring-1",
                timer
                  ? remaining <= 60_000
                    ? "bg-rose-50 ring-rose-200"
                    : "bg-brand-50 ring-brand-100"
                  : "bg-slate-50 ring-slate-200",
              )}
            >
              <p
                className={cx(
                  "font-mono text-[42px] font-extrabold leading-none tracking-tight",
                  timer ? (remaining <= 60_000 ? "text-rose-700" : "text-brand-800") : "text-slate-400",
                )}
              >
                {timer ? clock(remaining) : "--:--"}
              </p>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                {timer ? (remaining > 0 ? "남은 시간" : "시간 종료") : "타이머가 꺼져 있습니다"}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {TIMER_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => setDuration(minutes)}
                  className={cx(
                    "rounded-lg px-3 py-1.5 text-[12px] font-semibold ring-1 transition",
                    duration === minutes
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                  )}
                >
                  {minutes}분
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={120}
                value={duration}
                onChange={(event) => setDuration(Math.min(120, Math.max(1, Number(event.target.value) || 1)))}
                className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-semibold text-slate-700"
                aria-label="타이머 분"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!connected}
                onClick={() => send({ type: "timer_set", action: "start", durationSec: duration * 60 })}
              >
                <IconPlay size={14} /> {timer ? "다시 시작" : "타이머 시작"}
              </Button>
              {timer ? (
                <Button size="sm" variant="secondary" onClick={() => send({ type: "timer_set", action: "stop" })}>
                  끄기
                </Button>
              ) : null}
            </div>
            <p className="text-[10.5px] leading-relaxed text-slate-400">
              수업이 끝나면 타이머는 서버에서 즉시 삭제됩니다. 남은 시간은 학생 화면 상단에 항상
              표시됩니다.
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader title="전체 알림" description="접속한 모든 학생 화면에 짧은 안내를 보냅니다." />
          </div>
          <div className="space-y-2 p-5">
            <Input
              placeholder="예: 지금부터 5분 뒤에 정리합니다."
              maxLength={140}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                const value = event.currentTarget.value.trim();
                if (!value) return;
                send({ type: "nudge_all", text: value });
                event.currentTarget.value = "";
                announce("전체 알림을 보냈습니다.");
              }}
            />
            <p className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
              <IconInfo size={12} /> 입력하고 Enter를 누르면 바로 전송됩니다. 접속 {online.length}명.
            </p>
          </div>
        </Card>

        <NoticeQuiz
          quiz={quiz}
          results={results}
          settings={settings}
          connected={connected}
          send={send}
        />

        <Callout tone="warn" icon={<IconAlert size={15} />} title="전체화면은 학생이 한 번 눌러야">
          브라우저 보안 정책상 다른 기기의 화면을 강제로 전체화면으로 바꿀 수는 없습니다. “전체화면
          요청”을 켜면 학생 화면에 큰 안내와 버튼이 뜨고, 누르는 즉시 전체화면으로 전환됩니다.
        </Callout>

        <Callout tone="info" icon={<IconHand size={15} />}>
          “선생님 화면 공유”는 화면 공유 탭에서, 학생 화면을 크게 보는 것은 같은 탭의 “크게 보기”를
          사용하세요. 프로젝터에 그대로 띄울 수 있습니다.
        </Callout>
      </div>
    </div>
  );
}


