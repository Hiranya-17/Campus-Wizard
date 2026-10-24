"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconFood, IconHome, IconLayers, IconSparkle, IconWallet } from "@/components/icons";

const TABS = [
  { href: "/", label: "Home", Icon: IconHome, tour: "home" },
  { href: "/plan", label: "Semester", Icon: IconLayers, tour: "plan" },
  { href: "/week", label: "Week", Icon: IconCalendar, tour: "week" },
  { href: "/chat", label: "AI Chat", Icon: IconSparkle, tour: "chat" },
  { href: "/food", label: "Food", Icon: IconFood, tour: "food" },
  { href: "/money", label: "Money", Icon: IconWallet, tour: "money" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, Icon, tour }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                data-tour={`tab-${tour}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors duration-150 ${active ? "text-bu" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                <Icon size={21} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
