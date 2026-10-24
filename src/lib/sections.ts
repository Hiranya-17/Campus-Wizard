import type { Section } from "@/lib/types";

/**
 * How BU sections fit together:
 * - WR 153: every section (E1, F1, K1…) is a full class; pick one.
 * - MA 226: A1 is a lecture and A2–A6 are its discussions; pick A1 plus one of A2–A6 (or B1 plus one of B2–B5).
 * - EC 311: A1 is the lecture and C1–C5 are labs; pick A1 plus any one C section.
 * - PY 212: when a pool runs past 9 sections BU continues on the next letter (discussions D1–D9, E1–E9, F1;
 *   labs L1–L9, M1–M9, N1). Those letters are one pool, so shared companions are merged by kind, not letter.
 * - CS 111: a section can meet at two different times (A1 = MWF 10:10 and W 6:30 pm); those rows share an id
 *   and always go together, so a "unit" below is every row with the same section id.
 * Lectures/standalone sections ("primary") meet on 2+ days a week or for nearly the longest time;
 * discussions and labs meet once a week. When unsure, ask for fewer picks rather than more.
 */

export type Unit = Section[]; // all meeting rows of one section id

const minutes = (s: Section) =>
  s.schedule.start != null && s.schedule.end != null ? s.schedule.days.length * (s.schedule.end - s.schedule.start) : 0;
export const unitMinutes = (u: Unit) => u.reduce((m, s) => m + minutes(s), 0);

const letter = (u: Unit) => u[0].section.replace(/[^A-Z]/gi, "").slice(0, 1).toUpperCase() || "A";

export function units(sections: Section[]): Unit[] {
  const byId = new Map<string, Unit>();
  for (const s of sections) byId.set(s.section, [...(byId.get(s.section) ?? []), s]);
  return [...byId.values()];
}

export interface CompanionGroup {
  label: string; // "Discussion" | "Lab"
  choices: Unit[];
}

export interface SectionOption {
  primary: Unit;
  companions: CompanionGroup[]; // pick exactly one from each
}

export function sectionOptions(sections: Section[]): SectionOption[] {
  const all = units(sections);
  if (!all.length) return [];
  const max = Math.max(...all.map(unitMinutes));
  const days = (u: Unit) => new Set(u.flatMap((s) => s.schedule.days)).size;
  const isPrimary = (u: Unit) => max === 0 || days(u) >= 2 || unitMinutes(u) >= 0.75 * max;
  const primaries = all.filter(isPrimary);
  const companions = all.filter((u) => !isPrimary(u));
  const primaryLetters = new Set(primaries.map(letter));

  const label = (group: Unit[]) => {
    const perMeeting = group.flat().reduce((m, s) => m + minutes(s) / Math.max(1, s.schedule.days.length), 0) / group.flat().length;
    return perMeeting >= 100 ? "Lab" : "Discussion";
  };

  // Companions whose letter has no lecture are shared by every lecture (EC 311's C labs).
  const byLetter = new Map<string, Unit[]>();
  for (const c of companions) {
    if (!primaryLetters.has(letter(c))) byLetter.set(letter(c), [...(byLetter.get(letter(c)) ?? []), c]);
  }
  // Each letter is a discussion or lab pool (judged on the whole letter, so one odd row can't flip it);
  // letters of the same kind are one pool.
  const shared = new Map<string, Unit[]>();
  for (const group of byLetter.values()) {
    const kind = label(group);
    shared.set(kind, [...(shared.get(kind) ?? []), ...group]);
  }

  return primaries.map((primary) => {
    // This lecture's own discussions (MA 226's A2–A6) join the shared pool of the same kind (CS 440)
    const pools = new Map<string, Unit[]>(shared);
    const own = companions.filter((c) => letter(c) === letter(primary));
    if (own.length) pools.set(label(own), [...own, ...(pools.get(label(own)) ?? [])]);
    const groups: CompanionGroup[] = [];
    for (const kind of ["Discussion", "Lab"]) {
      const pool = pools.get(kind);
      if (pool) groups.push({ label: kind, choices: pool });
    }
    return { primary, companions: groups };
  });
}

export function sectionsOverlap(a: Section, b: Section): boolean {
  const sa = a.schedule, sb = b.schedule;
  if (sa.start == null || sa.end == null || sb.start == null || sb.end == null) return false;
  if (!sa.days.some((d) => sb.days.includes(d))) return false;
  return sa.start < sb.end && sb.start < sa.end;
}

export const unitClashes = (u: Unit, taken: Section[]) => u.some((s) => taken.some((t) => sectionsOverlap(s, t)));

/** First full set (a primary plus one of each required companion) that doesn't overlap `taken`. */
export function pickSections(sections: Section[], taken: Section[]): Section[] | null {
  for (const opt of sectionOptions(sections)) {
    if (unitClashes(opt.primary, taken)) continue;
    const chosen: Section[] = [...opt.primary];
    const go = (i: number): boolean => {
      if (i === opt.companions.length) return true;
      for (const u of opt.companions[i].choices) {
        if (unitClashes(u, [...taken, ...chosen])) continue;
        chosen.push(...u);
        if (go(i + 1)) return true;
        chosen.splice(chosen.length - u.length, u.length);
      }
      return false;
    };
    if (go(0)) return chosen;
  }
  return null;
}
