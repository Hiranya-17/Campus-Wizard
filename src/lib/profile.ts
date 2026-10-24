"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_BUDGET, DEFAULT_PREFS, DEMO_PROFILE } from "@/lib/demo";
import type { Profile } from "@/lib/types";

const GUEST_KEY = "rhett.profile.v2"; // demo student, kept in this browser
const ACCOUNT_KEY = "rhett.account.v1"; // cached copy of the logged-in user's profile

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const withDefaults = (p: Profile): Profile => ({ prefs: DEFAULT_PREFS, budget: DEFAULT_BUDGET, ...p });

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function saveToServer(profile: Profile) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
  }, 600);
}

/**
 * The current profile. Logged in: the account's profile, saved to the server.
 * Guest: the demo student, saved in this browser only.
 */
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEMO_PROFILE);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cached = read<{ user: SessionUser; profile: Profile }>(ACCOUNT_KEY);
    if (cached) {
      setUser(cached.user);
      setProfile(withDefaults(cached.profile));
    } else {
      const guest = read<Profile>(GUEST_KEY);
      if (guest) setProfile({ ...DEMO_PROFILE, ...guest });
    }
    (async () => {
      const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => null);
      if (me?.user) {
        const server: Profile | null = await fetch("/api/profile").then((r) => (r.ok ? r.json() : null));
        const p = withDefaults(server ?? cached?.profile ?? { ...DEMO_PROFILE, name: me.user.name, expenses: [] });
        setUser(me.user);
        setProfile(p);
        write(ACCOUNT_KEY, { user: me.user, profile: p });
      } else if (cached) {
        // session expired: back to the guest demo
        write(ACCOUNT_KEY, null);
        setUser(null);
        setProfile({ ...DEMO_PROFILE, ...(read<Profile>(GUEST_KEY) ?? {}) });
      }
      setReady(true);
    })();
  }, []);

  const update = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((p) => {
        const next = { ...p, ...patch };
        if (user) {
          write(ACCOUNT_KEY, { user, profile: next });
          saveToServer(next);
        } else {
          write(GUEST_KEY, next);
        }
        return next;
      });
    },
    [user],
  );

  const reset = useCallback(() => {
    write(GUEST_KEY, null);
    setProfile(DEMO_PROFILE);
  }, []);

  return { profile, update, reset, user, ready };
}

/** Log in or sign up, then reload so every screen picks up the account. */
export async function authRequest(path: "login" | "signup", body: object): Promise<string | null> {
  const res = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) return data.error ?? "Something went wrong.";
  const profile = await fetch("/api/profile").then((r) => (r.ok ? r.json() : null));
  write(ACCOUNT_KEY, { user: data.user, profile: withDefaults(profile ?? { ...DEMO_PROFILE, name: data.user.name, expenses: [] }) });
  return null;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  write(ACCOUNT_KEY, null);
}
