"""Conservative validation for AI/rule-generated CSS before it is written anywhere.

Only plain rule blocks (optionally inside @media) with a small allow-list of properties
are accepted. No @import, url(), expression(), behaviours, HTML or script content.
"""
from __future__ import annotations

import re

ALLOWED_PROPERTIES = {
    "width", "max-width", "min-width", "height", "max-height", "min-height", "box-sizing",
    "margin", "margin-top", "margin-bottom", "margin-left", "margin-right",
    "padding", "padding-top", "padding-bottom", "padding-left", "padding-right",
    "position", "top", "left", "right", "bottom", "transform", "z-index",
    "display", "flex-wrap", "flex-direction", "flex", "flex-shrink", "flex-grow", "gap", "row-gap", "column-gap",
    "align-self", "align-items", "justify-content", "overflow", "overflow-x", "overflow-wrap", "white-space",
    "word-break", "text-overflow", "color", "background-color", "font-size", "line-height", "grid-template-columns",
}
_FORBIDDEN = re.compile(r"@import|url\s*\(|expression\s*\(|javascript:|behavior\s*:|<|>|\\|/\*|\*/|@font-face|@charset", re.I)
_BLOCK = re.compile(r"([^{}]+)\{([^{}]*)\}")
_SELECTOR_OK = re.compile(r"^[A-Za-z0-9_\-\.\#\:\s>\+~\(\)\[\]=\"'\*,]+$")
_MEDIA_OK = re.compile(r"^@media\s*\(\s*(min|max)-width\s*:\s*\d{2,4}px\s*\)$")


class UnsafeCssError(ValueError):
    pass


def _check_declarations(body: str) -> None:
    for decl in [d.strip() for d in body.split(";") if d.strip()]:
        if ":" not in decl:
            raise UnsafeCssError(f"Invalid declaration: {decl[:40]}")
        prop, value = (x.strip() for x in decl.split(":", 1))
        if prop.lower() not in ALLOWED_PROPERTIES:
            raise UnsafeCssError(f"CSS property '{prop}' is not permitted in automated fixes.")
        if not value or len(value) > 120:
            raise UnsafeCssError("Invalid CSS value.")


def validate_css_patch(css: str) -> str:
    css = (css or "").strip()
    if not css or len(css) > 4000:
        raise UnsafeCssError("CSS patch is empty or too large.")
    if _FORBIDDEN.search(css):
        raise UnsafeCssError("CSS patch contains forbidden constructs.")
    if css.count("{") != css.count("}"):
        raise UnsafeCssError("CSS patch has unbalanced braces.")

    # Peel at most one level of @media wrapping.
    remaining = css
    while remaining.strip():
        remaining = remaining.strip()
        if remaining.startswith("@"):
            head, _, rest = remaining.partition("{")
            if not _MEDIA_OK.match(head.strip()):
                raise UnsafeCssError("Only simple @media (min/max-width) queries are permitted.")
            depth, idx = 1, 0
            while idx < len(rest) and depth:
                depth += {"{": 1, "}": -1}.get(rest[idx], 0)
                idx += 1
            if depth:
                raise UnsafeCssError("Unbalanced @media block.")
            inner, remaining = rest[: idx - 1], rest[idx:]
            _validate_rules(inner)
        else:
            m = _BLOCK.match(remaining)
            if not m:
                raise UnsafeCssError("Unrecognised CSS structure.")
            _validate_rules(m.group(0))
            remaining = remaining[m.end():]
    return css


def _validate_rules(text: str) -> None:
    pos = 0
    text = text.strip()
    if not text:
        raise UnsafeCssError("Empty rule block.")
    while pos < len(text):
        m = _BLOCK.match(text, pos)
        if not m:
            if text[pos:].strip():
                raise UnsafeCssError("Unrecognised CSS structure.")
            break
        selector = m.group(1).strip()
        if not selector or not _SELECTOR_OK.match(selector) or len(selector) > 240:
            raise UnsafeCssError("Selector contains unsupported characters.")
        _check_declarations(m.group(2))
        pos = m.end()
        while pos < len(text) and text[pos].isspace():
            pos += 1
