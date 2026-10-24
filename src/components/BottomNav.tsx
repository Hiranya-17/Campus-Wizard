"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  plan: <path d="M4 4h16v16H4zM4 9h16M9 4v16" />,
  week: <path d="M4 5h16v15H4zM4 10h16M8 3v4M16 3v4" />,
  food: <path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 0-3 3-3 6s1 4 3 4v8" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
};

const TABS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/plan", label: "Plan", icon: "plan" },
  { href: "/week", label: "Week", icon: "week" },
  { href: "/food", label: "Food", icon: "food" },
  { href: "/chat", label: "Rhett", icon: "chat" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[11px] font-medium ${active ? "text-bu" : "text-zinc-500"}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
                  {ICONS[t.icon]}
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
