import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api";
import { useClassroomSocket } from "../lib/realtime";
import {
  FocusEventThrottle,
  classifyKeystroke,
  readFullscreen,
  readVisibility,
  requestClassroomFullscreen,
} from "../lib/focus";
import { clearStudent, loadStudent } from "../lib/studentStore";
import type {
  BoardColor,
  ClassTimer,
  ClassroomPublicInfo,
  ClassToolsState,
  GameState,
  LiveBoard,
  LiveQuiz,
  MiniGameState,
  PresenterPick,
  RosterState,
  ServerMessage,
  StageContent,
  StudentLive,
  StudentSnapshot,
  TeamBoard,
  WorksheetState,
} from "../../shared/protocol";
import { DEFAULT_SETTINGS, type ClassSettings } from "../../shared/settings";
import { teamLabels, teamTone } from "../../shared/roster";
import { LogoMark } from "../components/Logo";
import { LiveVideo } from "../components/LiveVideo";
import { PdfAnnotator } from "../components/PdfAnnotator";
import { MiniGameCard } from "../components/MiniGameCard";
import {
  Badge,
  Button,
  Callout,
  Card,
  Input,
  Modal,
  Skeleton,
  Spinner,
  Textarea,
  cx,
} from "../components/ui";
import {
  IconAlert,
  IconCast,
  IconCheck,
  IconClock,
  IconDownload,
  IconExternal,
  IconFileText,
  IconHand,
  IconInfo,
  IconLayout,
  IconLock,
  IconMaximize,
  IconMonitor,
  IconRadio,
  IconRefresh,
  IconTrophy,
  IconUsers,
  IconVideo,
  IconVideoOff,
  IconX,
} from "../components/Icons";
import { formatBytes, formatTime } from "../lib/format";
import { isSfxEnabled, playCue, setSfxEnabled } from "../lib/sfx";
import {
  takePendingStudentShare,
  useStudentScreenShare,
  type StudentScreenShare,
} from "../lib/screenShare";
import {
  addChunk,
  createTransferBuffer,
  downloadBlob,
  finishTransfer,
  type IncomingTransfer,
} from "../lib/fileTransfer";

const BOARD_COLORS: { id: BoardColor; className: string; label: string }[] = [
  { id: "yellow", className: "bg-amber-300", label: "노랑" },
  { id: "rose", className: "bg-rose-300", label: "분홍" },
  { id: "sky", className: "bg-sky-300", label: "하늘" },
  { id: "emerald", className: "bg-emerald-300", label: "초록" },
  { id: "violet", className: "bg-violet-300", label: "보라" },
  { id: "slate", className: "bg-slate-300", label: "회색" },
];

const BOARD_CARD_CLASS: Record<string, string> = {
  yellow: "bg-amber-100 text-amber-950 ring-amber-200",
  rose: "bg-rose-100 text-rose-950 ring-rose-200",
  sky: "bg-sky-100 text-sky-950 ring-sky-200",
  emerald: "bg-emerald-100 text-emerald-950 ring-emerald-200",
  violet: "bg-violet-100 text-violet-950 ring-violet-200",
  slate: "bg-slate-100 text-slate-900 ring-slate-200",
};

function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Full-screen content pushed by the teacher. Fullscreen itself needs a tap, so
 * the overlay always shows a big button and also attempts the transition when
 * the browser allows it.
 */
function StageOverlay({
  stage,
  board,
  allowPosts,
  ended,
  onAddCard,
  onHide,
}: {
  stage: StageContent;
  board: LiveBoard | null;
  allowPosts: boolean;
  ended: boolean;
  onAddCard: (text: string) => void;
  onHide: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [refused, setRefused] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!stage.requireFullscreen) return;
    boxRef.current
      ?.requestFullscreen?.({ navigationUI: "hide" })
      .then(() => setRefused(false))
      .catch(() => setRefused(true));
  }, [stage.id, stage.requireFullscreen]);

  const goFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await boxRef.current?.requestFullscreen({ navigationUI: "hide" });
      setRefused(false);
    } catch {
      setRefused(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950">
      <div ref={boxRef} className="flex h-full flex-col bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-white">
            <IconCast size={15} className="shrink-0 text-brand-300" />
            <span className="truncate">{stage.title}</span>
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {stage.url ? (
              <a
                href={stage.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/20"
              >
                <IconExternal size={14} /> 새 창
              </a>
            ) : null}
            <button
              onClick={() => void goFullscreen()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/20"
            >
              <IconMaximize size={14} /> {fullscreen ? "전체화면 해제" : "전체화면"}
            </button>
            <button
              onClick={onHide}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/20"
            >
              <IconX size={14} /> 잠시 숨기기
            </button>
          </div>
        </div>

        {stage.requireFullscreen && !fullscreen ? (
          <button
            onClick={() => void goFullscreen()}
            className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-[12.5px] font-bold text-amber-950 hover:bg-amber-300"
          >
            <IconMaximize size={15} /> 선생님이 전체화면을 요청했습니다 — 여기를 누르세요
          </button>
        ) : null}
        {refused && stage.requireFullscreen ? (
          <p className="bg-slate-900 px-4 py-1.5 text-center text-[10.5px] text-white/50">
            이 브라우저가 자동 전체화면을 막았습니다. 위 버튼을 한 번 눌러 주세요.
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto bg-white">
          {stage.kind === "url" && stage.url ? (
            <iframe
              src={stage.url}
              title={stage.title}
              className="h-full w-full border-0 bg-white"
              allow="camera; microphone; fullscreen; display-capture; clipboard-write "
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : null}
          {stage.kind === "note" ? (
            <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-700 to-indigo-900 p-8">
              <div className="max-w-3xl text-center">
                <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-200">
                  {stage.title}
                </p>
                <p className="mt-4 whitespace-pre-wrap text-[clamp(22px,4vw,42px)] font-extrabold leading-snug text-white">
                  {stage.body}
                </p>
              </div>
            </div>
          ) : null}
          {stage.kind === "board" ? (
            <div className="min-h-full bg-slate-100 p-4 sm:p-6">
              {!board ? (
                <p className="py-16 text-center text-[14px] font-semibold text-slate-500">
                  선생님이 보드를 닫았습니다.
                </p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-[clamp(18px,2.5vw,28px)] font-extrabold text-slate-900">
                        {board.title}
                      </h2>
                      {board.instructions ? (
                        <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-slate-500">
                          {board.instructions}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
                      카드 {board.cards.length}장
                    </span>
                  </div>
                  {allowPosts && !ended ? (
                    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        maxLength={280}
                        placeholder="여기에 적고 ‘카드 붙이기’를 누르면 보드에 바로 붙습니다."
                        className="min-h-20 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">{draft.length}/280자</span>
                        <button
                          onClick={() => {
                            if (!draft.trim()) return;
                            onAddCard(draft.trim());
                            setDraft("");
                          }}
                          disabled={!draft.trim()}
                          className="rounded-xl bg-brand-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          카드 붙이기
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {board.cards.map((card) => (
                      <div
                        key={card.id}
                        className={cx(
                          "rounded-xl p-4 text-[clamp(14px,1.6vw,20px)] leading-relaxed ring-1",
                          BOARD_CARD_CLASS[card.color] ?? BOARD_CARD_CLASS.yellow,
                        )}
                      >
                        <p className="whitespace-pre-wrap">{card.text}</p>
                        <p className="mt-2 text-[10px] opacity-60">{card.author}</p>
                      </div>
                    ))}
                    {board.cards.length === 0 ? (
                      <p className="col-span-full py-10 text-center text-[13px] text-slate-400">
                        아직 카드가 없습니다.
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function StudentRoom() {
  const { code = "" } = useParams();
  const joinCode = code.trim().toUpperCase();
  const navigate = useNavigate();
  const stored = useMemo(() => loadStudent(joinCode), [joinCode]);

  const [classroom, setClassroom] = useState<ClassroomPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<LiveQuiz | null>(null);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [worksheet, setWorksheet] = useState<WorksheetState | null>(null);
  const [worksheetText, setWorksheetText] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [game, setGame] = useState<GameState>({
    mode: "classic",
    round: 0,
    totalRounds: 1,
    scores: [],
    teams: [],
    lobbyOpen: false,
    items: [],
    feed: [],
  });
  const [stage, setStage] = useState<StageContent | null>(null);
  const [timer, setTimer] = useState<ClassTimer | null>(null);
  const [teamBoard, setTeamBoard] = useState<TeamBoard | null>(null);
  const [presenter, setPresenter] = useState<PresenterPick | null>(null);
  const [minigame, setMinigame] = useState<MiniGameState | null>(null);
  const [tools, setTools] = useState<ClassToolsState>({ scores: {}, checkinOpen: false, attendance: [] });
  const [roster, setRoster] = useState<RosterState>({
    teamCount: 4,
    teamOpen: false,
    seatRows: 5,
    seatCols: 6,
    seatOpen: false,
  });
  const [me, setMe] = useState<StudentLive | null>(null);
  const [connectAnswers, setConnectAnswers] = useState<Record<string, string>>({});
  const quizIdRef = useRef<string | null>(null);
  const [sfx, setSfx] = useState(() => isSfxEnabled());
  const [settings, setSettings] = useState<ClassSettings>(DEFAULT_SETTINGS);
  const settingsTouched = useRef(false);
  const [worksheetLocked, setWorksheetLocked] = useState(false);
  const [fullscreenRequested, setFullscreenRequested] = useState(false);
  const [teamText, setTeamText] = useState("");
  const [foundWord, setFoundWord] = useState("");
  const [stageHidden, setStageHidden] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [board, setBoard] = useState<LiveBoard | null>(null);
  const [boardText, setBoardText] = useState("");
  const [boardColor, setBoardColor] = useState<BoardColor>("yellow");
  const [boardColumn, setBoardColumn] = useState("");
  const [fullscreen, setFullscreen] = useState<boolean | null>(() => readFullscreen());
  const [visibility, setVisibility] = useState(readVisibility());
  const [online, setOnline] = useState(navigator.onLine);
  const [ended, setEnded] = useState(false);
  const [observing, setObserving] = useState(false);
  const [spellAnswer, setSpellAnswer] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [materialBlob, setMaterialBlob] = useState<Blob | null>(null);
  const [materialUrl, setMaterialUrl] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<"idle" | "receiving" | "ready" | "error">("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const worksheetIdRef = useRef<string | null>(null);
  const worksheetRef = useRef<WorksheetState | null>(null);
  worksheetRef.current = worksheet;
  const transferRef = useRef<IncomingTransfer | null>(null);
  const lastChunkAt = useRef(0);
  const shareRef = useRef<StudentScreenShare | null>(null);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!materialUrl) return;
    return () => URL.revokeObjectURL(materialUrl);
  }, [materialUrl]);

  const resetMaterial = useCallback(() => {
    transferRef.current = null;
    setMaterialBlob(null);
    setMaterialUrl(null);
    setDownloadState("idle");
    setDownloadProgress(0);
    setDownloadError(null);
  }, []);

  const applySnapshot = useCallback(
    (snapshot: StudentSnapshot) => {
      setQuiz(snapshot.quiz);
      setMyAnswer(snapshot.myQuizAnswer);
      if (snapshot.quiz?.mode === "spell") setSpellAnswer(snapshot.myQuizAnswer ?? "");
      if (snapshot.quiz?.mode === "connect" && snapshot.myQuizAnswer) {
        try {
          const parsed = JSON.parse(snapshot.myQuizAnswer) as Record<string, string>;
          if (parsed && typeof parsed === "object") setConnectAnswers(parsed);
        } catch {
          /* not a connect payload */
        }
      }
      setWorksheet(snapshot.worksheet);
      setWorksheetLocked(snapshot.myWorksheetLocked);
      setBoard(snapshot.board);
      setStage(snapshot.stage);
      setTimer(snapshot.timer);
      setGame(snapshot.game);
      setTeamBoard(snapshot.teamBoard);
      setPresenter(snapshot.presenter);
      setMinigame(snapshot.minigame);
      setTools(snapshot.tools ?? { scores: {}, checkinOpen: false, attendance: [] });
      if (snapshot.roster) setRoster(snapshot.roster);
      if (snapshot.settings) {
        setSettings(snapshot.settings);
        if (!settingsTouched.current) {
          settingsTouched.current = true;
          setSfx(snapshot.settings.soundEnabled);
          setSfxEnabled(snapshot.settings.soundEnabled);
        }
      }
      setMe(snapshot.self);
      if (snapshot.quiz?.id !== quizIdRef.current) {
        quizIdRef.current = snapshot.quiz?.id ?? null;
        setConnectAnswers({});
      }
      setObserving(snapshot.observing);
      if (snapshot.worksheet?.id !== worksheetIdRef.current) {
        worksheetIdRef.current = snapshot.worksheet?.id ?? null;
        setWorksheetText(snapshot.myWorksheet ?? "");
        setAnswers(snapshot.myWorksheetAnswers ?? {});
        resetMaterial();
      } else {
        if (snapshot.myWorksheet !== null) {
          setWorksheetText((current) => (current === "" ? snapshot.myWorksheet ?? "" : current));
        }
        if (snapshot.myWorksheetAnswers) {
          setAnswers((current) =>
            Object.keys(current).length ? current : snapshot.myWorksheetAnswers ?? current,
          );
        }
      }
      if (snapshot.self) {
        setFullscreen(snapshot.self.fullscreen);
        setVisibility(snapshot.self.visibility === "hidden" ? "hidden" : "visible");
        setHandRaised(snapshot.self.handRaised);
      }
      if (snapshot.status === "ended") setEnded(true);
    },
    [resetMaterial],
  );

  const onMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "snapshot":
          if (message.role === "student") applySnapshot(message.snapshot);
          break;
        case "quiz":
          setQuiz(message.quiz);
          if (message.quiz?.id !== quizIdRef.current) {
            quizIdRef.current = message.quiz?.id ?? null;
            setConnectAnswers({});
          }
          if (message.yourAnswer !== undefined) {
            setMyAnswer(message.yourAnswer);
            if (message.quiz?.mode === "spell") setSpellAnswer(message.yourAnswer ?? "");
            if (message.quiz?.mode === "connect" && message.yourAnswer) {
              try {
                const parsed = JSON.parse(message.yourAnswer) as Record<string, string>;
                if (parsed && typeof parsed === "object") setConnectAnswers(parsed);
              } catch {
                /* not a connect payload */
              }
            }
          }
          break;
        case "observe":
          setObserving(message.observing);
          break;
        case "worksheet":
          setWorksheet(message.worksheet);
          if (message.locked !== undefined) {
            // The lock is the server's answer, never a local guess: a rejected
            // submit must leave the form editable.
            setWorksheetLocked(message.locked);
            setSaveState(message.locked ? "saved" : "idle");
          }
          if (message.worksheet?.id !== worksheetIdRef.current) {
            // A new worksheet has new field ids, so previous answers must go.
            worksheetIdRef.current = message.worksheet?.id ?? null;
            setWorksheetText("");
            setAnswers({});
            setSaveState("idle");
            resetMaterial();
          }
          break;
        case "teams":
          setTeamBoard(message.boards[0] ?? null);
          break;
        case "presenter":
          setPresenter(message.presenter);
          break;
        case "minigame":
          setMinigame(message.game);
          break;
        case "tools":
          setTools(message.tools);
          break;
        case "roster":
          setRoster(message.roster);
          break;
        case "settings":
          setSettings(message.settings);
          break;
        case "you":
          setMe(message.self);
          break;
        case "error":
          // Server-side rejections (locked worksheet, closed quiz, …) used to
          // vanish silently; show them and undo the optimistic worksheet lock.
          setNotice(message.message);
          setSaveState("idle");
          if (message.message.includes("학습지")) {
            setWorksheetLocked(message.message.includes("이미 제출"));
          }
          break;
        case "fullscreen_request":
          setFullscreenRequested(true);
          break;
        case "board":
          setBoard(message.board);
          if (!message.board) setBoardText("");
          break;
        case "stage":
          setStage(message.stage);
          if (!message.stage) setStageHidden(null);
          break;
        case "timer":
          setTimer(message.timer);
          break;
        case "game":
          setGame(message.game);
          break;
        case "file_chunk": {
          const material = worksheetRef.current?.material;
          if (!material || material.id !== message.materialId) break;
          lastChunkAt.current = Date.now();
          let transfer = transferRef.current;
          if (!transfer || transfer.transferId !== message.transferId) {
            transfer = createTransferBuffer(message);
            transferRef.current = transfer;
          }
          const { done, progress } = addChunk(transfer, message.index, message.data);
          setDownloadProgress(progress);
          setDownloadState("receiving");
          if (done) {
            const blob = finishTransfer(transfer);
            if (blob.size !== message.size) {
              setDownloadState("error");
              setDownloadError("받은 파일 크기가 원본과 다릅니다. 다시 요청해 주세요.");
              transferRef.current = null;
              break;
            }
            setMaterialBlob(blob);
            setMaterialUrl(URL.createObjectURL(blob));
            setDownloadState("ready");
            setDownloadError(null);
          }
          break;
        }
        case "rtc":
          shareRef.current?.handleSignal(message);
          break;
        case "notice":
          setNotice(message.text);
          if (message.text.includes("종료")) setEnded(true);
          break;
        default:
          break;
      }
    },
    [applySnapshot, resetMaterial],
  );

  useEffect(() => {
    if (!stored) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api.join.info(joinCode),
      api.join.state(joinCode, stored.token).catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 401) {
          clearStudent(joinCode);
          navigate(`/join/${joinCode}`, { replace: true });
        }
        throw error;
      }),
    ])
      .then(([{ classroom: info }, { snapshot }]) => {
        if (!active) return;
        setClassroom(info);
        applySnapshot(snapshot);
      })
      .catch((caught) => {
        if (!active) return;
        setLoadError(
          caught instanceof ApiRequestError ? caught.message : "수업 상태를 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applySnapshot, joinCode, navigate, stored]);

  const socket = useClassroomSocket({
    classroomId: classroom?.id ?? "",
    role: "student",
    token: stored?.token,
    enabled: Boolean(classroom && stored && !ended),
    onMessage,
  });
  const { send: socketSend, status: socketStatus } = socket;
  const adoptedShare = useRef(false);

  const screenShare = useStudentScreenShare({
    send: socketSend,
    onEvent: (eventType) => socketSend({ type: "event", eventType }),
  });
  shareRef.current = screenShare;

  // A screen picked on the join screen is adopted as soon as the socket opens,
  // and the teacher is asked to (re)send the shared screen to this connection.
  useEffect(() => {
    if (socketStatus !== "open" || adoptedShare.current) return;
    adoptedShare.current = true;
    const pending = takePendingStudentShare();
    if (pending) {
      void pending.then((stream) => {
        if (stream) void screenShare.startWith(stream);
      });
    }
    socketSend({
      type: "rtc",
      to: "teacher",
      signal: { kind: "request", purpose: "teacher-screen" },
    });
  }, [screenShare, socketSend, socketStatus]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  // Activity inputs only: never global keystrokes, password fields or other apps.
  useEffect(() => {
    if (!observing || !worksheet || ended || socketStatus !== "open") return;
    const timer = window.setTimeout(() => {
      socketSend({ type: "input_preview", field: "학습지 답변", text: worksheetText.slice(0, 2000) });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [ended, observing, socketSend, socketStatus, worksheet, worksheetText]);

  useEffect(() => {
    if (!observing || !board || ended || socketStatus !== "open") return;
    const timer = window.setTimeout(() => {
      socketSend({ type: "input_preview", field: "보드 카드", text: boardText.slice(0, 2000) });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [board, boardText, ended, observing, socketSend, socketStatus]);

  const sendFocus = useCallback(() => {
    socketSend({
      type: "focus",
      fullscreen: readFullscreen(),
      visibility: readVisibility(),
      online: navigator.onLine,
    });
  }, [socketSend]);

  const leaveBeacon = useCallback(() => {
    if (!stored) return;
    try {
      void fetch(`/api/v1/join/${joinCode}/leave`, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "x-aic-client": "web",
          "x-aic-participant": stored.token,
        },
        body: "{}",
      });
    } catch {
      /* the socket close still records the disconnect */
    }
  }, [joinCode, stored]);

  useEffect(() => {
    if (socketStatus !== "open") return;
    sendFocus();
    socketSend({ type: "heartbeat", at: Date.now() });
    const timer = window.setInterval(() => {
      socketSend({ type: "heartbeat", at: Date.now() });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [sendFocus, socketSend, socketStatus]);

  useEffect(() => {
    const throttle = new FocusEventThrottle(15_000);
    const onFullscreenChange = () => {
      setFullscreen(readFullscreen());
      sendFocus();
    };
    const onVisibilityChange = () => {
      setVisibility(readVisibility());
      // Refresh the clock right away: a hidden tab throttles the tick interval.
      setNow(Date.now());
      sendFocus();
    };
    const onOnline = () => {
      setOnline(true);
      sendFocus();
      socketSend({ type: "event", eventType: "network_online" });
    };
    const onOffline = () => {
      setOnline(false);
      sendFocus();
      socketSend({ type: "event", eventType: "network_offline" });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const observation = classifyKeystroke(event);
      if (observation && throttle.shouldSend(observation.detail)) {
        socketSend({ type: "event", eventType: observation.type, detail: observation.detail });
      }
    };
    const onPageHide = () => {
      sendFocus();
      leaveBeacon();
    };
    const onPageShow = () => {
      setVisibility(readVisibility());
      sendFocus();
      socketSend({ type: "event", eventType: "page_return" });
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [leaveBeacon, sendFocus, socketSend]);

  useEffect(() => {
    if (fullscreen === true) setDismissedPrompt(false);
  }, [fullscreen]);

  useEffect(() => {
    if (!notice) return;
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, [notice]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (downloadState !== "receiving") return;
      const transfer = transferRef.current;
      if (!transfer) return;
      setDownloadProgress(transfer.received / transfer.total);
    }, 700);
    return () => window.clearInterval(timer);
  }, [downloadState]);

  // A relay that stalls (teacher console closed, socket blip) must not leave the
  // button stuck on "받는 중" forever.
  useEffect(() => {
    if (downloadState !== "receiving") return;
    const timer = window.setInterval(() => {
      if (Date.now() - lastChunkAt.current < 20_000) return;
      transferRef.current = null;
      setDownloadState("error");
      setDownloadError("PDF 전송이 멈쳤습니다. 선생님 수업 화면이 열려 있는지 확인하고 다시 요청해 주세요.");
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [downloadState]);

  // Short game cues: a new question, the answer reveal, a solved 초성 퀴즈.
  const cueQuiz = useRef("");
  useEffect(() => {
    if (!quiz) return;
    const key = `${quiz.id}:${quiz.status}`;
    if (cueQuiz.current === key) return;
    cueQuiz.current = key;
    if (quiz.status === "open") {
      playCue("start");
      return;
    }
    const correct = Boolean(
      quiz.correctAnswer && myAnswer && quiz.correctAnswer.trim() === myAnswer.trim(),
    );
    playCue(correct ? "correct" : "wrong");
  }, [myAnswer, quiz]);

  const cueJamo = useRef("");
  useEffect(() => {
    if (minigame?.kind !== "jamo") return;
    const key = `${minigame.index}:${minigame.solved}`;
    if (cueJamo.current === key) return;
    cueJamo.current = key;
    if (minigame.solved) playCue("win");
  }, [minigame]);

  // 보기 순서는 문제마다 한 번만 섞습니다(다시 그려도 순서가 바뀌지 않도록).
  const connectRights = useMemo(() => {
    const list = quiz?.mode === "connect" ? [...quiz.rights] : [];
    for (let index = list.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [list[index], list[swap]] = [list[swap], list[index]];
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id]);

  if (!stored) return <Navigate to={`/join/${joinCode}`} replace />;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fb]">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError || !classroom) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6fb] px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <IconAlert size={22} />
          </span>
          <h1 className="mt-4 text-[17px] font-bold text-slate-900">수업 화면을 열 수 없습니다</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
            {loadError ?? "참가 정보가 만료되었을 수 있습니다."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              <IconRefresh size={15} /> 다시 시도
            </Button>
            <Button
              onClick={() => {
                clearStudent(joinCode);
                navigate(`/join/${joinCode}`, { replace: true });
              }}
            >
              다시 참가
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const showFullscreenPrompt =
    classroom.requireFullscreen &&
    settings.requireFullscreen &&
    fullscreen === false &&
    !dismissedPrompt &&
    !ended;

  const myGame = game.scores.find((score) => score.participantId === stored.participantId) ?? null;
  const canPostToBoard = Boolean(board?.allowStudentPosts) && settings.allowStudentPosts;
  // A background tab throttles the tick interval, so `now` can lag behind the
  // real clock. Clamping keeps the countdown from ever showing more than the
  // configured duration.
  const timerRemaining = timer
    ? Math.max(0, Math.min(timer.durationSec * 1000, timer.endsAt - now))
    : 0;
  const quizTimeLeft = quiz?.endsAt
    ? Math.max(0, Math.min(quiz.durationSec ? quiz.durationSec * 1000 : Infinity, quiz.endsAt - now))
    : null;
  const quizTimeOver = quizTimeLeft !== null && quizTimeLeft <= 0;
  const eliminated = quiz?.gameMode === "goldenbell" && myGame !== null && !myGame.alive;
  const quizOpen = Boolean(quiz && quiz.status === "open" && !quizTimeOver && !eliminated);

  const toggleHand = () => {
    if (ended) return;
    const next = !handRaised;
    setHandRaised(next);
    socketSend({ type: "hand", raised: next });
  };

  const answerQuiz = (optionId: string) => {
    if (!quiz || !quizOpen || ended) return;
    setMyAnswer(optionId);
    socketSend({ type: "quiz_answer", optionId });
  };

  const submitSpell = () => {
    if (!quiz || !quizOpen || ended || !spellAnswer.trim()) return;
    const text = spellAnswer.trim();
    setMyAnswer(text);
    socketSend({ type: "quiz_answer", text });
  };

  const submitConnect = () => {
    if (!quiz || quiz.mode !== "connect" || !quizOpen || ended) return;
    if (quiz.lefts.some((left) => !connectAnswers[left])) return;
    const text = JSON.stringify(connectAnswers);
    setMyAnswer(text);
    socketSend({ type: "quiz_answer", text });
  };

  const useItem = (item: string) => {
    if (ended) return;
    socketSend({ type: "item_use", item: item as "double" | "steal" | "bonus" });
  };

  const submitWorksheet = () => {
    if (!worksheet || ended || worksheetLocked) return;
    setSaveState("saving");
    socketSend({ type: "worksheet_save", text: worksheetText, answers });
  };

  const requestFullscreenNow = async () => {
    const ok = await requestClassroomFullscreen();
    setFullscreen(readFullscreen());
    if (ok) setFullscreenRequested(false);
    else setNotice("브라우저가 전체화면 전환을 허용하지 않았습니다. 주소 표시줄의 전체화면 버튼을 사용해 주세요.");
  };

  const requestMaterial = () => {
    const material = worksheet?.material;
    if (!material) return;
    setDownloadState("receiving");
    setDownloadProgress(0);
    setDownloadError(null);
    lastChunkAt.current = Date.now();
    transferRef.current = null;
    socketSend({ type: "file_request", materialId: material.id });
  };

  const addBoardCard = () => {
    if (!board || !boardText.trim() || ended) return;
    socketSend({
      type: "board_add",
      text: boardText.trim(),
      color: boardColor,
      column: board.layout === "columns" ? boardColumn || board.columns[0] || null : null,
    });
    setBoardText("");
  };

  const leaveClass = async () => {
    try {
      screenShare.stop();
      await api.join.leave(joinCode, stored.token);
    } catch {
      /* leaving is best effort */
    }
    clearStudent(joinCode);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] pb-16">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-bold tracking-tight text-slate-900">
                {classroom.title}
              </p>
              <p className="truncate text-[10.5px] text-slate-400">
                {settings.className ? `${settings.className} · ` : ""}
                {classroom.teacherName} 선생님 · {stored.name}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge tone={online ? "ok" : "danger"} dot className="hidden sm:inline-flex">
              {online ? "온라인" : "오프라인"}
            </Badge>
            <Badge
              tone={fullscreen === true ? "ok" : fullscreen === false ? "warn" : "neutral"}
              className="hidden sm:inline-flex"
            >
              <IconMonitor size={11} />
              {fullscreen === true ? "전체화면" : fullscreen === false ? "창 모드" : "확인 불가"}
            </Badge>
            {screenShare.sharing ? (
              <Badge tone="info" dot>
                화면 공유 중
              </Badge>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const next = !sfx;
                setSfx(next);
                setSfxEnabled(next);
                if (next) playCue("tick");
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label={sfx ? "게임 소리 끄기" : "게임 소리 켜기"}
            >
              <IconRadio size={14} /> <span className="hidden sm:inline">{sfx ? "소리 켬" : "소리 끔"}</span>
            </button>
            <Button variant="ghost" size="sm" onClick={() => setLeaveOpen(true)}>
              나가기
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {timer ? (
          <div
            className={cx(
              "flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 ring-1",
              timerRemaining <= 60_000
                ? "bg-rose-50 text-rose-800 ring-rose-200"
                : "bg-brand-50 text-brand-800 ring-brand-100",
            )}
          >
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold">
              <IconClock size={14} /> 수업 남은 시간
            </span>
            <span className="font-mono text-[19px] font-extrabold tracking-tight">
              {countdown(timerRemaining)}
            </span>
          </div>
        ) : null}

        {minigame ? (
          <MiniGameCard
            game={minigame}
            me={stored.participantId}
            now={now}
            foundWord={foundWord}
            onFoundWord={setFoundWord}
            onFind={(word) => {
              socketSend({ type: "word_found", word });
              setFoundWord("");
            }}
            onPass={() => socketSend({ type: "bomb_pass" })}
            onFlip={(cardId) => socketSend({ type: "memory_flip", cardId })}
            onTap={(cell) => socketSend({ type: "speedtap_tap", cell })}
            onJamo={(text) => socketSend({ type: "jamo_answer", text })}
            ended={ended}
          />
        ) : null}

        {tools.checkinOpen || Object.keys(tools.scores).length > 0 ? (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <p className="text-[12.5px] font-semibold text-slate-900">🏆 우리 반 현황</p>
              {tools.checkinOpen ?
                tools.attendance.some((entry) => entry.participantId === stored.participantId) ? (
                  <Badge tone="ok">
                    <IconCheck size={11} /> 출석 완료
                  </Badge>
                ) : (
                  <Button size="sm" disabled={ended} onClick={() => socketSend({ type: "checkin" })}>
                    <IconCheck size={13} /> 출석하기
                  </Button>
                )
              : null}
            </div>
            <div className="space-y-2 p-3">
              {Object.keys(tools.scores).length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(tools.scores)
                    .sort((left, right) => right[1] - left[1])
                    .map(([team, points], index) => (
                      <div
                        key={team}
                        className={cx(
                          "rounded-lg px-2.5 py-1.5",
                          index === 0 ? "bg-amber-50" : "bg-slate-50",
                        )}
                      >
                        <p className="text-[10.5px] font-semibold text-slate-500">{team}</p>
                        <p className="text-[15px] font-extrabold text-slate-900">
                          {points}점 {index === 0 ? "🏆" : ""}
                        </p>
                      </div>
                    ))}
                </div>
              ) : null}
              {tools.checkinOpen ? (
                <p className="text-[10.5px] text-slate-400">
                  선생님이 출석을 받고 있습니다. ‘출석하기’를 한 번만 누르면 됩니다.
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}

        {teamBoard ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <IconUsers size={15} className="text-brand-600" />
                  <p className="text-[12.5px] font-semibold text-slate-900">{teamBoard.team} 토의</p>
                </div>
                <Badge tone="brand">
                  <IconLock size={11} /> 우리 모둠만 보기
                </Badge>
              </div>
              <p className="mt-1 text-[10.5px] text-slate-400">
                같은 모둠 친구들의 글만 보입니다. 다른 모둠의 토의는 이 화면에 전송되지 않습니다.
              </p>
            </div>
            <div className="space-y-2 p-4">
              {teamBoard.posts.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-[11.5px] text-slate-400">
                  첫 번째 의견을 남겨 보세요.
                </p>
              ) : (
                teamBoard.posts.map((post) => (
                  <div key={post.id} className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">
                      {post.text}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">{post.author}</p>
                  </div>
                ))
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={teamText}
                  onChange={(event) => setTeamText(event.target.value)}
                  maxLength={400}
                  disabled={ended}
                  placeholder="우리 모둠에게만 보이는 의견"
                  className="min-h-16 text-[12.5px]"
                />
                <Button
                  size="sm"
                  disabled={ended || !teamText.trim()}
                  onClick={() => {
                    socketSend({ type: "team_post", text: teamText.trim() });
                    setTeamText("");
                  }}
                >
                  보내기
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {screenShare.teacherStream ? (
          <Card className="overflow-hidden border-brand-200 ring-2 ring-brand-500/25">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50/70 px-4 py-2.5">
              <p className="flex items-center gap-2 text-[12.5px] font-bold text-brand-800">
                <IconMonitor size={15} /> 선생님 화면
                <span className="hidden rounded-full bg-white/70 px-2 py-0.5 text-[9.5px] font-semibold text-brand-600 sm:inline">
                  실시간
                </span>
              </p>
              <button
                onClick={async () => {
                  try {
                    if (document.fullscreenElement) {
                      await document.exitFullscreen();
                    } else {
                      await document.getElementById("aic-teacher-stage")?.requestFullscreen();
                    }
                  } catch {
                    setNotice("브라우저가 전체화면을 허용하지 않았습니다.");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50"
              >
                <IconMaximize size={13} /> 전체화면
              </button>
            </div>
            <div id="aic-teacher-stage" className="bg-slate-950">
              <LiveVideo
                stream={screenShare.teacherStream}
                label="선생님이 공유한 화면"
                className="aspect-video w-full bg-slate-950"
              />
            </div>
            <p className="px-4 py-2 text-[10.5px] text-slate-400">
              선생님이 공유를 멈추면 자동으로 사라집니다. 영상은 저장되지 않습니다.
            </p>
          </Card>
        ) : null}

        {ended ? (
          <Callout tone="warn" icon={<IconClock size={16} />} title="수업이 종료되었습니다">
            수업 내용과 참가 정보가 즉시 삭제되었습니다. 새 수업은 선생님께 참가 코드를 받아
            입장해 주세요.
          </Callout>
        ) : null}

        {observing && !ended ? (
          <Callout tone="brand" icon={<IconLock size={16} />} title="선생님이 활동 입력을 보고 있습니다">
            AIC 안의 학습지·보드·게임 답변만 실시간으로 보입니다. 다른 앱, 비밀번호 입력, 키보드
            전체 입력은 수집하지 않습니다.
          </Callout>
        ) : null}

        {screenShare.pendingRequest ? (
          <Callout tone="brand" icon={<IconVideo size={16} />} title="선생님이 화면 공유를 요청했습니다">
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void screenShare.acceptRequest()}>
                <IconVideo size={14} /> 내 화면 공유 허용
              </Button>
              <Button size="sm" variant="secondary" onClick={screenShare.dismissRequest}>
                나중에
              </Button>
            </div>
            <p className="mt-2 text-[11px] opacity-80">
              허용하면 브라우저 선택 창이 열립니다. 선택한 화면만 선생님에게 보입니다.
            </p>
          </Callout>
        ) : null}

        {fullscreenRequested && fullscreen !== true && !ended ? (
          <Callout tone="warn" icon={<IconMaximize size={16} />} title="선생님이 전체화면을 요청했습니다">
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void requestFullscreenNow()}>
                <IconMaximize size={14} /> 지금 전체화면으로
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setFullscreenRequested(false)}>
                나중에
              </Button>
            </div>
          </Callout>
        ) : null}

        {presenter ? (
          <div
            className={cx(
              "flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 ring-1",
              presenter.participantId === stored.participantId
                ? "bg-amber-50 text-amber-900 ring-amber-200"
                : "bg-white text-slate-700 ring-slate-200",
            )}
          >
            <span className="inline-flex items-center gap-2 text-[12.5px] font-bold">
              <IconTrophy size={15} className="text-amber-500" />
              {presenter.participantId === stored.participantId
                ? "🎉 오늘의 발표자로 선정되었습니다!"
                : `오늘의 발표자: ${presenter.name}`}
            </span>
            <span className="text-[10.5px] opacity-70">{presenter.team ?? "모둠 미지정"}</span>
          </div>
        ) : null}

        {notice ? (
          <Callout tone="info" icon={<IconInfo size={16} />}>
            <div className="flex items-start justify-between gap-3">
              <span>{notice}</span>
              <button
                onClick={() => setNotice(null)}
                className="shrink-0 opacity-60 hover:opacity-100"
                aria-label="알림 닫기"
              >
                <IconX size={14} />
              </button>
            </div>
          </Callout>
        ) : null}

        {socketStatus !== "open" && !ended ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[11.5px] text-slate-500">
            <Spinner className="h-3.5 w-3.5 text-brand-500" />
            실시간 연결을 복구하는 중입니다. 수업 참가 상태와 작성 내용은 유지됩니다.
          </div>
        ) : null}

        {screenShare.error ? (
          <Callout tone="warn" icon={<IconAlert size={15} />}>
            <div className="flex items-start justify-between gap-3">
              <span>{screenShare.error}</span>
              <button
                onClick={screenShare.dismissError}
                className="shrink-0 opacity-60 hover:opacity-100"
                aria-label="닫기"
              >
                <IconX size={13} />
              </button>
            </div>
          </Callout>
        ) : null}

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">
                {stored.name.slice(0, 1)}
              </span>
              <div>
                <p className="text-[13px] font-semibold text-slate-900">{stored.name}</p>
                <p className="text-[10.5px] text-slate-400">
                  참가 {formatTime(stored.joinedAt)} · 임시 참가자
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {settings.allowHandRaise ? (
                <Button
                  size="sm"
                  variant={handRaised ? "success" : "secondary"}
                  disabled={ended}
                  onClick={toggleHand}
                >
                  <IconHand size={14} /> {handRaised ? "손 내리기" : "손들기"}
                </Button>
              ) : null}
              {fullscreen !== true && !ended ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const ok = await requestClassroomFullscreen();
                    setFullscreen(readFullscreen());
                    if (!ok) {
                      setNotice(
                        "브라우저가 전체화면 전환을 허용하지 않았습니다. 주소 표시줄의 전체화면 버튼을 사용해 주세요.",
                      );
                    }
                  }}
                >
                  <IconMaximize size={14} /> 전체화면
                </Button>
              ) : null}
              <Badge tone={visibility === "hidden" ? "warn" : "neutral"}>
                {visibility === "hidden" ? "페이지 숨김" : "페이지 표시"}
              </Badge>
            </div>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-slate-400">
            <IconLock size={12} className="mt-0.5 shrink-0" />
            이 이름은 이 수업에서만 사용되고, 수업이 끝나면 참가 정보가 정리됩니다.
          </p>
        </div>

        {settings.joinNotice ? (
          <Callout tone="info" icon={<IconAlert size={15} />} className="mt-1">
            {settings.joinNotice}
          </Callout>
        ) : null}

        {settings.allowStudentShare ? (
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <IconVideo size={16} className="text-brand-600" />
                <p className="text-[13px] font-semibold text-slate-900">내 화면 공유</p>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                내가 선택한 화면을 선생님이 실시간으로 볼 수 있습니다. 언제든 중지할 수 있습니다.
              </p>
            </div>
            <Badge tone={screenShare.sharing ? "info" : "neutral"} dot={screenShare.sharing}>
              {screenShare.sharing ? "공유 중" : "대기"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <p className="text-[10.5px] leading-relaxed text-slate-400">
              브라우저가 화면 선택을 요구합니다. 허용하지 않으면 아무것도 전송되지 않습니다.
            </p>
            {screenShare.sharing ? (
              <Button size="sm" variant="danger" onClick={screenShare.stop}>
                <IconVideoOff size={14} /> 공유 중지
              </Button>
            ) : (
              <Button size="sm" variant="secondary" disabled={ended} onClick={() => void screenShare.start()}>
                <IconVideo size={14} /> 내 화면 공유
              </Button>
            )}
          </div>
        </Card>
        ) : null}

        {game.lobbyOpen && !quiz ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <p className="text-[12.5px] font-semibold text-slate-900">🏁 게임 대기 중</p>
            </div>
            <div className="space-y-2 p-4">
              <p className="text-[12px] text-slate-600">
                선생님이 시작하면 문제가 나타납니다. 지금 <b>{game.scores.length}명</b>이 함께하고
                있습니다.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {game.scores.map((score) => (
                  <span
                    key={score.participantId}
                    className={cx(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                      score.participantId === stored.participantId
                        ? "bg-slate-900 text-white ring-slate-900"
                        : teamTone(score.team).chip,
                    )}
                  >
                    {score.name}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {game.mode === "item" && game.items.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <p className="text-[12.5px] font-semibold text-slate-900">🎁 내 아이템</p>
              <span className="text-[10.5px] text-slate-400">정답을 맞히면 아이템을 받습니다</span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-3">
              {game.items.map((item) => (
                <button
                  key={`${item.item}-${item.at}`}
                  type="button"
                  disabled={ended}
                  onClick={() => useItem(item.item)}
                  className="rounded-xl bg-fuchsia-50 px-3 py-2 text-left ring-1 ring-fuchsia-200 transition hover:bg-fuchsia-100 disabled:opacity-60"
                >
                  <span className="block text-[11.5px] font-extrabold text-fuchsia-800">
                    {item.item === "double" ? "더블" : item.item === "steal" ? "훔치기" : "+50점"}
                  </span>
                  <span className="block text-[9.5px] text-fuchsia-600">
                    {item.item === "double"
                      ? "다음 정답 2배"
                      : item.item === "steal"
                        ? "1등 점수 10% 흡수"
                        : "즉시 +50점"}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        ) : null}

        {roster.teamOpen || roster.seatOpen || me?.team || me?.seat != null ? (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <p className="text-[12.5px] font-semibold text-slate-900">🪑 내 모둠·자리</p>
              <span className="text-[10.5px] text-slate-400">
                {me?.seat != null ? `${me.seat + 1}번 자리` : "자리 미배정"}
              </span>
            </div>
            <div className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] font-semibold text-slate-500">모둠</span>
                {roster.teamOpen ? (
                  teamLabels(roster.teamCount).map((team) => (
                    <button
                      key={team}
                      type="button"
                      disabled={ended}
                      onClick={() => socketSend({ type: "team_take", team })}
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition disabled:opacity-60",
                        me?.team === team
                          ? "bg-slate-900 text-white ring-slate-900"
                          : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                      )}
                    >
                      {team}
                    </button>
                  ))
                ) : (
                  <Badge tone="brand">{me?.team ?? "아직 배정되지 않았습니다"}</Badge>
                )}
              </div>
              {roster.seatOpen ? (
                <div className="space-y-1">
                  <p className="text-[10.5px] font-semibold text-slate-500">빈자리를 눌러 앉기</p>
                  <div className="space-y-1">
                    {Array.from({ length: Math.max(1, roster.seatRows) }, (_, row) => (
                      <div
                        key={row}
                        className="grid gap-1"
                        style={{ gridTemplateColumns: `repeat(${Math.max(2, roster.seatCols)}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: Math.max(2, roster.seatCols) }, (_, col) => {
                          const seat = row * roster.seatCols + col;
                          const mine = me?.seat === seat;
                          const taken = !mine && (roster.occupiedSeats ?? []).includes(seat);
                          return (
                            <button
                              key={seat}
                              type="button"
                              disabled={ended || taken}
                              onClick={() => socketSend({ type: "seat_take", seat })}
                              className={cx(
                                "h-7 rounded-md text-[9.5px] font-bold transition",
                                mine
                                  ? "bg-brand-600 text-white"
                                  : taken
                                    ? "bg-slate-200 text-slate-400"
                                    : "bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:bg-brand-50",
                              )}
                            >
                              {mine ? "내 자리" : taken ? "—" : `${seat + 1}`}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {quiz ? (
          <Card className="overflow-hidden">
            <div className="relative bg-gradient-to-br from-brand-600 to-indigo-800 px-5 py-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold tracking-[0.16em] text-indigo-200">
                  LIVE QUIZ · {quiz.round}번 문제
                </span>
                <div className="flex items-center gap-1.5">
                  {quizTimeLeft !== null && quiz.status === "open" ? (
                    <span
                      className={cx(
                        "rounded-full px-2 py-0.5 font-mono text-[10.5px] font-bold",
                        quizTimeLeft <= 5_000 ? "bg-rose-500 text-white" : "bg-white/15 text-white",
                      )}
                    >
                      {countdown(quizTimeLeft)}
                    </span>
                  ) : null}
                  <Badge
                    tone="neutral"
                    className="bg-white/10 text-[10px] text-white ring-white/20"
                  >
                    {eliminated ? "탈락" : quizOpen ? "응답 가능" : "응답 마감"}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 text-[18px] font-bold leading-snug tracking-tight">{quiz.prompt}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-indigo-200">
                응답 {quiz.answerCount}명 ·{" "}
                {myAnswer ? "내 응답 제출됨" : "아직 응답하지 않았습니다"}
                {settings.showLeaderboard ? (
                  <>
                    {" "}·{" "}
                    <IconTrophy size={11} className="text-amber-300" /> 내 점수 {myGame?.points ?? 0}점
                    {myGame && game.scores.length > 1
                      ? ` · ${game.scores.findIndex((score) => score.participantId === stored.participantId) + 1}위`
                      : ""}
                  </>
                ) : null}
              </p>
            </div>
            <div className="space-y-2 p-4">
              {eliminated ? (
                <Callout tone="danger" icon={<IconAlert size={15} />} title="골든벨 탈락">
                  이번 판에서 탈락했습니다. 다른 친구들이 정답을 맞히는 모습을 함께 보세요. 다음 판은
                  선생님이 다시 시작하면 참여할 수 있습니다.
                </Callout>
              ) : null}
              {quiz.mode === "spell" ? (
                <div className="space-y-2">
                  <Textarea
                    value={spellAnswer}
                    onChange={(event) => setSpellAnswer(event.target.value)}
                    maxLength={120}
                    placeholder="정답을 입력하세요"
                    disabled={!quizOpen || ended}
                    className="min-h-16 text-[13px]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-slate-400">
                      {myAnswer ? `내 답: ${myAnswer}` : "아직 제출하지 않았습니다"}
                    </span>
                    <Button
                      size="sm"
                      disabled={!quizOpen || ended || !spellAnswer.trim()}
                      onClick={submitSpell}
                    >
                      <IconCheck size={14} /> 정답 제출
                    </Button>
                  </div>
                </div>
              ) : quiz.mode === "connect" ? (
                <div className="space-y-2">
                  {quiz.lefts.map((left) => (
                    <div key={left} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-2.5 py-2 text-[12px] font-semibold text-slate-700">
                        {left}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">→</span>
                      <select
                        value={connectAnswers[left] ?? ""}
                        disabled={!quizOpen || ended}
                        onChange={(event) =>
                          setConnectAnswers((current) => ({ ...current, [left]: event.target.value }))
                        }
                        className="h-9 w-32 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 disabled:opacity-70"
                        aria-label={`${left} 연결`}
                      >
                        <option value="">선택</option>
                        {connectRights.map((right) => (
                          <option key={right} value={right}>
                            {right}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10.5px] text-slate-400">
                      {myAnswer ? "제출했습니다. 모두 맞혀야 정답!" : "모든 항목을 연결한 뒤 제출하세요"}
                    </span>
                    <Button
                      size="sm"
                      disabled={!quizOpen || ended || quiz.lefts.some((left) => !connectAnswers[left])}
                      onClick={submitConnect}
                    >
                      <IconCheck size={14} /> 연결 제출
                    </Button>
                  </div>
                </div>
              ) : (
                quiz.options.map((option, index) => {
                  const chosen = myAnswer === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => answerQuiz(option.id)}
                      disabled={!quizOpen || ended}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-[13px] transition disabled:opacity-70",
                        chosen
                          ? "border-brand-500 bg-brand-50 font-semibold text-brand-800 ring-1 ring-brand-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50/30",
                      )}
                    >
                      <span
                        className={cx(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                          chosen ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {quiz.mode === "ox"
                          ? option.label
                          : chosen
                            ? <IconCheck size={14} />
                            : String.fromCharCode(65 + index)}
                      </span>
                      {quiz.mode === "ox" ? null : option.label}
                      {quiz.mode === "ox" && chosen ? (
                        <IconCheck size={14} className="ml-auto shrink-0" />
                      ) : null}
                    </button>
                  );
                })
              )}
              {quiz.status === "closed" && quiz.correctAnswer ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] font-semibold text-emerald-800">
                  정답: {quiz.correctAnswer}
                </p>
              ) : null}
              <p className="pt-1 text-[10.5px] text-slate-400">
                제출 후에도 응답을 바꿀 수 있습니다. 제한 시간이 끝나면 서버가 자동으로 마감하고 정답을
                공개합니다.
              </p>
            </div>
          </Card>
        ) : null}

        {worksheet ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <IconFileText size={15} className="text-brand-600" />
                <p className="text-[12.5px] font-semibold text-slate-900">학습지</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-600">
                {worksheet.prompt}
              </p>
            </div>

            {worksheet.material ? (
              <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-slate-200">
                      <IconFileText size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-slate-800">
                        {worksheet.material.name}
                      </p>
                      <p className="text-[10.5px] text-slate-400">
                        {formatBytes(worksheet.material.size)} · PDF
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {materialBlob && materialUrl ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => downloadBlob(materialBlob, worksheet.material?.name ?? "worksheet.pdf")}
                        >
                          <IconDownload size={14} /> 저장
                        </Button>
                        <Badge tone="ok">
                          <IconCheck size={12} /> 받음
                        </Badge>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={downloadState === "receiving"}
                        disabled={downloadState === "receiving" || ended}
                        onClick={requestMaterial}
                      >
                        <IconDownload size={14} />
                        {downloadState === "receiving"
                          ? `받는 중 ${Math.round(downloadProgress * 100)}%`
                          : "학습지 PDF 받기"}
                      </Button>
                    )}
                  </div>
                </div>

                {downloadError ? (
                  <p className="mt-2 text-[11px] font-medium text-rose-600">{downloadError}</p>
                ) : null}

                {materialBlob ? (
                  <div className="mt-3">
                    <PdfAnnotator
                      blob={materialBlob}
                      fileName={worksheet.material?.name ?? "학습지.pdf"}
                      storeKey={`${worksheet.id}:${stored.participantId}`}
                      compact
                    />
                  </div>
                ) : (
                  <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-slate-400">
                    <IconInfo size={12} className="mt-0.5 shrink-0" />
                    PDF는 선생님 컴퓨터에서 바로 전송됩니다. 선생님 수업 화면이 열려 있어야 받을 수
                    있고, 서버에는 저장되지 않습니다.
                  </p>
                )}
              </div>
            ) : null}

            <div className="space-y-3 p-4">
              {worksheet.fields.length > 0 ? (
                <div className="space-y-3">
                  {worksheet.fields.map((field, index) => (
                    <div key={field.id} className="space-y-1.5">
                      <p className="text-[12.5px] font-semibold leading-relaxed text-slate-800">
                        <span className="mr-1 text-brand-600">{index + 1}.</span>
                        {field.label}
                      </p>
                      {field.type === "ox" ? (
                        <div className="flex gap-2">
                          {["O", "X"].map((value) => (
                            <button
                              key={value}
                              type="button"
                              disabled={ended || worksheetLocked}
                              onClick={() => {
                                setAnswers((current) => ({ ...current, [field.id]: value }));
                                setSaveState("idle");
                              }}
                              className={cx(
                                "h-10 w-16 rounded-xl text-[14px] font-extrabold ring-1 transition disabled:opacity-60",
                                answers[field.id] === value
                                  ? "bg-brand-600 text-white ring-brand-600"
                                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                              )}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      ) : field.type === "long" ? (
                        <Textarea
                          value={answers[field.id] ?? ""}
                          onChange={(event) => {
                            setAnswers((current) => ({ ...current, [field.id]: event.target.value }));
                            setSaveState("idle");
                          }}
                          maxLength={2000}
                          disabled={ended || worksheetLocked}
                          placeholder="답을 작성하세요."
                          className="min-h-24 text-[13px]"
                        />
                      ) : (
                        <Input
                          value={answers[field.id] ?? ""}
                          onChange={(event) => {
                            setAnswers((current) => ({ ...current, [field.id]: event.target.value }));
                            setSaveState("idle");
                          }}
                          maxLength={200}
                          disabled={ended || worksheetLocked}
                          placeholder="답을 입력하세요."
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Textarea
                  value={worksheetText}
                  onChange={(event) => {
                    setWorksheetText(event.target.value);
                    setSaveState("idle");
                  }}
                  maxLength={8000}
                  placeholder="PDF를 보면서 답을 여기에 작성하세요."
                  disabled={ended || worksheetLocked}
                  className="min-h-32 text-[13px]"
                />
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-slate-400">
                  {worksheet.fields.length > 0
                    ? `${Object.values(answers).filter((value) => value.trim()).length} / ${worksheet.fields.length}문항 작성`
                    : `${worksheetText.length} / 8000자`}
                  {saveState === "saved" ? (
                    <span className="ml-2 inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <IconCheck size={11} /> 제출됨
                    </span>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  onClick={submitWorksheet}
                  disabled={ended || worksheetLocked}
                  loading={saveState === "saving"}
                >
                  <IconCheck size={14} /> {worksheetLocked ? "제출 완료" : "학습지 제출"}
                </Button>
              </div>
              <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-slate-400">
                <IconLock size={12} className="mt-0.5 shrink-0" />
                {worksheetLocked
                  ? "제출이 끝났습니다. 선생님이 ‘다시 제출 허용’을 누르면 그때 수정할 수 있습니다."
                  : "제출 내용은 선생님만 볼 수 있고, 재접속하면 그대로 복원됩니다. 한 번 제출하면 다시 낼 수 없습니다."}
              </p>
            </div>
          </Card>
        ) : null}

        {board ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <IconLayout size={15} className="text-brand-600" />
                  <p className="text-[12.5px] font-semibold text-slate-900">{board.title}</p>
                </div>
                <Badge tone={canPostToBoard ? "ok" : "neutral"}>
                  {canPostToBoard ? "카드 작성 가능" : "보기 전용"}
                </Badge>
              </div>
              {board.instructions ? (
                <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-slate-500">
                  {board.instructions}
                </p>
              ) : null}
            </div>

            <div className="p-4">
              {board.layout === "columns" && board.columns.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {board.columns.map((column) => {
                    const cards = board.cards.filter((card) => card.column === column);
                    return (
                      <div key={column} className="rounded-xl bg-slate-50 p-3">
                        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                          {column}
                        </p>
                        <div className="space-y-2">
                          {cards.length === 0 ? (
                            <p className="text-[11px] text-slate-400">아직 카드가 없습니다.</p>
                          ) : null}
                          {cards.map((card) => (
                            <div
                              key={card.id}
                              className={cx(
                                "rounded-lg p-2.5 text-[12px] leading-relaxed ring-1",
                                BOARD_CARD_CLASS[card.color] ?? BOARD_CARD_CLASS.yellow,
                              )}
                            >
                              <p className="whitespace-pre-wrap">{card.text}</p>
                              <p className="mt-1 text-[10px] opacity-60">{card.author}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {board.cards.length === 0 ? (
                    <p className="col-span-full py-4 text-center text-[11.5px] text-slate-400">
                      아직 카드가 없습니다.
                    </p>
                  ) : null}
                  {board.cards.map((card) => (
                    <div
                      key={card.id}
                      className={cx(
                        "rounded-xl p-3 text-[12.5px] leading-relaxed ring-1",
                        BOARD_CARD_CLASS[card.color] ?? BOARD_CARD_CLASS.yellow,
                      )}
                    >
                      <p className="whitespace-pre-wrap">{card.text}</p>
                      <p className="mt-1.5 text-[10px] opacity-60">{card.author}</p>
                    </div>
                  ))}
                </div>
              )}

              {canPostToBoard && !ended ? (
                <div className="mt-4 rounded-xl border border-slate-200 p-3">
                  <Textarea
                    value={boardText}
                    onChange={(event) => setBoardText(event.target.value)}
                    maxLength={280}
                    placeholder="보드에 붙일 내용을 적어 주세요."
                    className="min-h-16 text-[12.5px]"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {BOARD_COLORS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setBoardColor(color.id)}
                        aria-label={`카드 색 ${color.label}`}
                        className={cx(
                          "h-6 w-6 rounded-full ring-2 ring-offset-2",
                          color.className,
                          boardColor === color.id ? "ring-slate-900" : "ring-transparent",
                        )}
                      />
                    ))}
                    {board.layout === "columns" && board.columns.length > 0 ? (
                      <select
                        value={boardColumn || board.columns[0]}
                        onChange={(event) => setBoardColumn(event.target.value)}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11.5px] text-slate-600"
                      >
                        {board.columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <Button
                      size="sm"
                      className="ml-auto"
                      disabled={!boardText.trim()}
                      onClick={addBoardCard}
                    >
                      카드 붙이기
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {!quiz && !worksheet && !board && !screenShare.teacherStream ? (
          <Card className="p-6 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <IconClock size={20} />
            </span>
            <p className="mt-3 text-[13px] font-semibold text-slate-800">수업 활동을 기다리는 중</p>
            <p className="mt-1 text-[12px] text-slate-500">
              선생님이 퀴즈·학습지·보드·화면을 열면 이 화면에 나타납니다.
            </p>
          </Card>
        ) : null}

        {showFullscreenPrompt ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
            <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
              <IconAlert size={16} className="shrink-0 text-amber-600" />
              <p className="text-[11.5px] leading-relaxed text-amber-900">
                수업 화면이 창 모드입니다. 집중을 위해 전체화면을 권장합니다.
              </p>
              <button
                onClick={() => setDismissedPrompt(true)}
                className="shrink-0 text-amber-700 hover:text-amber-900"
                aria-label="안내 닫기"
              >
                <IconX size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </main>

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="수업에서 나갈까요?"
        description="이름과 참가 정보가 이 기기에서 지워집니다. 다시 들어오려면 참가 코드를 입력해야 합니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLeaveOpen(false)}>
              계속 듣기
            </Button>
            <Button variant="danger" onClick={() => void leaveClass()}>
              나가기
            </Button>
          </>
        }
      >
        <Callout tone="info" icon={<IconInfo size={15} />}>
          작성한 학습지 답변은 선생님 쪽에 남아 있습니다. 화면 공유 중이라면 함께 중지됩니다.
        </Callout>
      </Modal>

      {stage && stageHidden !== stage.id ? (
        <StageOverlay
          stage={stage}
          board={board}
          allowPosts={settings.allowStudentPosts}
          ended={ended}
          onAddCard={(text) =>
            socketSend({
              type: "board_add",
              text,
              color: "yellow",
              column: board?.layout === "columns" ? board.columns[0] ?? null : null,
            })
          }
          onHide={() => setStageHidden(stage.id)}
        />
      ) : null}

      {stage && stageHidden === stage.id ? (
        <button
          onClick={() => setStageHidden(null)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-[12px] font-semibold text-white shadow-lg hover:bg-slate-800"
        >
          <IconCast size={14} /> 선생님이 띄운 화면 다시 보기
        </button>
      ) : null}
    </div>
  );
}





