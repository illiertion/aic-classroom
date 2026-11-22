import { useEffect, useMemo, useState } from "react";
import type { ClientMessage, MiniGameState, StudentLive } from "../../../shared/protocol";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Field,
  Select,
  Textarea,
  cx,
} from "../../components/ui";
import {
  IconAlert,
  IconCheck,
  IconPlay,
  IconRefresh,
  IconSparkles,
  IconTrophy,
  IconX,
} from "../../components/Icons";
import { LadderBoard } from "../../components/LadderBoard";

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function parseWords(value: string, max = 6): string[] {
  return value
    .split(/[\s,]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, max);
}

function parseLines(value: string, max: number): string[] {
  return value
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

const TITLES: Record<MiniGameState["kind"], string> = {
  roulette: "룰렛",
  bomb: "폭탄 돌리기",
  wordsearch: "낱말 찾기",
  memory: "카드 짝 맞추기",
  ladder: "사다리 타기",
  speedtap: "반응 속도 대결",
  jamo: "초성 퀴즈",
};

/** Cells that belong to an already-found word, so the grid can highlight them. */
function foundCells(state: Extract<MiniGameState, { kind: "wordsearch" }>): Set<string> {
  const cells = new Set<string>();
  for (const item of state.found) {
    const word = item.word;
    for (let row = 0; row < state.size; row += 1) {
      for (let col = 0; col < state.size; col += 1) {
        for (const horizontal of [true, false]) {
          let fits = true;
          for (let index = 0; index < word.length; index += 1) {
            const r = row + (horizontal ? 0 : index);
            const c = col + (horizontal ? index : 0);
            if (r >= state.size || c >= state.size || state.grid[r][c] !== word[index]) {
              fits = false;
              break;
            }
          }
          if (!fits) continue;
          for (let index = 0; index < word.length; index += 1) {
            cells.add(`${row + (horizontal ? 0 : index)}:${col + (horizontal ? index : 0)}`);
          }
        }
      }
    }
  }
  return cells;
}

export function MiniGameTab({
  game,
  students,
  send,
  connected,
  initialWords,
}: {
  game: MiniGameState | null;
  students: StudentLive[];
  send: (message: ClientMessage) => void;
  connected: boolean;
  initialWords?: string;
}) {
  const [words, setWords] = useState(initialWords || "사과 나무 학교 친구");
  const [ladderNames, setLadderNames] = useState("");
  const [ladderPrizes, setLadderPrizes] = useState("1등 상품\n2등 상품\n3등 상품\n참가 상품");
  const [ladderRows, setLadderRows] = useState(8);
  const [tapSize, setTapSize] = useState(3);
  const [now, setNow] = useState(() => Date.now());

  const bomb = game?.kind === "bomb" ? game : null;
  const speedtap = game?.kind === "speedtap" ? game : null;

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 300);
    return () => window.clearInterval(tick);
  }, []);

  const highlighted = useMemo(
    () => (game?.kind === "wordsearch" ? foundCells(game) : new Set<string>()),
    [game],
  );
  const online = students.filter((student) => student.online);
  const onlineNames = online.map((student) => student.name);

  return (
    <div className="space-y-4">
      <Callout tone="info" icon={<IconSparkles size={15} />} title="띵커벨처럼 바로 쓰는 미니게임 7종">
        룰렛·폭탄 돌리기·낱말 찾기·카드 짝 맞추기·사다리 타기·반응 속도 대결·초성 퀴즈는 서버가 진행
        상태를 관리합니다. 선생님이 다른 탭을 보고 있어도 폭탄은 제때 터지고, 학생 화면에는 같은 판이
        실시간으로 보입니다.
      </Callout>

      {game ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-white">
          <span className="text-[12px] font-semibold">진행 중 · {TITLES[game.kind]}</span>
          <Button size="sm" variant="secondary" onClick={() => send({ type: "minigame_close" })}>
            <IconX size={13} /> 게임 끝내기
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="🎡 룰렛 뽑기"
              description="접속한 학생 중 한 명을 무작위로 뽑습니다. 결과는 학생 화면에도 크게 표시됩니다."
              action={<Badge tone={game?.kind === "roulette" ? "brand" : "neutral"}>{online.length}명 접속</Badge>}
            />
          </div>
          <div className="space-y-3 p-5">
            <Button disabled={!connected || online.length === 0} onClick={() => send({ type: "minigame_roulette" })}>
              <IconSparkles size={15} /> 룰렛 돌리기
            </Button>
            {game?.kind === "roulette" ? (
              <div className="rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 p-5 text-center text-white">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-brand-200">당첨</p>
                <p className="mt-1 text-[26px] font-extrabold">{game.picked?.name ?? "다시 뽑아 주세요"}</p>
                <p className="mt-1 text-[11px] text-white/60">후보 {game.candidates.length}명</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="💣 폭탄 돌리기"
              description="폭탄을 든 학생이 ‘넘기기’를 눌러 다음 학생에게 넘깁니다. 터지는 시각은 서버만 알고, 학생 화면에도 시계가 표시되지 않습니다."
              action={
                <Badge
                  tone={bomb?.status === "running" ? "warn" : bomb?.status === "exploded" ? "danger" : "neutral"}
                  dot={Boolean(bomb)}
                >
                  {bomb?.status === "running" ? "진행 중" : bomb?.status === "exploded" ? "터짐" : "대기"}
                </Badge>
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <Button disabled={!connected || online.length === 0} onClick={() => send({ type: "minigame_bomb_start" })}>
              <IconPlay size={14} /> 폭탄 시작
            </Button>
            {bomb ? (
              <div
                className={cx(
                  "rounded-xl p-5 text-center",
                  bomb.status === "exploded"
                    ? "bg-rose-50 ring-1 ring-rose-200"
                    : "bg-amber-50 ring-1 ring-amber-200",
                )}
              >
                <p className="text-[34px] leading-none">{bomb.status === "exploded" ? "💥" : "💣"}</p>
                <p className="mt-2 text-[13px] font-bold text-slate-800">
                  {bomb.status === "exploded"
                    ? `${bomb.loserName ?? bomb.holder.name}님이 걸렸습니다`
                    : `${bomb.holder.name}님이 폭탄을 들고 있습니다`}
                </p>
                {bomb.status === "running" ? (
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    경과 {clock(now - bomb.startedAt)} · 남은 시간은 아무도 모릅니다
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[11.5px] text-slate-400">학생이 2명 이상 접속하면 폭탄을 돌릴 수 있습니다.</p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="🔎 낱말 찾기"
              description="낱말을 2~6개 넣으면 서버가 가로세로 퍼즐을 만듭니다. 학생은 찾은 낱말을 입력합니다."
            />
          </div>
          <div className="space-y-3 p-5">
            <Field label="낱말 (공백·쉼표로 구분)" htmlFor="wordsearch-words">
              <Textarea
                id="wordsearch-words"
                value={words}
                onChange={(event) => setWords(event.target.value)}
                className="min-h-16 text-[12.5px]"
                maxLength={160}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!connected || parseWords(words).length < 2}
                onClick={() => send({ type: "minigame_wordsearch", words: parseWords(words) })}
              >
                <IconPlay size={14} /> 낱말 찾기 시작
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!connected || parseWords(words).length < 2}
                onClick={() => send({ type: "minigame_jamo", words: parseWords(words, 12) })}
              >
                🔤 이 낱말로 초성 퀴즈
              </Button>
            </div>
            {game?.kind === "wordsearch" ? (
              <>
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
                            "flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold",
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
                <div className="flex flex-wrap gap-1.5">
                  {game.words.map((word) => {
                    const found = game.found.find((item) => item.word === word);
                    return (
                      <span
                        key={word}
                        className={cx(
                          "rounded-md px-2 py-1 text-[11px] font-semibold ring-1",
                          found
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-50 text-slate-600 ring-slate-200",
                        )}
                      >
                        {word}
                        {found ? ` · ${found.by}` : ""}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="🃏 카드 짝 맞추기"
              description="같은 낱말 두 장을 찾는 기억 게임입니다. 학생과 선생님 모두 카드를 뒤집을 수 있습니다."
              action={
                game?.kind === "memory" ? (
                  <Badge tone="info">
                    {game.matched}/{game.cards.length / 2}쌍 · {game.moves}번
                  </Badge>
                ) : null
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap gap-2">
              <Button disabled={!connected} onClick={() => send({ type: "minigame_memory", words: parseWords(words) })}>
                <IconPlay size={14} /> 카드 만들기
              </Button>
              {game?.kind === "memory" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!connected}
                  onClick={() => send({ type: "minigame_memory", words: parseWords(words) })}
                >
                  <IconRefresh size={13} /> 다시 섞기
                </Button>
              ) : null}
            </div>
            {game?.kind === "memory" ? (
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(4, Math.ceil(Math.sqrt(game.cards.length)))}, minmax(0, 1fr))`,
                }}
              >
                {game.cards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    disabled={card.state !== "hidden"}
                    onClick={() => send({ type: "memory_flip", cardId: card.id })}
                    className={cx(
                      "flex h-16 items-center justify-center rounded-xl text-[14px] font-extrabold ring-1 transition",
                      card.state === "matched"
                        ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                        : card.state === "open"
                          ? "bg-brand-600 text-white ring-brand-600"
                          : "bg-slate-800 text-transparent ring-slate-800 hover:bg-slate-700",
                    )}
                  >
                    {card.state === "hidden" ? "?" : card.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11.5px] text-slate-400">
                위 낱말 목록으로 카드를 만듭니다. 낱말이 2개 미만이면 기본 4쌍이 쓰입니다.
              </p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="🪜 사다리 타기"
              description="이름과 상품을 넣으면 서버가 사다리를 긋고 결과를 계산합니다. 결과는 ‘결과 공개’를 눌러야 보입니다."
              action={
                game?.kind === "ladder" ? (
                  <Badge tone={game.revealed ? "ok" : "warn"} dot>
                    {game.revealed ? "공개됨" : "결과 숨김"}
                  </Badge>
                ) : null
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field
                label="이름 (줄·쉼표 구분)"
                htmlFor="ladder-names"
                hint={onlineNames.length ? `비우면 접속 학생 ${onlineNames.length}명을 사용합니다.` : "비우면 접속 학생을 사용합니다."}
              >
                <Textarea
                  id="ladder-names"
                  value={ladderNames}
                  onChange={(event) => setLadderNames(event.target.value)}
                  placeholder={onlineNames.slice(0, 5).join("\n") || "학생1\n학생2"}
                  className="min-h-20 text-[12px]"
                  maxLength={400}
                />
              </Field>
              <Field label="상품 (줄·쉼표 구분)" htmlFor="ladder-prizes">
                <Textarea
                  id="ladder-prizes"
                  value={ladderPrizes}
                  onChange={(event) => setLadderPrizes(event.target.value)}
                  className="min-h-20 text-[12px]"
                  maxLength={400}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="사다리 높이" htmlFor="ladder-rows" className="w-28">
                <Select
                  id="ladder-rows"
                  value={ladderRows}
                  onChange={(event) => setLadderRows(Number(event.target.value))}
                >
                  {[6, 8, 10, 12].map((value) => (
                    <option key={value} value={value}>
                      {value}칸
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                disabled={!connected}
                onClick={() =>
                  send({
                    type: "minigame_ladder",
                    names: parseLines(ladderNames, 10),
                    prizes: parseLines(ladderPrizes, 10),
                    rows: ladderRows,
                  })
                }
              >
                <IconPlay size={14} /> 사다리 만들기
              </Button>
              {game?.kind === "ladder" && !game.revealed ? (
                <Button variant="secondary" disabled={!connected} onClick={() => send({ type: "ladder_reveal" })}>
                  <IconSparkles size={14} /> 결과 공개
                </Button>
              ) : null}
            </div>
            {game?.kind === "ladder" ? <LadderBoard state={game} reveal={game.revealed} /> : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="⏱ 반응 속도 대결"
              description="랜덤한 시점에 두더지가 나타납니다. 가장 빠르게 누른 학생이 가장 많은 점수를 받고, 라운드 점수는 누적됩니다."
              action={
                speedtap ? (
                  <Badge tone={now < speedtap.startsAt ? "warn" : now < speedtap.endsAt ? "ok" : "neutral"} dot>
                    {speedtap.round}라운드 ·{" "}
                    {now < speedtap.startsAt ? "준비" : now < speedtap.endsAt ? "진행 중" : "종료"}
                  </Badge>
                ) : null
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="판 크기" htmlFor="tap-size" className="w-28">
                <Select id="tap-size" value={tapSize} onChange={(event) => setTapSize(Number(event.target.value))}>
                  {[3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}×{value}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                disabled={!connected || online.length === 0}
                onClick={() => send({ type: "minigame_speedtap", size: tapSize })}
              >
                <IconPlay size={14} /> 대결 시작
              </Button>
              {speedtap ? (
                <Button variant="secondary" disabled={!connected} onClick={() => send({ type: "speedtap_next" })}>
                  <IconRefresh size={14} /> 다음 라운드
                </Button>
              ) : null}
            </div>
            {speedtap ? (
              <>
                <div
                  className="grid gap-1 rounded-xl bg-slate-100 p-2"
                  style={{ gridTemplateColumns: `repeat(${speedtap.size}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: speedtap.size * speedtap.size }, (_, cell) => {
                    const visible = now >= speedtap.startsAt && now < speedtap.endsAt;
                    const isTarget = visible && cell === speedtap.target;
                    return (
                      <div
                        key={cell}
                        className={cx(
                          "flex aspect-square items-center justify-center rounded-lg text-[18px]",
                          isTarget ? "bg-amber-300" : "bg-white ring-1 ring-slate-200",
                        )}
                      >
                        {isTarget ? "🐹" : ""}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1">
                  {speedtap.hits.length === 0 ? (
                    <p className="text-[11.5px] text-slate-400">아직 누른 학생이 없습니다.</p>
                  ) : (
                    speedtap.hits.map((hit, index) => (
                      <div
                        key={`${hit.participantId}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11.5px]"
                      >
                        <span className="font-semibold text-slate-700">
                          {index + 1}. {hit.name}
                        </span>
                        <span className="font-bold text-slate-500">
                          {hit.ms}ms · +{hit.points}점
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {speedtap.totals.length ? (
                  <p className="text-[10.5px] text-slate-400">
                    누적:{" "}
                    {[...speedtap.totals]
                      .sort((left, right) => right.points - left.points)
                      .slice(0, 5)
                      .map((score) => `${score.name} ${score.points}점`)
                      .join(" · ")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-[11.5px] text-slate-400">
                학생 화면에 3×3 두더지 판이 나타납니다. 두더지가 나오는 시각과 위치는 서버가 정합니다.
              </p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="🔤 초성 퀴즈"
              description="낱말을 넣으면 서버가 초성만 보여 줍니다. 먼저 맞힌 학생이 10점을 받고, 정답은 그때 공개됩니다."
              action={
                game?.kind === "jamo" ? (
                  <Badge tone={game.solved ? "ok" : "brand"}>
                    {game.index}/{game.total}번
                  </Badge>
                ) : null
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <Field label="낱말 (줄·쉼표·공백 구분, 최대 30개)" htmlFor="jamo-words">
              <Textarea
                id="jamo-words"
                value={words}
                onChange={(event) => setWords(event.target.value)}
                className="min-h-16 text-[12.5px]"
                maxLength={600}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!connected || parseWords(words, 30).length === 0}
                onClick={() => send({ type: "minigame_jamo", words: parseWords(words, 30) })}
              >
                <IconPlay size={14} /> 초성 퀴즈 시작
              </Button>
              {game?.kind === "jamo" ? (
                <Button variant="secondary" disabled={!connected} onClick={() => send({ type: "jamo_next" })}>
                  <IconRefresh size={14} /> 다음 문제
                </Button>
              ) : null}
              {game?.kind === "jamo" && !game.solved ? (
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500">
                  <IconTrophy size={13} className="text-amber-500" /> 정답은 아직 서버에만 있습니다
                </span>
              ) : null}
            </div>
            {game?.kind === "jamo" ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-gradient-to-br from-slate-900 to-indigo-900 px-4 py-6 text-center text-white">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-indigo-300">
                    이 초성의 낱말은?
                  </p>
                  <p className="mt-1 text-[clamp(24px,4vw,36px)] font-extrabold tracking-[0.14em]">{game.prompt}</p>
                  {game.solved ? (
                    <p className="mt-2 text-[14px] font-bold text-emerald-300">
                      <IconCheck size={14} className="mr-1 inline" /> {game.answer} · {game.solvedBy}님 정답
                    </p>
                  ) : null}
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {game.attempts.length === 0 ? (
                    <p className="text-[11.5px] text-slate-400">학생이 입력한 답이 여기에 표시됩니다.</p>
                  ) : (
                    game.attempts
                      .slice()
                      .reverse()
                      .map((attempt, index) => (
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
                      ))
                  )}
                </div>
                {game.scores.length ? (
                  <p className="text-[11px] font-semibold text-slate-500">
                    점수:{" "}
                    {[...game.scores]
                      .sort((left, right) => right.points - left.points)
                      .map((score) => `${score.name} ${score.points}점`)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Callout tone="warn" icon={<IconAlert size={15} />}>
        게임은 수업이 진행되는 동안만 서버에 저장되고, <strong>수업을 종료하면 즉시 삭제</strong>됩니다.
        점수판은 게임 탭의 결과 CSV로 남길 수 있습니다.
      </Callout>
    </div>
  );
}
