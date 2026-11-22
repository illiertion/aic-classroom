// Temporary local render check for the new games/tools UI. Deleted after use.
import { createRoot } from "react-dom/client";
import "./index.css";
import { LadderBoard } from "./components/LadderBoard";
import { MiniGameCard } from "./components/MiniGameCard";
import { MiniGameTab } from "./features/teacher/MiniGameTab";
import { TeamTab } from "./features/teacher/TeamTab";
import { DEFAULT_SETTINGS } from "../shared/settings";
import { GameTab } from "./features/teacher/GameTab";
import { ToolboxTab } from "./features/teacher/ToolboxTab";
import type { GameState, LadderState, RosterState, StudentLive } from "../shared/protocol";

const now = Date.now();

const ladder: LadderState = {
  kind: "ladder",
  at: now,
  names: ["김하늘", "이바다", "박별", "최달"],
  prizes: ["1등", "2등", "3등", "참가"],
  rows: 8,
  rungs: [
    { row: 1, col: 0 },
    { row: 2, col: 2 },
    { row: 4, col: 1 },
    { row: 5, col: 0 },
    { row: 6, col: 2 },
    { row: 7, col: 1 },
  ],
  winners: [
    { name: "김하늘", prize: "2등", start: 0, end: 1 },
    { name: "이바다", prize: "참가", start: 1, end: 3 },
    { name: "박별", prize: "1등", start: 2, end: 0 },
    { name: "최달", prize: "3등", start: 3, end: 2 },
  ],
  revealed: true,
};

const students: StudentLive[] = [
  {
    participantId: "prt_a",
    name: "김하늘",
    online: true,
    team: "1모둠",
    alive: true,
    handRaised: false,
    fullscreen: true,
    visibility: "visible",
    joinedAt: now - 60_000,
    lastActivityAt: now,
    lastRejoinAt: null,
    sharingScreen: false,
    eventCount: 3,
    seat: 0,
  },
  {
    participantId: "prt_b",
    name: "이바다",
    online: true,
    team: "2모둠",
    alive: true,
    handRaised: true,
    fullscreen: false,
    visibility: "visible",
    joinedAt: now - 50_000,
    lastActivityAt: now,
    lastRejoinAt: null,
    sharingScreen: true,
    eventCount: 4,
    seat: 1,
  },
];

const jamo = {
  kind: "jamo" as const,
  index: 1,
  total: 3,
  prompt: "ㅅㄱ (2글자)",
  answer: null,
  solved: false,
  solvedBy: null,
  attempts: [{ name: "김하늘", text: "사과", correct: true, at: now }],
  scores: [{ name: "김하늘", points: 10 }],
  startedAt: now,
};

const speedtap = {
  kind: "speedtap" as const,
  round: 2,
  size: 4,
  target: 5,
  startsAt: now - 1000,
  endsAt: now + 60_000,
  hits: [{ participantId: "prt_a", name: "김하늘", ms: 312, points: 10 }],
  totals: [{ participantId: "prt_a", name: "김하늘", points: 10, bestMs: 312 }],
};

const memory = {
  kind: "memory" as const,
  cards: [
    { id: "c1", label: "사과", pairId: "p1", state: "open" as const },
    { id: "c2", label: "포도", pairId: "p2", state: "hidden" as const },
    { id: "c3", label: "사과", pairId: "p1", state: "matched" as const },
    { id: "c4", label: "포도", pairId: "p2", state: "hidden" as const },
  ],
  moves: 3,
  matched: 1,
};

const roster: RosterState = {
  teamCount: 6,
  teamOpen: true,
  seatRows: 2,
  seatCols: 3,
  seatOpen: true,
  occupiedSeats: [0, 2, 4],
};

const gameState: GameState = {
  mode: "item",
  round: 2,
  totalRounds: 5,
  scores: [
    { participantId: "prt_a", name: "김하늘", team: "1모둠", points: 250, correct: 2, wrong: 0, alive: true },
    { participantId: "prt_b", name: "이바다", team: "2모둠", points: 120, correct: 1, wrong: 1, alive: true },
  ],
  teams: [
    { id: "1모둠", label: "1모둠", points: 250, players: 1 },
    { id: "2모둠", label: "2모둠", points: 120, players: 1 },
  ],
  lobbyOpen: false,
  items: [{ participantId: "prt_a", item: "double", at: now }],
  feed: [
    { id: "f1", at: now, text: "김하늘 학생이 100점을 얻었습니다.", tone: "good" },
    { id: "f2", at: now, text: "이바다 학생이 1위로 올라섰습니다!", tone: "warn" },
  ],
};

const noop = () => undefined;
const ladderGame = ladder;
const speedtapGame = speedtap;
function Check() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-[#f4f6fb] p-6">
      <h1 className="text-[20px] font-extrabold text-slate-900">AIC 새 게임·도구 렌더링 점검</h1>
      <section id="ladder">
        <LadderBoard state={ladder} reveal />
      </section>
      <section id="jamo">
        <MiniGameCard
          game={jamo}
          me="prt_a"
          now={now}
          foundWord=""
          onFoundWord={noop}
          onFind={noop}
          onPass={noop}
          onFlip={noop}
          onTap={noop}
          onJamo={noop}
          ended={false}
        />
      </section>
      <section id="speedtap">
        <MiniGameCard
          game={speedtap}
          me="prt_a"
          now={now}
          foundWord=""
          onFoundWord={noop}
          onFind={noop}
          onPass={noop}
          onFlip={noop}
          onTap={noop}
          onJamo={noop}
          ended={false}
        />
      </section>
      <section id="memory">
        <MiniGameCard
          game={memory}
          me="prt_a"
          now={now}
          foundWord=""
          onFoundWord={noop}
          onFind={noop}
          onPass={noop}
          onFlip={noop}
          onTap={noop}
          onJamo={noop}
          ended={false}
        />
      </section>
      <section id="toolbox">
        <ToolboxTab
          tools={{
            scores: { "1모둠": 10, "2모둠": 5 },
            checkinOpen: true,
            attendance: [{ participantId: "prt_a", name: "김하늘", at: now }],
          }}
          students={students}
          roster={roster}
          send={noop}
          connected
        />
      </section>
      <section id="teams">
        <TeamTab
          students={students}
          boards={[{ team: "1모둠", posts: [{ id: "p1", team: "1모둠", author: "김하늘", text: "토의 내용", createdAt: now }] }]}
          presenter={null}
          roster={roster}
          settings={DEFAULT_SETTINGS}
          send={noop}
          connected
        />
      </section>
      <section id="gametab">
        <GameTab
          quiz={null}
          results={null}
          game={gameState}
          send={noop}
          connected
          studentCount={2}
          joinCode="733746"
          settings={DEFAULT_SETTINGS}
        />
      </section>
      <section id="minigametab">
        <MiniGameTab game={ladderGame} students={students} send={noop} connected />
      </section>
      <section id="minigametab-speed">
        <MiniGameTab game={speedtapGame} students={students} send={noop} connected />
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Check />);



