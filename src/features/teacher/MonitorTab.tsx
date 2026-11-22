import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type {
  ClassroomEventRecord,
  ClassroomSummary,
  InputPreview,
  StudentLive,
} from "../../../shared/protocol";
import { eventMeta, studentStatusLabel, studentStatusTone } from "../../../shared/labels";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Spinner,
  StatusDot,
  type Tone,
} from "../../components/ui";
import {
  IconAlert,
  IconChevronRight,
  IconClock,
  IconEye,
  IconInfo,
  IconLock,
  IconMonitor,
  IconRefresh,
  IconShield,
  IconUsers,
  IconX,
} from "../../components/Icons";
import { formatTime, timeAgo } from "../../lib/format";

const STATUS_TONE: Record<"ok" | "warn" | "danger" | "muted", Tone> = {
  ok: "ok",
  warn: "warn",
  danger: "danger",
  muted: "neutral",
};

function severityTone(type: ClassroomEventRecord["type"]): Tone {
  const severity = eventMeta(type).severity;
  if (severity === "warning") return "warn";
  if (severity === "notice") return "info";
  return "neutral";
}

function fullscreenLabel(student: StudentLive) {
  if (student.fullscreen === true) return { text: "전체화면", tone: "ok" as const };
  if (student.fullscreen === false) return { text: "해제됨", tone: "warn" as const };
  return { text: "확인 불가", tone: "neutral" as const };
}

export function MonitorTab({
  students,
  events,
  classroom,
  classroomId,
  observing,
  inputs,
  onToggleObserve,
  onRefresh,
}: {
  students: StudentLive[];
  events: ClassroomEventRecord[];
  classroom: ClassroomSummary;
  classroomId: string;
  observing: boolean;
  inputs: InputPreview[];
  onToggleObserve: (next: boolean) => void;
  onRefresh: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<ClassroomEventRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selected = students.find((student) => student.participantId === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) {
      setHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    api.classrooms
      .events(classroomId, selectedId, 40)
      .then(({ events: list }) => {
        if (active) setHistory(list);
      })
      .catch(() => {
        if (active) setHistory([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classroomId, selectedId]);

  const stats = useMemo(() => {
    const online = students.filter((student) => student.online);
    const attention = online.filter(
      (student) => student.fullscreen === false || student.visibility === "hidden",
    );
    const sharing = students.filter((student) => student.sharingScreen);
    return {
      total: students.length,
      online: online.length,
      attention: attention.length,
      sharing: sharing.length,
    };
  }, [students]);

  const alerts = useMemo(() => events.slice(0, 12), [events]);

  const combinedHistory = useMemo(() => {
    const seen = new Set(history.map((event) => event.id));
    const live = events.filter(
      (event) => event.participantId === selectedId && !seen.has(event.id),
    );
    return [...live, ...history].slice(0, 40);
  }, [events, history, selectedId]);

  const refresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "참가 학생",
              value: `${stats.total}명`,
              caption: `접속 ${stats.online}명`,
              tone: "text-slate-700",
              icon: IconUsers,
            },
            {
              label: "정상 참여",
              value: `${Math.max(0, stats.online - stats.attention)}명`,
              caption: "온라인 · 전체화면",
              tone: "text-emerald-600",
              icon: IconShield,
            },
            {
              label: "확인 필요",
              value: `${stats.attention}명`,
              caption: "전체화면 해제 또는 페이지 숨김",
              tone: "text-amber-600",
              icon: IconAlert,
            },
            {
              label: "화면 공유",
              value: `${stats.sharing}명`,
              caption: "학생이 허용한 화면",
              tone: "text-sky-600",
              icon: IconMonitor,
            },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11.5px] font-medium text-slate-500">{stat.label}</p>
                <stat.icon size={15} className={stat.tone} />
              </div>
              <p className="mt-1.5 text-[22px] font-extrabold tracking-tight text-slate-900">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[10.5px] text-slate-400">{stat.caption}</p>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="활동 입력 미리보기"
              description="AIC 안의 학습지·보드·게임 입력만 실시간으로 봅니다. 다른 앱, 비밀번호, 키보드 전체 입력은 수집하지 않습니다."
              action={
                <div className="flex items-center gap-2">
                  <Badge tone={observing ? "ok" : "neutral"} dot={observing}>
                    {observing ? "관찰 중" : "꺼짐"}
                  </Badge>
                  <Button
                    size="sm"
                    variant={observing ? "danger" : "secondary"}
                    onClick={() => onToggleObserve(!observing)}
                    disabled={classroom.status !== "live"}
                  >
                    <IconEye size={14} /> {observing ? "관찰 끄기" : "관찰 켜기"}
                  </Button>
                </div>
              }
            />
          </div>
          {observing ? (
            inputs.length === 0 ? (
              <p className="px-5 py-4 text-[11.5px] text-slate-500">
                학생이 학습지·보드·게임 답을 입력하면 여기에 나타납니다.
              </p>
            ) : (
              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {inputs.map((input) => (
                  <div key={`${input.participantId}:${input.field}`} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-[10.5px]">
                      <span className="font-semibold text-slate-700">
                        {input.studentName} · {input.field}
                      </span>
                      <span className="text-slate-400">{formatTime(input.at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-2.5 py-2 text-[12px] leading-relaxed text-slate-700">
                      {input.text || "(비어 있음)"}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="flex items-start gap-1.5 px-5 py-4 text-[11.5px] leading-relaxed text-slate-500">
              <IconLock size={13} className="mt-0.5 shrink-0" />
              꺼져 있으면 학생 화면의 입력 내용이 전송되지 않습니다. 켜면 학생 화면에도 관찰 중임이
              표시됩니다.
            </p>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="학생 상태"
              description="브라우저가 알려준 상태만 표시합니다. '확인 불가'는 이탈이 아닙니다."
            />
            <Button variant="secondary" size="sm" onClick={() => void refresh()}>
              {refreshing ? <Spinner className="h-3.5 w-3.5" /> : <IconRefresh size={14} />}
              새로고침
            </Button>
          </div>

          {students.length === 0 ? (
            <EmptyState
              icon={<IconUsers size={22} />}
              title="아직 참가한 학생이 없습니다"
              description={`학생에게 참가 코드 ${classroom.joinCode} 또는 QR을 안내해 주세요.`}
            />
          ) : (
            <div>
              <div className="hidden grid-cols-[1.5fr_1fr_0.9fr_0.9fr_0.9fr_32px] gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
                <span>학생</span>
                <span>상태</span>
                <span>전체화면</span>
                <span>마지막 활동</span>
                <span>화면 공유</span>
                <span />
              </div>
              <div className="divide-y divide-slate-100">
                {students.map((student) => {
                  const tone = STATUS_TONE[studentStatusTone(student)];
                  const fs = fullscreenLabel(student);
                  return (
                    <button
                      key={student.participantId}
                      onClick={() =>
                        setSelectedId((current) =>
                          current === student.participantId ? null : student.participantId,
                        )
                      }
                      className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50/70 sm:grid-cols-[1.5fr_1fr_0.9fr_0.9fr_0.9fr_32px] ${
                        selectedId === student.participantId ? "bg-brand-50/40" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={student.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-slate-900">
                            {student.name}
                          </p>
                          <p className="text-[10.5px] text-slate-400">
                            이벤트 {student.eventCount}건
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 justify-self-end sm:justify-self-start">
                        <StatusDot tone={tone} pulse={student.online} />
                        <span className="whitespace-nowrap text-[11.5px] font-medium text-slate-600">
                          {studentStatusLabel(student)}
                        </span>
                      </div>
                      <span className="hidden sm:block">
                        <Badge tone={fs.tone}>
                          {fs.tone === "warn" ? <IconAlert size={11} /> : null}
                          {fs.text}
                        </Badge>
                      </span>
                      <span className="hidden text-[11.5px] text-slate-500 sm:block">
                        {timeAgo(student.lastActivityAt)}
                      </span>
                      <span className="hidden sm:block">
                        {student.sharingScreen ? (
                          <Badge tone="info">
                            <StatusDot tone="info" pulse /> 공유 중
                          </Badge>
                        ) : (
                          <span className="text-[11.5px] text-slate-400">—</span>
                        )}
                      </span>
                      <IconChevronRight
                        size={15}
                        className={`hidden text-slate-300 transition sm:block ${
                          selectedId === student.participantId ? "rotate-90" : ""
                        }`}
                      />
                      <div className="flex items-center gap-2 sm:hidden">
                        <Badge tone={fs.tone}>{fs.text}</Badge>
                        {student.sharingScreen ? <Badge tone="info">화면 공유</Badge> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {selected ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Avatar name={selected.name} size="sm" />
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">{selected.name} 이벤트 이력</p>
                  <p className="text-[10.5px] text-slate-400">
                    최근 40건 · {formatTime(selected.lastActivityAt)} 마지막 활동
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="닫기"
              >
                <IconX size={16} />
              </button>
            </div>
            {historyLoading && history.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Spinner />
              </div>
            ) : combinedHistory.length === 0 ? (
              <EmptyState title="이 학생의 이벤트가 없습니다" description="입장 후 관측된 이벤트가 여기에 쌓입니다." />
            ) : (
              <ol className="divide-y divide-slate-100">
                {combinedHistory.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 px-5 py-2.5">
                    <span className="mt-0.5 w-14 shrink-0 font-mono text-[10.5px] text-slate-400">
                      {formatTime(event.createdAt)}
                    </span>
                    <Badge tone={severityTone(event.type)}>{eventMeta(event.type).label}</Badge>
                    <span className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-slate-500">
                      {event.detail ?? eventMeta(event.type).observation}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        ) : null}

        <div className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
          <IconInfo size={13} className="mt-0.5 shrink-0" />
          관측 불가(권한 없음·브라우저 미지원)는 이탈로 계산하지 않습니다. 키보드 감지는 페이지가 실제로
          받은 입력만 기록하며 부정행위 판정에 사용하지 않습니다.
        </div>
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <StatusDot tone="ok" pulse />
              <h3 className="text-[13px] font-semibold text-slate-900">실시간 알림</h3>
            </div>
            <span className="text-[10.5px] text-slate-400">중복 25초 억제</span>
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <IconClock size={20} className="mx-auto text-slate-300" />
              <p className="mt-2 text-[12px] text-slate-400">
                이벤트가 발생하면 여기에 실시간으로 표시됩니다.
              </p>
            </div>
          ) : (
            <ul className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
              {alerts.map((event) => (
                <li key={event.id} className="aic-slide-in flex items-start gap-2.5 px-4 py-2.5">
                  <span className="mt-1.5">
                    <StatusDot tone={severityTone(event.type)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-slate-800">
                      {event.studentName}
                      <span className="ml-1.5 font-normal text-slate-500">
                        {eventMeta(event.type).label}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400">
                      {eventMeta(event.type).observation}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400">{formatTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Callout tone="info" icon={<IconInfo size={15} />} title="관측 기준">
          페이지 숨김은 “이탈 의심”, 전체화면 해제는 “창 모드”, 연결 종료는 “상태 확인 불가”로 기록합니다.
          학생이 돌아오면 복귀 시각이 별도 이벤트로 남습니다.
        </Callout>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-800">
            <IconMonitor size={15} className="text-brand-600" />
            화면 공유
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">
            학생 화면은 학생이 직접 허용한 동안에만 볼 수 있습니다. ‘화면 공유’ 탭에서 요청하거나
            선생님 화면을 학급에 공유할 수 있습니다.
          </p>
        </Card>
      </div>
    </div>
  );
}
