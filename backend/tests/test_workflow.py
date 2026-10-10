"""End-to-end workflow against the bundled demo site using a real Chromium (Playwright).

Scan -> issues -> propose fix -> approve -> apply (isolated workspace) -> verify -> rollback.
Background tasks run before TestClient returns, so scans are finished when POST /scans responds.
"""
import hashlib
from pathlib import Path

import pytest

from app.core.config import get_settings

pytestmark = pytest.mark.usefixtures("demo_site")


def _demo_css_hash() -> str:
    return hashlib.sha256((Path(get_settings().demo_site_dir) / "styles.css").read_bytes()).hexdigest()


@pytest.fixture()
def scanned(user_client):
    r = user_client.post("/api/projects/demo")
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    r = user_client.post("/api/scans", json={"project_id": pid})
    assert r.status_code == 202, r.text
    scan = user_client.get(f"/api/scans/{r.json()['id']}").json()
    return user_client, pid, scan


def test_scan_lifecycle_captures_screenshots_and_metadata(scanned):
    c, _, scan = scanned
    assert scan["status"] == "completed" and scan["progress"] == 100
    assert scan["page_title"] and "Northwind" in scan["page_title"]
    assert {s["viewport"] for s in scan["screenshots"]} == {"desktop", "tablet", "mobile"}
    assert scan["analysis_mode"] == "rule-based-demo"
    assert any("Demo mode" in n for n in scan["ai_notes"])
    shot = scan["screenshots"][0]
    img = c.get(f"/api/screenshots/{shot['id']}/file")
    assert img.status_code == 200 and img.content[:4] == b"\x89PNG"


def test_scan_finds_the_planted_bugs_and_not_the_control_case(scanned):
    c, _, scan = scanned
    issues = c.get(f"/api/scans/{scan['id']}/issues").json()
    rules = {i["rule_id"] for i in issues}
    assert {"viewport-overflow", "overlap", "misaligned-siblings", "nav-wrap"} <= rules
    assert all(i["source"] == "rule-based" for i in issues)
    assert not any("feature" in (i["evidence"].get("element_selector") or "") for i in issues)
    overflow = next(i for i in issues if i["rule_id"] == "viewport-overflow")
    assert overflow["severity"] == "critical" and overflow["viewport"] == "mobile"


def test_issue_listing_filters(scanned):
    c, pid, _ = scanned
    page = c.get("/api/issues", params={"severity": "critical"}).json()
    assert page["total"] == 1 and page["items"][0]["severity"] == "critical"
    assert c.get("/api/issues", params={"q": "zzz-no-match"}).json()["total"] == 0
    assert c.get("/api/issues", params={"project_id": pid}).json()["total"] == 4


def test_concurrent_scan_for_same_project_is_rejected(user_client, demo_site):
    pid = user_client.post("/api/projects/demo").json()["id"]
    from app.db.session import SessionLocal
    from app.models import Scan
    with SessionLocal() as db:
        db.add(Scan(project_id=pid, kind="baseline", target_url=demo_site, status="running", viewports=["desktop"]))
        db.commit()
    assert user_client.post("/api/scans", json={"project_id": pid}).status_code == 409


def test_fix_requires_approval_then_applies_in_isolation_and_verifies(scanned):
    c, _, scan = scanned
    before = _demo_css_hash()
    issue = next(i for i in c.get(f"/api/scans/{scan['id']}/issues").json() if i["rule_id"] == "viewport-overflow")
    fix = c.post(f"/api/issues/{issue['id']}/propose-fix")
    assert fix.status_code == 201 and fix.json()["status"] == "proposed"
    fid = fix.json()["id"]

    assert c.post(f"/api/fixes/{fid}/apply").status_code == 409        # not approved yet
    assert c.post(f"/api/fixes/{fid}/verify").status_code in (409, 422)
    assert c.post(f"/api/fixes/{fid}/approve", json={"comment": "looks right"}).json()["status"] == "approved"
    applied = c.post(f"/api/fixes/{fid}/apply")
    assert applied.status_code == 200 and applied.json()["status"] == "applied"
    assert "+++" in c.get(f"/api/fixes/{fid}/patch").text

    v = c.post(f"/api/fixes/{fid}/verify")
    assert v.status_code == 200, v.text
    body = v.json()
    assert body["resolved"] is True and body["status"] == "passed" and body["regressions"] == []
    assert body["before_screenshot_id"] and body["after_screenshot_id"]
    assert c.get(f"/api/issues/{issue['id']}").json()["status"] == "verified"

    assert _demo_css_hash() == before, "the original source must never be modified"
    assert c.post(f"/api/fixes/{fid}/rollback").status_code == 200


def test_fix_rejection_blocks_apply(scanned):
    c, _, scan = scanned
    issue = c.get(f"/api/scans/{scan['id']}/issues").json()[0]
    fid = c.post(f"/api/issues/{issue['id']}/propose-fix").json()["id"]
    assert c.post(f"/api/fixes/{fid}/reject", json={"comment": "not now"}).json()["status"] == "rejected"
    assert c.post(f"/api/fixes/{fid}/apply").status_code == 409
    assert c.post(f"/api/fixes/{fid}/approve", json={}).status_code == 409


def test_reports_export(scanned):
    c, _, scan = scanned
    assert c.get(f"/api/reports/{scan['id']}").status_code == 200
    csv = c.get(f"/api/reports/{scan['id']}", params={"format": "csv"})
    assert csv.status_code == 200 and "severity" in csv.text.lower()


def test_scanning_a_blocked_target_is_refused(user_client):
    r = user_client.post("/api/projects", json={"name": "Internal", "target_url": "http://169.254.169.254/latest/meta-data"})
    assert r.status_code == 422
