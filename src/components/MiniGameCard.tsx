import { useEffect, useState } from "react";
import type { MiniGameState } from "../../shared/protocol";
import { Badge, Button, Card, Input, cx } from "./ui";
import { IconCheck, IconPlay } from "./Icons";
import { LadderBoard } from "./LadderBoard";

function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Grid cells that belong to a found word, used for highlighting. */
function foundCells(game: Extract<MiniGameState, { kind: "wordsearch" }>): Set<string> {
  const cells = new Set<string>();
  for (const item of game.found) {
    for (let row = 0; row < game.size; row += 1) {
      for (let col = 0; col < game.size; col += 1) {
        for (const horizontal of [true, false]) {
          let fits = true;
          for (let index = 0; index < item.word.length; index += 1) {
            const r = row + (horizontal ? 0 : index);
            const c = col + (horizontal ? index : 0);
            if (r >= game.size || c >= game.size || game.grid[r][c] !== item.word[index]) {
              fits = false;
              break;
            }
          }
          if (!fits) continue;
          for (let index = 0; index < item.word.length; index += 1) {
            cells.add(`${row + (horizontal ? 0 : index)}:${col + (horizontal ? index : 0)}`);
          }
        }
      }
    }
  }
  return cells;
}

const TITLES: Record<MiniGameState["kind"], string> = {
  roulette: "🎡 룰렛",
  bomb: "💣 폭탄 돌리기",
  wordsearch: "🔎 낱말 찾기",
  memory: "🃏 카드 짝 맞추기",
  ladder: "🪜 사다리 타기",
  speedtap: "⏱ 반응 속도 대결",
  jamo: "🔤 초성 퀴즈",
};

/**
 * One live mini-game on a student's device. The server owns the state, so this
 * component only renders and sends the student's own actions.
 */
export function MiniGameCard({
  game,
  me,
  now,
  foundWord,
  onFoundWord,
  onFind,
  onPass,
  onFlip,
  onTap,
  onJamo,
  ended,
}: {
  game: MiniGameState;
  me: string;
  now: number;
  foundWord: string;
  onFoundWord: (value: string) => void;
  onFind: (word: string) => void;
  onPass: () => void;
  onFlip: (cardId: string) => void;
  onTap: (cell: number) => void;
  onJamo: (text: string) => void;
  ended: boolean;
}) {
  const [guess, setGuess] = useState("");

  // A new consonant prompt means a new word, so the previous guess is cleared.
  const jamoPromptText = game.kind === "jamo" ? `${game.index}:${game.prompt}` : "";
  useEffect(() => {
    setGuess("");
  }, [jamoPromptText]);

  const isHolder = game.kind === "bomb" && game.holder.participantId === me;
  const highlighted = game.kind === "wordsearch" ? foundCells(game) : new Set<string>();

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold text-slate-900">{TITLES[game.kind]}</p>
          {game.kind === "bomb" ? (
            <Badge tone={game.status === "exploded" ? "danger" : "warn"} dot>
              {game.status === "exploded" ? "터짐" : "진행 중"}
            </Badge>
          ) : null}
          {game.kind === "speedtap" ? (
            <Badge tone={now >= game.startsAt && now < game.endsAt ? "ok" : "neutral"} dot>
              {game.round}라운드 ·{" "}
              {now < game.startsAt ? "준비" : now < game.endsAt ? "진행 중" : "마감"}
            </Badge>
          ) : null}
          {game.kind === "jamo" ? (
            <Badge tone={game.solved ? "ok" : "brand"}>
              {game.index}/{game.total}번
            </Badge>
          ) : null}
        </div>
      </div>

      {game.kind === "roulette" ? (
        <div className="bg-gradient-to-br from-brand-600 to-indigo-700 px-5 py-8 text-center text-white">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-brand-200">룰렛 결과</p>
          <p className="mt-2 text-[28px] font-extrabold">{game.picked?.name ?? "다시 뽑아 주세요"}</p>
        </div>
      ) : null}

      {game.kind === "bomb" ? (
        <div
          className={cx(
            "px-5 py-6 text-center",
            isHolder && game.status === "running" ? "bg-amber-50" : "bg-white",
          )}
        >
          {/* The exact explosion time is server-only, otherwise students could
              simply hold the bomb until the last second. */}
          <p className={cx("text-[40px] leading-none", game.status === "exploded" ? "" : "aic-bomb")}>
            {game.status === "exploded" ? "💥" : "💣"}
          </p>
          <p className="mt-3 text-[13px] font-bold text-slate-800">
            {game.status === "exploded"
              ? `${game.loserName ?? game.holder.name}님이 걸렸습니다`
              : isHolder
                ? "폭탄을 들고 있습니다! 빨리 넘기세요."
                : `${game.holder.name}님이 폭탄을 들고 있습니다`}
          </p>
          {game.status === "running" ? (
            <p className="mt-1 font-mono text-[11.5px] text-slate-400">
              시작 후 {countdown(now - game.startedAt)} 경과 · 터지는 시각은 알 수 없습니다
            </p>
          ) : null}
          {isHolder && game.status === "running" ? (
            <Button className="mt-3" size="sm" disabled={ended} onClick={onPass}>
              <IconPlay size={14} /> 다음 사람에게 넘기기
            </Button>
          ) : null}
        </div>
      ) : null}

      {game.kind === "wordsearch" ? (
        <div className="space-y-3 p-4">
          <div className="overflow-x-auto rounded-xl bg-slate-900 p-2">
            <div
              className="mx-auto grid w-max gap-0.5"
              style={{ gridTemplateColumns: `repeat(${game.size}, minmax(0, 1fr))` }}
            >
              {game.grid.flatMap((row, rowIndex) =>
                row.split("").map((letter, colIndex) => (
                  <span
                    key={`${rowIndex}:${colIndex}`}
                    className={cx(
                      "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                      highlighted.has(`${rowIndex}:${colIndex}`)
                        ? "bg-emerald-400 text-emerald-950"
                        : "bg-white/10 text-white/80",
                    )}
                  >
                    {letter}
                  </span>
                )),
              )}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Input
              value={foundWord}
              onChange={(event) => onFoundWord(event.target.value)}
              maxLength={12}
              placeholder="찾은 낱말을 입력"
              disabled={ended}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                if (!foundWord.trim()) return;
                onFind(foundWord.trim());
              }}
            />
            <Button
              size="sm"
              disabled={ended || !foundWord.trim()}
              onClick={() => onFind(foundWord.trim())}
            >
              찾았어요
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {game.words.map((word) => {
              const found = game.found.find((item) => item.word === word);
              return (
                <span
                  key={word}
                  className={cx(
                    "rounded px-1.5 py-0.5 text-[10.5px] font-semibold",
                    found ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {found ? `${word} · ${found.by}` : word}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {game.kind === "memory" ? (
        <div className="p-4">
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${Math.min(
                4,
                Math.ceil(Math.sqrt(game.cards.length)),
              )}, minmax(0, 1fr))`,
            }}
          >
            {game.cards.map((card) => (
              <button
                key={card.id}
                type="button"
                disabled={ended || card.state !== "hidden"}
                onClick={() => onFlip(card.id)}
                className={cx(
                  "flex h-14 items-center justify-center rounded-lg text-[12px] font-extrabold transition",
                  card.state === "matched"
                    ? "bg-emerald-100 text-emerald-800"
                    : card.state === "open"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-800 text-transparent hover:bg-slate-700",
                )}
              >
                {card.state === "hidden" ? "?" : card.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] text-slate-400">
            친구들과 함께 카드를 뒤집을 수 있습니다. {game.matched}/{game.cards.length / 2}쌍 · {game.moves}번
          </p>
        </div>
      ) : null}

      {game.kind === "ladder" ? (
        <div className="p-4">
          <LadderBoard state={game} reveal={game.revealed} compact />
        </div>
      ) : null}

      {game.kind === "speedtap" ? (
        <SpeedTapBoard game={game} me={me} now={now} ended={ended} onTap={onTap} />
      ) : null}

      {game.kind === "jamo" ? (
        <div className="space-y-3 p-4">
          <div className="rounded-xl bg-gradient-to-br from-slate-900 to-indigo-900 px-4 py-6 text-center text-white">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-indigo-300">
              초성을 보고 낱말을 맞히세요
            </p>
            <p className="mt-2 text-[clamp(24px,5vw,38px)] font-extrabold tracking-[0.14em]">
              {game.prompt}
            </p>
            {game.solved ? (
              <p className="mt-2 text-[14px] font-bold text-emerald-300">
                정답 {game.answer} · {game.solvedBy}님
              </p>
            ) : null}
          </div>
          <div className="flex items-end gap-2">
            <Input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              maxLength={24}
              placeholder="정답 낱말"
              disabled={ended || game.solved}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                if (!guess.trim()) return;
                onJamo(guess.trim());
                setGuess("");
              }}
            />
            <Button
              size="sm"
              disabled={ended || game.solved || !guess.trim()}
              onClick={() => {
                onJamo(guess.trim());
                setGuess("");
              }}
            >
              <IconCheck size={14} /> 제출
            </Button>
          </div>
          {game.attempts.length ? (
            <div className="space-y-1">
              {game.attempts.slice(-5).reverse().map((attempt, index) => (
                <div
                  key={`${attempt.at}-${index}`}
                  className={cx(
                    "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px]",
                    attempt.correct ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600",
                  )}
                >
                  <span className="truncate font-semibold">{attempt.name}</span>
                  <span className="truncate">{attempt.text}</span>
                </div>
              ))}
            </div>
          ) : null}
          {game.scores.length ? (
            <p className="text-[10.5px] text-slate-400">
              {[...game.scores]
                .sort((left, right) => right.points - left.points)
                .slice(0, 5)
                .map((score) => `${score.name} ${score.points}점`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function SpeedTapBoard({
  game,
  me,
  now,
  ended,
  onTap,
}: {
  game: Extract<MiniGameState, { kind: "speedtap" }>;
  me: string;
  now: number;
  ended: boolean;
  onTap: (cell: number) => void;
}) {
  const ready = now >= game.startsAt;
  const live = ready && now < game.endsAt;
  const myHit = game.hits.find((hit) => hit.participantId === me) ?? null;
  const myScore = game.totals.find((score) => score.participantId === me) ?? null;
  const cells = Array.from({ length: game.size * game.size }, (_, index) => index);

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
        <span className="font-semibold text-slate-600">
          {ready ? (live ? "두더지를 누르세요!" : "이번 라운드 종료") : "곧 두더지가 나타납니다…"}
        </span>
        <span className="font-bold text-slate-500">내 점수 {myScore?.points ?? 0}점</span>
      </div>
      <div
        className={cx(
          "grid gap-1.5 rounded-xl p-2 transition",
          ready ? "bg-emerald-50" : "bg-slate-100",
        )}
        style={{ gridTemplateColumns: `repeat(${game.size}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const isTarget = ready && live && cell === game.target;
          return (
            <button
              key={cell}
              type="button"
              disabled={ended || !live || Boolean(myHit)}
              onClick={() => onTap(cell)}
              className={cx(
                "flex aspect-square items-center justify-center rounded-xl text-[22px] font-extrabold transition",
                isTarget
                  ? "bg-amber-300 text-amber-950 shadow-inner"
                  : "bg-white text-slate-300 ring-1 ring-slate-200",
                !ready && "opacity-70",
              )}
              aria-label={isTarget ? "두더지" : `칸 ${cell + 1}`}
            >
              {isTarget ? "🐹" : ""}
            </button>
          );
        })}
      </div>
      {myHit ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">
          기록 {myHit.ms}ms · +{myHit.points}점
        </p>
      ) : (
        <p className="text-[10.5px] text-slate-400">
          반응 속도는 서버가 재고, 이번 라운드에서 가장 빨랐던 사람이 가장 많은 점수를 받습니다.
        </p>
      )}
      {game.totals.length ? (
        <div className="space-y-1">
          {[...game.totals]
            .sort((left, right) => right.points - left.points)
            .slice(0, 5)
            .map((score, index) => (
              <div
                key={score.participantId}
                className={cx(
                  "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-[11.5px]",
                  index === 0 ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600",
                )}
              >
                <span className="truncate font-semibold">
                  {index + 1}. {score.name}
                </span>
                <span className="shrink-0 font-bold">
                  {score.points}점{score.bestMs !== null ? ` · ${score.bestMs}ms` : ""}
                </span>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
