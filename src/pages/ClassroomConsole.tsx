import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useClassroomSocket, type SocketStatus } from "../lib/realtime";
import type {
  ClassTimer,
  ClassroomEventRecord,
  ClassroomSnapshot,
  ClassroomSummary,
  ClassToolsState,
  RosterState,
  ClientMessage,
  GameState,
  InputPreview,
  LiveBoard,
  LiveQuiz,
  MiniGameState,
  PresenterPick,
  QuizResults,
  ServerMessage,
  SharedMaterial,
  StageContent,
  StudentLive,
  TeamBoard,
  WorksheetState,
  WorksheetSubmission,
} from "../../shared/protocol";
import { DEFAULT_SETTINGS, type ClassSettings } from "../../shared/settings";
import { AppShell } from "../components/AppShell";
import { JoinQr } from "../components/JoinQr";
import {
  Badge,
  Button,
  Callout,
  Card,
  CopyButton,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  StatusDot,
  Tabs,
  cx,
} from "../components/ui";
import {
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconCast,
  IconFileText,
  IconLayout,
  IconLock,
  IconQr,
  IconUsers,
  IconVideo,
} from "../components/Icons";
import { formatDate } from "../lib/format";
import { MonitorTab } from "../features/teacher/MonitorTab";
import { ToolsTab } from "../features/teacher/ToolsTab";
import { GamesHubTab } from "../features/teacher/GamesHubTab";
import { PadletTab } from "../features/teacher/PadletTab";
import { BoardTab } from "../features/teacher/BoardTab";
import { ScreenShareTab } from "../features/teacher/ScreenShareTab";
import { PresentTab } from "../features/teacher/PresentTab";
import { SettingsTab } from "../features/teacher/SettingsTab";
import { SubjectTab } from "../features/teacher/SubjectTab";
import { TeamTab } from "../features/teacher/TeamTab";
import { ToolboxTab } from "../features/teacher/ToolboxTab";
import { EventsTab } from "../features/teacher/EventsTab";
import { relayFileToStudent } from "../lib/fileTransfer";
import { loadMaterial } from "../lib/materialStore";
import { useTeacherScreenShare } from "../lib/screenShare";
import {
  clearJoinBase,
  isLoopbackBase,
  joinLink,
  normalizeBase,
  readJoinBase,
  saveJoinBase,
  suggestLanBases,
} from "../lib/joinBase";

const TABS = [
  { id: "monitor", label: "수업 현황" },
  { id: "tools", label: "학습지·문제" },
  { id: "subject", label: "과목 도구" },
  { id: "game", label: "게임·미니게임" },
  { id: "toolbox", label: "수업 도구" },
  { id: "teams", label: "모둠·자리" },
  { id: "present", label: "띄우기·타이머" },
  { id: "board", label: "활동 보드" },
  { id: "padlet", label: "패들렛" },
  { id: "share", label: "화면 공유" },
  { id: "settings", label: "수업 설정" },
  { id: "events", label: "기록" },
];

const EMPTY_GAME: GameState = {
  mode: "classic",
  round: 0,
  totalRounds: 1,
  scores: [],
  teams: [],
  lobbyOpen: false,
  items: [],
  feed: [],
};
const EMPTY_TOOLS: ClassToolsState = { scores: {}, checkinOpen: false, attendance: [] };
const EMPTY_ROSTER: RosterState = {
  teamCount: 4,
  teamOpen: false,
  seatRows: 5,
  seatCols: 6,
  seatOpen: false,
};

function connectionBadge(status: SocketStatus) {
  if (status === "open") return <Badge tone="ok" dot>실시간 연결</Badge>;
  if (status === "connecting") return <Badge tone="warn" dot>연결 중</Badge>;
  return <Badge tone="danger" dot>재연결 중</Badge>;
}

export default function ClassroomConsole() {
  const { id = "" } = useParams();
  const { teacher } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") ?? "monitor";
  // 이전 링크(?tab=minigames)도 게임 탭으로 열리게 합니다.
  const tab = requestedTab === "minigames" ? "game" : requestedTab;

  const [classroom, setClassroom] = useState<ClassroomSummary | null>(null);
  const [students, setStudents] = useState<StudentLive[]>([]);
  const [events, setEvents] = useState<ClassroomEventRecord[]>([]);
  const [quiz, setQuiz] = useState<LiveQuiz | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResults | null>(null);
  const [worksheet, setWorksheet] = useState<WorksheetState | null>(null);
  const [submissions, setSubmissions] = useState<WorksheetSubmission[]>([]);
  const [board, setBoard] = useState<LiveBoard | null>(null);
  const [stage, setStage] = useState<StageContent | null>(null);
  const [timer, setTimer] = useState<ClassTimer | null>(null);
  const [game, setGame] = useState<GameState>(EMPTY_GAME);
  const [teamBoards, setTeamBoards] = useState<TeamBoard[]>([]);
  const [presenter, setPresenter] = useState<PresenterPick | null>(null);
  const [minigame, setMinigame] = useState<MiniGameState | null>(null);
  const [tools, setTools] = useState<ClassToolsState>(EMPTY_TOOLS);
  const [roster, setRoster] = useState<RosterState>(EMPTY_ROSTER);
  const [settings, setSettings] = useState<ClassSettings>(DEFAULT_SETTINGS);
  const [joinBase, setJoinBase] = useState(() => readJoinBase());
  const [joinBaseDraft, setJoinBaseDraft] = useState(() => readJoinBase());
  const [joinBaseError, setJoinBaseError] = useState<string | null>(null);
  const [lanBases, setLanBases] = useState<string[]>([]);
  const joinBaseLoopback = isLoopbackBase(joinBase);

  useEffect(() => {
    if (!joinBaseLoopback) return;
    let active = true;
    void suggestLanBases().then((list) => {
      if (active) setLanBases(list);
    });
    return () => {
      active = false;
    };
  }, [joinBaseLoopback]);
  const [observing, setObserving] = useState(false);
  const [inputs, setInputs] = useState<InputPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "warn" | "danger"; text: string } | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [materialSending, setMaterialSending] = useState<Record<string, { sent: number; total: number }>>({});
  const [materialError, setMaterialError] = useState<string | null>(null);

  const worksheetRef = useRef<WorksheetState | null>(null);
  worksheetRef.current = worksheet;
  const socketSendRef = useRef<(message: ClientMessage) => void>(() => undefined);
  const socketStatusRef = useRef<SocketStatus>("connecting");
  const rtcHandlerRef = useRef<((message: Extract<ServerMessage, { type: "rtc" }>) => void) | null>(null);

  const applySnapshot = useCallback((snapshot: ClassroomSnapshot) => {
    setStudents(snapshot.students);
    setQuiz(snapshot.quiz);
    setQuizResults(snapshot.quizResults);
    setWorksheet(snapshot.worksheet);
    setSubmissions(snapshot.submissions);
    setBoard(snapshot.board);
    setStage(snapshot.stage);
    setTimer(snapshot.timer);
    setGame(snapshot.game);
    setTeamBoards(snapshot.teamBoards);
    setPresenter(snapshot.presenter);
    setMinigame(snapshot.minigame);
    setTools(snapshot.tools ?? EMPTY_TOOLS);
    setRoster(snapshot.roster ?? EMPTY_ROSTER);
    setSettings(snapshot.settings ?? DEFAULT_SETTINGS);
    setObserving(snapshot.observing);
    setInputs(snapshot.inputs);
    setEvents((previous) => {
      const seen = new Set(previous.map((event) => event.id));
      const fresh = snapshot.recentEvents.filter((event) => !seen.has(event.id));
      return [...fresh, ...previous].slice(0, 250);
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [{ classroom: room }, { snapshot }] = await Promise.all([
        api.classrooms.get(id),
        api.classrooms.state(id),
      ]);
      setClassroom(room);
      applySnapshot(snapshot);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수업을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshState = useCallback(async () => {
    try {
      const { snapshot } = await api.classrooms.state(id);
      applySnapshot(snapshot);
    } catch {
      /* socket reconnect will retry */
    }
  }, [applySnapshot, id]);

  const sendMaterialTo = useCallback(async (to: string, material: SharedMaterial) => {
    setMaterialError(null);
    // The relay uses the socket outbox; 90 chunks or more would overflow it, so
    // never start a transfer while the connection is down.
    if (socketStatusRef.current !== "open") {
      setMaterialError("실시간 연결이 끊겨 PDF를 보내지 못했습니다. 연결이 복구되면 다시 시도해 주세요.");
      return;
    }
    setMaterialSending((current) => ({ ...current, [to]: { sent: 0, total: 1 } }));
    try {
      const stored = await loadMaterial(material.id);
      if (!stored) {
        throw new Error("PDF가 이 컴퓨터에 없습니다. 학습지를 다시 선택해 주세요.");
      }
      await relayFileToStudent({
        to,
        material,
        blob: stored.blob,
        send: (message) => socketSendRef.current(message),
        onProgress: (sent, total) =>
          setMaterialSending((current) => ({ ...current, [to]: { sent, total } })),
      });
      setNotice({ tone: "info", text: "학생에게 학습지 PDF를 전송했습니다." });
    } catch (caught) {
      setMaterialError(caught instanceof Error ? caught.message : "PDF를 전송하지 못했습니다.");
    } finally {
      window.setTimeout(() => {
        setMaterialSending((current) => {
          const next = { ...current };
          delete next[to];
          return next;
        });
      }, 2500);
    }
  }, []);

  const onMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "snapshot":
          if (message.role === "teacher") applySnapshot(message.snapshot);
          return;
        case "students":
          setStudents(message.students);
          return;
        case "event":
          setEvents((previous) => {
            if (previous.some((event) => event.id === message.event.id)) return previous;
            return [message.event, ...previous].slice(0, 250);
          });
          return;
        case "quiz":
          setQuiz(message.quiz);
          if (message.results) setQuizResults(message.results);
          return;
        case "worksheet":
          setWorksheet(message.worksheet);
          if (message.submissions) setSubmissions(message.submissions);
          return;
        case "board":
          setBoard(message.board);
          return;
        case "stage":
          setStage(message.stage);
          return;
        case "timer":
          setTimer(message.timer);
          return;
        case "game":
          setGame(message.game);
          return;
        case "teams":
          setTeamBoards(message.boards);
          return;
        case "presenter":
          setPresenter(message.presenter);
          return;
        case "minigame":
          setMinigame(message.game);
          return;
        case "tools":
          setTools(message.tools);
          return;
        case "roster":
          setRoster(message.roster);
          return;
        case "settings":
          setSettings(message.settings);
          return;
        case "observe":
          setObserving(message.observing);
          return;
        case "input_preview":
          setInputs((previous) => {
            const next = previous.filter(
              (item) =>
                !(
                  item.participantId === message.preview.participantId &&
                  item.field === message.preview.field
                ),
            );
            return [message.preview, ...next].slice(0, 50);
          });
          return;
        case "file_request": {
          const material = worksheetRef.current?.material;
          if (material && material.id === message.materialId) {
            void sendMaterialTo(message.from, material);
          }
          return;
        }
        case "rtc":
          rtcHandlerRef.current?.(message);
          return;
        case "notice":
          setNotice({ tone: "info", text: message.text });
          if (message.text.includes("종료")) {
            setClassroom((previous) => (previous ? { ...previous, status: "ended" } : previous));
          }
          return;
        case "error":
          setNotice({ tone: "danger", text: message.message });
          return;
        default:
          return;
      }
    },
    [applySnapshot, sendMaterialTo],
  );

  const socket = useClassroomSocket({
    classroomId: id,
    role: "teacher",
    enabled: Boolean(classroom && classroom.status === "live"),
    onMessage,
    onOpen: () => void refreshState(),
  });
  socketSendRef.current = socket.send;
  socketStatusRef.current = socket.status;

  // Teacher notices should not pile up on screen.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 9000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const screenShare = useTeacherScreenShare({ send: socket.send, students });
  rtcHandlerRef.current = screenShare.handleSignal;

  const liveStudents = useMemo(() => students.filter((student) => student.online), [students]);

  if (!teacher) return null;

  const endClass = async () => {
    if (!classroom) return;
    setEnding(true);
    try {
      screenShare.stop();
      const { classroom: updated } = await api.classrooms.end(classroom.id);
      setClassroom(updated);
      setEndOpen(false);
      setNotice({ tone: "warn", text: "수업을 종료했습니다. 학생 화면에 종료 안내가 표시됩니다." });
    } catch (caught) {
      setNotice({
        tone: "danger",
        text: caught instanceof Error ? caught.message : "수업을 종료하지 못했습니다.",
      });
    } finally {
      setEnding(false);
    }
  };

  const startClass = async () => {
    if (!classroom) return;
    setStarting(true);
    try {
      const { classroom: updated } = await api.classrooms.start(classroom.id);
      setClassroom(updated);
      setNotice({ tone: "info", text: "수업을 다시 시작했습니다. 기존 참가자는 코드로 복귀할 수 있습니다." });
    } catch (caught) {
      setNotice({
        tone: "danger",
        text: caught instanceof Error ? caught.message : "수업을 시작하지 못했습니다.",
      });
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <AppShell teacher={teacher} wide>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-24 rounded-2xl" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (error || !classroom) {
    return (
      <AppShell teacher={teacher} wide>
        <Card>
          <EmptyState
            icon={<IconAlert size={22} />}
            title="수업을 열 수 없습니다"
            description={error ?? "삭제되었거나 접근 권한이 없는 수업입니다."}
            action={
              <Button variant="secondary" onClick={() => navigate("/app")}>
                <IconArrowLeft size={15} /> 대시보드로
              </Button>
            }
          />
        </Card>
      </AppShell>
    );
  }

  const joinUrl = joinLink(joinBase, classroom.joinCode);
  const joinBaseIsLoopback = isLoopbackBase(joinBase);

  const applyJoinBase = () => {
    const normalized = normalizeBase(joinBaseDraft);
    if (!normalized) {
      setJoinBaseError("http://192.168.0.5:5173 처럼 주소를 입력해 주세요.");
      return;
    }
    setJoinBase(saveJoinBase(normalized));
    setJoinBaseDraft(normalized);
    setJoinBaseError(null);
  };

  const resetJoinBase = () => {
    clearJoinBase();
    setJoinBase(window.location.origin);
    setJoinBaseDraft(window.location.origin);
    setJoinBaseError(null);
  };
  const sendingCount = Object.keys(materialSending).length;

  return (
    <AppShell teacher={teacher} wide>
      <Link
        to="/app"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-slate-900"
      >
        <IconArrowLeft size={14} /> 내 수업
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={classroom.status === "live" ? "ok" : "neutral"} dot>
              {classroom.status === "live" ? "진행 중" : "종료됨"}
            </Badge>
            {classroom.status === "live" ? connectionBadge(socket.status) : null}
            {screenShare.sharing || Object.keys(screenShare.remote).length > 0 ? (
              <Badge tone="brand">
                <IconVideo size={12} /> 화면 공유 중
              </Badge>
            ) : null}
            {board ? (
              <Badge tone="info">
                <IconLayout size={12} /> 보드 공유 중
              </Badge>
            ) : null}
            {stage ? (
              <Badge tone="warn">
                <IconCast size={12} /> 학생 화면에 띄우는 중
              </Badge>
            ) : null}
            {presenter ? <Badge tone="brand">🎤 {presenter.name}</Badge> : null}
            {timer && timer.endsAt > Date.now() ? (
              <Badge tone="brand">
                <IconClock size={12} /> 타이머 {Math.max(1, Math.ceil((timer.endsAt - Date.now()) / 60000))}분
              </Badge>
            ) : null}
          </div>
          <h1 className="mt-2.5 text-[26px] font-extrabold tracking-[-0.03em] text-slate-900 sm:text-[30px]">
            {classroom.title}
          </h1>
          <p className="mt-1 text-[12.5px] text-slate-500">
            {classroom.subject || "과목 미지정"} · 생성 {formatDate(classroom.createdAt)} · 참가{" "}
            {classroom.participantCount}명
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setJoinOpen(true)}>
            <IconQr size={16} />
            참가 안내
          </Button>
          {classroom.status === "live" ? (
            <Button variant="secondary" onClick={() => setEndOpen(true)}>
              수업 종료
            </Button>
          ) : (
            <Button onClick={() => void startClass()} loading={starting}>
              수업 다시 시작
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-[12.5px]">
          <span className="inline-flex items-center gap-2 text-slate-500">
            <IconLock size={14} /> 학생 계정 없음
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="text-slate-400">참가 코드</span>
            <span className="rounded-md bg-slate-50 px-2 py-1 font-mono text-[13px] font-bold tracking-[0.16em] text-slate-900 ring-1 ring-slate-200">
              {classroom.joinCode}
            </span>
          </span>
          <CopyButton value={joinUrl} label="링크 복사" />
          {joinBaseIsLoopback ? (
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
            >
              <IconAlert size={12} /> 학생 기기에서는 안 열리는 주소 · 고치기
            </button>
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500">
          <IconFileText size={13} /> 자료는 내 컴퓨터에 저장 · R2/업로드 없음
        </span>
      </div>

      {notice ? (
        <Callout
          tone={notice.tone === "danger" ? "danger" : notice.tone === "warn" ? "warn" : "info"}
          icon={notice.tone === "danger" ? <IconAlert size={15} /> : <IconCheck size={15} />}
          className="mt-4"
        >
          <div className="flex items-start justify-between gap-3">
            <span>{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              className="shrink-0 text-[11px] font-semibold opacity-60 hover:opacity-100"
            >
              닫기
            </button>
          </div>
        </Callout>
      ) : null}

      {sendingCount > 0 ? (
        <Callout tone="info" icon={<IconFileText size={15} />} className="mt-4">
          학습지 PDF 전송 중…{" "}
          {Object.entries(materialSending)
            .map(([participantId, progress]) => {
              const name =
                students.find((student) => student.participantId === participantId)?.name ?? "학생";
              return `${name} ${progress.sent}/${progress.total}`;
            })
            .join(" · ")}
        </Callout>
      ) : null}

      {materialError ? (
        <Callout tone="warn" icon={<IconAlert size={15} />} className="mt-4">
          {materialError}
        </Callout>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={TABS.map((item) => ({
            ...item,
            count:
              item.id === "monitor"
                ? liveStudents.length
                : item.id === "events"
                  ? events.length
                  : item.id === "board" && board
                    ? board.cards.length
                    : item.id === "present"
                      ? students.filter((student) => student.handRaised && student.online).length
                      : item.id === "teams"
                        ? teamBoards.reduce((sum, board) => sum + board.posts.length, 0)
                        : item.id === "toolbox"
                          ? tools.attendance.length
                          : undefined,
          }))}
          value={tab}
          onChange={(next) => setSearchParams({ tab: next }, { replace: true })}
        />
        <div className="flex items-center gap-4 text-[11.5px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <IconUsers size={14} /> 접속 {liveStudents.length}/{students.length}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconClock size={14} /> 마지막 갱신{" "}
            {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      <div className="mt-4">
        {tab === "present" ? (
          <PresentTab
            stage={stage}
            timer={timer}
            students={students}
            board={board}
            send={socket.send}
            connected={socket.status === "open" && classroom.status === "live"}
            settings={settings}
            quiz={quiz}
            results={quizResults}
          />
        ) : null}
        {tab === "monitor" ? (
          <MonitorTab
            students={students}
            events={events}
            classroomId={classroom.id}
            classroom={classroom}
            observing={observing}
            inputs={inputs}
            onToggleObserve={(next) => socket.send({ type: "observe_set", observing: next })}
            onRefresh={refreshState}
          />
        ) : null}
        {tab === "tools" ? (
          <ToolsTab
            quiz={quiz}
            results={quizResults}
            worksheet={worksheet}
            submissions={submissions}
            send={socket.send}
            connected={socket.status === "open" && classroom.status === "live"}
            studentCount={students.length}
          />
        ) : null}
        {tab === "subject" ? (
          <SubjectTab
            subject={classroom.subject}
            quiz={quiz}
            students={students}
            settings={settings}
            send={socket.send}
            connected={socket.status === "open" && classroom.status === "live"}
          />
        ) : null}
        {tab === "game" ? (
          <GamesHubTab
            quiz={quiz}
            results={quizResults}
            game={game}
            minigame={minigame}
            students={students}
            send={socket.send}
            connected={socket.status === "open" && classroom.status === "live"}
            studentCount={students.length}
            joinCode={classroom.joinCode}
            settings={settings}
          />
        ) : null}
        {tab === "toolbox" ? (
          <ToolboxTab
            tools={tools}
            students={students}
            roster={roster}
            send={socket.send}
            connected={socket.status === "open" && classroom.status === "live"}
          />
        ) : null}
        {tab === "teams" ? (
          <TeamTab
            students={students}
            boards={teamBoards}
            presenter={presenter}
            roster={roster}
            settings={settings}
            send={socket.send}
            connected={socket.status === "open" && classroom.status === "live"}
          />
        ) : null}
        {tab === "board" ? (
          <BoardTab board={board} send={socket.send} connected={socket.status === "open" && classroom.status === "live"} />
        ) : null}
        {tab === "padlet" ? (
          <PadletTab send={socket.send} connected={socket.status === "open" && classroom.status === "live"} />
        ) : null}
        {tab === "share" ? <ScreenShareTab students={students} share={screenShare} /> : null}
        {tab === "settings" ? (
          <SettingsTab
            settings={settings}
            send={socket.send}
            connected={socket.status === "open" && classroom.status === "live"}
          />
        ) : null}
        {tab === "events" ? (
          <EventsTab
            events={events}
            students={students}
            classroomId={classroom.id}
            onRefresh={refreshState}
          />
        ) : null}
      </div>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="학생 참가 안내"
        description="QR을 스캔하거나 참가 코드와 이름만 입력하면 입장합니다."
      >
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <JoinQr value={joinUrl} size={200} />
          <div className="w-full space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">참가 코드</p>
              <p className="mt-1 font-mono text-[32px] font-extrabold tracking-[0.22em] text-slate-900">
                {classroom.joinCode}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="break-all text-[12px] text-slate-600">{joinUrl}</p>
              <div className="mt-2 flex gap-2">
                <CopyButton value={joinUrl} label="링크 복사" />
                <CopyButton value={classroom.joinCode} label="코드 복사" />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[11px] font-bold text-slate-500">학생에게 안내할 접속 주소</p>
              {joinBaseIsLoopback ? (
                <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                  지금 주소는 이 컴퓨터(127.0.0.1)에서만 열립니다. 학생은 접속할 수 없으니, 이 PC의
                  와이파이 IP(예: 192.168.0.5)로 콘솔을 열거나 아래에 주소를 직접 넣어 QR·링크를
                  바꿔 주세요.
                </p>
              ) : (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  QR과 링크가 이 주소로 만들어집니다. 보통은 지금 주소 그대로 두면 됩니다.
                </p>
              )}
              {joinBaseIsLoopback && lanBases.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lanBases.map((base) => (
                    <button
                      key={base}
                      onClick={() => {
                        setJoinBase(saveJoinBase(base));
                        setJoinBaseDraft(base);
                        setJoinBaseError(null);
                      }}
                      className="rounded-lg bg-amber-50 px-2 py-1 font-mono text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                    >
                      {base.replace(/^https?:\/\//, "")} 사용
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Input
                  value={joinBaseDraft}
                  onChange={(event) => setJoinBaseDraft(event.target.value)}
                  placeholder="http://192.168.0.5:5173"
                  className="h-9 min-w-0 flex-1 text-[12px]"
                />
                <Button size="sm" onClick={applyJoinBase}>
                  주소 저장
                </Button>
                <Button size="sm" variant="ghost" onClick={resetJoinBase}>
                  이 PC 주소
                </Button>
              </div>
              {joinBaseError ? <p className="mt-1 text-[11px] text-rose-600">{joinBaseError}</p> : null}
            </div>
            <div className="space-y-1.5 text-[12px] text-slate-500">
              <p className="flex items-center gap-1.5">
                <StatusDot tone="ok" /> 학생은 이름만 입력합니다.
              </p>
              <p className="flex items-center gap-1.5">
                <StatusDot tone="brand" /> 입장 시 전체화면과 화면 공유를 함께 시작할 수 있습니다.
              </p>
              <p className="flex items-center gap-1.5">
                <StatusDot tone="warn" /> 화면 공유는 브라우저 선택 창에서 학생이 허용한 경우에만 보입니다.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="수업을 종료할까요?"
        description="학생 화면에 종료 안내가 표시되고 실시간 연결이 닫힙니다. 참가자·답변·보드·이벤트가 즉시 삭제됩니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndOpen(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={() => void endClass()} loading={ending}>
              수업 종료
            </Button>
          </>
        }
      >
        <Callout tone="warn" icon={<IconAlert size={16} />}>
          참가자 정보, 학습지 제출, 퀴즈·게임 응답, 보드 사본, 이벤트 기록이 즉시 삭제됩니다.
          보드 원본과 PDF는 선생님 컴퓨터에 남아 다음 수업에서 다시 열 수 있습니다.
        </Callout>
      </Modal>

      <div className={cx("mt-8 text-[11px] leading-relaxed text-slate-400", tab === "monitor" && "hidden")} />
    </AppShell>
  );
}
