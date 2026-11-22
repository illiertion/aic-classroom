import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api";
import type { ClassroomPublicInfo } from "../../shared/protocol";
import { Logo } from "../components/Logo";
import { Button, Callout, Card, Field, Input, Skeleton, StatusDot, cx } from "../components/ui";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconFileText,
  IconMonitor,
  IconUser,
} from "../components/Icons";
import { loadStudent, rememberStudentName, saveStudent, lastStudentName } from "../lib/studentStore";
import { requestClassroomFullscreen } from "../lib/focus";
import {
  requestStudentDisplay,
  stagePendingStudentShare,
  takePendingStudentShare,
} from "../lib/screenShare";

export default function StudentJoin() {
  const { code = "" } = useParams();
  const joinCode = code.trim().toUpperCase();
  const navigate = useNavigate();
  const stored = useMemo(() => loadStudent(joinCode), [joinCode]);

  const [classroom, setClassroom] = useState<ClassroomPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState(lastStudentName());
  const [joining, setJoining] = useState(false);
  const [rejoining, setRejoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showNameForm, setShowNameForm] = useState(!stored);
  const [shareOnJoin, setShareOnJoin] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.join
      .info(joinCode)
      .then(({ classroom: info }) => {
        if (active) setClassroom(info);
      })
      .catch((caught) => {
        if (active)
          setLoadError(
            caught instanceof Error ? caught.message : "수업 정보를 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [joinCode]);

  const prepareEntry = () => {
    // Both calls must begin inside the click gesture. The screen picker is the
    // browser's own consent step; cancelling it still lets the student join.
    void requestClassroomFullscreen();
    if (!shareOnJoin) return;
    const pending = requestStudentDisplay();
    stagePendingStudentShare(pending);
  };

  const discardPendingShare = () => {
    void takePendingStudentShare()?.then((stream) =>
      stream?.getTracks().forEach((track) => track.stop()),
    );
  };

  const finishJoin = (token: string, participant: { id: string; name: string; joinedAt: number }) => {
    saveStudent(joinCode, {
      token,
      participantId: participant.id,
      name: participant.name,
      joinedAt: participant.joinedAt,
    });
    rememberStudentName(participant.name);
    navigate(`/class/${joinCode}`, { replace: true });
  };

  const submitName = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setJoinError("이름을 입력해 주세요.");
      return;
    }
    setJoinError(null);
    setJoining(true);
    prepareEntry();
    try {
      const result = await api.join.submit(joinCode, { name: name.trim() });
      if (!result.ok) {
        discardPendingShare();
        setJoinError(result.message);
        return;
      }
      finishJoin(result.participantToken, result.participant);
    } catch (caught) {
      discardPendingShare();
      setJoinError(
        caught instanceof ApiRequestError ? caught.message : "수업에 참가하지 못했습니다.",
      );
    } finally {
      setJoining(false);
    }
  };

  const rejoin = async () => {
    if (!stored) return;
    setJoinError(null);
    setRejoining(true);
    prepareEntry();
    try {
      const result = await api.join.submit(joinCode, { token: stored.token });
      if (!result.ok) {
        discardPendingShare();
        setJoinError(result.message);
        setShowNameForm(true);
        return;
      }
      finishJoin(result.participantToken, result.participant);
    } catch (caught) {
      discardPendingShare();
      setJoinError(
        caught instanceof ApiRequestError ? caught.message : "다시 참가하지 못했습니다.",
      );
    } finally {
      setRejoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6fb] px-4">
        <Skeleton className="h-[360px] w-full max-w-md rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
        <Link to="/">
          <Logo />
        </Link>
        <Link to="/about" className="text-[12px] font-medium text-slate-500 hover:text-slate-900">
          개인정보 · 라이선스
        </Link>
      </header>

      <main className="mx-auto w-full max-w-xl px-4 pb-16">
        {loadError || !classroom ? (
          <Card className="mt-6 p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <IconAlert size={22} />
            </span>
            <h1 className="mt-4 text-[18px] font-bold text-slate-900">수업을 찾을 수 없습니다</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
              {loadError ?? "참가 코드를 다시 확인해 주세요."}
            </p>
            <Link to="/" className="mt-5 inline-block">
              <Button variant="secondary">처음으로</Button>
            </Link>
          </Card>
        ) : (
          <>
            <div className="mt-2 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.4)]">
              <div className="relative bg-ink-900 px-6 py-6 text-white">
                <div className="absolute inset-0 aic-grid-dark opacity-40" />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <StatusDot tone={classroom.status === "live" ? "ok" : "neutral"} pulse={classroom.status === "live"} />
                    <span className="text-[10.5px] font-bold tracking-[0.14em] text-slate-400">
                      {classroom.status === "live" ? "LIVE CLASSROOM" : "CLASS ENDED"}
                    </span>
                  </div>
                  <h1 className="mt-3 text-[24px] font-extrabold leading-tight tracking-[-0.03em]">
                    {classroom.title}
                  </h1>
                  <p className="mt-1 text-[12.5px] text-slate-400">
                    {classroom.teacherName} 선생님 · {classroom.subject || "수업"}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 font-mono text-[13px] font-bold tracking-[0.2em]">
                    {classroom.joinCode}
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                {classroom.status === "ended" ? (
                  <Callout tone="warn" icon={<IconClock size={16} />} title="종료된 수업입니다">
                    선생님께 새 수업의 참가 코드를 요청해 주세요.
                  </Callout>
                ) : null}

                {joinError ? (
                  <Callout tone="danger" icon={<IconAlert size={16} />}>
                    {joinError}
                  </Callout>
                ) : null}

                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <input
                    type="checkbox"
                    checked={shareOnJoin}
                    onChange={(event) => setShareOnJoin(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                  />
                  <span>
                    <span className="block text-[12px] font-semibold text-slate-800">
                      입장과 함께 전체화면·내 화면 공유
                    </span>
                    <span className="mt-0.5 block text-[10.5px] leading-relaxed text-slate-500">
                      전체화면을 요청하고, 브라우저 선택 창에서 고른 화면을 선생님이 볼 수 있게
                      시작합니다. 선택을 취소해도 수업에는 참가됩니다. 언제든 중지할 수 있습니다.
                    </span>
                  </span>
                </label>

                {stored ? (
                  <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
                      이전 참가 정보
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-slate-900">
                      {stored.name} <span className="text-[12px] font-normal text-slate-500">학생</span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-slate-500">
                      진행 중이던 수업과 퀴즈·학습지 상태를 그대로 복원합니다.
                    </p>
                    <Button
                      className="mt-3 w-full"
                      onClick={() => void rejoin()}
                      loading={rejoining}
                      disabled={classroom.status !== "live" || joining}
                    >
                      이어서 참가하기
                      <IconArrowRight size={16} />
                    </Button>
                    <button
                      onClick={() => setShowNameForm((value) => !value)}
                      className="mt-2 w-full text-[11.5px] font-medium text-slate-500 hover:text-slate-800"
                    >
                      {showNameForm ? "이름 입력 닫기" : "다른 이름으로 새로 참가"}
                    </button>
                  </div>
                ) : null}

                {showNameForm || !stored ? (
                  <form onSubmit={submitName} className="space-y-3">
                    <Field
                      label="이름"
                      htmlFor="student-name"
                      hint="이 이름은 이 수업에서만 사용됩니다. 계정은 만들어지지 않습니다."
                    >
                      <Input
                        id="student-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={20}
                        placeholder="이름을 입력하세요"
                        autoComplete="off"
                        autoFocus={!stored}
                        disabled={classroom.status !== "live"}
                      />
                    </Field>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      loading={joining}
                      disabled={rejoining || classroom.status !== "live"}
                    >
                      <IconUser size={16} />
                      수업 참가하기
                    </Button>
                    <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                      <IconMonitor size={12} /> 참가하면 전체화면 진입을 요청합니다.
                    </p>
                  </form>
                ) : null}

                {classroom.status === "live" ? (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <IconFileText size={15} className="text-brand-600" />
                      <p className="text-[12.5px] font-semibold text-slate-800">
                        수업 자료는 선생님 컴퓨터에서 옵니다
                      </p>
                    </div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
                      학습지 PDF와 활동 보드는 서버에 업로드되지 않습니다. 선생님이 수업 화면을
                      열어 둔 동안에만 받을 수 있고, 화면 공유도 내가 허용한 경우에만 보입니다.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={cx("mt-5 grid gap-3 text-[11.5px] text-slate-500", "sm:grid-cols-3")}>
              {[
                { icon: IconCheck, text: "계정·비밀번호 없음" },
                { icon: IconMonitor, text: "전체화면 상태 관측" },
                { icon: IconClock, text: "수업 종료 후 임시 정보 정리" },
              ].map((item) => (
                <span key={item.text} className="inline-flex items-center gap-1.5">
                  <item.icon size={13} className="text-slate-400" />
                  {item.text}
                </span>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
