import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { ClassroomSummary } from "../../shared/protocol";
import { AppShell } from "../components/AppShell";
import {
  Badge,
  Button,
  Callout,
  Card,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  cx,
} from "../components/ui";
import {
  IconAlert,
  IconArrowRight,
  IconLayout,
  IconPlus,
  IconQr,
  IconTrash,
  IconUsers,
  IconVideo,
  IconHelp,
} from "../components/Icons";
import { formatDate, withHonorific } from "../lib/format";

export default function Dashboard() {
  const { teacher, setTeacher } = useAuth();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<ClassroomSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ClassroomSummary | null>(null);
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { classrooms: list } = await api.classrooms.list();
      setClassrooms(list);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수업 목록을 불러오지 못했습니다.");
      setClassrooms([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!teacher) return null;

  const create = async () => {
    if (!title.trim()) {
      setCreateError("수업 이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const { classroom } = await api.classrooms.create(title.trim(), subject.trim());
      navigate(`/app/classrooms/${classroom.id}`);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "수업을 만들지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const saveName = async () => {
    const name = nameDraft.replace(/\s+/g, " ").trim();
    if (!name) {
      setNameError("이름을 입력해 주세요.");
      return;
    }
    setNameSaving(true);
    setNameError(null);
    try {
      const { teacher: profile } = await api.auth.updateProfile(name);
      setTeacher(profile);
      setNameOpen(false);
    } catch (caught) {
      setNameError(caught instanceof Error ? caught.message : "이름을 저장하지 못했습니다.");
    } finally {
      setNameSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    setDeleteError(null);
    try {
      await api.classrooms.remove(deleting.id);
      setClassrooms((current) => (current ?? []).filter((item) => item.id !== deleting.id));
      setDeleting(null);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "수업을 삭제하지 못했습니다.");
    } finally {
      setRemoving(false);
    }
  };

  const live = classrooms?.filter((item) => item.status === "live") ?? [];
  const totalParticipants = classrooms?.reduce((sum, item) => sum + item.participantCount, 0) ?? 0;

  return (
    <AppShell teacher={teacher} wide>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-brand-600">TEACHER WORKSPACE</p>
          <h1 className="mt-2 text-[26px] font-extrabold tracking-[-0.03em] text-slate-900 sm:text-[30px]">
            {withHonorific(teacher.name)}, 안녕하세요
          </h1>
          <button
            type="button"
            onClick={() => {
              setNameDraft(teacher.name);
              setNameError(null);
              setNameOpen(true);
            }}
            className="mt-1 text-[11.5px] font-semibold text-brand-600 hover:text-brand-700"
          >
            이름 바꾸기
          </button>
          {teacher.accessCode ? (
            <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200">
              <span className="text-[11px] font-semibold text-slate-500">내 액세스 코드</span>
              <span className="font-mono text-[13px] font-bold tracking-[0.16em] text-slate-900">
                {teacher.accessCode}
              </span>
              <CopyButton value={teacher.accessCode} label="복사" />
              <button
                type="button"
                onClick={() => {
                  void api.auth
                    .rotateCode()
                    .then((result) => setTeacher(result.teacher))
                    .catch(() => undefined);
                }}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700"
              >
                재발급
              </button>
            </div>
          ) : null}
          <p className="mt-1.5 text-[13px] text-slate-500">
            수업을 열고 참가 코드를 공유하세요. 학생은 설치 없이 이름만으로 참여합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/guide"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm shadow-slate-900/5 hover:bg-slate-50"
          >
            <IconHelp size={16} /> 기능 안내
          </Link>
          <Link
            to="/app/boards"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm shadow-slate-900/5 hover:bg-slate-50"
          >
            <IconLayout size={16} /> 활동 보드
          </Link>
          <Button onClick={() => setCreating(true)} size="lg">
            <IconPlus size={17} />
            새 수업 만들기
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "전체 수업", value: classrooms?.length ?? 0, icon: IconQr, tone: "text-slate-500" },
          { label: "진행 중", value: live.length, icon: IconVideo, tone: "text-emerald-600" },
          { label: "참가 학생", value: totalParticipants, icon: IconUsers, tone: "text-brand-600" },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-3 p-4">
            <span className={cx("flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50", stat.tone)}>
              <stat.icon size={18} />
            </span>
            <div>
              <p className="text-[18px] font-bold leading-tight text-slate-900">{stat.value}</p>
              <p className="text-[11.5px] text-slate-500">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-3 flex flex-wrap items-center justify-between gap-3 border-brand-100 bg-brand-50/40 p-4">
        <div>
          <p className="text-[12.5px] font-bold text-slate-900">패들렛·띵커벨형 활동 보드</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">
            보드와 학습지 PDF는 선생님 컴퓨터에만 저장됩니다. 수업 중에 열어 둔 동안만 학생에게
            보이고, 서버 업로드나 R2는 사용하지 않습니다.
          </p>
        </div>
        <Link to="/app/boards">
          <Button variant="secondary" size="sm">
            보드 만들기 <IconArrowRight size={14} />
          </Button>
        </Link>
      </Card>

      {error ? (
        <Callout tone="danger" icon={<IconAlert size={16} />} className="mt-6">
          {error}
        </Callout>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900">내 수업</h2>
        <button
          onClick={() => void load()}
          className="text-[12px] font-semibold text-slate-500 hover:text-slate-900"
        >
          새로고침
        </button>
      </div>

      {classrooms === null ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : classrooms.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<IconQr size={22} />}
            title="아직 수업이 없습니다"
            description="첫 수업을 만들면 6자리 참가 코드와 QR이 함께 생성됩니다."
            action={
              <Button onClick={() => setCreating(true)}>
                <IconPlus size={16} /> 수업 만들기
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {classrooms.map((classroom) => (
            <Card key={classroom.id} className="group flex flex-col overflow-hidden">
              <Link to={`/app/classrooms/${classroom.id}`} className="block p-5 transition hover:bg-slate-50/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={classroom.status === "live" ? "ok" : "neutral"} dot>
                        {classroom.status === "live" ? "진행 중" : "종료됨"}
                      </Badge>
                    </div>
                    <h3 className="mt-2.5 truncate text-[16px] font-bold tracking-tight text-slate-900">
                      {classroom.title}
                    </h3>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {classroom.subject || "과목 미지정"} · {formatDate(classroom.createdAt)}
                    </p>
                  </div>
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 transition group-hover:bg-slate-900 group-hover:text-white">
                    <IconArrowRight size={15} />
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-4 text-[12px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <IconUsers size={14} /> {classroom.participantCount}명
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <IconLayout size={14} /> 보드·PDF·화면 공유
                  </span>
                </div>
              </Link>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                    CODE
                  </span>
                  <span className="rounded-md bg-white px-2 py-1 font-mono text-[12.5px] font-bold tracking-[0.15em] text-slate-800 ring-1 ring-slate-200">
                    {classroom.joinCode}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CopyButton
                    value={`${window.location.origin}/join/${classroom.joinCode}`}
                    label="참가 링크"
                  />
                  <button
                    onClick={() => {
                      setDeleting(classroom);
                      setDeleteError(null);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`${classroom.title} 수업 삭제`}
                    title="수업 삭제"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="수업을 삭제할까요?"
        description="수업과 참가자 기록이 서버에서 완전히 삭제됩니다. 되돌릴 수 없습니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button variant="danger" onClick={() => void remove()} loading={removing}>
              <IconTrash size={15} /> 완전히 삭제
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {deleteError ? (
            <Callout tone="danger" icon={<IconAlert size={16} />}>
              {deleteError}
            </Callout>
          ) : null}
          <Callout tone="warn" icon={<IconAlert size={16} />}>{"\""}{deleting?.title ?? ""}{"\""} 수업을 삭제합니다.
            진행 중이라면 학생 연결이 먼저 종료되고, 참가자·응답·보드 사본·이벤트가 모두 지워집니다.
          </Callout>
          <p className="text-[11.5px] leading-relaxed text-slate-500">
            선생님 컴퓨터에 저장된 보드 원본과 학습지 PDF는 지워지지 않습니다. 필요 없으면 활동
            보드함에서 따로 정리하세요.
          </p>
        </div>
      </Modal>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="새 수업 만들기"
        description="수업이 만들어지면 바로 참가 코드가 발급됩니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              취소
            </Button>
            <Button onClick={() => void create()} loading={saving}>
              수업 만들기
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createError ? (
            <Callout tone="danger" icon={<IconAlert size={16} />}>
              {createError}
            </Callout>
          ) : null}
          <Field label="수업 이름" htmlFor="class-title">
            <Input
              id="class-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 3학년 2반 과학"
              maxLength={60}
              autoFocus
            />
          </Field>
          <Field label="과목" htmlFor="class-subject" hint="선택 사항입니다.">
            <Input
              id="class-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="과학"
              maxLength={40}
            />
          </Field>
          <Callout tone="info" icon={<IconLayout size={15} />}>
            수업을 연 뒤 <strong>활동 보드</strong> 탭에서 보드를 고르고, <strong>학습지·문제</strong>{" "}
            탭에서 PDF 학습지를 배포하세요. 파일은 이 컴퓨터에만 저장됩니다. 모둠 점수판과 출석은{" "}
            <strong>수업 도구</strong> 탭에 있습니다.
          </Callout>
        </div>
      </Modal>

      <Modal
        open={nameOpen}
        onClose={() => setNameOpen(false)}
        title="선생님 이름 바꾸기"
        description="수업 화면·학생 화면·참가 안내에 표시되는 이름입니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setNameOpen(false)}>
              취소
            </Button>
            <Button onClick={() => void saveName()} loading={nameSaving}>
              저장
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {nameError ? (
            <Callout tone="danger" icon={<IconAlert size={16} />}>
              {nameError}
            </Callout>
          ) : null}
          <Field label="이름" htmlFor="teacher-name" hint="1~40자. 비우면 저장되지 않습니다.">
            <Input
              id="teacher-name"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={40}
              placeholder="예: 김선생"
              autoFocus
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                void saveName();
              }}
            />
          </Field>
          <p className="text-[11px] leading-relaxed text-slate-400">
            비밀번호는 그대로 <code className="rounded bg-slate-100 px-1 py-0.5">TEACHER_PASSWORD</code>{" "}
            하나로 입장합니다. 이름은 이 앱의 데이터베이스에만 저장됩니다.
          </p>
        </div>
      </Modal>
    </AppShell>
  );
}
