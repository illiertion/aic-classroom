import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { TeacherProfile } from "../../shared/protocol";
import { useAuth } from "../lib/auth";
import { IconHelp, IconHome, IconLogOut, IconShield } from "./Icons";
import { Logo } from "./Logo";
import { Avatar, cx } from "./ui";

const NAV = [
  { to: "/app", label: "수업", icon: IconHome, end: true },
  { to: "/app/guide", label: "기능 안내", icon: IconHelp, end: false },
  { to: "/about", label: "소개 및 라이선스", icon: IconHelp, end: false },
];

export function AppShell({
  teacher,
  children,
  wide = false,
}: {
  teacher: TeacherProfile;
  children: ReactNode;
  wide?: boolean;
}) {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-ink-900 px-4 py-5 lg:flex">
        <Link to="/app" className="px-2">
          <Logo inverted />
        </Link>
        <nav className="mt-8 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <IconShield size={14} />
            Privacy first
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
            학생 계정은 만들지 않습니다. 이름과 참가 토큰은 수업이 끝나면 정리됩니다.
          </p>
        </div>

        <div className="mt-auto space-y-3 pt-6">
          <div className="flex items-center gap-3 rounded-xl px-2 py-1">
            <Avatar name={teacher.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{teacher.name}</p>
              <p className="truncate text-[11px] text-slate-500">
                {teacher.email || "비밀번호로 보호됨"}
              </p>
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <IconLogOut size={16} />
            로그아웃
          </button>
          <p className="px-3 text-[10.5px] leading-relaxed text-slate-600">
            AIC 4.0 · Focus &amp; Local-first
          </p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#f4f6fb]/85 backdrop-blur">
          <div
            className={cx(
              "mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6",
              wide ? "max-w-[1500px]" : "max-w-6xl",
            )}
          >
            <Link to="/app" className="lg:hidden">
              <Logo />
            </Link>
            <div className="hidden items-center gap-2 text-[12.5px] text-slate-500 lg:flex">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium ring-1 ring-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                선생님 모드
              </span>
              <span className="text-slate-400">·</span>
              <span>학생은 QR 또는 참가 코드로 입장</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/app/guide"
                className="rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              >
                기능 안내
              </Link>
              <Link
                to="/about"
                className="rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              >
                소개
              </Link>
              <button
                onClick={() => void signOut()}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
                aria-label="로그아웃"
              >
                <IconLogOut size={18} />
              </button>
              <div className="hidden items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 ring-1 ring-slate-200 lg:flex">
                <Avatar name={teacher.name} size="sm" />
                <span className="text-[12.5px] font-semibold text-slate-700">{teacher.name}</span>
              </div>
            </div>
          </div>
        </header>
        <main className={cx("mx-auto px-4 py-6 sm:px-6 sm:py-8", wide ? "max-w-[1500px]" : "max-w-6xl")}>
          {children}
        </main>
      </div>
    </div>
  );
}
