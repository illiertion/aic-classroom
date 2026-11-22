// Temporary local render check for the new games/tools UI. Deleted after use.
import { createRoot } from "react-dom/client";
import "./index.css";
import { DEFAULT_SETTINGS } from "../shared/settings";
import type { GameState, RosterState, StudentLive } from "../shared/protocol";
import { ToolboxTab } from "./features/teacher/ToolboxTab";
import { TeamTab } from "./features/teacher/TeamTab";
import { GameTab } from "./features/teacher/GameTab";

const now = Date.now();


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
function Check() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-[#f4f6fb] p-6">
      <h1 className="text-[20px] font-extrabold text-slate-900">AIC 새 게임·도구 렌더링 점검</h1>
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
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Check />);






