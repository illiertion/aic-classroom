import { useAuth } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import { Badge, Callout, Card, CardHeader, cx } from "../components/ui";
import {
  IconAlert,
  IconCast,
  IconCheck,
  IconClock,
  IconFileText,
  IconHand,
  IconHelp,
  IconLayout,
  IconLock,
  IconMonitor,
  IconSettings,
  IconVideo,
} from "../components/Icons";

const FLOW = [
  {
    time: "0~3분",
    title: "수업 열기",
    body: "현황 탭에서 참가 코드·QR을 확인하고 학생이 들어올 때까지 기다립니다.",
    tab: "현황",
  },
  {
    time: "3~15분",
    title: "학습지 풀기",
    body: "문항을 만들거나 PDF를 붙여 배포 → 학생이 앱 안에서 답을 쓰고 제출 → 자동 채점·CSV.",
    tab: "학습지",
  },
  {
    time: "15~30분",
    title: "문제로 확인",
    body: "문제를 내고 마감하면 「결과를 학생에게 띄우기」로 응답 수·분포·정답자를 함께 확인합니다.",
    tab: "학습지",
  },
  {
    time: "30~40분",
    title: "함께 보기",
    body: "링크·큰 안내문·활동 보드를 전체 학생 화면에 띄우고, 50분 타이머를 켭니다.",
    tab: "활동·띄우기",
  },
  {
    time: "40~48분",
    title: "정리와 발표",
    body: "보드 카드로 정리하고(하트·댓글로 반응 모으기), 패들렛·화면 공유도 같은 탭에서 씁니다.",
    tab: "보드",
  },
  {
    time: "48~50분",
    title: "종료",
    body: "수업 종료를 누르면 참가자·응답·보드 사본이 즉시 삭제됩니다. 보드 원본과 PDF는 내 컴퓨터에 남습니다.",
    tab: "현황",
  },
];

const TABS = [
  {
    icon: IconMonitor,
    name: "현황",
    tone: "brand" as const,
    points: [
      "접속·전체화면·화면 공유 상태를 학생별로 확인",
      "손든 학생, 최근 이벤트, 학습지 제출 현황 요약",
      "수업 종료·다시 시작",
    ],
  },
  {
    icon: IconFileText,
    name: "학습지",
    tone: "info" as const,
    points: [
      "단답·서술·O/X 문항을 직접 만들고 정답 지정",
      "PDF 학습지를 함께 배포(파일은 내 컴퓨터에서 전송)",
      "문제를 내고 마감 → 결과를 학생 화면에 크게 띄우기",
      "제출 답안·자동 채점 점수 확인, 학생 답안·정답을 전체 화면에 띄우기, CSV로 저장",
      "빠른 양식으로 문항 한 번에 만들기",
    ],
  },
  {
    icon: IconLayout,
    name: "보드",
    tone: "brand" as const,
    points: [
      "활동 보드: 카드 자유 배치(드래그)·하트·댓글, 학생 카드 작성",
      "템플릿으로 바로 열기, 학생 화면 전체 띄우기",
      "패들렛: padlet.com 주소·embed 코드를 앱 안에서 바로 사용",
      "보드는 수업 중에만 학생에게 보이고, 원본은 내 컴퓨터에 저장",
    ],
  },
  {
    icon: IconCast,
    name: "활동·띄우기",
    tone: "warn" as const,
    points: [
      "웹 페이지·큰 글씨 안내문·보드를 접속한 학생 전원 화면에 동시 표시",
      "이 링크 보내기: 링크를 띄우고 알림까지 한 번에 전송",
      "쪽지 문제: 창 없이 알림으로 작은 문제를 보내 바로 채점",
      "50분 타이머·손들기·전체 알림·화면 공유",
    ],
  },
  {
    icon: IconCheck,
    name: "모둠·자리",
    tone: "ok" as const,
    points: [
      "모둠 수 조절·자동 배분, 학생 직접 선택 또는 선생님 직접 배정",
      "발표자 뽑기, 자리 뽑기(무작위·이름순·입장순·모둠별)",
      "모둠별 토의: 다른 모둠 글은 보이지 않고, 잠글 수도 있습니다",
    ],
  },
  {
    icon: IconCheck,
    name: "도구",
    tone: "ok" as const,
    points: [
      "검색하거나 버튼을 눌러서 열어 씁니다: 모둠 점수판·출석 체크·소음 측정기·스톱워치",
      "모둠 점수판과 출석은 학생 화면에도 함께 표시",
    ],
  },
  {
    icon: IconSettings,
    name: "설정·기록",
    tone: "neutral" as const,
    points: [
      "정답·오답 점수, 제한 시간, 아이템 수치, 자리 규칙, 학급 이름·안내 문구",
      "학생 화면 허용(전체화면·화면 공유·손들기·보드·순위)",
      "학생별 기록(Event History)",
    ],
  },
];

const STUDENT = [
  { icon: IconCheck, title: "이름만으로 참가", body: "계정·비밀번호 없이 참가 코드와 이름만 입력합니다." },
  { icon: IconLayout, title: "보드 카드", body: "활동 보드에 카드를 붙이고, 끌어서 옮기고, 하트와 댓글로 반응합니다." },
  { icon: IconFileText, title: "학습지", body: "앱 안에서 문항에 답하고 제출합니다. 한 번 제출하면 잠깁니다." },
  { icon: IconHand, title: "손들기·출석", body: "손들기와 출석하기 버튼으로 신호를 보냅니다." },
  { icon: IconVideo, title: "화면 공유", body: "선생님이 허용하면 내 화면을 보여 주고, 전체화면 요청을 받습니다." },
  { icon: IconClock, title: "타이머·결과", body: "남은 시간과 선생님이 띄운 결과·안내문을 함께 받습니다." },
];

const SETUP = [
  { label: "TEACHER_PASSWORD", detail: "기존 공용 비밀번호 계정용(새 선생님은 액세스 코드 사용)", required: false },
  { label: "SESSION_SECRET", detail: "세션 쿠키 서명 키(32자 이상)", required: true },
  { label: "TEACHER_NAME", detail: "오너 계정의 첫 표시 이름(이후 앱에서 변경)", required: false },
];

export default function Guide() {
  const { teacher } = useAuth();
  if (!teacher) return null;

  return (
    <AppShell teacher={teacher} wide>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-brand-600">CLASS GUIDE</p>
          <h1 className="mt-2 text-[26px] font-extrabold tracking-[-0.03em] text-slate-900 sm:text-[30px]">
            기능 안내와 50분 수업 사용법
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-500">
            수업 콘솔의 여섯 개 탭과 학생 화면 기능을 한 곳에 정리했습니다. 수업 중에 이 페이지를
            새 탭으로 열어 두어도 됩니다.
          </p>
        </div>
        <Badge tone="brand" dot>
          AIC 4.0
        </Badge>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <CardHeader
            title="50분 수업 흐름"
            description="한 차시를 그대로 따라 할 수 있는 순서입니다. 시간은 예시이고, 탭 이름은 콘솔 상단 탭과 같습니다."
          />
        </div>
        <div className="divide-y divide-slate-100">
          {FLOW.map((step) => (
            <div key={step.time} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start">
              <span className="w-16 shrink-0 rounded-lg bg-slate-900 px-2 py-1 text-center text-[11.5px] font-bold text-white">
                {step.time}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-slate-900">{step.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{step.body}</p>
              </div>
              <span className="shrink-0 self-start rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200">
                {step.tab}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900">선생님 콘솔 탭</h2>
        <span className="text-[11.5px] text-slate-400">6개 탭</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TABS.map((tab) => (
          <Card key={tab.name} className="flex flex-col p-5">
            <div className="flex items-center gap-2.5">
              <span
                className={cx(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  tab.tone === "brand" && "bg-brand-50 text-brand-600",
                  tab.tone === "info" && "bg-sky-50 text-sky-600",
                  tab.tone === "warn" && "bg-amber-50 text-amber-600",
                  tab.tone === "ok" && "bg-emerald-50 text-emerald-600",
                  tab.tone === "neutral" && "bg-slate-100 text-slate-500",
                )}
              >
                <tab.icon size={17} />
              </span>
              <p className="text-[14px] font-bold text-slate-900">{tab.name}</p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {tab.points.map((point) => (
                <li key={point} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900">학생 화면에서 할 수 있는 것</h2>
        <span className="text-[11.5px] text-slate-400">계정 없이 이름만으로 참가</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {STUDENT.map((item) => (
          <div key={item.title} className="rounded-xl border border-slate-200/80 bg-white p-4">
            <p className="flex items-center gap-2 text-[12.5px] font-bold text-slate-900">
              <item.icon size={15} className="text-brand-600" />
              {item.title}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="선생님이 직접 설정할 것"
              description="배포 전에 서버에 넣어야 하는 값입니다. 상세 절차는 docs/DEPLOY.md에 있습니다."
            />
          </div>
          <div className="divide-y divide-slate-100">
            {SETUP.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[12px] font-semibold text-slate-800">{row.label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{row.detail}</p>
                </div>
                <Badge tone={row.required ? "danger" : "neutral"}>
                  {row.required ? "필수" : "선택"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Callout tone="warn" icon={<IconAlert size={16} />} title="화면 공유는 HTTPS에서만">
            브라우저는 http 주소에서 화면 캡처를 허용하지 않습니다. 배포한 주소나
            https://&lt;IP&gt; 주소로 접속하세요.
          </Callout>
          <Callout tone="info" icon={<IconCast size={16} />} title="전체화면은 학생이 한 번 눌러야">
            다른 기기 화면을 강제로 전체화면으로 바꿀 수는 없습니다. ‘전체화면 요청’을 켜면 학생
            화면에 큰 버튼이 뜹니다.
          </Callout>
          <Callout tone="neutral" icon={<IconLock size={16} />} title="저장 위치">
            보드 원본·PDF는 선생님 브라우저에만 저장됩니다. 서버에는 수업 중 필요한
            최소 정보만 있고, 수업을 종료하면 즉시 삭제됩니다.
          </Callout>
          <Callout tone="brand" icon={<IconHelp size={16} />} title="수업 중 막히면">
            오른쪽 위 실시간 연결 배지가 ‘재연결 중’이면 잠시 기다리면 자동으로 다시 붙습니다.
            그래도 안 되면 페이지를 새로 고치세요. 학생은 참가 코드로 다시 들어오면 됩니다.
          </Callout>
        </div>
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-slate-400">
        이 안내는 앱 안에서 언제든 다시 볼 수 있습니다. 자세한 배포 절차는 저장소의 README.md와
        docs/DEPLOY.md를 참고하세요.
      </p>
    </AppShell>
  );
}


