"use client";
import { useCallback, useEffect, useState } from "react";
import { DEMO_PROFILE } from "@/lib/demo";
import type { Profile } from "@/lib/types";

const KEY = "rhett.profile.v1";

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEMO_PROFILE, ...JSON.parse(raw) };
  } catch {}
  return DEMO_PROFILE;
}

/** The demo user's profile, saved in this browser. */
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEMO_PROFILE);
  useEffect(() => setProfile(load()), []);
  const update = useCallback((patch: Partial<Profile>) => {
    setProfile((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setProfile(DEMO_PROFILE);
  }, []);
  return { profile, update, reset };
}
