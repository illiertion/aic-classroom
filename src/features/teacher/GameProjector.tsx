import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState, LiveQuiz, QuizResults } from "../../../shared/protocol";
import { cx } from "../../components/ui";
import { IconMaximize, IconTrophy, IconUsers, IconX } from "../../components/Icons";
import { teamTone } from "../../../shared/roster";

const MODE_LABEL: Record<string, string> = {
  classic: "일반전",
  speed: "스피드전",
  goldenbell: "골든벨",
  team: "팀전",
  item: "아이템전",
};

const ITEM_LABEL: Record<string, string> = {
  double: "더블",
  steal: "훔치기",
  bonus: "+50점",
};

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Projector view: 대기 화면(방번호) · 문제 화면 · 실시간 랭킹판을 수업 화면에
 * 크게 띄웁니다. 선생님 콘솔과 같은 소켓 상태를 그대로 읽습니다.
 */
export function GameProjector({
  quiz,
  results,
  game,
  studentCount,
  joinCode,
  onClose,
}: {
  quiz: LiveQuiz | null;
  results: QuizResults | null;
  game: GameState;
  studentCount: number;
  joinCode: string;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState<"auto" | "question" | "ranking">("auto");

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const remaining = quiz?.endsAt
    ? Math.max(0, Math.min((quiz.durationSec ?? 0) * 1000, quiz.endsAt - now))
    : null;
  const answered = results?.answerCount ?? quiz?.answerCount ?? 0;
  const showLobby = !quiz && game.lobbyOpen;
  const showRanking = view === "ranking" || (view === "auto" && !quiz && !game.lobbyOpen);
  const topPoints = Math.max(1, ...game.scores.map((score) => score.points));
  const palette = useMemo(
    () => game.scores.map((score) => teamTone(score.team)),
    [game.scores],
  );

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await boxRef.current?.requestFullscreen({ navigationUI: "hide" });
    } catch {
      /* the browser refused — the overlay still fills the tab */
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 text-white">
      <div ref={boxRef} className="flex h-full flex-col bg-gradient-to-br from-slate-950 via-brand-950 to-indigo-950">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-white/70">
            <IconTrophy size={14} className="text-amber-300" />
            {quiz ? `${MODE_LABEL[quiz.gameMode] ?? "게임"} · ${quiz.round}/${game.totalRounds}문제` : "게임 대기"}
            <span className="ml-1 rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] tracking-[0.14em] text-white/80">
              {joinCode}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[["question", "문제"], ["ranking", "랭킹판"]] .map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id as "question" | "ranking")}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-[12px] font-semibold",
                  (view === id || (view === "auto" && id === "question" && quiz))
                    ? "bg-white text-slate-900"
                    : "bg-white/10 text-white hover:bg-white/20",
                )}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => void toggleFullscreen()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/20"
            >
              <IconMaximize size={14} /> {fullscreen ? "전체화면 해제" : "전체화면"}
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/20"
            >
              <IconX size={14} /> 닫기
            </button>
          </div>
        </div>

        {showLobby ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-6">
            <div className="text-center">
              <p className="text-[clamp(16px,2vw,24px)] font-bold text-white/70">
                접속 후 <span className="text-white">방번호</span>와 닉네임을 입력하세요
              </p>
              <p className="mt-2 font-mono text-[clamp(54px,9vw,140px)] font-black leading-none tracking-[0.12em] text-white">
                {joinCode}
              </p>
              <p className="mt-3 text-[clamp(12px,1.3vw,17px)] text-white/60">
                이미 수업에 접속한 학생은 자동으로 참여합니다 · 대기 중 {studentCount}명
              </p>
            </div>
            <div className="w-full max-w-6xl">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-white/60">
                <IconUsers size={14} /> 접속 현황 {studentCount}
              </div>
              <div className="flex flex-wrap gap-2">
                {game.scores.length === 0 ? (
                  <p className="text-[13px] text-white/40">학생이 입장하면 이름이 여기에 나타납니다.</p>
                ) : (
                  game.scores.map((score) => (
                    <span
                      key={score.participantId}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[clamp(13px,1.4vw,19px)] font-bold ring-1 ring-white/15"
                    >
                      <span className={cx("h-2.5 w-2.5 rounded-full", teamTone(score.team).dot)} />
                      {score.name}
                      {score.team ? <span className="text-[0.75em] font-medium text-white/50">{score.team}</span> : null}
                    </span>
                  ))
                )}
              </div>
            </div>
            <p className="text-[12px] text-white/40">선생님 콘솔에서 ‘이 문제 시작’을 누르면 게임이 시작됩니다.</p>
          </div>
        ) : showRanking ? (
          <div className="flex min-h-0 flex-1 gap-4 px-6 py-5">
            <div className="flex min-w-0 flex-[1.35] flex-col">
              <p className="mb-3 flex items-center gap-2 text-[clamp(18px,2vw,28px)] font-extrabold">
                <IconTrophy size={22} className="text-amber-300" /> 순위
              </p>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {game.scores.length === 0 ? (
                  <p className="text-[14px] text-white/40">학생이 참가하면 순위가 표시됩니다.</p>
                ) : (
                  game.scores.map((score, index) => (
                    <div
                      key={score.participantId}
                      className={cx(
                        "relative overflow-hidden rounded-xl px-4 py-2.5",
                        index === 0 ? "bg-amber-400/20 ring-1 ring-amber-300/40" : "bg-white/[0.07]",
                      )}
                    >
                      <div
                        className={cx("absolute inset-y-0 left-0 opacity-25", palette[index]?.bar ?? "bg-white")}
                        style={{ width: `${Math.max(4, Math.round((Math.max(0, score.points) / topPoints) * 100))}%` }}
                      />
                      <div className="relative flex items-center gap-3">
                        <span className="w-7 shrink-0 text-center text-[clamp(13px,1.4vw,18px)] font-black text-white/50">
                          {index + 1}
                        </span>
                        <span className={cx("h-3 w-3 shrink-0 rounded-full", (palette[index] ?? teamTone(null)).dot)} />
                        <span className="min-w-0 flex-1 truncate text-[clamp(14px,1.5vw,21px)] font-extrabold">
                          {score.name}
                          {!score.alive ? <span className="ml-2 text-[0.7em] font-bold text-rose-300">탈락</span> : null}
                        </span>
                        <span className="shrink-0 text-[clamp(12px,1.1vw,15px)] text-white/50">
                          {score.correct}문제
                        </span>
                        <span className="shrink-0 font-mono text-[clamp(15px,1.7vw,24px)] font-black tabular-nums">
                          {score.points.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {game.teams.length > 0 ? (
                <div className="mt-3 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
                  {[...game.teams]
                    .sort((left, right) => right.points - left.points)
                    .map((team) => (
                      <div key={team.id} className="rounded-xl bg-white/[0.07] px-3 py-2">
                        <p className="text-[11px] font-semibold text-white/50">
                          {team.label} · {team.players}명
                        </p>
                        <p className="text-[clamp(14px,1.5vw,20px)] font-extrabold">{team.points}점</p>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
            <div className="flex min-h-0 w-[min(34%,420px)] flex-col rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="mb-2 text-[13px] font-bold text-white/70">알림</p>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {game.feed.length === 0 ? (
                  <p className="text-[12px] text-white/40">점수를 얻으면 여기에 알림이 쌓입니다.</p>
                ) : (
                  game.feed.map((entry) => (
                    <p
                      key={entry.id}
                      className={cx(
                        "rounded-lg px-2.5 py-1.5 text-[clamp(11px,1.05vw,14px)] leading-snug",
                        entry.tone === "warn"
                          ? "bg-amber-400/15 text-amber-100"
                          : entry.tone === "good"
                            ? "bg-emerald-400/15 text-emerald-100"
                            : "bg-white/[0.06] text-white/70",
                      )}
                    >
                      {entry.text}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold",
                    quiz?.status === "open" ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-white/70",
                  )}
                >
                  <span className={cx("h-1.5 w-1.5 rounded-full", quiz?.status === "open" ? "bg-emerald-300" : "bg-white/40")} />
                  {quiz?.status === "open"
                    ? remaining !== null && remaining <= 0
                      ? "시간 종료"
                      : "응답 받는 중"
                    : "응답 마감"}
                </span>
                <span className="text-[12.5px] font-semibold text-white/60">
                  응답 {answered}/{studentCount}명
                </span>
                {game.mode === "item" ? (
                  <span className="rounded-full bg-fuchsia-400/20 px-2.5 py-1 text-[11px] font-bold text-fuchsia-100">
                    아이템전
                  </span>
                ) : null}
              </div>
              {remaining !== null ? (
                <div
                  className={cx(
                    "rounded-xl px-4 py-1.5 font-mono text-[clamp(22px,3vw,38px)] font-extrabold leading-none tabular-nums",
                    remaining <= 5000 ? "bg-rose-500/90 text-white" : "bg-white/10 text-white",
                  )}
                >
                  {clock(remaining)}
                </div>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col justify-center gap-6 px-6 py-4">
              <p className="text-center text-[clamp(24px,4.2vw,58px)] font-extrabold leading-tight tracking-tight">
                {quiz?.prompt}
              </p>

              {quiz?.mode === "connect" ? (
                <div className="mx-auto grid w-full max-w-4xl gap-2 sm:grid-cols-2">
                  {quiz.lefts.map((left) => (
                    <div
                      key={left}
                      className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[clamp(14px,1.7vw,22px)] font-bold"
                    >
                      {left}
                    </div>
                  ))}
                  <p className="sm:col-span-2 text-center text-[clamp(11px,1.2vw,15px)] text-white/50">
                    학생 화면에서 왼쪽 항목과 오른쪽 뜻을 연결합니다 · 모두 맞혀야 정답
                  </p>
                </div>
              ) : (
                <div className="mx-auto grid w-full max-w-6xl gap-3 sm:grid-cols-2">
                  {quiz?.options.map((option, index) => {
                    const tally = results?.tallies[option.id] ?? 0;
                    const percent = answered > 0 ? Math.round((tally / answered) * 100) : 0;
                    const isCorrect =
                      quiz.status === "closed" &&
                      Boolean(results?.correctAnswer) &&
                      results?.correctAnswer === option.label;
                    return (
                      <div
                        key={option.id}
                        className={cx(
                          "relative overflow-hidden rounded-2xl border px-4 py-3",
                          isCorrect ? "border-emerald-400/60 bg-emerald-500/20" : "border-white/15 bg-white/[0.06]",
                        )}
                      >
                        <div
                          className={cx(
                            "absolute inset-y-0 left-0 transition-all duration-500",
                            isCorrect ? "bg-emerald-400/20" : "bg-white/10",
                          )}
                          style={{ width: `${percent}%` }}
                        />
                        <div className="relative flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              className={cx(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-extrabold",
                                isCorrect ? "bg-emerald-400 text-emerald-950" : "bg-white/15 text-white",
                              )}
                            >
                              {quiz.mode === "ox" ? option.label : String.fromCharCode(65 + index)}
                            </span>
                            <span className="truncate text-[clamp(16px,2vw,26px)] font-bold">
                              {quiz.mode === "ox" ? "" : option.label}
                            </span>
                          </span>
                          <span className="shrink-0 text-[13px] font-bold text-white/70">{tally}명</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {quiz?.status === "closed" && results?.correctAnswer ? (
                <p className="text-center text-[clamp(14px,1.8vw,22px)] font-bold text-emerald-300">
                  정답 · {results.correctAnswer}
                  {typeof results.correctCount === "number" ? ` · ${results.correctCount}명 정답` : ""}
                </p>
              ) : null}
            </div>

            <div className="border-t border-white/10 px-6 py-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-end gap-3">
                  {game.scores.slice(0, 3).length === 0 ? (
                    <p className="text-[12.5px] text-white/50">학생이 참가하면 순위가 표시됩니다.</p>
                  ) : (
                    game.scores.slice(0, 3).map((score, index) => (
                      <div
                        key={score.participantId}
                        className={cx(
                          "rounded-xl px-4 py-2",
                          index === 0 ? "bg-amber-400/20 ring-1 ring-amber-300/40" : "bg-white/10",
                        )}
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">{index + 1}위</p>
                        <p className="text-[clamp(14px,1.6vw,20px)] font-extrabold">{score.name}</p>
                        <p className="text-[12px] font-semibold text-white/70">
                          {score.points}점{score.team ? ` · ${score.team}` : ""}
                          {!score.alive ? " · 탈락" : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[12px] text-white/60">
                  {game.feed[0] ? (
                    <span className="rounded-lg bg-white/10 px-3 py-1.5 text-white/80">
                      {game.feed[0].text}
                    </span>
                  ) : null}
                  {game.mode === "item" ? (
                    <span>
                      아이템{" "}
                      {game.items.length
                        ? (() => {
                            const counts: Record<string, number> = {};
                            for (const item of game.items) counts[item.item] = (counts[item.item] ?? 0) + 1;
                            return Object.entries(counts)
                              .map(([kind, count]) => `${ITEM_LABEL[kind] ?? kind} ${count}`)
                              .join(" · ");
                          })()
                        : "없음"}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
