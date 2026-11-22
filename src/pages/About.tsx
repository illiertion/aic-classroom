import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/Logo";
import { Badge, Card, StatusDot, cx } from "../components/ui";
import {
  IconArrowLeft,
  IconCheck,
  IconCode,
  IconExternal,
  IconLock,
  IconShield,
  IconX,
} from "../components/Icons";

const MODULES = [
  {
    name: "Classroom",
    status: "구현",
    description: "수업 생성, 6자리 참가 코드·QR, 임시 참가자, 실시간 연결 상태",
  },
  {
    name: "Focus Mode",
    status: "구현",
    description: "전체화면 요청·해제 감지, 페이지 표시/숨김, 온라인/오프라인, 수신된 키 입력 관측",
  },
  {
    name: "Exit Monitor",
    status: "구현",
    description: "학생별 상태, 마지막 활동, 중복 억제 알림, 학생별 이벤트 이력",
  },
  {
    name: "활동 보드",
    status: "구현",
    description: "패들렛·띵커벨형 보드를 선생님 컴퓨터에 저장하고 수업 중에만 공유",
  },
  {
    name: "PDF 학습지",
    status: "구현",
    description: "PDF를 서버 업로드 없이 선생님 브라우저에서 학생에게 중계, 제출 답변 실시간 확인",
  },
  {
    name: "화면 공유",
    status: "구현",
    description: "선생님 화면을 학급에 공유, 학생이 허용한 화면을 선생님이 실시간 열람 (WebRTC)",
  },
  {
    name: "게임",
    status: "구현",
    description: "영단어·과일·요일·수도·OX·수학·속담 16개 기본 세트와 직접 만든 세트를 로컬에 저장하고 진행",
  },
  {
    name: "패들렛",
    status: "구현",
    description: "Padlet embed 주소를 로컬에 저장하고 콘솔 안 iframe으로 표시",
  },
  {
    name: "입력 관찰",
    status: "조건부",
    description: "선생님이 켠 동안 AIC 활동 입력만 미리보기. 전체 키로깅·다른 앱 캡처는 하지 않음",
  },
  {
    name: "Android 키오스크 · MDM",
    status: "범위 밖",
    description: "웹으로 불가능한 기기 잠금은 관리형 기기 확장 영역으로 분리",
  },
];

const CAN_DO = [
  "전체화면 해제·재진입 안내",
  "페이지 숨김·복귀, 온라인·오프라인 관측",
  "WebSocket 단절·복귀 기록",
  "선생님 PC의 보드·PDF를 수업 중에만 공유",
  "학생이 허용한 화면을 선생님이 실시간으로 보기",
  "선생님 화면을 접속한 학생에게 공유",
  "PDF 학습지 제출과 실시간 확인",
  "영단어·OX·스펠링 게임과 커스텀 세트",
  "선생님이 켠 동안 활동 입력 미리보기",
  "입장 시 전체화면·화면 공유 함께 시작",
  "수업 종료 즉시 모든 수업 내용 파기",
];

const CANNOT_DO = [
  "Ctrl+T·Ctrl+W 등 브라우저 단축키 차단",
  "ESC 전체화면 해제 차단",
  "Android 홈 버튼·다른 앱 실행 차단",
  "학생 허락 없는 화면 공유·녹화",
  "다른 앱·비밀번호 필드의 키 입력 수집",
  "선생님 콘솔이 꺼진 뒤 자료 접근",
  "사용자 동작 없는 전체화면 복구",
  "권한 없이 다른 앱 화면 캡처",
];

const RETENTION = [
  { data: "선생님 비밀번호", where: "Cloudflare secret", period: "앱에 저장하지 않음" },
  { data: "수업 정보·참가 코드", where: "D1", period: "선생님이 관리하는 기간" },
  { data: "임시 참가자(이름·토큰 해시)", where: "D1", period: "수업 종료 즉시" },
  { data: "실시간 상태·퀴즈·게임·학습지 답변", where: "Durable Object (SQLite)", period: "수업 종료 즉시" },
  { data: "공유 중인 보드 사본", where: "Durable Object (SQLite)", period: "콘솔을 닫거나 수업 종료 시" },
  { data: "이벤트 로그", where: "Durable Object (SQLite)", period: "수업 종료 즉시" },
  { data: "활동 보드·학습지 PDF", where: "선생님 브라우저 (IndexedDB)", period: "선생님이 삭제할 때까지" },
];

const LICENSES = [
  { name: "AIC — All-in-One Class", version: "4.0.0", license: "MIT", note: "이 프로젝트", url: "" },
  {
    name: "React · React DOM",
    version: "19.x",
    license: "MIT",
    note: "UI 런타임",
    url: "https://github.com/facebook/react/blob/main/LICENSE",
  },
  {
    name: "React Router",
    version: "7.x",
    license: "MIT",
    note: "클라이언트 라우팅",
    url: "https://github.com/remix-run/react-router/blob/main/LICENSE.md",
  },
  {
    name: "Hono",
    version: "4.x",
    license: "MIT",
    note: "Cloudflare Worker API 라우터",
    url: "https://github.com/honojs/hono/blob/main/LICENSE",
  },
  {
    name: "Tailwind CSS",
    version: "4.x",
    license: "MIT",
    note: "스타일 시스템",
    url: "https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE",
  },
  {
    name: "Vite · @vitejs/plugin-react",
    version: "7.x / 5.x",
    license: "MIT",
    note: "개발 서버·번들러",
    url: "https://github.com/vitejs/vite/blob/main/LICENSE",
  },
  {
    name: "TypeScript",
    version: "5.x",
    license: "Apache-2.0",
    note: "타입 시스템",
    url: "https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt",
  },
  {
    name: "Wrangler",
    version: "4.x",
    license: "MIT OR Apache-2.0",
    note: "Cloudflare 로컬 개발·배포 CLI",
    url: "https://github.com/cloudflare/workers-sdk/blob/main/LICENSE",
  },
  {
    name: "@cloudflare/workers-types",
    version: "4.x",
    license: "BSD-3-Clause OR Apache-2.0",
    note: "Worker 타입 정의",
    url: "https://github.com/cloudflare/workers-types/blob/main/LICENSE",
  },
  {
    name: "qrcode",
    version: "1.5",
    license: "MIT",
    note: "참가 QR 생성",
    url: "https://github.com/soldair/node-qrcode/blob/master/license",
  },
  {
    name: "concurrently",
    version: "9.x",
    license: "MIT",
    note: "로컬 개발 프로세스 실행",
    url: "https://github.com/open-cli-tools/concurrently/blob/main/LICENSE",
  },
];

export default function About() {
  const { teacher } = useAuth();

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <IconArrowLeft size={14} /> 홈
            </Link>
            <Link
              to={teacher ? "/app" : "/login"}
              className="rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
            >
              {teacher ? "대시보드" : "선생님 로그인"}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-[11px] font-bold tracking-[0.16em] text-brand-600">ABOUT AIC</p>
        <h1 className="mt-3 text-[34px] font-extrabold leading-[1.15] tracking-[-0.035em] text-slate-900 sm:text-[44px]">
          수업에 필요한 모든 것을
          <br />
          하나의 교실로.
        </h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-slate-500">
          AIC(All-in-One Class)는 선생님이 수업을 열고 학생은 QR 또는 참가 코드와 이름만으로 참여하는
          교실 운영 플랫폼입니다. 3.0 버전은{" "}
          <strong className="font-semibold text-slate-700">수업 집중 모니터링</strong>에 더해{" "}
          <strong className="font-semibold text-slate-700">활동 보드·PDF 학습지·화면 공유</strong>를
          더했습니다. 보드와 PDF는 선생님 컴퓨터에만 저장되고, 수업 중에 열어 둔 동안에만 학생에게
          보입니다.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge tone="brand">v4.0 · Local-First Classroom</Badge>
          <Badge tone="neutral">React · TypeScript · Vite</Badge>
          <Badge tone="neutral">Cloudflare Workers · D1 · Durable Objects · WebRTC</Badge>
          <Badge tone="ok">MIT License</Badge>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <IconShield size={16} className="text-brand-600" />
              <h2 className="text-[14px] font-bold text-slate-900">설계 원칙</h2>
            </div>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-slate-600">
              {[
                "기존 수업 기능을 제거하지 않고 독립 모듈로 통합",
                "학생 계정·영구 프로필을 만들지 않음",
                "선생님은 Cloudflare 비밀번호 하나로 입장",
                "D1은 수업·임시 참가자만 저장",
                "실시간 상태와 이벤트 로그는 Durable Object에서 관리",
                "보드·PDF는 선생님 컴퓨터에, 학생에게는 수업 중에만",
                "대용량 업로드·R2 객체 저장소를 사용하지 않음",
                "관측과 추정을 구분해 표시",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <IconCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <IconLock size={16} className="text-brand-600" />
              <h2 className="text-[14px] font-bold text-slate-900">개인정보 최소화</h2>
            </div>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-slate-600">
              {[
                "이름은 수업 단위 임시 표시 이름으로만 사용",
                "참가 토큰은 해시로 저장, 학생 쿠키 없음",
                "PDF·보드는 서버에 저장하지 않고 수업 중에만 중계",
                "화면 공유는 브라우저 선택·허용 후에만 시작",
                "공유 영상은 저장하지 않으며 콘솔 종료 시 즉시 중단",
                "수업 종료 즉시 참가자·답변·보드·이벤트 파기",
                "입력 관찰은 AIC 활동 입력으로 한정",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <IconCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <section className="mt-12">
          <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">모듈 구성</h2>
          <p className="mt-1.5 text-[13px] text-slate-500">
            모듈형 모놀리스 구조를 유지하며, 집중·자료 공유 모듈은 수업이 없어도 안전하게 비활성화됩니다.
          </p>
          <Card className="mt-4 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {MODULES.map((module) => (
                <div key={module.name} className="flex flex-col gap-1.5 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex w-44 shrink-0 items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-slate-900">{module.name}</span>
                    <Badge
                      tone={
                        module.status === "구현"
                          ? "ok"
                          : module.status === "기본 구현"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {module.status}
                    </Badge>
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-500">{module.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">
            브라우저가 할 수 있는 일과 없는 일
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
            웹 앱은 Android 관리형 키오스크가 아닙니다. 아래 제한은 버그가 아니라 플랫폼 경계이며, AIC는
            이를 구현한 것처럼 표시하지 않습니다.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[12.5px] font-bold text-emerald-700">
                <IconCheck size={15} /> 구현되어 동작하는 기능
              </p>
              <ul className="mt-3 space-y-2">
                {CAN_DO.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[12px] text-slate-600">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[12.5px] font-bold text-slate-700">
                <IconX size={15} /> 웹으로 불가능 (미구현)
              </p>
              <ul className="mt-3 space-y-2">
                {CANNOT_DO.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[12px] text-slate-500">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">보관 기간</h2>
          <p className="mt-1.5 text-[13px] text-slate-500">
            D1에는 파일 데이터를 저장하지 않습니다. 보드와 PDF는 선생님 브라우저에만 있고, 학생에게는
            수업 중에 실시간으로 전달됩니다.
          </p>
          <Card className="mt-4 overflow-hidden">
            <div className="hidden grid-cols-[1.2fr_1fr_1.2fr] gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
              <span>데이터</span>
              <span>저장 위치</span>
              <span>보관 기간</span>
            </div>
            <div className="divide-y divide-slate-100">
              {RETENTION.map((row) => (
                <div
                  key={row.data}
                  className="grid gap-1 px-5 py-3 text-[12px] sm:grid-cols-[1.2fr_1fr_1.2fr] sm:gap-3"
                >
                  <span className="font-semibold text-slate-800">{row.data}</span>
                  <span className="text-slate-500">{row.where}</span>
                  <span className="text-slate-500">{row.period}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">보안</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "HTTPS · WSS (배포 시 Cloudflare TLS)",
              "선생님 비밀번호는 Cloudflare secret에만 보관",
              "HttpOnly · SameSite 세션 쿠키, Origin 검증",
              "학생 참가 토큰은 SHA-256 해시로 저장",
              "PDF는 서버에 저장하지 않고 콘솔이 열린 동안만 중계",
              "화면 공유는 학생의 브라우저 선택·허용 필요",
              "수업 소유자 검증(Teacher RBAC)",
              "R2·객체 저장소·영구 파일 업로드 없음",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-600"
              >
                <IconCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                {item}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
            국내 개인정보보호법과 미성년자 관련 요구사항은 실제 배포 전에 학교·기관 정책에 맞춰 별도
            검토해야 합니다. 이 앱은 수업 목적의 최소 데이터만 저장합니다.
          </p>
        </section>

        <section className="mt-12" id="licenses">
          <div className="flex items-center gap-2">
            <IconCode size={19} className="text-brand-600" />
            <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900">
              오픈소스 라이선스
            </h2>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
            AIC 자체 코드는 <strong className="font-semibold text-slate-700">MIT License</strong>로
            배포됩니다. 아래 오픈소스 소프트웨어를 사용하며, 각 프로젝트의 라이선스 전문은 저장소의{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">LICENSE</code> 파일과
            배포 패키지에 포함되어 있습니다.
          </p>

          <Card className="mt-4 overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12.5px] font-bold text-slate-800">
                  MIT License — Copyright (c) 2026 AIC
                </p>
                <Badge tone="ok">MIT</Badge>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Permission is hereby granted, free of charge, to any person obtaining a copy of this
                software and associated documentation files, to deal in the Software without
                restriction, including without limitation the rights to use, copy, modify, merge,
                publish, distribute, sublicense, and/or sell copies of the Software, subject to the
                condition that the above copyright notice and this permission notice are included in
                all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED “AS IS”,
                WITHOUT WARRANTY OF ANY KIND.
              </p>
            </div>
            <div className="hidden grid-cols-[1.3fr_0.6fr_0.8fr_1.1fr] gap-3 border-b border-slate-100 px-5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
              <span>패키지</span>
              <span>버전</span>
              <span>라이선스</span>
              <span>용도</span>
            </div>
            <div className="divide-y divide-slate-100">
              {LICENSES.map((entry) => (
                <div
                  key={entry.name}
                  className={cx(
                    "grid gap-1 px-5 py-3 text-[12px] sm:grid-cols-[1.3fr_0.6fr_0.8fr_1.1fr] sm:items-center sm:gap-3",
                    entry.name.startsWith("AIC") && "bg-brand-50/40",
                  )}
                >
                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                    {entry.url ? (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 hover:text-brand-700"
                      >
                        {entry.name}
                        <IconExternal size={11} className="text-slate-400" />
                      </a>
                    ) : (
                      entry.name
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{entry.version}</span>
                  <span className="text-slate-600">{entry.license}</span>
                  <span className="text-slate-500">{entry.note}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="mt-4 flex gap-2">
            <StatusDot tone="ok" className="mt-1.5" />
            <p className="text-[11px] leading-relaxed text-slate-400">
              라이선스 고지는 제품 화면에서 확인할 수 있도록 유지됩니다. 의존성을 추가하거나 교체할 때는
              이 목록과 저장소의 고지 파일을 함께 갱신해야 합니다.
            </p>
          </div>
        </section>

        <footer className="mt-14 border-t border-slate-200 pt-6 text-[11.5px] text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>AIC · All-in-One Class · v3.0.0 · MIT License</span>
            <div className="flex items-center gap-4">
              <Link to="/" className="hover:text-slate-700">
                홈
              </Link>
              <Link to={teacher ? "/app" : "/login"} className="hover:text-slate-700">
                {teacher ? "대시보드" : "로그인"}
              </Link>
              <a href="#licenses" className="hover:text-slate-700">
                라이선스
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
