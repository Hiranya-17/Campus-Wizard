"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconBell, LogoTile } from "@/components/icons";
import { logout, useProfile } from "@/lib/profile";
import { daysUntil } from "@/lib/study";

/** Top bar from the design: logo tile, then term, a bell (dot when something is due soon) and the avatar menu. */
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
      <AccountMenu initials={initials} name={user?.name} email={user?.email} />
    </div>
  );
}

/** Avatar button with a dropdown: account, tour, privacy, terms, and log out (or log in for guests). */
function AccountMenu({ initials, name, email }: { initials: string; name?: string; email?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLAnchorElement>(null);
  const path = usePathname();
  const loggedIn = Boolean(email);

  // close on route change, outside tap, or Esc
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = "flex min-h-11 w-full items-center px-4 text-left text-sm text-zinc-700 hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none";

  return (
    <div ref={wrap} className="relative">
      <button
        data-tour="account"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={loggedIn ? `Account menu for ${email}` : "Account menu"}
        className={`grid h-9 w-9 place-items-center rounded-full bg-[#f3e7df] text-xs font-bold text-[#7a4a32] ring-1 ring-black/5 transition-shadow ${open ? "ring-2 ring-bu" : ""}`}
      >
        {initials || "?"}
      </button>
      {open && (
        <div role="menu" aria-label="Account" className="cw-enter absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-xl">
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="truncate text-sm font-semibold">{loggedIn ? name : "Guest"}</p>
            <p className="truncate text-xs text-zinc-500">{loggedIn ? email : "Exploring the sample student"}</p>
          </div>
          <Link ref={firstItem} role="menuitem" href="/account" className={item}>{loggedIn ? "My account" : "Log in or sign up"}</Link>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); window.dispatchEvent(new Event("cw:tour")); }}>
            Replay workspace tour
          </button>
          <div className="my-1 border-t border-zinc-100" />
          <Link role="menuitem" href="/privacy" className={item}>Privacy Policy</Link>
          <Link role="menuitem" href="/terms" className={item}>Terms of Service</Link>
          {loggedIn && (
            <>
              <div className="my-1 border-t border-zinc-100" />
              <button
                role="menuitem"
                disabled={busy}
                className={`${item} font-semibold !text-red-700`}
                onClick={async () => {
                  setBusy(true);
                  await logout();
                  window.location.href = "/"; // full reload so every screen switches back to the guest demo
                }}
              >
                {busy ? "Logging out…" : "Log out"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
