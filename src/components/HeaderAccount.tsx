"use client";
import Link from "next/link";
import { useProfile } from "@/lib/profile";

export function HeaderAccount() {
  const { user } = useProfile();
  return (
    <Link href="/account" className="ml-auto flex items-center gap-2 text-xs font-medium">
      {user ? (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-bold text-bu" title={user.email}>
          {user.name[0]?.toUpperCase()}
        </span>
      ) : (
        <span className="rounded-full border border-white/60 px-3 py-1">Log in</span>
      )}
    </Link>
  );
}
