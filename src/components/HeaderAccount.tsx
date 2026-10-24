"use client";
import Link from "next/link";
import { IconBell, LogoTile } from "@/components/icons";
import { useProfile } from "@/lib/profile";
import { daysUntil } from "@/lib/study";

/** Top bar from the design: logo tile, then term, a bell (dot when something is due soon) and the avatar. */
export function HeaderAccount() {
  const { profile, user } = useProfile();
  const name = user?.name ?? profile.name ?? "Guest";
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const dueSoon = (profile.assignments ?? []).filter((a) => { const d = daysUntil(a); return d >= 0 && d <= 2; }).length;
  const [season, year] = (profile.term ?? "Fall 2026").split(" ");
  return (
    <div className="flex w-full items-center gap-3">
      <Link href="/" aria-label="CampusWizard home" className="flex items-center gap-2">
        <LogoTile size={34} />
        <span className="hidden text-[15px] font-bold tracking-tight sm:inline">CampusWizard</span>
      </Link>
      <span className="ml-auto text-xs font-medium text-zinc-500">{season} &rsquo;{year?.slice(2)}</span>
      <Link href="/#coming-up" aria-label={dueSoon ? `${dueSoon} things due in the next 2 days` : "Coming up"} className="relative grid h-9 w-9 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100">
        <IconBell size={19} />
        {dueSoon > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-bu ring-2 ring-white" />}
      </Link>
      <Link
        href="/account"
        data-tour="account"
        aria-label={user ? `Account: ${user.email}` : "Log in or create an account"}
        className="grid h-9 w-9 place-items-center rounded-full bg-[#f3e7df] text-xs font-bold text-[#7a4a32] ring-1 ring-black/5"
      >
        {initials || "?"}
      </Link>
    </div>
  );
}
