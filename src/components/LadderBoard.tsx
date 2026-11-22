import type { LadderState } from "../../shared/protocol";
import { cx } from "./ui";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#64748b",
  "#d946ef",
];

const COL_GAP = 84;
const ROW_GAP = 34;
const PAD_TOP = 34;
const PAD_SIDE = 46;

/**
 * 사다리 타기 drawing. The ladder itself comes from the server, so the teacher
 * and every student see exactly the same rungs. `reveal` only affects the
 * result lines and labels.
 */
export function LadderBoard({
  state,
  reveal,
  compact = false,
}: {
  state: LadderState;
  reveal: boolean;
  compact?: boolean;
}) {
  const cols = state.names.length;
  const width = PAD_SIDE * 2 + Math.max(1, cols - 1) * COL_GAP;
  const height = PAD_TOP * 2 + state.rows * ROW_GAP + 12;
  const xOf = (col: number) => PAD_SIDE + col * COL_GAP;
  const yOf = (row: number) => PAD_TOP + row * ROW_GAP;
  const bottom = yOf(state.rows);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl bg-white p-2 ring-1 ring-slate-200">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={cx("mx-auto block h-auto", compact ? "w-[420px]" : "w-full max-w-[760px]")}
          role="img"
          aria-label="사다리 타기"
        >
          {state.names.map((_, col) => (
            <line
              key={`line-${col}`}
              x1={xOf(col)}
              y1={PAD_TOP - 6}
              x2={xOf(col)}
              y2={bottom + 6}
              stroke="#cbd5f5"
              strokeWidth={4}
              strokeLinecap="round"
            />
          ))}
          {state.rungs.map((rung, index) => (
            <line
              key={`rung-${index}`}
              x1={xOf(rung.col)}
              y1={yOf(rung.row)}
              x2={xOf(rung.col + 1)}
              y2={yOf(rung.row)}
              stroke="#94a3b8"
              strokeWidth={4}
              strokeLinecap="round"
            />
          ))}
          {reveal
            ? state.winners.map((winner, index) => {
                const color = COLORS[index % COLORS.length];
                const points: string[] = [];
                let col = winner.start;
                points.push(`${xOf(col)},${PAD_TOP - 6}`);
                for (let row = 0; row < state.rows; row += 1) {
                  const y = yOf(row);
                  if (state.rungs.some((rung) => rung.row === row && rung.col === col)) {
                    points.push(`${xOf(col + 1)},${y}`);
                    col += 1;
                  } else if (
                    col > 0 &&
                    state.rungs.some((rung) => rung.row === row && rung.col === col - 1)
                  ) {
                    points.push(`${xOf(col - 1)},${y}`);
                    col -= 1;
                  }
                }
                points.push(`${xOf(col)},${bottom + 6}`);
                return (
                  <polyline
                    key={`path-${winner.name}-${index}`}
                    points={points.join(" ")}
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    strokeLinejoin="round"
                  />
                );
              })
            : null}
          {state.names.map((name, col) => (
            <text
              key={`name-${col}`}
              x={xOf(col)}
              y={PAD_TOP - 16}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill={reveal ? COLORS[col % COLORS.length] : "#334155"}
            >
              {name.length > 7 ? `${name.slice(0, 6)}…` : name}
            </text>
          ))}
          {state.prizes.map((prize, col) => {
            const winner = state.winners.find((item) => item.end === col);
            return (
              <text
                key={`prize-${col}`}
                x={xOf(col)}
                y={bottom + 26}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={reveal && winner ? COLORS[state.winners.indexOf(winner) % COLORS.length] : "#64748b"}
              >
                {prize.length > 8 ? `${prize.slice(0, 7)}…` : prize}
              </text>
            );
          })}
        </svg>
      </div>

      {reveal ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {state.winners.map((winner, index) => (
            <div
              key={`${winner.name}-${winner.prize}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[12px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="truncate font-semibold text-slate-800">{winner.name}</span>
              </span>
              <span className="shrink-0 font-bold text-slate-600">{winner.prize}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-[11.5px] font-semibold text-slate-400">
          선생님이 결과를 공개하면 색깔 길이 나타납니다.
        </p>
      )}
    </div>
  );
}
