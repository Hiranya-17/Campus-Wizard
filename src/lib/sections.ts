import type { Section } from "@/lib/types";

/**
 * How BU sections fit together:
 * - WR 153: every section (E1, F1, K1…) is a full class; pick one.
 * - MA 226: A1 is a lecture and A2–A6 are its discussions; pick A1 plus one of A2–A6 (or B1 plus one of B2–B5).
 * - EC 311: A1 is the lecture and C1–C5 are labs; pick A1 plus any one C section.
 * - CS 111: a section can meet at two different times (A1 = MWF 10:10 and W 6:30 pm); those rows share an id
 *   and always go together, so a "unit" below is every row with the same section id.
 * Long meetings are "primary" (lecture or standalone section); short ones are discussions/labs.
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
  const isPrimary = (u: Unit) => max === 0 || unitMinutes(u) >= 0.75 * max;
  const primaries = all.filter(isPrimary);
  const companions = all.filter((u) => !isPrimary(u));
  const primaryLetters = new Set(primaries.map(letter));

  const label = (group: Unit[]) => {
    const perMeeting = group.flat().reduce((m, s) => m + minutes(s) / Math.max(1, s.schedule.days.length), 0) / group.flat().length;
    return perMeeting >= 100 ? "Lab" : "Discussion";
  };

  // Companions whose letter has no lecture are shared by every lecture (EC 311's C labs).
  const shared = new Map<string, Unit[]>();
  for (const c of companions) {
    if (!primaryLetters.has(letter(c))) shared.set(letter(c), [...(shared.get(letter(c)) ?? []), c]);
  }

  return primaries.map((primary) => {
    const own = companions.filter((c) => letter(c) === letter(primary));
    const groups: CompanionGroup[] = [];
    if (own.length) groups.push({ label: label(own), choices: own });
    for (const g of shared.values()) groups.push({ label: label(g), choices: g });
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
