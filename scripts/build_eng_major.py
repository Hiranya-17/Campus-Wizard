#!/usr/bin/env python3
"""Turn an ENG Bulletin page's "Required Courses (typical sequence)" into data/majors/<id>.json.

Usage: python3 scripts/build_eng_major.py ee "Electrical Engineering" https://www.bu.edu/academics/eng/programs/electrical-engineering/bs/
Named electives without a course list on the page get an empty group, which the planner skips.
"""
import html
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HUB = [
    "Philosophical Inquiry and Life's Meanings", "Aesthetic Exploration", "Historical Consciousness",
    "Social Inquiry", "The Individual in Community", "Global Citizenship and Intercultural Literacy",
    "Global Citizenship and Intercultural Literacy", "Ethical Reasoning",
]
KNOWN_GROUPS = {
    "natural science elective": ["CAS AS 202", "CAS BI 107", "CAS BI 108", "CAS CH 101", "CAS CH 131", "CAS PY 313"],
}
# pages say "Freshman" or "First Year", "Sophomore" or "Sophomore Year", ...
YEAR_LABEL = {"freshman": "First-year", "first year": "First-year", "sophomore": "Sophomore",
              "sophomore year": "Sophomore", "junior": "Junior", "junior year": "Junior",
              "senior": "Senior", "senior year": "Senior"}
CODE = re.compile(r"^(CAS|ENG|CDS|QST|COM|CFA|SAR)\s+([A-Z]{2})\s+(\d{3})\b")


def page_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    s = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    s = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", s))
    return [l.strip() for l in t.split("\n") if l.strip()]


def slug(name):
    return re.sub(r"[^a-z0-9]+", "", name.lower().replace("elective", ""))[:20] or "elective"


def build(major_id, name, url):
    lines = page_text(url)
    start = next(i for i, l in enumerate(lines) if l.startswith("Required Courses"))
    plan, groups, notes = [], {}, []
    year, term = None, None
    total = re.search(r"total of (\d+) units", " ".join(lines))
    for l in lines[start + 1:]:
        if l.startswith("Related Bulletin"):
            break
        if l.lower() in YEAR_LABEL:
            year = YEAR_LABEL[l.lower()]
            continue
        m = re.match(r"(First|Second) Term", l)
        if m and year:
            term = {"term": f"{year} {1 if m.group(1) == 'First' else 2}", "slots": []}
            plan.append(term)
            continue
        if not term:
            continue
        code = CODE.match(l)
        wr = re.match(r"CAS WR 15\d", l)
        if wr:
            groups.setdefault("wr15x", {"id": "wr15x", "name": "Writing & Research Seminar (WR 15x)", "count": 0,
                                        "courses": ["CAS WR 150", "CAS WR 151", "CAS WR 152", "CAS WR 153"]})
            groups["wr15x"]["count"] += 1
            term["slots"].append({"kind": "elective", "group": "wr15x"})
        elif code:
            term["slots"].append({"kind": "course", "code": " ".join(code.groups())})
        elif re.match(r"hub elective", l, re.I):
            term["slots"].append({"kind": "hub"})
        elif re.search(r"elective", l, re.I):
            label = re.sub(r"\s*\(.*\)$", "", l).strip()
            gid = slug(label)
            g = groups.setdefault(gid, {"id": gid, "name": label.title(), "count": 0,
                                        "courses": KNOWN_GROUPS.get(label.lower(), [])})
            if not g["courses"]:
                g["rule"] = "See your department's approved list."
            g["count"] += 1
            term["slots"].append({"kind": "elective", "group": gid})
    major = {
        "id": major_id, "name": name, "school": "ENG", "classOf": "2029",
        "totalUnits": int(total.group(1)) if total else 128,
        "plan": plan, "electiveGroups": list(groups.values()), "hubRequired": HUB,
        "notes": [f"Typical sequence from the BU Bulletin: {url}"],
    }
    out = os.path.join(ROOT, "data", "majors", f"{major_id}.json")
    with open(out, "w") as f:
        json.dump(major, f, indent=2)
    print(f"{out}: {len(plan)} terms, {sum(len(t['slots']) for t in plan)} slots, groups {[g['id'] for g in groups.values()]}")


if __name__ == "__main__":
    build(*sys.argv[1:4])
