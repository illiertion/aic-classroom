import { useState } from "react";
import type {
  ClientMessage,
  GameState,
  LiveQuiz,
  MiniGameState,
  QuizResults,
  StudentLive,
} from "../../../shared/protocol";
import { cx } from "../../components/ui";
import type { ClassSettings } from "../../../shared/settings";
import { IconSparkles, IconTrophy } from "../../components/Icons";
import { GameTab } from "./GameTab";
import { MiniGameTab } from "./MiniGameTab";

/**
 * 게임 탭과 미니게임 탭을 한 화면으로 합쳤습니다. 문제 게임(지선다·OX·주관식·뜻 연결)과
 * 띵커벨형 미니게임을 오가며 수업 중에 바로 씁니다.
 */
export function GamesHubTab({
  quiz,
  results,
  game,
  minigame,
  students,
  send,
  connected,
  studentCount,
  joinCode,
  settings,
}: {
  quiz: LiveQuiz | null;
  results: QuizResults | null;
  game: GameState;
  minigame: MiniGameState | null;
  students: StudentLive[];
  send: (message: ClientMessage) => void;
  connected: boolean;
  studentCount: number;
  joinCode: string;
  settings: ClassSettings;
}) {
  const [view, setView] = useState<"quiz" | "mini">("quiz");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setView("quiz")}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition",
              view === "quiz" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <IconTrophy size={13} /> 문제 게임
          </button>
          <button
            type="button"
            onClick={() => setView("mini")}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition",
              view === "mini" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <IconSparkles size={13} /> 미니게임
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          {view === "quiz"
            ? "세트를 골라 문제를 내고, 대기 화면·랭킹판을 프로젝터에 띄웁니다."
            : "룰렛·폭탄·낱말 찾기·카드 짝·사다리·반응 속도·초성을 바로 시작합니다."}
        </p>
      </div>

      {view === "quiz" ? (
        <GameTab
          quiz={quiz}
          results={results}
          game={game}
          send={send}
          connected={connected}
          studentCount={studentCount}
          joinCode={joinCode}
          settings={settings}
          onOpenMini={() => setView("mini")}
        />
      ) : (
        <MiniGameTab game={minigame} students={students} send={send} connected={connected} />
      )}
    </div>
  );
}

