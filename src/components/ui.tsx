import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconCopy, IconX } from "./Icons";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/* --------------------------------- button -------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700 active:bg-brand-700",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700",
  success: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700",
  subtle: "bg-brand-50 text-brand-700 hover:bg-brand-100",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px]",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2.5 rounded-xl px-5 text-[15px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- card --------------------------------- */

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={cx(
        "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-32px_rgba(15,23,42,0.35)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------- badges -------------------------------- */

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "brand";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

const DOT_TONES: Record<Tone, string> = {
  neutral: "bg-slate-400",
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  brand: "bg-brand-500",
};

export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cx("relative inline-flex h-2 w-2", className)}>
      <span className={cx("h-2 w-2 rounded-full", DOT_TONES[tone], pulse && "aic-live-dot")} />
    </span>
  );
}

/* --------------------------------- inputs -------------------------------- */

const FIELD_BASE =
  "w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD_BASE, "h-11 px-3.5", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(FIELD_BASE, "min-h-24 px-3.5 py-3 leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(FIELD_BASE, "h-11 px-3", className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-700">
        {label}
      </label>
      {children}
      {error ? <p className="text-[12.5px] font-medium text-rose-600">{error}</p> : null}
      {hint && !error ? (
        <p className="text-[12.5px] leading-relaxed text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        checked ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-slate-200",
      )}
    >
      <span
        className={cx(
          "inline-block h-4.5 w-4.5 translate-x-0.5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-[22px]",
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}

/* --------------------------------- modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cx(
          "aic-fade-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{description}</p>
            ) : null}
          </div>
          <IconButton label="닫기" onClick={onClose}>
            <IconX size={18} />
          </IconButton>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------------------------- tabs --------------------------------- */

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "scrollbar-thin inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/70 p-1 backdrop-blur",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cx(
            "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors",
            value === item.id
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
          )}
        >
          {item.label}
          {typeof item.count === "number" && item.count > 0 ? (
            <span
              className={cx(
                "rounded-full px-1.5 py-0.5 text-[10.5px] font-bold leading-none",
                value === item.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- feedback -------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className ?? "h-4 w-4",
      )}
      aria-hidden="true"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-slate-100", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

const CALLOUT_TONES: Record<Tone, { wrap: string; icon: string }> = {
  neutral: { wrap: "border-slate-200 bg-slate-50 text-slate-600", icon: "text-slate-400" },
  ok: { wrap: "border-emerald-200 bg-emerald-50/70 text-emerald-800", icon: "text-emerald-500" },
  warn: { wrap: "border-amber-200 bg-amber-50/80 text-amber-900", icon: "text-amber-500" },
  danger: { wrap: "border-rose-200 bg-rose-50/80 text-rose-800", icon: "text-rose-500" },
  info: { wrap: "border-sky-200 bg-sky-50/80 text-sky-900", icon: "text-sky-500" },
  brand: { wrap: "border-brand-200 bg-brand-50/70 text-brand-800", icon: "text-brand-500" },
};

export function Callout({
  tone = "neutral",
  icon,
  title,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const styles = CALLOUT_TONES[tone];
  return (
    <div className={cx("flex gap-3 rounded-xl border px-4 py-3", styles.wrap, className)}>
      {icon ? <div className={cx("mt-0.5 shrink-0", styles.icon)}>{icon}</div> : null}
      <div className="min-w-0 text-[12.5px] leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

/* --------------------------------- misc ---------------------------------- */

/**
 * navigator.clipboard exists only in a secure context (https:// or localhost),
 * so a classroom opened over http://<LAN IP> falls back to the legacy command.
 */
async function writeClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* denied — try the legacy path below */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label = "복사",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    const ok = await writeClipboard(value);
    setStatus(ok ? "copied" : "failed");
  };
  const copied = status === "copied";
  const failed = status === "failed";

  return (
    <button
      type="button"
      onClick={copy}
      className={cx(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50",
        copied && "border-emerald-200 bg-emerald-50 text-emerald-700",
        failed && "border-rose-200 bg-rose-50 text-rose-700",
        className,
      )}
    >
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      {copied ? "복사됨" : failed ? "복사 실패" : label}
    </button>
  );
}

const AVATAR_PALETTE = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const palette = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  const dimensions = size === "sm" ? "h-8 w-8 text-[11px]" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-[13px]";
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        palette,
        dimensions,
        className,
      )}
      aria-hidden="true"
    >
      {name.slice(0, 1) || "?"}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("border-slate-100", className)} />;
}
