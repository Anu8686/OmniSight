"""Playwright-based scanner: captures screenshots + DOM/layout evidence at several viewports.

Runs synchronously (call it from a worker thread). Chromium is launched in a separate
browser process; scanned page content is untrusted and never executed in the API process.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable
from urllib.parse import urlsplit

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

from app.browser.dom_probe import PROBE_JS
from app.security.url_guard import UnsafeTargetError, is_url_allowed, validate_target_url

log = logging.getLogger("omnisight.scanner")

VIEWPORTS: dict[str, tuple[int, int]] = {"desktop": (1440, 900), "tablet": (820, 1180), "mobile": (390, 844)}
MAX_FULLPAGE_HEIGHT = 12000
MAX_RESPONSE_BYTES = 25 * 1024 * 1024


class ScanCancelled(Exception):
    pass


class ScanError(Exception):
    """A user-presentable scan failure (never contains stack traces or file paths)."""


@dataclass
class ShotRecord:
    viewport: str
    kind: str  # viewport | fullpage
    width: int
    height: int
    rel_path: str


@dataclass
class ViewportResult:
    name: str
    width: int
    height: int
    shots: list[ShotRecord] = field(default_factory=list)
    dom: dict = field(default_factory=dict)


@dataclass
class ScanResult:
    page_title: str = ""
    final_url: str = ""
    console_errors: list[str] = field(default_factory=list)
    failed_requests: list[dict] = field(default_factory=list)
    viewports: dict[str, ViewportResult] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def _friendly_nav_error(exc: Exception) -> str:
    msg = str(exc)
    if "ERR_CONNECTION_REFUSED" in msg:
        return "The target refused the connection. Is the site running?"
    if "ERR_NAME_NOT_RESOLVED" in msg:
        return "The target host name could not be resolved."
    if "ERR_CERT" in msg or "SSL" in msg:
        return "The target's TLS certificate could not be verified."
    if "blockedbyclient" in msg.lower() or "ERR_BLOCKED_BY_CLIENT" in msg:
        return "The navigation was blocked by OmniSight's security policy."
    if isinstance(exc, PlaywrightTimeout) or "Timeout" in msg:
        return "The page did not finish loading before the timeout."
    return "The page could not be loaded."


def run_scan(
    target_url: str,
    viewport_names: list[str],
    out_dir: Path,
    rel_prefix: str,
    *,
    extra_allowed: set[str] | None = None,
    cancel_check: Callable[[], bool] | None = None,
    on_progress: Callable[[str, int], None] | None = None,
    timeout_s: int = 45,
    max_elements: int = 700,
) -> ScanResult:
    def check_cancel() -> None:
        if cancel_check and cancel_check():
            raise ScanCancelled()

    def progress(stage: str, pct: int) -> None:
        if on_progress:
            on_progress(stage, pct)

    # 1. Validate target (SSRF rules)
    try:
        validate_target_url(target_url, extra_allowed)
    except UnsafeTargetError as exc:
        raise ScanError(str(exc)) from exc

    names = [v for v in viewport_names if v in VIEWPORTS] or list(VIEWPORTS)
    out_dir.mkdir(parents=True, exist_ok=True)
    result = ScanResult()
    host_cache: dict[tuple[str, str, int | None], bool] = {}
    oversized: list[str] = []

    def allowed(url: str) -> bool:
        p = urlsplit(url)
        key = (p.scheme, p.hostname or "", p.port)
        if key not in host_cache:
            host_cache[key] = is_url_allowed(url, extra_allowed)
        return host_cache[key]

    progress("Launching browser", 5)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--disable-dev-shm-usage"])
            try:
                for i, name in enumerate(names):
                    check_cancel()
                    w, h = VIEWPORTS[name]
                    base_pct = 10 + int(70 * i / len(names))
                    progress(f"Opening page ({name} {w}x{h})", base_pct)
                    ctx = browser.new_context(viewport={"width": w, "height": h}, ignore_https_errors=False)
                    ctx.set_default_timeout(timeout_s * 1000)
                    page = ctx.new_page()

                    def route_handler(route, request):
                        if allowed(request.url):
                            route.continue_()
                        else:
                            result.failed_requests.append(
                                {"url": _short(request.url), "reason": "Blocked by OmniSight security policy", "viewport": name}
                            )
                            route.abort("blockedbyclient")

                    ctx.route("**/*", route_handler)
                    page.on(
                        "console",
                        lambda m, _n=name: result.console_errors.append(f"[{_n}] {m.text[:300]}") if m.type == "error" else None,
                    )
                    page.on("pageerror", lambda e, _n=name: result.console_errors.append(f"[{_n}] {str(e)[:300]}"))
                    page.on(
                        "requestfailed",
                        lambda r, _n=name: result.failed_requests.append(
                            {"url": _short(r.url), "reason": (r.failure or "failed")[:120], "viewport": _n}
                        ) if "blockedbyclient" not in (r.failure or "").lower() else None,
                    )

                    def on_response(resp, _n=name):
                        try:
                            if resp.status >= 400:
                                result.failed_requests.append(
                                    {"url": _short(resp.url), "reason": f"HTTP {resp.status}", "viewport": _n}
                                )
                            cl = int(resp.headers.get("content-length", "0") or 0)
                            if cl > MAX_RESPONSE_BYTES:
                                oversized.append(resp.url)
                        except Exception:
                            pass

                    page.on("response", on_response)

                    response = None
                    last_exc: Exception | None = None
                    for attempt in range(3):  # retry transient failures
                        check_cancel()
                        try:
                            response = page.goto(target_url, wait_until="load", timeout=timeout_s * 1000)
                            last_exc = None
                            break
                        except (PlaywrightTimeout, PlaywrightError) as exc:
                            last_exc = exc
                            log.info("navigation attempt %d failed for %s: %s", attempt + 1, name, type(exc).__name__)
                            if "ERR_NAME_NOT_RESOLVED" in str(exc) or "blockedbyclient" in str(exc).lower():
                                break
                            page.wait_for_timeout(500 * (attempt + 1))
                    if last_exc is not None:
                        raise ScanError(_friendly_nav_error(last_exc))
                    if response is not None and response.status >= 400:
                        raise ScanError(f"The target returned HTTP {response.status} for the main page.")
                    if oversized:
                        raise ScanError("The target response exceeded the 25 MB size limit.")
                    try:
                        page.wait_for_load_state("networkidle", timeout=5000)
                    except PlaywrightTimeout:
                        pass
                    page.wait_for_timeout(250)
                    check_cancel()

                    progress(f"Inspecting layout ({name})", base_pct + 8)
                    dom = page.evaluate(PROBE_JS, max_elements)
                    if dom.get("looksLikeCaptcha"):
                        raise ScanError("The page is protected by a CAPTCHA or bot check. OmniSight does not bypass these.")
                    if i == 0:
                        result.page_title = (dom.get("title") or "")[:300]
                        result.final_url = dom.get("url") or target_url
                        if not is_url_allowed(result.final_url, extra_allowed):
                            raise ScanError("The target redirected to an address that is not authorised.")
                        if dom.get("hasPasswordField"):
                            result.notes.append(
                                "A password field was detected. If this page requires sign-in, OmniSight scans only what is "
                                "publicly visible and never bypasses authentication."
                            )

                    progress(f"Capturing screenshots ({name})", base_pct + 14)
                    vr = ViewportResult(name=name, width=w, height=h, dom=dom)
                    vp_file = out_dir / f"{name}-viewport.png"
                    page.screenshot(path=str(vp_file), full_page=False)
                    vr.shots.append(ShotRecord(name, "viewport", w, h, f"{rel_prefix}/{vp_file.name}"))
                    full_file = out_dir / f"{name}-full.png"
                    page_h = int(min(dom.get("scrollHeight") or h, MAX_FULLPAGE_HEIGHT))
                    full_w = int(max(dom.get("scrollWidth") or w, w))
                    try:
                        page.screenshot(
                            path=str(full_file), full_page=True,
                            clip={"x": 0, "y": 0, "width": min(full_w, 4000), "height": max(page_h, h)},
                        )
                        vr.shots.append(ShotRecord(name, "fullpage", min(full_w, 4000), max(page_h, h), f"{rel_prefix}/{full_file.name}"))
                    except PlaywrightError:
                        result.notes.append(f"Full-page screenshot unavailable for {name}; viewport screenshot captured instead.")
                    result.viewports[name] = vr
                    ctx.close()
            finally:
                browser.close()
    except (ScanError, ScanCancelled):
        raise
    except PlaywrightError as exc:
        log.warning("browser error: %s", type(exc).__name__)
        raise ScanError(
            "The browser could not be started. Run 'python -m playwright install chromium' and try again."
            if "Executable doesn't exist" in str(exc) else "A browser error interrupted the scan."
        ) from exc

    progress("Capture complete", 82)
    return result


def _short(url: str) -> str:
    url = re.sub(r"(?i)(token|key|secret|password)=[^&]+", r"\1=***", url)
    return url[:300]
