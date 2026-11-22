import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/Logo";
import { Badge, Button, StatusDot, cx } from "../components/ui";
import {
  IconArrowRight,
  IconCheck,
  IconFileText,
  IconKeyboard,
  IconLayout,
  IconLock,
  IconMonitor,
  IconShield,
  IconSparkles,
  IconUsers,
  IconVideo,
  IconX,
} from "../components/Icons";

const PREVIEW_STUDENTS = [
  { name: "김서연", state: "정상 참여", tone: "ok" as const, detail: "전체화면 · 방금" },
  { name: "박준호", state: "페이지 이탈 의심", tone: "warn" as const, detail: "페이지 숨김 · 12초 전" },
  { name: "이하늘", state: "전체화면 해제", tone: "warn" as const, detail: "창 모드 · 3초 전" },
  { name: "최유진", state: "화면 공유 중", tone: "brand" as const, detail: "학생 허용 · 04:12" },
];

function MonitorPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-tr from-brand-500/30 via-indigo-500/10 to-mint-400/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-800/90 shadow-[0_40px_120px_-40px_rgba(2,6,23,0.9)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <StatusDot tone="ok" pulse />
            <div>
              <p className="text-[13px] font-semibold text-white">3학년 2반 · 과학</p>
              <p className="text-[10.5px] text-slate-400">실시간 교실 모니터</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-[10.5px] font-bold text-sky-300 ring-1 ring-inset ring-sky-400/30">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            공유 1
          </span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {PREVIEW_STUDENTS.map((student, index) => (
            <div
              key={student.name}
              className="flex items-center gap-3 px-5 py-3"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-slate-200">
                {student.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-slate-100">{student.name}</p>
                <p className="text-[10.5px] text-slate-500">{student.detail}</p>
              </div>
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                  student.tone === "ok" && "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
                  student.tone === "warn" && "bg-amber-400/10 text-amber-300 ring-amber-400/20",
                  student.tone === "brand" && "bg-brand-400/15 text-brand-200 ring-brand-400/30",
                )}
              >
                {student.state}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/10 bg-white/[0.02]">
          {[
            { label: "관측 이벤트", value: "12" },
            { label: "확인 필요", value: "2" },
            { label: "화면 공유", value: "1" },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-3.5">
              <p className="text-[16px] font-bold text-white">{stat.value}</p>
              <p className="text-[10px] text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-white/10 bg-ink-900/95 px-3 py-2 text-[10.5px] font-medium text-slate-300 shadow-xl sm:flex">
        <IconLock size={13} className="text-mint-400" />
        화면 공유는 학생 허용 후에만
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: IconMonitor,
    eyebrow: "Focus Mode",
    title: "전체화면 이탈을 그 자리에서 감지",
    description:
      "수업 입장 시 전체화면을 요청하고, fullscreenchange 이벤트로 상태 변화를 관측합니다. 해제되어도 수업 참가와 학습 진행은 그대로 유지됩니다.",
    points: ["전체화면 재진입 안내", "ESC·단축키는 수신된 입력만 기록", "키 감지를 부정행위로 단정하지 않음"],
  },
  {
    icon: IconShield,
    eyebrow: "Exit Monitor",
    title: "선생님 화면에 실시간 관측 기록",
    description:
      "페이지 숨김, 연결 끊김, 복귀를 구분해 보여줍니다. 확인되지 않은 행동을 확정적인 이탈로 표시하지 않고, 같은 이벤트의 반복 알림은 억제합니다.",
    points: ["학생별 상태·마지막 활동", "중복 알림 25초 억제", "학생별 이벤트 이력"],
  },
  {
    icon: IconLayout,
    eyebrow: "Activity Board",
    title: "패들렛·띵커벨형 보드를 내 PC에서",
    description:
      "벽면형·모둠형 보드를 미리 만들어 두고 수업에서 엽니다. 보드는 선생님 브라우저에만 저장되고, 콘솔을 닫으면 학생 화면에서 사라집니다.",
    points: ["벽면형·모둠형 템플릿", "학생 카드 작성·교사 삭제", "JSON으로 가져오기·내보내기"],
  },
  {
    icon: IconFileText,
    eyebrow: "PDF Worksheet",
    title: "PDF를 올리지 않고 바로 배포",
    description:
      "선생님 컴퓨터의 PDF를 학생이 요청할 때만 조각으로 전달합니다. 학생은 보면서 답을 적고, 제출하면 선생님이 바로 확인합니다.",
    points: ["서버 업로드·R2 없음", "학생 PDF 미리보기·저장", "제출 답변 실시간 확인"],
  },
  {
    icon: IconVideo,
    eyebrow: "Screen Share",
    title: "선생님과 학생 화면을 실시간으로",
    description:
      "선생님 화면을 학급에 공유하고, 학생이 직접 허용한 화면은 선생님이 볼 수 있습니다. 영상은 저장하지 않고 P2P로만 흐릅니다.",
    points: ["브라우저 선택·허용 필수", "학생별 화면 요청·중지", "영상 저장 없음"],
  },
  {
    icon: IconSparkles,
    eyebrow: "Live Quiz",
    title: "퀴즈와 학습지를 한 흐름으로",
    description:
      "수업을 벗어나지 않고 퀴즈를 내고 결과를 집계합니다. 학생이 재접속하면 진행 중인 활동과 자기 답변이 복원됩니다.",
    points: ["실시간 응답 집계", "응답 마감·재응답", "재접속 상태 복원"],
  },
];

const CAN_DO = [
  "전체화면 해제 감지와 재진입 안내",
  "페이지 숨김·복귀, 온라인·오프라인 관측",
  "선생님 PC의 보드·PDF를 수업 중에만 공유",
  "학생이 허용한 화면을 선생님이 실시간으로 보기",
  "선생님 화면을 접속한 학생에게 공유",
  "PDF 학습지 제출과 실시간 확인",
  "재접속 시 수업과 퀴즈·학습지 상태 복원",
];

const CANNOT_DO = [
  "Ctrl+T, Ctrl+W 등 브라우저 단축키 차단",
  "ESC로 인한 전체화면 해제 차단",
  "Android 홈 버튼이나 다른 앱 실행 차단",
  "학생 허락 없는 화면 공유·녹화",
  "선생님 콘솔이 꺼진 뒤 자료 접근",
  "사용자 동작 없는 전체화면 강제 복구",
];

const STEPS = [
  { step: "01", title: "수업 열기", body: "선생님이 수업을 만들면 6자리 참가 코드와 QR이 생성됩니다." },
  { step: "02", title: "QR 또는 코드", body: "학생은 설치나 계정 없이 링크를 열고 이름만 입력합니다." },
  { step: "03", title: "집중 모드", body: "전체화면 진입을 안내하고, 브라우저가 알려주는 상태를 관측합니다." },
  { step: "04", title: "보드·PDF·화면", body: "보드를 열고 PDF를 배포하며, 필요할 때 화면을 공유합니다." },
];

export default function Landing() {
  const { teacher } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const join = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) navigate(`/join/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <Logo inverted />
          </Link>
          <nav className="hidden items-center gap-7 text-[12.5px] font-medium text-slate-400 md:flex">
            <a href="#features" className="transition hover:text-white">
              기능
            </a>
            <a href="#limits" className="transition hover:text-white">
              브라우저 한계
            </a>
            <Link to="/about" className="transition hover:text-white">
              소개 · 라이선스
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-[12.5px] font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              로그인
            </Link>
                          <Link to={teacher ? "/app" : "/login"}>
                <Button size="sm" className="bg-white text-ink-900 shadow-none hover:bg-slate-100">
                {teacher ? "대시보드" : "선생님 입장"}
                <IconArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-ink-950 pb-20 pt-14 text-white sm:pb-28 sm:pt-20">
        <div className="absolute inset-0 aic-grid-dark opacity-60" />
        <div className="absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-brand-600/20 blur-[120px]" />
        <div className="absolute -right-32 top-40 h-[420px] w-[420px] rounded-full bg-mint-500/10 blur-[110px]" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="aic-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10.5px] font-bold tracking-[0.14em] text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
              CLASSROOM FOCUS &amp; LOCAL MATERIALS
            </span>
            <h1 className="mt-6 text-[38px] font-extrabold leading-[1.14] tracking-[-0.035em] sm:text-[52px]">
              수업의 흐름은 끊기지 않게,
              <br />
              <span className="bg-gradient-to-r from-brand-300 via-indigo-200 to-mint-300 bg-clip-text text-transparent">
                자료는 내 컴퓨터에서.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-[14.5px] leading-relaxed text-slate-400">
              선생님은 수업을 열고, 학생은 QR과 이름만으로 참여합니다. 활동 보드와 PDF는 선생님
              컴퓨터에만 저장되고 수업 중에만 공유되며, 화면은 허용한 동안 실시간으로 오갑니다.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={teacher ? "/app" : "/login"}>
                <Button size="lg">
                  {teacher ? "내 수업 열기" : "비밀번호로 입장"}
                  <IconArrowRight size={17} />
                </Button>
              </Link>
              <form onSubmit={join} className="flex items-center gap-2">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="참가 코드"
                  maxLength={6}
                  aria-label="참가 코드"
                  className="h-12 w-[136px] rounded-xl border border-white/15 bg-white/[0.06] px-3.5 text-center text-[15px] font-bold tracking-[0.18em] text-white placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-500 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/20 focus:outline-none"
                />
                <Button size="lg" variant="secondary" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                  학생 입장
                </Button>
              </form>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <IconCheck size={13} className="text-mint-400" /> 학생 계정 없음
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconCheck size={13} className="text-mint-400" /> 앱 설치 없음
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconCheck size={13} className="text-mint-400" /> Android Chrome
              </span>
            </div>
          </div>
          <div className="aic-fade-up lg:pl-4" style={{ animationDelay: "120ms" }}>
            <MonitorPreview />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          {[
            { icon: IconUsers, title: "학생 계정 0개", body: "이름과 참가 토큰은 수업에만 존재합니다." },
            { icon: IconKeyboard, title: "관측만, 단정 없음", body: "수신한 이벤트를 기록하고 의도를 추정하지 않습니다." },
            { icon: IconLock, title: "기본값은 비공개", body: "자료는 내 PC에, 화면은 허용한 동안에만 공유됩니다." },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <item.icon size={17} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.16em] text-brand-600">AIC CLASSROOM EXTENSIONS</p>
          <h2 className="mt-3 text-[28px] font-extrabold tracking-[-0.03em] text-slate-900 sm:text-[34px]">
            수업을 방해하지 않는 독립 모듈
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-500">
            집중 관리, 활동 보드, PDF 학습지, 화면 공유는 기존 수업·퀴즈 위에 얹히는 선택형
            모듈입니다. 자료 전송이 실패해도 수업은 정상적으로 이어집니다.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.eyebrow}
              className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_24px_50px_-32px_rgba(79,70,229,0.4)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-white text-brand-600 ring-1 ring-brand-100">
                <feature.icon size={21} />
              </span>
              <p className="mt-5 text-[10.5px] font-bold tracking-[0.14em] text-brand-500">
                {feature.eyebrow.toUpperCase()}
              </p>
              <h3 className="mt-1.5 text-[16px] font-bold tracking-tight text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">{feature.description}</p>
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-[12px] text-slate-600">
                    <IconCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="limits" className="bg-ink-950 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-mint-400">HONEST BY DEFAULT</p>
              <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[36px]">
                웹페이지가 할 수 있는 일과
                <br />
                할 수 없는 일을 구분합니다.
              </h2>
              <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-slate-400">
                AIC는 브라우저 샌드박스 안에서 동작합니다. 기기 전체 제어나 강제 전체화면은 OS 관리형
                키오스크·MDM이 필요한 별도 확장 영역이며, 이 앱은 그렇게 동작하는 척하지 않습니다.
              </p>
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-[11.5px] font-semibold text-slate-300">
                  <IconShield size={15} className="text-mint-400" />
                  관측된 사실만 기록합니다
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
                  “페이지가 숨겨졌다”는 사실과 “다른 활동을 했다”는 추정은 다릅니다. 이벤트 이름과
                  문구는 전자만 사용합니다.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
                <p className="flex items-center gap-2 text-[12.5px] font-bold text-emerald-300">
                  <IconCheck size={15} /> 가능
                </p>
                <ul className="mt-3 space-y-2.5">
                  {CAN_DO.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-300">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="flex items-center gap-2 text-[12.5px] font-bold text-slate-300">
                  <IconX size={15} /> 웹으로 불가능
                </p>
                <ul className="mt-3 space-y-2.5">
                  {CANNOT_DO.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-brand-600">HOW IT WORKS</p>
            <h2 className="mt-3 text-[28px] font-extrabold tracking-[-0.03em] text-slate-900 sm:text-[34px]">
              네 단계면 충분합니다
            </h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-slate-500">
              학생은 회원가입도, 앱 설치도 하지 않습니다. 수업이 끝나면 임시 참가 정보는 정리됩니다.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step) => (
              <div key={step.step} className="rounded-2xl border border-slate-200/80 bg-white p-5">
                <span className="text-[11px] font-bold tracking-[0.14em] text-brand-400">{step.step}</span>
                <p className="mt-2 text-[14px] font-bold text-slate-900">{step.title}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 px-6 py-12 text-center sm:px-12">
          <div className="absolute inset-0 aic-grid opacity-20" />
          <div className="relative">
            <Badge tone="brand" className="bg-white/10 text-white ring-white/20">
              One Platform. Every Classroom.
            </Badge>
            <h2 className="mx-auto mt-4 max-w-xl text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-white sm:text-[34px]">
              오늘 수업을 AIC로 열어보세요
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[13.5px] leading-relaxed text-indigo-100">
              수업 생성부터 집중 모니터링, 보드·PDF·화면 공유까지 하나의 공간에서.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to={teacher ? "/app" : "/login"}>
                <Button size="lg" className="bg-white text-brand-700 shadow-lg shadow-indigo-950/30 hover:bg-indigo-50">
                  {teacher ? "대시보드로 이동" : "선생님 입장"}
                  <IconArrowRight size={17} />
                </Button>
              </Link>
              <Link to="/about">
                <Button size="lg" variant="ghost" className="text-indigo-100 hover:bg-white/10 hover:text-white">
                  라이선스 보기
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">Focus &amp; Local-first 3.0</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#features" className="hover:text-slate-900">
              기능
            </a>
            <Link to="/about" className="hover:text-slate-900">
              오픈소스 라이선스
            </Link>
            <span className="text-slate-400">AIC © 2026 · MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
