import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { IconCheck, IconEye, IconLock, IconMonitor } from "./Icons";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f6fb] lg:grid lg:grid-cols-[1.02fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 px-12 py-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 aic-grid-dark opacity-50" />
        <div className="absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-brand-600/25 blur-[110px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-mint-500/10 blur-[100px]" />
        <div className="relative">
          <Link to="/">
            <Logo inverted />
          </Link>
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="text-[11px] font-bold tracking-[0.16em] text-mint-400">TEACHER CONSOLE</p>
          <h1 className="mt-3 text-[32px] font-extrabold leading-[1.22] tracking-[-0.03em]">
            학생은 이름만,
            <br />
            선생님은 수업에 집중.
          </h1>
          <p className="mt-4 text-[13.5px] leading-relaxed text-slate-400">
            수업 중 이탈 관측과 보드·PDF·화면 공유는 선생님 한 사람에게만 연결됩니다. 학생 계정
            테이블은 만들지 않습니다.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "이름과 액세스 코드만으로 입장",
              "액세스 코드는 D1에만 저장",
              "QR·참가 코드로 학생 입장",
              "보드·PDF는 선생님 PC에, 업로드 없음",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[12.5px] text-slate-300">
                <IconCheck size={15} className="mt-0.5 shrink-0 text-mint-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mt-10 grid grid-cols-3 gap-3">
          {[
            { icon: IconLock, label: "학생 계정 없음" },
            { icon: IconMonitor, label: "실시간 관측" },
            { icon: IconEye, label: "허용 기반 공유" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <item.icon size={16} className="text-slate-400" />
              <p className="mt-2 text-[10.5px] font-medium leading-snug text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
                  <p className="relative mt-8 text-[10.5px] text-slate-600">AIC 4.0 · Focus &amp; Local-first</p>
      </aside>

      <main className="flex min-h-screen flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h2 className="text-[26px] font-extrabold tracking-[-0.03em] text-slate-900">{title}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 text-[12.5px] text-slate-500">{footer}</div>
        </div>
        <p className="mx-auto w-full max-w-[400px] text-[11px] leading-relaxed text-slate-400">
          액세스 코드는 AIC 데이터베이스에만 저장되고 학생에게는 절대 보이지 않습니다. 학생의
          이름은 수업 단위로만 사용되고 수업을 종료하면 바로 정리됩니다.
        </p>
      </main>
    </div>
  );
}

