import Link from "next/link";

/** White rounded card on the off-white canvas. */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>{children}</div>;
}

/** Page heading in the design's voice: a calm sentence, a quiet subtitle, optional red eyebrow. */
export function PageTitle({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return (
    <div className="mb-5 cw-enter">
      {eyebrow && <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-bu">{eyebrow}</p>}
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-zinc-900">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{subtitle}</p>}
    </div>
  );
}

/** Card heading with an optional "View week →" style link. */
export function SectionHeader({ title, href, linkLabel, className = "" }: { title: string; href?: string; linkLabel?: string; className?: string }) {
  return (
    <div className={`mb-3 flex items-baseline justify-between gap-2 ${className}`}>
      <h2 className="text-[17px] font-semibold text-zinc-900">{title}</h2>
      {href && linkLabel && (
        <Link href={href} className="shrink-0 text-sm font-medium text-bu hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

const BUTTON = {
  primary: "bg-bu text-white hover:bg-red-700 active:bg-red-800 disabled:bg-zinc-200 disabled:text-zinc-400",
  secondary: "bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 disabled:text-zinc-400",
  ghost: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:text-zinc-400",
  danger: "bg-red-50 text-red-700 hover:bg-red-100",
};

export function Button({
  children, onClick, disabled, variant = "primary", type = "button", full = true, className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: keyof typeof BUTTON;
  type?: "button" | "submit";
  full?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${full ? "w-full" : ""} inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${BUTTON[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Pill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "red" | "green" | "amber" | "blue" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700",
    red: "bg-red-50 text-red-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-sky-50 text-sky-700",
  };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

/** Friendly empty state: icon tile, one short headline, one line, one action. */
export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-bu">{icon}</span>
      <p className="font-semibold text-zinc-900">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-zinc-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Placeholder rows while something loads. */
export function Skeleton({ rows = 3, label = "Loading your workspace…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="cw-skeleton h-9 w-9 shrink-0 rounded-lg" />
          <span className="flex-1 space-y-1.5">
            <span className="cw-skeleton block h-3 w-3/4 rounded" />
            <span className="cw-skeleton block h-2.5 w-1/2 rounded" />
          </span>
        </div>
      ))}
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  );
}

/** A course-code chip tinted by course (CS 202, MATH 230…). */
// same order as the calendar's course colors, so a course looks the same everywhere
const CHIP = ["bg-sky-50 text-sky-700", "bg-amber-50 text-amber-700", "bg-emerald-50 text-emerald-700", "bg-violet-50 text-violet-700", "bg-pink-50 text-pink-700", "bg-teal-50 text-teal-700", "bg-orange-50 text-orange-700"];
export const chipTone = (i: number) => CHIP[i % CHIP.length];
export function CodeChip({ code, index }: { code: string; index: number }) {
  return <span className={`inline-grid min-w-16 place-items-center rounded-lg px-2 py-2.5 text-[11px] font-bold tracking-wide ${chipTone(index)}`}>{code}</span>;
}
