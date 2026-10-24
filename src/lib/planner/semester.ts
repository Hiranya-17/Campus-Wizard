import { pickSections } from "@/lib/sections";
import type {
  Course,
  Major,
  PlannedCourse,
  Section,
  SemesterPlanRequest,
  SemesterPlanResponse,
} from "@/lib/types";

const STANDING_RANK = { freshman: 0, sophomore: 1, junior: 2, senior: 3, graduate: 4 } as const;

export function unitsOf(c: Course): number {
  const n = parseFloat(c.units ?? "");
  return Number.isFinite(n) && n > 0 ? n : 4;
}

/** Each AND-group needs at least one code in `have`. Returns the groups still missing. */
export function missingGroups(groups: string[][], have: Set<string>): string[][] {
  return groups.filter((alts) => !alts.some((code) => have.has(code)));
}

/** Terms that have any section data, newest first. */
function availableTerms(courses: Map<string, Course>): string[] {
  const seen = new Set<string>();
  for (const c of courses.values()) for (const s of c.sections) seen.add(s.term);
  const key = (t: string) => {
    const [season, year] = t.split(" ");
    return Number(year) * 10 + (season === "Spring" ? 1 : season === "Summer" ? 2 : 3);
  };
  return [...seen].sort((a, b) => key(b) - key(a));
}

type Candidate = { code: string; reason: string; termIndex: number; group?: string; hub?: boolean };

export function planSemester(
  req: SemesterPlanRequest,
  major: Major,
  courses: Map<string, Course>,
): SemesterPlanResponse {
  const maxUnits = req.maxUnits ?? 18;
  const completed = new Set(req.completed.map((c) => c.toUpperCase().replace(/\s+/g, " ").trim()));
  const warnings: string[] = [];

  // Which term's sections do we schedule against?
  const terms = availableTerms(courses);
  let scheduleTerm = req.term;
  if (!terms.includes(req.term)) {
    scheduleTerm = terms[0] ?? req.term;
    warnings.push(`${req.term} times aren't published yet, so times shown are from ${scheduleTerm}.`);
  }
  const offered = (c: Course) => c.sections.filter((s) => s.term === scheduleTerm);

  // Credit completed courses toward elective groups (each course counts once).
  const groupLeft = new Map(major.electiveGroups.map((g) => [g.id, g.count]));
  const used = new Set<string>();
  for (const slot of major.plan.flatMap((t) => t.slots)) {
    if (slot.kind === "course" && completed.has(slot.code)) used.add(slot.code);
  }
  for (const g of major.electiveGroups) {
    for (const code of g.courses) {
      if ((groupLeft.get(g.id) ?? 0) > 0 && completed.has(code) && !used.has(code)) {
        used.add(code);
        groupLeft.set(g.id, groupLeft.get(g.id)! - 1);
      }
    }
  }

  // Hub areas still needed (Global Citizenship counts twice).
  const hubLeft = [...major.hubRequired];
  for (const code of completed) {
    for (const area of courses.get(code)?.hub ?? []) {
      const i = hubLeft.findIndex((h) => h.toLowerCase() === area.toLowerCase());
      if (i >= 0) hubLeft.splice(i, 1);
    }
  }

  // Remaining slots in sheet order become candidates.
  const candidates: Candidate[] = [];
  let hubSlots = 0;
  const groupSlotsSeen = new Map<string, number>();
  major.plan.forEach((term, termIndex) => {
    for (const slot of term.slots) {
      if (slot.kind === "course") {
        if (!completed.has(slot.code)) candidates.push({ code: slot.code, termIndex, reason: `${term.term} on the ${major.name} sheet` });
      } else if (slot.kind === "elective") {
        const seen = (groupSlotsSeen.get(slot.group) ?? 0) + 1;
        groupSlotsSeen.set(slot.group, seen);
        const g = major.electiveGroups.find((x) => x.id === slot.group)!;
        if (seen > g.count - (groupLeft.get(g.id) ?? 0)) {
          candidates.push({ code: "", group: g.id, termIndex, reason: `${g.name} (${term.term} on the sheet)` });
        }
      } else if (hubSlots++ < Math.ceil(hubLeft.length / 2)) {
        candidates.push({ code: "", hub: true, termIndex, reason: `Hub elective (${term.term} on the sheet)` });
      }
    }
  });
  // The sheet term this request lines up with (Sophomore 2 = index 3).
  const target = Math.min(STANDING_RANK[req.standing], 3) * 2 + (req.term.startsWith("Spring") ? 1 : 0);

  const standing = STANDING_RANK[req.standing];
  const chosen: PlannedCourse[] = [];
  const chosenCodes = new Set<string>();
  const blocked: SemesterPlanResponse["blocked"] = [];
  let total = 0;

  const eligible = (c: Course): { ok: boolean; missing: string[] } => {
    const missing = missingGroups(c.prereqs, completed).map((alts) => alts.join(" or "));
    if (c.minStanding && STANDING_RANK[c.minStanding] > standing) missing.push(`${c.minStanding} standing`);
    return { ok: missing.length === 0, missing };
  };

  const tryAdd = (c: Course, reason: string): boolean => {
    if (chosenCodes.has(c.code) || completed.has(c.code)) return false;
    const units = unitsOf(c);
    if (total + units > maxUnits) return false;
    const secs = offered(c);
    // No times for any term means BU hasn't posted them; keep the course and say so.
    if (secs.length === 0 && c.sections.length > 0) return false;
    const picked = secs.length ? pickSections(secs, chosen.flatMap((p) => p.sections)) : [];
    if (!picked) return false;
    chosen.push({ code: c.code, title: c.title, units, reason: picked.length ? reason : `${reason} (times not posted yet)`, sections: picked });
    chosenCodes.add(c.code);
    total += units;
    return true;
  };

  // This year's slots first, then look up to a year ahead if there's room.
  const ordered = [
    ...candidates.filter((c) => c.termIndex <= target),
    ...candidates.filter((c) => c.termIndex > target && c.termIndex <= target + 2),
  ];
  for (const cand of ordered) {
    if (total >= maxUnits - 1) break;
    if (cand.code) {
      const c = courses.get(cand.code);
      if (!c) continue;
      const { ok, missing } = eligible(c);
      if (!ok) {
        blocked.push({ code: c.code, title: c.title, missing });
        continue;
      }
      if (!tryAdd(c, cand.reason) && offered(c).length === 0 && c.sections.length > 0) {
        blocked.push({ code: c.code, title: c.title, missing: [`not offered ${req.term}`] });
      }
    } else if (cand.group) {
      const g = major.electiveGroups.find((x) => x.id === cand.group)!;
      for (const code of g.courses) {
        const c = courses.get(code);
        if (c && !used.has(code) && eligible(c).ok && tryAdd(c, cand.reason)) {
          used.add(code);
          break;
        }
      }
    } else if (cand.hub && hubLeft.length) {
      const pick = bestHubCourse(courses, hubLeft, chosenCodes, completed, offered);
      if (pick && tryAdd(pick, `${cand.reason}: covers ${pick.hub.filter((h) => hubLeft.includes(h)).join(", ")}`)) {
        for (const area of pick.hub) {
          const i = hubLeft.indexOf(area);
          if (i >= 0) hubLeft.splice(i, 1);
        }
      }
    }
  }

  // Corequisites must be done already or taken together.
  const have = new Set([...completed, ...chosenCodes]);
  for (const p of chosen) {
    const c = courses.get(p.code)!;
    const miss = missingGroups(c.coreqs, have);
    if (miss.length) warnings.push(`${p.code} needs ${miss.map((m) => m.join(" or ")).join(" and ")} at the same time or before.`);
  }

  return { term: req.term, courses: chosen, totalUnits: total, blocked: blocked.slice(0, 6), warnings };
}

function bestHubCourse(
  courses: Map<string, Course>,
  hubLeft: string[],
  chosen: Set<string>,
  completed: Set<string>,
  offered: (c: Course) => Section[],
): Course | null {
  let best: Course | null = null;
  let bestScore = 0;
  for (const c of courses.values()) {
    if (chosen.has(c.code) || completed.has(c.code)) continue;
    if ((c.level ?? 999) > 200 || c.prereqs.length || c.minStanding) continue;
    const score = new Set(c.hub.filter((h) => hubLeft.includes(h))).size;
    if (score > bestScore && offered(c).length) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
