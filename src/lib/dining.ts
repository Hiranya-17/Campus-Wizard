import type { Day, DiningHall, DiningHallToday, DiningMenuItem } from "@/lib/types";
import { DAYS } from "@/lib/types";

/** Day of week as our "Mon".."Sun", from a Date (defaults to now). */
export function dayOf(d: Date = new Date()): Day {
  return DAYS[(d.getDay() + 6) % 7];
}

/** Minutes after midnight for a Date (defaults to now). */
export function minutesOf(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

const MEAL_OF_PERIOD: [RegExp, DiningMenuItem["meals"][number]][] = [
  [/break|brunch/i, "breakfast"],
  [/lunch|brunch/i, "lunch"],
  [/dinner|supper/i, "dinner"],
];

/** Which meal a named service period maps to, for filtering the menu. */
export function mealForPeriod(name: string): DiningMenuItem["meals"][number] | null {
  return MEAL_OF_PERIOD.find(([re]) => re.test(name))?.[1] ?? null;
}

/**
 * Collapse one hall to today's status: today's hours, whether it's open right now,
 * the current (or next) service period, and today's menu. Pure; pass `now` in tests.
 */
export function hallToday(hall: DiningHall, now: Date = new Date()): DiningHallToday {
  const day = dayOf(now);
  const mins = minutesOf(now);
  const hours = hall.hours.find((h) => h.day === day)?.periods ?? [];
  const open = hours.find((p) => mins >= p.start && mins < p.end) ?? null;
  const next = hours.find((p) => p.start > mins) ?? null;
  const items = hall.menu.find((m) => m.day === day)?.items ?? [];
  return {
    hall: {
      id: hall.id,
      name: hall.name,
      building: hall.building,
      address: hall.address,
      campus: hall.campus,
      style: hall.style,
      payWith: hall.payWith,
      cuisines: hall.cuisines,
      features: hall.features,
      url: hall.url,
    },
    hours,
    openNow: open != null,
    currentPeriod: open?.name ?? next?.name ?? null,
    items,
  };
}

export function hallsToday(halls: DiningHall[], now: Date = new Date()): DiningHallToday[] {
  return halls
    .map((h) => hallToday(h, now))
    .sort((a, b) => Number(b.openNow) - Number(a.openNow) || a.hall.name.localeCompare(b.hall.name));
}

/** Loose cuisine match: free-text query against a menu item's cuisine, station and name. */
export function matchesCuisine(item: DiningMenuItem, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const hay = `${item.cuisine} ${item.station} ${item.name} ${item.tags.join(" ")}`.toLowerCase();
  // Split on spaces so "something spicy" still matches on "spicy" tokens.
  return q.split(/\s+/).some((word) => word.length > 2 && hay.includes(word));
}
