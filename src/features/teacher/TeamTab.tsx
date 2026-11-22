import { useMemo, useState } from "react";
import type { ClientMessage, PresenterPick, RosterState, StudentLive, TeamBoard } from "../../../shared/protocol";
import { teamLabels, teamTone } from "../../../shared/roster";
import { SEAT_RULES, type ClassSettings } from "../../../shared/settings";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  cx,
} from "../../components/ui";
import { IconCheck, IconLayout, IconRefresh, IconSparkles, IconUsers, IconX } from "../../components/Icons";

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-brand-200"
    >
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-slate-800">{label}</span>
        {hint ? <span className="mt-0.5 block text-[10.5px] leading-snug text-slate-400">{hint}</span> : null}
      </span>
      <span
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full transition",
          checked ? "bg-brand-600" : "bg-slate-300",
        )}
      >
        <span
          className={cx(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

export function TeamTab({
  students,
  boards,
  presenter,
  roster,
  settings,
  send,
  connected,
}: {
  students: StudentLive[];
  boards: TeamBoard[];
  presenter: PresenterPick | null;
  roster: RosterState;
  settings: ClassSettings;
  send: (message: ClientMessage) => void;
  connected: boolean;
}) {
  const teams = useMemo(() => teamLabels(roster.teamCount), [roster.teamCount]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [teamPick, setTeamPick] = useState("");
  const [teamText, setTeamText] = useState("");
  const [rouletteTeam, setRouletteTeam] = useState("");

  const capacity = Math.max(1, roster.seatRows) * Math.max(2, roster.seatCols);
  const seatMap = useMemo(() => {
    const map = new Map<number, StudentLive>();
    for (const student of students) {
      if (student.seat !== null) map.set(student.seat, student);
    }
    return map;
  }, [students]);
  const unseated = students.filter((student) => student.seat === null);
  const selected = students.find((student) => student.participantId === selectedStudent) ?? null;
  const teamPickValue = teamPick || teams[0] || "";
  const boardFor = (team: string) => boards.find((board) => board.team === team)?.posts ?? [];

  const patchRoster = (patch: Partial<RosterState>) =>
    send({
      type: "roster_set",
      teamCount: patch.teamCount,
      teamOpen: patch.teamOpen,
      seatRows: patch.seatRows,
      seatCols: patch.seatCols,
      seatOpen: patch.seatOpen,
    });

  const clickSeat = (seat: number) => {
    if (!connected) return;
    const occupant = seatMap.get(seat);
    if (selected) {
      send({ type: "seat_assign", to: selected.participantId, seat });
      setSelectedStudent(null);
      return;
    }
    if (occupant) send({ type: "seat_assign", to: occupant.participantId, seat: null });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="모둠 운영"
              description="모둠 수를 자유롭게 바꾸고, 학생이 직접 모둠을 고르게 할 수도 있습니다."
              action={
                <Badge tone="brand">
                  <IconUsers size={11} /> {teams.length}개 모둠
                </Badge>
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-semibold text-slate-600">모둠 수</span>
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  disabled={!connected || roster.teamCount <= 1}
                  onClick={() => patchRoster({ teamCount: roster.teamCount - 1 })}
                  className="h-7 w-7 rounded-lg bg-white text-[15px] font-bold text-slate-700 shadow-sm disabled:opacity-40"
                  aria-label="모둠 수 줄이기"
                >
                  −
                </button>
                <span className="w-10 text-center text-[13px] font-extrabold text-slate-800">
                  {roster.teamCount}
                </span>
                <button
                  type="button"
                  disabled={!connected || roster.teamCount >= 8}
                  onClick={() => patchRoster({ teamCount: roster.teamCount + 1 })}
                  className="h-7 w-7 rounded-lg bg-white text-[15px] font-bold text-slate-700 shadow-sm disabled:opacity-40"
                  aria-label="모둠 수 늘리기"
                >
                  +
                </button>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!connected}
                onClick={() => send({ type: "team_auto" })}
              >
                <IconRefresh size={12} /> 자동 배분
              </Button>
            </div>

            <Toggle
              checked={roster.teamOpen}
              onChange={(open) => patchRoster({ teamOpen: open })}
              label="학생이 직접 모둠 선택"
              hint="켜 두면 학생 화면에 모둠 버튼이 나타나 스스로 들어갈 모둠을 고릅니다."
            />

            <div className="grid gap-1.5 sm:grid-cols-2">
              {teams.map((team) => {
                const members = students.filter((student) => student.team === team);
                const tone = teamTone(team);
                return (
                  <div key={team} className={cx("rounded-xl px-3 py-2 ring-1", tone.chip)}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11.5px] font-bold">
                        {team} · {members.length}명
                      </p>
                      <button
                        type="button"
                        onClick={() => send({ type: "team_clear", team })}
                        className="text-[10px] font-semibold opacity-60 hover:opacity-100"
                      >
                        글 비우기
                      </button>
                    </div>
                    <p className="mt-1 truncate text-[10.5px] opacity-80">
                      {members.length ? members.map((student) => student.name).join(", ") : "아직 없음"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="자리 배치 · 자리 뽑기"
              description="줄과 칸을 고른 뒤 자리를 뽑습니다. 학생이 직접 앉을 자리를 고르게 할 수도 있습니다."
              action={<IconLayout size={17} className="text-brand-600" />}
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="grid grid-cols-2 gap-2">
              <Field label="줄 (행)" htmlFor="seat-rows">
                <Select
                  id="seat-rows"
                  disabled={!connected}
                  value={roster.seatRows}
                  onChange={(event) => patchRoster({ seatRows: Number(event.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                    <option key={value} value={value}>
                      {value}줄
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="한 줄에 (열)" htmlFor="seat-cols">
                <Select
                  id="seat-cols"
                  disabled={!connected}
                  value={roster.seatCols}
                  onChange={(event) => patchRoster({ seatCols: Number(event.target.value) })}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <option key={value} value={value}>
                      {value}명
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                disabled={!connected || students.length === 0}
                onClick={() => send({ type: "seat_shuffle" })}
              >
                <IconSparkles size={13} /> 자리 뽑기 ({Math.min(capacity, students.length)}명)
              </Button>              <Button size="sm" variant="secondary" disabled={!connected} onClick={() => send({ type: "seat_clear" })}>
                <IconRefresh size={12} /> 자리 비우기
              </Button>
              <span className="text-[10.5px] text-slate-400">
                {students.length}명 · {capacity}자리 · 규칙{" "}
                {SEAT_RULES.find((rule) => rule.id === settings.seatRule)?.label ?? "무작위"}
              </span>
            </div>

            <Toggle
              checked={roster.seatOpen}
              onChange={(open) => patchRoster({ seatOpen: open })}
              label="학생이 직접 자리 선택"
              hint="켜 두면 학생이 빈자리를 눌러 앉을 수 있습니다. 이미 앉은 자리는 바꿀 수 없습니다."
            />

            {selected ? (
              <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 ring-1 ring-brand-200">
                <Avatar name={selected.name} size="sm" />
                <p className="text-[11.5px] font-semibold text-brand-800">
                  {selected.name} 학생을 옮길 자리를 누르세요
                </p>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedStudent(null)}>
                  <IconX size={12} /> 취소
                </Button>
              </div>
            ) : (
              <p className="text-[10.5px] text-slate-400">
                아래에서 학생을 고른 뒤 자리를 누르면 그 자리로 이동합니다. 앉은 학생을 누르면 자리가 비워집니다.
              </p>
            )}

            <div className="space-y-1.5 rounded-xl bg-slate-50 p-2.5">
              {Array.from({ length: Math.max(1, roster.seatRows) }, (_, row) => (
                <div
                  key={row}
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${Math.max(2, roster.seatCols)}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: Math.max(2, roster.seatCols) }, (_, col) => {
                    const seat = row * roster.seatCols + col;
                    if (seat >= capacity) return <span key={seat} />;
                    const student = seatMap.get(seat);
                    const tone = student ? teamTone(student.team) : null;
                    return (
                      <button
                        key={seat}
                        type="button"
                        onClick={() => clickSeat(seat)}
                        className={cx(
                          "min-h-[46px] rounded-lg px-1.5 py-1.5 text-center text-[11px] ring-1 transition",
                          student && tone
                            ? cx(tone.chip, "hover:brightness-95")
                            : "bg-white text-slate-300 ring-slate-200 hover:border-brand-300 hover:text-brand-500",
                        )}
                        title={student ? `${student.name} · ${seat + 1}번` : `${seat + 1}번 빈자리`}
                      >
                        <span className="block truncate font-bold">
                          {student ? student.name : "빈자리"}
                        </span>
                        <span className="block text-[9px] opacity-60">{seat + 1}번</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {unseated.length > 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-2.5">
                <p className="mb-1.5 text-[10.5px] font-semibold text-slate-500">아직 자리가 없는 학생</p>
                <div className="flex flex-wrap gap-1.5">
                  {unseated.map((student) => (
                    <button
                      key={student.participantId}
                      type="button"
                      onClick={() =>
                        setSelectedStudent((current) =>
                          current === student.participantId ? null : student.participantId,
                        )
                      }
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
                        selectedStudent === student.participantId
                          ? "bg-slate-900 text-white ring-slate-900"
                          : "bg-white text-slate-600 ring-slate-200",
                      )}
                    >
                      {student.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="발표자 뽑기"
              description="접속한 학생 중에서 무작위로 한 명을 뽑습니다. 결과는 모든 학생 화면에 함께 표시됩니다."
              action={
                <Badge tone={presenter ? "brand" : "neutral"} dot={Boolean(presenter)}>
                  {presenter ? "선정됨" : "대기"}
                </Badge>
              }
            />
          </div>
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="대상" htmlFor="roulette-team" className="w-32">
                <Select
                  id="roulette-team"
                  value={rouletteTeam}
                  onChange={(event) => setRouletteTeam(event.target.value)}
                >
                  <option value="">전체</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                disabled={!connected || students.filter((student) => student.online).length === 0}
                onClick={() => send({ type: "presenter_pick", team: rouletteTeam || null })}
              >
                <IconSparkles size={15} /> 발표자 뽑기
              </Button>
            </div>
            {presenter ? (
              <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3">
                <Avatar name={presenter.name} />
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold text-slate-900">{presenter.name}</p>
                  <p className="text-[11px] text-slate-500">{presenter.team ?? "모둠 미지정"} · 오늘의 발표자</p>
                </div>
                <Badge tone="brand" className="ml-auto">
                  <IconCheck size={11} /> 학생 화면에도 표시
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => send({ type: "presenter_clear" })}>
                  지우기
                </Button>
              </div>
            ) : (
              <p className="text-[11.5px] text-slate-400">아직 발표자를 뽑지 않았습니다.</p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader title="학생별 모둠" description="학생마다 모둠을 직접 바꿀 수 있습니다." />
          </div>
          <div className="p-5">
            {students.length === 0 ? (
              <p className="text-[11.5px] text-slate-400">접속한 학생이 없습니다.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {students.map((student) => (
                  <div key={student.participantId} className="flex items-center justify-between gap-2 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={student.name} size="sm" />
                      <span className="truncate text-[12.5px] font-semibold text-slate-800">{student.name}</span>
                      {student.seat !== null ? (
                        <span className="shrink-0 text-[9.5px] text-slate-400">{student.seat + 1}번</span>
                      ) : null}
                      {student.online ? null : <span className="text-[10px] text-slate-400">오프라인</span>}
                    </span>
                    <select
                      value={student.team ?? ""}
                      onChange={(event) =>
                        send({ type: "team_set", to: student.participantId, team: event.target.value || null })
                      }
                      className="h-8 w-28 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[11.5px] text-slate-700"
                      aria-label={`${student.name} 모둠`}
                    >
                      <option value="">모둠 없음</option>
                      {teams.map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden self-start">
        <div className="border-b border-slate-100 px-5 py-4">
          <CardHeader
            title="모둠별 토의"
            description="학생은 자기 모둠의 글만 보고 씁니다. 다른 모둠의 글은 학생에게 전송되지 않습니다."
            action={<Badge tone="neutral">{teams.length}개 모둠</Badge>}
          />
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {teams.map((team) => {
            const posts = boardFor(team);
            const tone = teamTone(team);
            return (
              <div key={team} className={cx("rounded-xl p-3 ring-1", tone.chip)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold">{team}</p>
                  <button
                    onClick={() => send({ type: "team_clear", team })}
                    className="text-[10px] font-semibold opacity-60 hover:opacity-100"
                  >
                    비우기
                  </button>
                </div>
                <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {posts.length === 0 ? (
                    <p className="text-[10.5px] opacity-60">아직 글이 없습니다.</p>
                  ) : (
                    posts.map((post) => (
                      <div key={post.id} className="rounded-lg bg-white/80 px-2 py-1.5">
                        <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-slate-700">
                          {post.text}
                        </p>
                        <p className="mt-0.5 text-[9.5px] text-slate-400">{post.author}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-2 border-t border-slate-100 p-4">
          <div className="flex items-end gap-2">
            <Field label="모둠 선택" htmlFor="team-post-target" className="w-28">
              <Select
                id="team-post-target"
                value={teamPickValue}
                onChange={(event) => setTeamPick(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </Select>
            </Field>
            <Input
              value={teamText}
              maxLength={400}
              placeholder="해당 모둠에게만 보낼 안내나 질문"
              onChange={(event) => setTeamText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                if (!teamText.trim()) return;
                send({ type: "team_post", team: teamPickValue, text: teamText.trim() });
                setTeamText("");
              }}
            />
            <Button
              disabled={!connected || !teamText.trim()}
              onClick={() => {
                send({ type: "team_post", team: teamPickValue, text: teamText.trim() });
                setTeamText("");
              }}
            >
              보내기
            </Button>
          </div>
          <p className="text-[10.5px] text-slate-400">
            선생님은 모든 모둠을 볼 수 있지만, 학생 화면에는 자기 모둠 칸만 나타납니다.
          </p>
        </div>
      </Card>
    </div>
  );
}
