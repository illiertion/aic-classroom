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
  IconSparkles,
  IconTrophy,
  IconUsers,
  IconVideo,
} from "../components/Icons";

const FLOW = [
  {
    time: "0~3분",
    title: "수업 열고 학생 입장",
    body: "새 수업 만들기 → 참가 안내에서 QR·코드 공유. 학생은 이름만 입력합니다.",
    tab: "수업 현황",
  },
  {
    time: "3~15분",
    title: "학습지 풀기",
    body: "문항을 만들거나 PDF를 붙여 배포 → 학생이 앱 안에서 답을 쓰고 제출 → 자동 채점·CSV.",
    tab: "학습지·문제",
  },
  {
    time: "15~30분",
    title: "게임으로 확인",
    body: "세트 선택 → 방식(일반전·스피드전·골든벨·팀전·아이템전)과 제한 시간 → 한 문제씩 시작 → 순위 확인.",
    tab: "게임",
  },
  {
    time: "30~40분",
    title: "함께 보기",
    body: "패들렛·유튜브 주소, 큰 안내문, 활동 보드를 전체 학생 화면에 띄우고 50분 타이머를 켭니다.",
    tab: "띄우기·타이머",
  },
  {
    time: "40~48분",
    title: "정리와 발표",
    body: "보드 카드로 정리, 학생 화면을 크게 보기로 프로젝터에 띄우거나 선생님 화면을 공유합니다.",
    tab: "활동 보드 · 화면 공유",
  },
  {
    time: "48~50분",
    title: "종료",
    body: "수업 종료를 누르면 참가자·응답·보드 사본이 즉시 삭제됩니다. 보드 원본과 PDF는 내 컴퓨터에 남습니다.",
    tab: "수업 현황",
  },
];

const TABS = [
  {
    icon: IconMonitor,
    name: "수업 현황",
    tone: "brand" as const,
    points: [
      "접속·전체화면·화면 공유 상태를 학생별로 확인",
      "손든 학생, 최근 이벤트, 학습지 제출 현황 요약",
      "수업 종료·다시 시작",
    ],
  },
  {
    icon: IconFileText,
    name: "학습지·문제",
    tone: "info" as const,
    points: [
      "단답·서술·O/X 문항을 직접 만들고 정답 지정",
      "PDF 학습지를 함께 배포(파일은 내 컴퓨터에서 전송)",
      "학생이 PDF 위에 펜·형광펜으로 필기하고 ‘메모만 저장’ 또는 ‘원본+메모 PDF’로 저장",
      "한 번 제출하면 잠기고, 선생님이 ‘다시 제출 허용’을 눌러야 수정",
      "제출 답안·자동 채점 점수 확인, 학생 답안·정답을 전체 화면에 띄우기, CSV로 저장",
      "빠른 양식으로 문항 한 번에 만들기",
    ],
  },
  {
    icon: IconSparkles,
    name: "게임",
    tone: "warn" as const,
    points: [
      "게임 고르기: 흩어진 단어·단어/문장 순서·빈칸·운석·OX + 일반전·아이템전",
      "게임마다 라운드 수·제한시간을 직접 정하고, 문제 편집은 접어 두고 필요할 때만 엽니다",
      "일반전·스피드전·골든벨·팀전·아이템전 (점수는 수업 설정에서 바꿉니다)",
      "대기 화면: 방번호와 접속 학생 목록을 크게 띄워 함께 시작",
      "문제 유형: 3~6지선다·OX·주관식 단어·뜻 연결(짝 맞히기)을 직접 편집",
      "문제별 제한 시간 20·30·60초 · 시간이 끝나면 서버가 자동 마감",
      "프로젝터 화면: 큰 문제·카운트다운·응답 수·정답 공개·시상대",
      "랭킹판: 실시간 순위·점수 막대·‘○○이 1위’ 알림 피드",
      "아이템전: 정답마다 더블·훔치기·+50점 아이템을 받아 사용",
      "결과 CSV, 모둠 다시 섞기, 세트 JSON 내보내기·가져오기",
      "룰렛 뽑기: 접속한 학생 중 무작위 한 명을 뽑아 전원 화면에 표시",
      "폭탄 돌리기: 학생이 ‘넘기기’로 폭탄을 넘기고, 터지는 시각은 서버가 결정(학생 화면에 시계 없음)",
      "낱말 찾기: 낱말 2~6개로 가로세로 퍼즐을 만들고 학생이 찾은 낱말 입력",
      "카드 짝 맞추기: 같은 낱말 두 장을 찾는 기억 게임(학생과 선생님이 함께 뒤집기)",
      "사다리 타기: 이름·상품을 넣으면 서버가 사다리를 긋고 결과를 계산, ‘결과 공개’로 발표",
      "반응 속도 대결: 두더지가 나타나면 가장 빠르게 누른 학생이 점수 획득(점수 누적)",
      "초성 퀴즈: 서버가 초성만 보여 주고, 먼저 맞힌 학생에게 10점",
    ],
  },
  {
    icon: IconCheck,
    name: "수업 도구",
    tone: "ok" as const,
    points: [
      "모둠 점수판: +1/+5/+10으로 점수를 주고 학생 화면에도 표시",
      "출석 체크: 학생 화면의 ‘출석하기’ 버튼으로 누가 냈는지 바로 확인",
      "소음 측정기: 마이크 음량만 재고 소리는 저장하지 않음",
      "스톱워치: 활동 시간 계측과 구간 기록(교사 화면 전용)",
    ],
  },
  {
    icon: IconUsers,
    name: "모둠·자리",
    tone: "ok" as const,
    points: [
      "발표자 뽑기: 전체 또는 특정 모둠에서 무작위 선정",
      "모둠 수 1~8개: 늘리거나 줄이고 ‘자동 배분’으로 균등하게 나누기",
      "학생이 직접 모둠 선택: 켜 두면 학생 화면에 모둠 버튼이 나타남",
      "자리 뽑기: 줄(행)·한 줄 인원(열)을 고르고 무작위 배치",
      "자리 직접 지정: 학생을 고른 뒤 자리를 누르면 이동, 앉은 학생을 누르면 비움",
      "학생이 직접 자리 선택: 빈자리를 눌러 앉기(이미 앉은 자리는 잠금)",
      "모둠별 토의: 학생은 자기 모둠 글만 보고, 다른 모둠 글은 전송되지 않음",
    ],
  },
  {
    icon: IconCast,
    name: "띄우기·타이머",
    tone: "brand" as const,
    points: [
      "웹 주소·큰 안내문·활동 보드를 학생 전원 화면에 동시에 표시",
      "팝업 창으로 열기·교사 화면 전체화면·최근 자료 다시 띄우기",
      "학생 화면 전체화면 요청(학생이 한 번 누르면 전환)",
      "50·40·30·15·5분 타이머, 남은 시간은 학생 화면 상단에 표시",
      "손든 학생 확인·내리기, 전체 알림 보내기",
      "쪽지 문제: 창을 띄우지 않고 작은 문제를 알림으로 보내 바로 채점",
      "자리 뽑기 규칙(무작위·이름순·입장순·모둠별)은 수업 설정에서 정합니다",
    ],
  },
  {
    icon: IconLayout,
    name: "활동 보드",
    tone: "info" as const,
    points: [
      "패들렛형 카드 보드, 색·열(칼럼) 지정",
      "학생 글쓰기 허용/차단, 카드 삭제",
      "보드를 학생 화면에 전체화면으로 띄우기",
    ],
  },
  {
    icon: IconLayout,
    name: "패들렛",
    tone: "warn" as const,
    points: [
      "내 패들렛 주소를 넣고 학생에게 그대로 띄우기",
      "보드 주소를 저장해 두고 다음 수업에서 다시 사용",
    ],
  },
  {
    icon: IconVideo,
    name: "화면 공유",
    tone: "ok" as const,
    points: [
      "선생님 화면을 학생 화면 맨 위에 크게 표시(자동 재연결)",
      "학생 화면을 받아 ‘크게 보기’로 프로젝터에 전체화면",
      "모두에게 화면 공유 요청",
    ],
  },
  {
    icon: IconSettings,
    name: "수업 설정",
    tone: "info" as const,
    points: [
      "정답·오답 점수, 속도 가점, 랭킹 인원을 직접 지정",
      "문제 기본 제한 시간(0 = 무제한)과 아이템 효과 수치 조정",
      "학생 화면의 전체화면·화면 공유·손들기·보드 작성·순위 표시를 켜고 끄기",
      "학급 이름과 안내 문구를 학급에 맞게 바꾸기",
    ],
  },
  {
    icon: IconClock,
    name: "기록",
    tone: "neutral" as const,
    points: [
      "입장·퇴장·집중 이탈·화면 공유 등 이벤트 타임라인",
      "학생별 활동 로그 확인, 새로고침",
      "수업 종료 시 함께 삭제",
    ],
  },
];

const STUDENT = [
  {
    icon: IconFileText,
    title: "학습지",
    body: "문항에 답을 쓰고 제출합니다. 제출 후에는 잠기고, PDF는 보면서 펜·형광펜으로 메모해 ‘메모만’ 또는 ‘원본+메모’ PDF로 저장합니다.",
  },
  { icon: IconTrophy, title: "게임 응답", body: "O/X·객관식 버튼 또는 정답 입력. 남은 시간과 내 점수·순위가 보입니다." },
  { icon: IconCast, title: "띄워진 화면", body: "선생님이 띄운 페이지·안내문·보드가 화면을 덮고, 전체화면 버튼으로 크게 봅니다." },
  { icon: IconHand, title: "손들기", body: "질문이 있으면 손들기. 선생님 화면에 바로 표시되고 확인 알림이 옵니다." },
  { icon: IconVideo, title: "화면 공유", body: "허용하면 내 화면이 선생님에게 보입니다. 언제든 중지할 수 있습니다." },
  { icon: IconClock, title: "타이머", body: "수업 남은 시간이 상단에 항상 표시됩니다." },
  { icon: IconUsers, title: "모둠 토의", body: "내 모둠 칸에서만 글을 쓰고 볼 수 있습니다. 다른 모둠 글은 보이지 않습니다." },
  { icon: IconUsers, title: "모둠·자리 선택", body: "선생님이 열어 두면 내 모둠과 빈자리를 직접 고를 수 있습니다." },
  { icon: IconTrophy, title: "발표자", body: "발표자로 뽑히면 화면에 표시됩니다." },
  { icon: IconCheck, title: "출석·모둠 점수", body: "출석 시간이 되면 ‘출석하기’ 버튼이 뜨고, 우리 모둠 점수가 함께 보입니다. 아이템전에서는 아이템도 쓸 수 있습니다." },
];

const SETUP = [
  { label: "TEACHER_PASSWORD", detail: "선생님 로그인 비밀번호(8자 이상)", required: true },
  { label: "SESSION_SECRET", detail: "세션 서명 키(16자 이상)", required: true },
  { label: "TEACHER_NAME", detail: "처음 표시할 이름(이후 대시보드에서 언제든 변경)", required: false },
  { label: "D1 database_id", detail: "wrangler d1 create 후 wrangler.jsonc에 교체", required: true },
  { label: "bun run db:remote", detail: "원격 D1 스키마 적용", required: true },
  { label: "HTTPS", detail: "화면 공유는 https에서만 동작(workers.dev는 기본 제공)", required: true },
  { label: "VITE_TURN_*", detail: "다른 네트워크 학생과 화면 공유할 때 TURN 서버", required: false },
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
            수업 콘솔의 열한 개 탭과 학생 화면 기능을 한 곳에 정리했습니다. 수업 중에 이 페이지를
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
            브라우저는 http 주소에서 화면 캡처를 허용하지 않습니다. 배포한 workers.dev 주소나
            https://&lt;IP&gt;:8443 으로 접속하세요. 휴대폰 Safari는 화면 공유 송신을 지원하지
            않습니다.
          </Callout>
          <Callout tone="info" icon={<IconCast size={16} />} title="전체화면은 학생이 한 번 눌러야">
            다른 기기 화면을 강제로 전체화면으로 바꿀 수는 없습니다. ‘전체화면 요청’을 켜면 학생
            화면에 큰 버튼이 뜹니다.
          </Callout>
          <Callout tone="neutral" icon={<IconLock size={16} />} title="저장 위치">
            보드 원본·게임 세트·PDF는 선생님 브라우저에만 저장됩니다. 서버에는 수업 중 필요한
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







