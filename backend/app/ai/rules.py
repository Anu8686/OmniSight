"""Deterministic, rule-based visual QA checks over the DOM/layout evidence.

These are real geometric measurements, not simulated AI output. They are always run, and
they are the only analysis in demo mode (no VLM key configured).
"""
from __future__ import annotations

import re
from collections import Counter

from app.ai.schemas import BoundingBox, DetectedFinding, Evidence, SuggestedFix

CSS_FILE = "styles.css"


# ---------------------------------------------------------------- helpers
def boost_selector(selector: str) -> str:
    """Raise specificity of the last compound selector by repeating its first class twice."""
    last_start = max(selector.rfind(" "), selector.rfind(">"), selector.rfind("+"), selector.rfind("~")) + 1
    head, last = selector[:last_start], selector[last_start:]
    m = re.search(r"\.([A-Za-z_][\w-]*)", last)
    if not m:
        return selector
    cls = m.group(0)
    return head + last[: m.end()] + cls + cls + last[m.end():]


def _label(el: dict) -> str:
    text = (el.get("text") or "").strip()
    if el["tag"] == "button" or "btn" in el["cls"].split() or "btn" in " ".join(c.split("-")[0] for c in el["cls"].split()):
        kind = "Button"
    elif el["tag"] == "a":
        kind = "Link"
    elif el.get("isInput"):
        kind = "Input"
    else:
        kind = "Text"
    if text:
        return f"{kind} '{text[:40]}'"
    first_cls = el["cls"].split()[0] if el["cls"] else ""
    return f"<{el['tag']}{'.' + first_cls if first_cls else ''}>" if kind == "Text" else f"{kind} {el['selector']}"


def _parse_color(c: str) -> tuple[float, float, float, float] | None:
    m = re.match(r"rgba?\(([^)]+)\)", c or "")
    if not m:
        return None
    parts = [p.strip() for p in m.group(1).replace("/", ",").replace(" ", ",").split(",") if p.strip()]
    try:
        r, g, b = (float(x) for x in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return r, g, b, a
    except ValueError:
        return None


def _lum(rgb: tuple[float, float, float]) -> float:
    def ch(v: float) -> float:
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast_ratio(fg: tuple[float, float, float], bg: tuple[float, float, float]) -> float:
    l1, l2 = _lum(fg), _lum(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def _blend(fg: tuple[float, float, float, float], bg: tuple[float, float, float]) -> tuple[float, float, float]:
    a = fg[3]
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3))  # type: ignore[return-value]


def _ancestors(els: list[dict], el: dict) -> list[dict]:
    out, pid = [], el["parent"]
    while pid is not None and pid >= 0:
        p = els[pid]
        out.append(p)
        pid = p["parent"]
    return out


def _bbox(el: dict) -> BoundingBox:
    r = el["rect"]
    return BoundingBox(x=round(r["x"], 1), y=round(r["y"], 1), width=round(r["w"], 1), height=round(r["h"], 1))


def _media_for(viewport: str) -> str | None:
    return {"mobile": "@media (max-width: 480px)", "tablet": "@media (max-width: 900px)"}.get(viewport)


# ---------------------------------------------------------------- rules
def _overflow(dom: dict, vp: str) -> list[DetectedFinding]:
    els, vw = dom["elements"], dom["vw"]
    culprits: dict[int, dict] = {}
    for e in els:
        r = e["rect"]
        if e["tag"] in ("html", "body"):
            continue
        if r["x"] + r["w"] > vw + 1 or r["x"] < -1:
            # Ignore content inside an intentionally scrollable/clipped container that itself fits.
            anc = _ancestors(els, e)
            if any(a["overflowX"] in ("hidden", "auto", "scroll", "clip") and a["rect"]["x"] + a["rect"]["w"] <= vw + 1 for a in anc):
                continue
            culprits[e["id"]] = e
    out: list[DetectedFinding] = []
    for e in culprits.values():
        if e["parent"] in culprits:  # report only the outermost offending element
            continue
        r = e["rect"]
        has_interactive = e["interactive"] or any(
            c["interactive"] for c in els if c["parent"] == e["id"]
        )
        sev = "critical" if has_interactive else ("high" if e["text"] else "medium")
        overshoot = round(r["x"] + r["w"] - vw)
        fix = None
        media = _media_for(vp)
        sel = boost_selector(e["selector"])
        if overshoot > 0:
            body = f"{sel} {{ max-width: 100%; box-sizing: border-box; }}"
            fix = SuggestedFix(
                file=CSS_FILE,
                explanation=f"Constrain the element to its container so it no longer extends {overshoot}px past the {vp} viewport.",
                code=f"{media} {{ {body} }}" if media else body,
            )
        out.append(
            DetectedFinding(
                title=f"{_label(e)} extends beyond the viewport on {vp}",
                category="responsive-layout",
                severity=sev,
                description=(
                    f"The element's right edge is at {round(r['x'] + r['w'])}px but the {vp} viewport is only {vw}px wide, "
                    f"so it is clipped or forces horizontal scrolling."
                ),
                viewport=vp,
                confidence=0.95,
                evidence=Evidence(element_selector=e["selector"], bounding_box=_bbox(e)),
                suggested_fix=fix,
                reasoning="Measured with getBoundingClientRect: element right edge exceeds the layout viewport width.",
                rule_id="viewport-overflow",
                issue_key=f"viewport-overflow:{e['selector']}",
            )
        )
    if not out and dom["scrollWidth"] > vw + 1:
        out.append(
            DetectedFinding(
                title=f"Page scrolls horizontally on {vp}",
                category="responsive-layout",
                severity="medium",
                description=f"Document width is {dom['scrollWidth']}px but the viewport is {vw}px. The offending element could not be isolated automatically.",
                viewport=vp,
                confidence=0.8,
                evidence=Evidence(element_selector="html", bounding_box=BoundingBox(x=0, y=0, width=dom["scrollWidth"], height=min(dom["scrollHeight"], 900))),
                reasoning="scrollWidth exceeds clientWidth; manual investigation recommended.",
                rule_id="page-hscroll",
                issue_key="page-hscroll:html",
            )
        )
    return out


def _overlaps(dom: dict, vp: str) -> tuple[list[DetectedFinding], set[tuple[int, int]]]:
    els = dom["elements"]
    cand = [
        e for e in els
        if e["tag"] not in ("html", "body") and (e["text"] or e["interactive"] or e["isInput"]) and e["position"] != "fixed"
    ]
    anc_ids = {e["id"]: {a["id"] for a in _ancestors(els, e)} for e in cand}
    pairs: dict[tuple[int, int], tuple[float, float]] = {}
    for i, a in enumerate(cand):
        ra = a["rect"]
        for b in cand[i + 1:]:
            if a["id"] in anc_ids[b["id"]] or b["id"] in anc_ids[a["id"]]:
                continue
            rb = b["rect"]
            iw = min(ra["x"] + ra["w"], rb["x"] + rb["w"]) - max(ra["x"], rb["x"])
            ih = min(ra["y"] + ra["h"], rb["y"] + rb["h"]) - max(ra["y"], rb["y"])
            if iw < 4 or ih < 4:
                continue
            smaller = min(ra["w"] * ra["h"], rb["w"] * rb["h"])
            if smaller > 0 and (iw * ih) / smaller >= 0.25:
                pairs[(a["id"], b["id"])] = (iw, ih)
    out: list[DetectedFinding] = []
    used: set[int] = set()
    for (ai, bi), (iw, ih) in sorted(pairs.items(), key=lambda kv: -kv[1][0] * kv[1][1]):
        if ai in used or bi in used:
            continue
        used.update((ai, bi))
        a, b = els[ai], els[bi]
        positioned = [x for x in (a, b) if x["position"] in ("absolute", "fixed")]
        culprit = positioned[0] if positioned else b
        other = a if culprit is b else b
        fix = None
        sel = boost_selector(culprit["selector"])
        if positioned:
            inline = culprit["tag"] in {"span", "em", "small", "strong", "label", "a", "i", "b"}
            decl = "position: static; margin-top: 6px;" + (" display: block;" if inline else "")
            fix = SuggestedFix(
                file=CSS_FILE,
                explanation="Return the absolutely positioned element to normal flow so it no longer sits on top of its neighbour.",
                code=f"{sel} {{ {decl} }}",
            )
        else:
            fix = SuggestedFix(
                file=CSS_FILE,
                explanation="Add spacing so the elements no longer share the same area (heuristic: verify visually).",
                code=f"{sel} {{ margin-top: {int(ih) + 6}px; }}",
            )
        key = "|".join(sorted([culprit["selector"], other["selector"]]))
        out.append(
            DetectedFinding(
                title=f"{_label(culprit)} overlaps {_label(other)}",
                category="overlap",
                severity="high" if (a["interactive"] or b["interactive"] or a["isInput"] or b["isInput"]) else "medium",
                description=f"The two elements share a {int(iw)}x{int(ih)}px area on {vp}, so text or controls are drawn on top of each other.",
                viewport=vp,
                confidence=0.85 if positioned else 0.7,
                evidence=Evidence(element_selector=culprit["selector"], bounding_box=_bbox(culprit)),
                suggested_fix=fix,
                reasoning="Bounding boxes of two non-nested visible elements intersect by at least 25% of the smaller element.",
                rule_id="overlap",
                issue_key=f"overlap:{key}",
            )
        )
    return out, set(pairs)


def _misaligned(dom: dict, vp: str) -> list[DetectedFinding]:
    els = dom["elements"]
    groups: dict[tuple, list[dict]] = {}
    for e in els:
        if e["cls"] and e["tag"] not in ("html", "body", "li"):
            groups.setdefault((e["parent"], e["tag"], e["cls"]), []).append(e)
    out: list[DetectedFinding] = []
    for sibs in groups.values():
        if len(sibs) < 2:
            continue
        rows: list[list[dict]] = []
        for e in sorted(sibs, key=lambda x: x["rect"]["y"]):
            for row in rows:
                ref = row[0]["rect"]
                overlap = min(ref["y"] + ref["h"], e["rect"]["y"] + e["rect"]["h"]) - max(ref["y"], e["rect"]["y"])
                if overlap >= 0.5 * min(ref["h"], e["rect"]["h"]):
                    row.append(e)
                    break
            else:
                rows.append([e])
        for row in rows:
            if len(row) < 2:
                continue
            tops = [round(e["rect"]["y"]) for e in row]
            (mode_top, mode_n), = Counter(round(t / 3) * 3 for t in tops).most_common(1)
            if mode_n >= 2:
                ref_top = mode_top
                outliers = [e for e in row if abs(e["rect"]["y"] - ref_top) > 3]
                conf = 0.85
            else:
                ref_top = min(tops)
                outliers = [max(row, key=lambda e: e["rect"]["y"])]
                conf = 0.7
            ref_el = min(row, key=lambda e: abs(e["rect"]["y"] - ref_top))
            for e in outliers:
                d = e["rect"]["y"] - ref_el["rect"]["y"]
                if not (4 <= abs(d) <= 80):
                    continue
                same_h = abs(e["rect"]["h"] - ref_el["rect"]["h"]) <= 3
                same_bottom = abs((e["rect"]["y"] + e["rect"]["h"]) - (ref_el["rect"]["y"] + ref_el["rect"]["h"])) <= 3
                if not (same_h or same_bottom):
                    continue
                fix = None
                sel = boost_selector(e["selector"])
                if e["marginTop"] > 0 and abs(e["marginTop"] - abs(d)) <= 2:
                    fix = SuggestedFix(file=CSS_FILE, explanation=f"Remove the {round(e['marginTop'])}px top margin that pushes this item out of line with its row.", code=f"{sel} {{ margin-top: 0; }}")
                elif e["position"] == "relative" and e["top"] not in ("auto", "0px"):
                    fix = SuggestedFix(file=CSS_FILE, explanation="Reset the relative offset that shifts this item.", code=f"{sel} {{ top: 0; }}")
                elif e["transform"] not in ("none", ""):
                    fix = SuggestedFix(file=CSS_FILE, explanation="Remove the transform that shifts this item.", code=f"{sel} {{ transform: none; }}")
                out.append(
                    DetectedFinding(
                        title=f"{_label(e)} is misaligned with its row by {abs(round(d))}px",
                        category="alignment",
                        severity="medium",
                        description=f"Items with the same style in this row start at y={round(ref_el['rect']['y'])}px, but this one starts at y={round(e['rect']['y'])}px on {vp}.",
                        viewport=vp,
                        confidence=conf,
                        evidence=Evidence(element_selector=e["selector"], bounding_box=_bbox(e)),
                        suggested_fix=fix,
                        reasoning="Sibling elements sharing a tag and class sit in the same row but their top edges differ.",
                        rule_id="misaligned-siblings",
                        issue_key=f"misaligned-siblings:{e['selector']}",
                    )
                )
    return out


def _nav_wrap(dom: dict, vp: str) -> list[DetectedFinding]:
    if dom["vw"] < 768:
        return []
    els = dom["elements"]
    out: list[DetectedFinding] = []
    for p in els:
        if p["flexWrap"] not in ("wrap", "wrap-reverse") or p["display"] not in ("flex", "inline-flex"):
            continue
        in_nav = p["tag"] == "nav" or "nav" in p["cls"] or "menu" in p["cls"] or any(
            a["tag"] in ("nav", "header") for a in _ancestors(els, p)
        )
        if not in_nav:
            continue
        kids = [c for c in els if c["parent"] == p["id"]]
        if len(kids) < 3:
            continue
        rows: list[list[dict]] = []
        for k in sorted(kids, key=lambda k: k["rect"]["y"]):
            for row in rows:
                top = max(c["rect"]["y"] for c in row)
                bottom = min(c["rect"]["y"] + c["rect"]["h"] for c in row)
                ov = min(bottom, k["rect"]["y"] + k["rect"]["h"]) - max(top, k["rect"]["y"])
                if ov >= 0.3 * min(k["rect"]["h"], min(c["rect"]["h"] for c in row)):
                    row.append(k)
                    break
            else:
                rows.append([k])
        if len(rows) < 2:
            continue
        sel = boost_selector(p["selector"])
        out.append(
            DetectedFinding(
                title=f"Navigation items wrap onto {len(rows)} rows",
                category="navigation",
                severity="medium",
                description=f"The {len(kids)} navigation items are split across {len(rows)} rows on {vp} ({dom['vw']}px wide) although there is room for a single row.",
                viewport=vp,
                confidence=0.8,
                evidence=Evidence(element_selector=p["selector"], bounding_box=_bbox(p)),
                suggested_fix=SuggestedFix(
                    file=CSS_FILE,
                    explanation="Keep navigation items on one row on wider screens by disabling wrapping and removing the width cap.",
                    code=f"@media (min-width: 768px) {{ {sel} {{ flex-wrap: nowrap; max-width: none; }} }}",
                ),
                reasoning="A flex-wrap container inside the site navigation lays its children out on more than one row at a tablet/desktop width.",
                rule_id="nav-wrap",
                issue_key=f"nav-wrap:{p['selector']}",
            )
        )
    return out


def _contrast(dom: dict, vp: str) -> list[DetectedFinding]:
    els = dom["elements"]
    page_bg = _parse_color(dom.get("pageBg", "")) or (255, 255, 255, 1.0)
    cache: dict[int, tuple[float, float, float] | None] = {}

    def effective_bg(e: dict) -> tuple[float, float, float] | None:
        if e["id"] in cache:
            return cache[e["id"]]
        res: tuple[float, float, float] | None
        if e["bgImage"] not in ("none", ""):
            res = None  # cannot evaluate over images/gradients
        else:
            parent = effective_bg(els[e["parent"]]) if e["parent"] >= 0 else tuple(page_bg[:3])
            c = _parse_color(e["bgColor"])
            if parent is None:
                res = None
            elif c is None or c[3] == 0:
                res = parent
            else:
                res = _blend(c, parent) if c[3] < 1 else (c[0], c[1], c[2])
        cache[e["id"]] = res
        return res

    out: list[DetectedFinding] = []
    for e in els:
        if len(e["text"]) < 2:
            continue
        fg = _parse_color(e["color"])
        bg = effective_bg(e)
        if fg is None or bg is None:
            continue
        fg_rgb = _blend(fg, bg) if fg[3] < 1 else (fg[0], fg[1], fg[2])
        ratio = contrast_ratio(fg_rgb, bg)
        large = e["fontSize"] >= 24 or (e["fontSize"] >= 18.66 and str(e["fontWeight"]) in ("700", "bold", "800", "900"))
        need = 3.0 if large else 4.5
        if ratio >= need:
            continue
        dark_text = _lum(bg) > 0.4
        out.append(
            DetectedFinding(
                title=f"Low text contrast ({ratio:.1f}:1) on {_label(e)}",
                category="contrast",
                severity="high" if ratio < 3 else "medium",
                description=f"Text colour has a contrast ratio of {ratio:.2f}:1 against its background; WCAG AA requires {need}:1 for this text size.",
                viewport=vp,
                confidence=0.8,
                evidence=Evidence(element_selector=e["selector"], bounding_box=_bbox(e)),
                suggested_fix=SuggestedFix(
                    file=CSS_FILE,
                    explanation="Use a text colour with sufficient contrast against the background (confirm against your brand palette).",
                    code=f"{boost_selector(e['selector'])} {{ color: {'#111827' if dark_text else '#ffffff'}; }}",
                ),
                reasoning="WCAG relative-luminance contrast computed from computed text and effective background colours.",
                rule_id="low-contrast",
                issue_key=f"low-contrast:{e['selector']}",
            )
        )
    return out


def _obscured(dom: dict, vp: str, overlap_pairs: set[tuple[int, int]]) -> list[DetectedFinding]:
    els = dom["elements"]
    out: list[DetectedFinding] = []
    for e in els:
        by = e.get("obscuredBy")
        if by is None:
            continue
        if by >= 0 and ((e["id"], by) in overlap_pairs or (by, e["id"]) in overlap_pairs):
            continue  # already reported as an overlap
        out.append(
            DetectedFinding(
                title=f"{_label(e)} is covered by another element",
                category="obscured-element",
                severity="high",
                description=f"At its centre point the element is covered by `{e.get('obscuredBySelector', 'another element')}` on {vp}, so users may be unable to click it.",
                viewport=vp,
                confidence=0.6,
                evidence=Evidence(element_selector=e["selector"], bounding_box=_bbox(e)),
                reasoning="document.elementFromPoint at the element's centre returned a non-related element.",
                rule_id="obscured-interactive",
                issue_key=f"obscured:{e['selector']}",
            )
        )
    return out


def run_rules(dom: dict, viewport: str) -> list[DetectedFinding]:
    findings: list[DetectedFinding] = []
    findings += _overflow(dom, viewport)
    overlaps, pairs = _overlaps(dom, viewport)
    findings += overlaps
    findings += _misaligned(dom, viewport)
    findings += _nav_wrap(dom, viewport)
    findings += _contrast(dom, viewport)
    findings += _obscured(dom, viewport, pairs)
    return findings
