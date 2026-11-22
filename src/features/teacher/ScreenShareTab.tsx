import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentLive } from "../../../shared/protocol";
import type { TeacherScreenShare } from "../../lib/screenShare";
import { LiveVideo } from "../../components/LiveVideo";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  StatusDot,
  cx,
} from "../../components/ui";
import {
  IconAlert,
  IconInfo,
  IconMaximize,
  IconMonitor,
  IconRadio,
  IconVideo,
  IconVideoOff,
  IconX,
} from "../../components/Icons";

function FullscreenStage({
  stream,
  name,
  onClose,
}: {
  stream: MediaStream;
  name: string;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const goFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await boxRef.current?.requestFullscreen();
    } catch {
      /* the browser may refuse; the overlay still fills the tab */
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div ref={boxRef} className="flex min-h-0 flex-1 flex-col bg-slate-950">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-white">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <IconMonitor size={15} className="text-emerald-400" /> {name} 학생 화면
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void goFullscreen()}
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
        <div className="flex min-h-0 flex-1 items-center justify-center p-2">
          <LiveVideo
            stream={stream}
            muted
            label={`${name} 학생 화면`}
            className="max-h-full w-full bg-black object-contain"
          />
        </div>
        <p className="px-4 pb-2 text-center text-[10.5px] text-white/40">
          이 화면을 프로젝터에 그대로 띄울 수 있습니다. 학생이 공유를 멈추면 자동으로 닫힙니다.
        </p>
      </div>
    </div>
  );
}

export function ScreenShareTab({
  students,
  share,
}: {
  students: StudentLive[];
  share: TeacherScreenShare;
}) {
  const online = students.filter((student) => student.online);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewingStudent = students.find((student) => student.participantId === viewingId) ?? null;
  const viewingStream = viewingId ? share.remote[viewingId] ?? null : null;

  useEffect(() => {
    if (viewingId && !viewingStream) setViewingId(null);
  }, [viewingId, viewingStream]);

  const requestable = online.filter((student) => !share.remote[student.participantId]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="선생님 화면 공유"
              description="선생님이 고른 화면이 접속 중인 학생 모두에게 실시간으로 보입니다. 학생 화면에는 크게 표시됩니다."
              action={
                <Badge tone={share.sharing ? "ok" : "neutral"} dot={share.sharing}>
                  {share.sharing ? "공유 중" : "대기"}
                </Badge>
              }
            />
          </div>
          <div className="space-y-3 p-5">
            {share.localStream ? (
              <LiveVideo
                stream={share.localStream}
                muted
                label="내가 공유 중인 화면"
                className="aspect-video overflow-hidden rounded-xl bg-slate-950"
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
                <IconMonitor size={26} className="text-slate-300" />
                <p className="mt-2 text-[12.5px] font-semibold text-slate-600">
                  아직 공유 중인 화면이 없습니다
                </p>
                <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-slate-400">
                  브라우저 선택 창에서 공유할 탭·창·전체 화면을 직접 고르면 시작됩니다.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11.5px] text-slate-500">
                수신 학생 {online.length}명 · P2P(WebRTC) 연결
              </p>
              {share.sharing ? (
                <Button variant="danger" onClick={share.stop}>
                  <IconVideoOff size={15} /> 공유 중지
                </Button>
              ) : (
                <Button onClick={() => void share.start()}>
                  <IconVideo size={15} /> 내 화면 공유
                </Button>
              )}
            </div>

            {share.sharing ? (
              <Callout tone="ok" icon={<IconInfo size={15} />}>
                학생 화면 상단에 공유 화면이 크게 나타납니다. 학생이 늦게 들어오거나 새로고침해도
                자동으로 다시 연결됩니다.
              </Callout>
            ) : null}

            {share.error ? (
              <Callout tone="warn" icon={<IconAlert size={15} />}>
                {share.error}
              </Callout>
            ) : null}
          </div>
        </Card>

        <Callout tone="info" icon={<IconInfo size={15} />} title="연결이 안 될 때">
          같은 Wi-Fi에서는 바로 연결됩니다. 학생이 다른 네트워크(예: LTE)에 있으면 TURN 서버가 필요할
          수 있습니다. 배포 전 <code className="rounded bg-white/60 px-1">VITE_TURN_URL</code> 등을
          설정하는 방법은 README의 “인터넷에서 준비할 것”을 참고하세요.
        </Callout>
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="학생 화면 보기"
              description="학생이 공유를 허용한 동안에만 볼 수 있습니다. 크게 보기로 프로젝터에 띄울 수 있습니다."
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={requestable.length === 0}
              onClick={share.requestAll}
            >
              <IconMonitor size={14} /> 모두에게 요청
            </Button>
          </div>
          {online.length === 0 ? (
            <EmptyState
              icon={<IconRadio size={22} />}
              title="접속한 학생이 없습니다"
              description="학생이 입장하면 여기에서 화면을 요청할 수 있습니다."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {online.map((student) => {
                const stream = share.remote[student.participantId];
                return (
                  <div key={student.participantId} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={student.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-semibold text-slate-900">
                            {student.name}
                          </p>
                          <p className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                            <StatusDot tone={student.sharingScreen ? "ok" : "neutral"} />
                            {stream
                              ? "화면 수신 중"
                              : student.sharingScreen
                                ? "공유 연결 중"
                                : "공유하지 않음"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {stream ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="border-brand-200 text-brand-700"
                              onClick={() => setViewingId(student.participantId)}
                            >
                              <IconMaximize size={13} /> 크게 보기
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => share.stopViewing(student.participantId)}
                            >
                              <IconX size={13} /> 그만
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={Boolean(share.requested[student.participantId])}
                            onClick={() => share.requestStudent(student.participantId)}
                          >
                            <IconMonitor size={14} />
                            {share.requested[student.participantId] ? "요청함" : "화면 요청"}
                          </Button>
                        )}
                      </div>
                    </div>
                    {stream ? (
                      <button
                        onClick={() => setViewingId(student.participantId)}
                        className="block w-full overflow-hidden rounded-lg"
                        aria-label={`${student.name} 화면 크게 보기`}
                      >
                        <LiveVideo
                          stream={stream}
                          muted
                          label={`${student.name} 학생 화면`}
                          className="aspect-video overflow-hidden rounded-lg bg-slate-950"
                        />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Callout tone="warn" icon={<IconAlert size={15} />} title="화면 공유는 https에서">
          브라우저는 https:// 또는 localhost에서만 화면 선택 창을 허용합니다. 휴대폰·태블릿에서
          http:// 주소로 접속하면 화면 공유 버튼이 동작하지 않으니, README의 HTTPS 서버 안내를
          사용하세요.
        </Callout>

        <div className={cx("text-[11px] leading-relaxed text-slate-400", online.length > 0 ? "" : "hidden")}>
          여러 학생이 동시에 공유하면 각 학생 칸에 영상이 따로 표시됩니다. “크게 보기”는 한 번에 한
          명씩 표시됩니다.
        </div>
      </div>

      {viewingStream && viewingStudent ? (
        <FullscreenStage
          stream={viewingStream}
          name={viewingStudent.name}
          onClose={() => setViewingId(null)}
        />
      ) : null}
    </div>
  );
}
