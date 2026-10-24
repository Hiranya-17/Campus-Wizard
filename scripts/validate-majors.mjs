#!/usr/bin/env node
// Validate data/majors/*.json against the Major contract.
//
// ERRORS (exit 1) are problems internal to the major file, which the author can
// always fix:
//   - a {kind:"elective"} slot whose group is not a defined electiveGroups id
//   - an unknown slot kind, or a missing plan/electiveGroups array
//
// WARNINGS (exit 0) are references to course codes absent from data/courses.json:
//   - {kind:"course"} slot codes and electiveGroups[].courses entries
// These are warnings, not errors, because the scraped course set is known to be
// incomplete (e.g. some CAS CH/PY codes and grad/cross-list codes aren't in it),
// so a missing code usually means a data gap, not a broken major sheet.
//
// Usage:
//   node scripts/validate-majors.mjs            # all majors
//   node scripts/validate-majors.mjs a.json b   # only the given files
//
// Exits 1 only when a hard error is found; warnings alone exit 0.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const coursesPath = join(root, "data", "courses.json");
const majorsDir = join(root, "data", "majors");

function loadCourseCodes() {
  if (!existsSync(coursesPath)) {
    console.error(`error: ${coursesPath} not found; cannot verify course codes.`);
    process.exit(1);
  }
  const courses = JSON.parse(readFileSync(coursesPath, "utf8"));
  return new Set(courses.map((c) => c.code));
}

/** Returns { errors, warnings }, each an array of { where, message }. */
function validateMajor(major, codes) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(major.plan)) errors.push({ where: "plan", message: "missing or not an array" });
  if (!Array.isArray(major.electiveGroups))
    errors.push({ where: "electiveGroups", message: "missing or not an array" });
  if (errors.length) return { errors, warnings };

  const groupIds = new Set(major.electiveGroups.map((g) => g.id));

  major.plan.forEach((term, ti) => {
    (term.slots ?? []).forEach((slot, si) => {
      const at = `plan[${ti}] "${term.term ?? ti}" slot[${si}]`;
      if (slot.kind === "course") {
        if (!codes.has(slot.code)) warnings.push({ where: at, message: `course code "${slot.code}" not in courses.json` });
      } else if (slot.kind === "elective") {
        if (!groupIds.has(slot.group))
          errors.push({ where: at, message: `elective group "${slot.group}" is not a defined electiveGroups id` });
      } else if (slot.kind !== "hub") {
        errors.push({ where: at, message: `unknown slot kind "${slot.kind}"` });
      }
    });
  });

  major.electiveGroups.forEach((g, gi) => {
    (g.courses ?? []).forEach((code) => {
      if (!codes.has(code))
        warnings.push({ where: `electiveGroups[${gi}] "${g.id}"`, message: `course code "${code}" not in courses.json` });
    });
  });

  return { errors, warnings };
}

function resolveTargets(args) {
  if (args.length) return args;
  if (!existsSync(majorsDir)) {
    console.error(`error: ${majorsDir} not found.`);
    process.exit(1);
  }
  return readdirSync(majorsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(majorsDir, f));
}

function main() {
  const codes = loadCourseCodes();
  const targets = resolveTargets(process.argv.slice(2));
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of targets) {
    const path = existsSync(file) ? file : join(majorsDir, file);
    if (!existsSync(path)) {
      console.error(`✗ ${file}: file not found`);
      totalErrors++;
      continue;
    }
    let major;
    try {
      major = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      console.error(`✗ ${path}: invalid JSON (${e.message})`);
      totalErrors++;
      continue;
    }
    const { errors, warnings } = validateMajor(major, codes);
    for (const w of warnings) console.warn(`⚠ ${path}: ${w.where}: ${w.message}`);
    for (const e of errors) console.error(`✗ ${path}: ${e.where}: ${e.message}`);
    if (errors.length === 0 && warnings.length === 0) console.log(`✓ ${path}`);
    totalErrors += errors.length;
    totalWarnings += warnings.length;
  }

  const summary = `\n${totalErrors} error(s), ${totalWarnings} warning(s) across ${targets.length} file(s).`;
  if (totalErrors > 0) {
    console.error(summary);
    process.exit(1);
  }
  console.log(summary);
}

main();
