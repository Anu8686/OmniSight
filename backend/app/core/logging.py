"""Logging setup with secret masking."""
from __future__ import annotations

import logging
import re

_PATTERNS = [
    re.compile(r"(gh[pousr]_[A-Za-z0-9]{20,})"),
    re.compile(r"(github_pat_[A-Za-z0-9_]{20,})"),
    re.compile(r"(sk-[A-Za-z0-9_\-]{16,})"),
    re.compile(r"(?i)(authorization['\"]?\s*[:=]\s*['\"]?(?:bearer|token)\s+)[^\s'\"]+"),
    re.compile(r"(?i)(api[_-]?key['\"]?\s*[:=]\s*['\"]?)[^\s'\"]+"),
]


def mask_secrets(text: str) -> str:
    out = text
    for p in _PATTERNS:
        if p.groups == 1 and p.pattern.startswith("(?i)"):
            out = p.sub(lambda m: m.group(1) + "***", out)
        else:
            out = p.sub("***", out)
    return out


class SecretMaskingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = mask_secrets(record.getMessage())
            record.args = ()
        except Exception:  # pragma: no cover - never break logging
            pass
        return True


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    f = SecretMaskingFilter()
    for h in logging.getLogger().handlers:
        h.addFilter(f)
    logging.getLogger("omnisight").addFilter(f)
    for noisy in ("httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
