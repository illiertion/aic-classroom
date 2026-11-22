import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { ClassroomEventRecord, StudentLive } from "../../../shared/protocol";
import { eventMeta } from "../../../shared/labels";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Select,
  Spinner,
  StatusDot,
  type Tone,
} from "../../components/ui";
import { IconClock, IconRefresh, IconShield } from "../../components/Icons";
import { formatDate, formatTime } from "../../lib/format";

const CATEGORY: Record<string, string[]> = {
  focus: ["fullscreen_enter", "fullscreen_exit", "fullscreen_unknown", "key_escape", "shortcut_observed"],
  page: ["page_hidden", "page_visible", "page_leave", "page_return"],
  connection: ["join", "rejoin", "leave", "network_online", "network_offline", "ws_disconnected", "ws_reconnected"],
  sharing: ["screen_share_started", "screen_share_stopped", "screen_share_denied"],
};

function toneFor(type: ClassroomEventRecord["type"]): Tone {
  const severity = eventMeta(type).severity;
  return severity === "warning" ? "warn" : severity === "notice" ? "info" : "neutral";
}

const RETURN_TYPES = new Set(["rejoin", "page_visible", "page_return"]);

export function EventsTab({
  events,
  students,
  classroomId,
  onRefresh,
}: {
  events: ClassroomEventRecord[];
  students: StudentLive[];
  classroomId: string;
  onRefresh: () => Promise<void>;
}) {
  const [older, setOlder] = useState<ClassroomEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentFilter, setStudentFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const { events: list } = await api.classrooms.events(classroomId, undefined, 300);
      setOlder(list);
    } catch {
      /* socket events remain visible */
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.classrooms
      .events(classroomId, undefined, 300)
      .then(({ events: list }) => {
        if (active) setOlder(list);
      })
      .catch(() => {
        if (active) setOlder([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classroomId]);

  const merged = useMemo(() => {
    const map = new Map<string, ClassroomEventRecord>();
    for (const event of [...older, ...events]) map.set(event.id, event);
    return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
  }, [events, older]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const allowed = category === "all" ? null : new Set(CATEGORY[category] ?? []);
    return merged.filter((event) => {
      if (studentFilter !== "all" && event.participantId !== studentFilter) return false;
      if (allowed && !allowed.has(event.type)) return false;
      if (term) {
        const haystack = `${event.studentName} ${eventMeta(event.type).label} ${event.detail ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [category, merged, query, studentFilter]);

  const refresh = async () => {
    setRefreshing(true);
    await onRefresh();
    await load();
    setRefreshing(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "전체 이벤트", value: merged.length, icon: IconClock, tone: "text-slate-500" },
          {
            label: "확인이 필요한 관측",
            value: merged.filter((event) => eventMeta(event.type).severity === "warning").length,
            icon: IconShield,
            tone: "text-amber-600",
          },
          {
            label: "복귀 기록",
            value: merged.filter((event) => RETURN_TYPES.has(event.type)).length,
            icon: IconRefresh,
            tone: "text-emerald-600",
          },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-3 p-4">
            <stat.icon size={17} className={stat.tone} />
            <div>
              <p className="text-[17px] font-bold leading-tight text-slate-900">{stat.value}</p>
              <p className="text-[11px] text-slate-500">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <CardHeader
            title="이벤트 이력"
            description="이벤트 발생 시각, 학생, 종류, 연결 상태, 복귀 시각을 기록합니다."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="학생 · 이벤트 검색"
              className="h-9 w-40 text-[12.5px]"
            />
            <Select
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value)}
              className="h-9 w-32 text-[12.5px]"
            >
              <option value="all">모든 학생</option>
              {students.map((student) => (
                <option key={student.participantId} value={student.participantId}>
                  {student.name}
                </option>
              ))}
            </Select>
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-9 w-32 text-[12.5px]"
            >
              <option value="all">전체 종류</option>
              <option value="focus">전체화면·키보드</option>
              <option value="page">페이지 표시</option>
              <option value="connection">연결·복귀</option>
              <option value="sharing">화면 공유</option>
            </Select>
            <Button variant="secondary" size="sm" onClick={() => void refresh()}>
              {refreshing ? <Spinner className="h-3.5 w-3.5" /> : <IconRefresh size={14} />}
              새로고침
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[12.5px] text-slate-400">
            <Spinner /> 이벤트를 불러오는 중…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconClock size={22} />}
            title="조건에 맞는 이벤트가 없습니다"
            description="학생이 입장하면 전체화면·페이지·연결·화면 공유 관측이 기록됩니다."
          />
        ) : (
          <div>
            <div className="hidden grid-cols-[0.85fr_0.8fr_1.25fr_0.7fr_0.7fr] gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 md:grid">
              <span>발생 시각</span>
              <span>학생</span>
              <span>이벤트</span>
              <span>연결 상태</span>
              <span>복귀 시각</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.slice(0, 400).map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-1 gap-1.5 px-5 py-3 md:grid-cols-[0.85fr_0.8fr_1.25fr_0.7fr_0.7fr] md:items-center md:gap-3"
                >
                  <div className="font-mono text-[11px] text-slate-500">
                    {formatDate(event.createdAt)}
                    <span className="ml-1.5 text-slate-400">{formatTime(event.createdAt)}</span>
                  </div>
                  <p className="text-[12.5px] font-semibold text-slate-800">{event.studentName}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={toneFor(event.type)}>{eventMeta(event.type).label}</Badge>
                    <span className="text-[11px] text-slate-500">{event.detail ?? eventMeta(event.type).observation}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusDot
                      tone={event.connection === "connected" ? "ok" : event.connection === "disconnected" ? "danger" : "neutral"}
                    />
                    <span className="text-[11px] text-slate-500">
                      {event.connection === "connected"
                        ? "연결됨"
                        : event.connection === "disconnected"
                          ? "끊김"
                          : "알 수 없음"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {RETURN_TYPES.has(event.type) ? formatTime(event.createdAt) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <p className="text-[11px] leading-relaxed text-slate-400">
        이 이벤트는 브라우저가 알려준 상태를 기록한 것입니다. “페이지 숨김”은 다른 활동을 했다는 의미가
        아니며, 관측되지 않은 시간은 확인 불가로 남깁니다. 이벤트 로그는 학급 전용 Durable Object
        저장소에 보관되고 7일 뒤 정리됩니다.
      </p>
    </div>
  );
}
