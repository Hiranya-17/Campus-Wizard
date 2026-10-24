export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
    </div>
  );
}

export function Button({
  children, onClick, disabled, variant = "primary", type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "bg-bu text-white hover:bg-red-700 disabled:bg-zinc-300"
      : "bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${styles}`}>
      {children}
    </button>
  );
}

export function Pill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "red" | "green" | "amber" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700",
    red: "bg-red-50 text-red-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-800",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
