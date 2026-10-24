#!/usr/bin/env python3
"""Scrape every BU course from bu.edu/academics into data/courses.json.

Phase 1 walks each college's paginated course list (code, title, prereq text).
Phase 2 fetches each course page for units, Hub areas and section schedules.
Fetched pages are cached in scripts/.cache so a rerun resumes where it stopped.

Usage: python3 scripts/scrape_bu_courses.py [--colleges cas,eng] [--workers 8]
"""
import argparse
import hashlib
import html
import json
import os
import re
import sys
import time
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://www.bu.edu/academics"
COLLEGES = [
    "cas", "eng", "com", "cfa", "cgs", "sar", "sha", "sph", "questrom",
    "wheelock", "cds", "khc", "met", "law", "sdm", "ssw", "sth", "gms", "hub",
]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
OUT = os.path.join(ROOT, "data", "courses.json")
UA = "Mozilla/5.0 (BU student hackathon project; course planner)"
OFFLINE = False  # --offline: only use cached pages
DELAY = 0.0  # seconds each worker waits between network requests (set by --delay)
_blocked_until = [0.0]
_lock = threading.Lock()

SCHOOLS = "CAS|ENG|COM|CFA|CGS|SAR|SHA|SPH|QST|SMG|SED|WED|CDS|KHC|MET|LAW|SDM|SSW|STH|GMS|HUB|MED|OTP|XAS|XRG"
# school is optional ("PY251" inherits the school of the code before it)
CODE_RE = re.compile(rf"\b(?:({SCHOOLS})\s?)?([A-Z]{{2}})\s?(\d{{3}})\b")
STANDING_RE = re.compile(r"\b(freshman|sophomore|junior|senior|graduate)\s+standing", re.I)
DAY_MAP = {"M": "Mon", "T": "Tue", "W": "Wed", "R": "Thu", "F": "Fri", "S": "Sat", "U": "Sun"}


def fetch(url, retries=3):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".html")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    if OFFLINE:
        return ""
    for attempt in range(retries):
        wait = _blocked_until[0] - time.time()
        if wait > 0:
            time.sleep(wait)
        time.sleep(DELAY)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read().decode("utf-8", errors="ignore")
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            return body
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                # rate limited: every worker pauses, then we retry
                with _lock:
                    _blocked_until[0] = max(_blocked_until[0], time.time() + 90 * (attempt + 1))
                print(f"  rate limited on {url}, pausing", file=sys.stderr)
            elif e.code == 404 or attempt == retries - 1:
                print(f"  ! {url}: {e}", file=sys.stderr)
                return ""
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                print(f"  ! {url}: {e}", file=sys.stderr)
                return ""
            time.sleep(2 * (attempt + 1))
    return ""


def text(s):
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def norm_code(college, dept, num):
    return f"{college.upper()} {dept.upper()} {num.upper()}"


# ---------- phase 1: listings ----------

FEED_ITEM_RE = re.compile(
    r'<li>\s*<a href="(/academics/[a-z]+/courses/([a-z]+)-([a-z]+)-(\d+[a-z]?)/)"><strong>(.*?)</strong></a><br\s*/?>(.*?)</li>',
    re.S,
)


def list_college(college):
    first = fetch(f"{BASE}/{college}/courses/")
    pages = [int(n) for n in re.findall(rf"academics/{college}/courses/(\d+)/", first)]
    last = max(pages) if pages else 1
    urls = [f"{BASE}/{college}/courses/"] + [f"{BASE}/{college}/courses/{n}/" for n in range(2, last + 1)]
    return urls


def parse_listing(body):
    out = []
    for href, col, dept, num, strong, rest in FEED_ITEM_RE.findall(body):
        title = text(strong).split(":", 1)[-1].strip()
        out.append({
            "code": norm_code(col, dept, num),
            "college": col.upper(),
            "dept": dept.upper(),
            "number": num.upper(),
            "title": title,
            "url": "https://www.bu.edu" + href,
            "summary": text(rest),
        })
    return out


# ---------- phase 2: course pages ----------

TERM_TABLE_RE = re.compile(r"<h4><strong>(.*?)</strong>\s*Schedule</h4>\s*<table>(.*?)</table>", re.S)
ROW_RE = re.compile(r"<tr>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*</tr>", re.S)
SCHED_RE = re.compile(r"^([MTWRFSU]+)\s+(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)$", re.I)


def to_minutes(t):
    m = re.match(r"(\d{1,2}):(\d{2})\s*([ap]m)", t.strip(), re.I)
    h, mi, ap = int(m.group(1)), int(m.group(2)), m.group(3).lower()
    if ap == "pm" and h != 12:
        h += 12
    if ap == "am" and h == 12:
        h = 0
    return h * 60 + mi


def parse_schedule(s):
    s = text(s)
    m = SCHED_RE.match(s)
    if not m:
        return {"raw": s, "days": [], "start": None, "end": None}
    return {
        "raw": s,
        "days": [DAY_MAP[d] for d in m.group(1).upper()],
        "start": to_minutes(m.group(2)),
        "end": to_minutes(m.group(3)),
    }


def parse_course_page(body):
    info = {}
    units = re.search(r"<dt>Units:</dt>\s*<dd>(.*?)</dd>", body, re.S)
    if units:
        info["units"] = text(units.group(1))
    info["hub"] = [text(h) for h in re.findall(r'<li class="cf-hub-area-[^"]*">(.*?)</li>', body, re.S)]
    desc = re.search(r'<div id="course-content">.*?</div>\s*<p>(.*?)</p>', body, re.S)
    if desc:
        info["fullText"] = text(desc.group(1))
    sections = []
    for term, table in TERM_TABLE_RE.findall(body):
        for sec, instr, loc, sched, notes in ROW_RE.findall(table):
            sections.append({
                "term": text(term).title(),
                "section": text(sec),
                "instructor": text(instr),
                "location": text(loc),
                "schedule": parse_schedule(sched),
                "notes": text(notes),
            })
    info["sections"] = sections
    return info


# ---------- requisites ----------

REQ_LABEL_RE = re.compile(
    r"(Undergraduate|Graduate)?\s*(Pre-?requisites?|Co-?requisites?)\s*:\s*",
    re.I,
)


def split_requisites(summary):
    """Split 'Undergraduate Prerequisites: X - description' into parts."""
    reqs = {"prereqText": "", "coreqText": "", "description": summary}
    labels = list(REQ_LABEL_RE.finditer(summary))
    if not labels:
        return reqs
    # description follows the first ' - ' after the last label
    tail_start = labels[-1].end()
    dash = summary.find(" - ", tail_start)
    end_of_reqs = dash if dash != -1 else len(summary)
    reqs["description"] = summary[end_of_reqs + 3:].strip() if dash != -1 else ""
    for i, m in enumerate(labels):
        seg_end = labels[i + 1].start() if i + 1 < len(labels) else end_of_reqs
        seg = summary[m.end():seg_end].strip(" ;.")
        is_grad = (m.group(1) or "").lower() == "graduate"
        key = "coreqText" if "co" in m.group(2).lower() else "prereqText"
        if is_grad:
            key = "grad" + key[0].upper() + key[1:]
        reqs[key] = (reqs.get(key, "") + " " + seg).strip()
    return reqs


def codes_in(s, default_school=None):
    out, school = [], default_school
    for sch, dept, num in CODE_RE.findall(s):
        school = sch or school
        if school:
            out.append(norm_code(school, dept, num))
    return out


def parse_req_expr(s, default_school=None):
    """Heuristic AND-of-ORs: [['CAS MA 123'], ['ENG EK 125', 'CAS CS 111']].

    Top level splits on ';' and ' and '; inside a group, ' or ' and '/' mean alternatives.
    """
    if not s:
        return []
    groups, school = [], default_school
    for part in re.split(r";|\band\b|&", s, flags=re.I):
        alts = codes_in(part, school)
        if alts:
            school = alts[-1].split()[0]
            groups.append(sorted(set(alts), key=alts.index))
    return groups


def split_recommended(s):
    m = re.search(r"\b(recommended|suggested)\b\s*:?", s, re.I)
    return (s[:m.start()], s[m.end():]) if m else (s, "")


# ---------- main ----------

PRIORITY_DEPTS = {("CAS", d) for d in ["MA", "PY", "WR", "CS", "CH", "BI", "AS", "EC", "PH", "PS", "HI"]} | {
    ("ENG", d) for d in ["EC", "EK", "BE", "ME"]} | {("CDS", "DS")}


def major_codes():
    codes = set()
    d = os.path.join(ROOT, "data", "majors")
    for f in os.listdir(d) if os.path.isdir(d) else []:
        m = json.load(open(os.path.join(d, f)))
        codes |= {s["code"] for t in m["plan"] for s in t["slots"] if s["kind"] == "course"}
        codes |= {c for g in m["electiveGroups"] for c in g["courses"]}
    return codes


def finish(courses):
    out = []
    for raw in courses.values():
        c = dict(raw)
        c.update(split_requisites(c.pop("summary")))
        full = c.pop("fullText", "")
        if not c["prereqText"] and full:
            c.update({k: v for k, v in split_requisites(full).items() if v})
        required, recommended = split_recommended(c["prereqText"])
        c["prereqs"] = parse_req_expr(required, c["college"])
        c["recommended"] = codes_in(recommended, c["college"])
        c["coreqs"] = parse_req_expr(c["coreqText"], c["college"])
        standing = STANDING_RE.search(c["prereqText"])
        c["minStanding"] = standing.group(1).lower() if standing else None
        try:
            c["level"] = int(re.match(r"\d+", c["number"]).group()) // 100 * 100
        except Exception:  # noqa: BLE001
            c["level"] = None
        c.setdefault("hub", [])
        c.setdefault("sections", [])
        out.append(c)
    out.sort(key=lambda c: c["code"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    with_sections = sum(1 for c in out if c["sections"])
    print(f"wrote {len(out)} courses ({with_sections} with sections) to {OUT}")


def main():
    global DELAY, OFFLINE
    ap = argparse.ArgumentParser()
    ap.add_argument("--colleges", default=",".join(COLLEGES))
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--skip-details", action="store_true")
    ap.add_argument("--offline", action="store_true", help="build from cached pages only")
    args = ap.parse_args()
    DELAY = args.delay
    OFFLINE = args.offline
    colleges = args.colleges.split(",")

    with ThreadPoolExecutor(args.workers) as pool:
        page_urls = []
        for urls in pool.map(list_college, colleges):
            page_urls += urls
        print(f"phase 1: {len(page_urls)} listing pages")
        courses = {}
        for i, body in enumerate(pool.map(fetch, page_urls)):
            for c in parse_listing(body):
                courses.setdefault(c["code"], c)
            if i % 50 == 0:
                print(f"  listings {i}/{len(page_urls)}  courses so far {len(courses)}")
        print(f"phase 1 done: {len(courses)} courses")
        finish(courses)

        if not args.skip_details:
            wanted = major_codes()
            items = sorted(courses.values(), key=lambda c: (
                c["code"] not in wanted,
                (c["college"], c["dept"]) not in PRIORITY_DEPTS,
                (int(re.match(r"\d+", c["number"]).group()) if re.match(r"\d+", c["number"]) else 999) >= 600,
                c["code"],
            ))
            futures = {pool.submit(fetch, c["url"]): c for c in items}
            for i, fut in enumerate(as_completed(futures)):
                futures[fut].update(parse_course_page(fut.result()))
                if i % 200 == 0:
                    print(f"  details {i}/{len(items)}")
                    finish(courses)
        finish(courses)


if __name__ == "__main__":
    main()
