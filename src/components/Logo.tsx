import { cx } from "./ui";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-brand-500 via-brand-600 to-indigo-800 shadow-[0_6px_16px_-6px_rgba(79,70,229,0.8)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path d="M6 17.5 12 5l6 12.5" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.1 13.5h5.8" stroke="white" strokeWidth="2.1" strokeLinecap="round" opacity=".75" />
        <circle cx="18.4" cy="6" r="2" fill="#5eead4" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  compact = false,
  inverted = false,
}: {
  className?: string;
  compact?: boolean;
  inverted?: boolean;
}) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact ? (
        <span className="leading-none">
          <span
            className={cx(
              "block text-[17px] font-extrabold tracking-[-0.02em]",
              inverted ? "text-white" : "text-slate-900",
            )}
          >
            AIC
          </span>
          <span
            className={cx(
              "mt-1 block text-[9.5px] font-semibold tracking-[0.18em]",
              inverted ? "text-slate-400" : "text-slate-400",
            )}
          >
            ALL-IN-ONE CLASS
          </span>
        </span>
      ) : null}
    </span>
  );
}
