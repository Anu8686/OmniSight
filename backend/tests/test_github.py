"""GitHub integration: simulated mode, explicit approval, and failure handling without leaking tokens."""
import httpx
import pytest

from app.api import integrations
from app.core.config import get_settings
from app.github import service as gh

pytestmark = pytest.mark.usefixtures("demo_site")
SECRET = "ghp_supersecrettoken1234567890"


@pytest.fixture()
def approved_fix(user_client):
    pid = user_client.post("/api/projects/demo").json()["id"]
    sid = user_client.post("/api/scans", json={"project_id": pid}).json()["id"]
    issue = user_client.get(f"/api/scans/{sid}/issues").json()[0]
    fid = user_client.post(f"/api/issues/{issue['id']}/propose-fix").json()["id"]
    return user_client, fid


def test_status_is_simulated_without_credentials(user_client):
    s = user_client.get("/api/integrations/github/status").json()
    assert s["mode"] == "simulated" and s["configured"] is False and s["token_present"] is False


def test_pull_request_needs_explicit_approval_and_an_approved_fix(approved_fix):
    c, fid = approved_fix
    assert c.post("/api/integrations/github/pull-requests", json={"fix_id": fid, "approve": False}).status_code == 400
    assert c.post("/api/integrations/github/pull-requests", json={"fix_id": fid, "approve": True}).status_code == 409


def test_simulated_pull_request_after_approval(approved_fix):
    c, fid = approved_fix
    c.post(f"/api/fixes/{fid}/approve", json={})
    preview = c.post("/api/integrations/github/pull-requests/preview", json={"fix_id": fid}).json()
    assert preview["mode"] == "simulated" and preview["ready"] is True and preview["files"]
    r = c.post("/api/integrations/github/pull-requests", json={"fix_id": fid, "approve": True})
    assert r.status_code == 200 and r.json()["simulated"] is True and r.json()["url"].startswith("simulated://")


def test_live_failure_returns_safe_error_without_token(approved_fix, monkeypatch):
    c, fid = approved_fix
    c.post(f"/api/fixes/{fid}/approve", json={})
    s = get_settings()
    monkeypatch.setattr(s, "github_token", SECRET, raising=False)
    monkeypatch.setattr(s, "github_repository", "acme/widgets", raising=False)
    transport = httpx.MockTransport(lambda req: httpx.Response(401, json={"message": f"Bad credentials {SECRET}"}))
    monkeypatch.setattr(integrations, "_http_client", lambda: httpx.Client(transport=transport))
    r = c.post("/api/integrations/github/pull-requests", json={"fix_id": fid, "approve": True})
    assert r.status_code >= 400
    assert SECRET not in r.text
    assert SECRET not in c.get("/api/integrations/github/status").text


def test_github_error_type_exposes_message_only():
    err = gh.GitHubError("boom", 502)
    assert err.message == "boom" and err.status == 502
