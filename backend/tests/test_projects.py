import pytest

from tests.conftest import project_payload


def test_project_crud(user_client):
    c = user_client
    r = c.post("/api/projects", json=project_payload(description="d", github_repo_url="https://github.com/acme/site", github_branch="main"))
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert r.json()["scan_count"] == 0 and r.json()["viewports"] == ["desktop", "tablet", "mobile"]
    assert any(p["id"] == pid for p in c.get("/api/projects").json())
    assert c.get(f"/api/projects/{pid}").json()["name"] == "Demo project"
    r = c.patch(f"/api/projects/{pid}", json={"name": "Renamed", "viewports": ["mobile"]})
    assert r.status_code == 200 and r.json()["name"] == "Renamed" and r.json()["viewports"] == ["mobile"]
    assert c.delete(f"/api/projects/{pid}").status_code == 204
    assert c.get(f"/api/projects/{pid}").status_code == 404


@pytest.mark.parametrize("bad", [
    {"name": "x"},                                   # too short
    {"environment": "moon"},                         # not an allowed environment
    {"viewports": []},                               # at least one
    {"viewports": ["watch"]},                        # unknown preset
    {"github_repo_url": "https://evil.example/x/y"}, # not github
    {"github_branch": "../etc"},                     # traversal
    {"repo_path_prefix": "../../etc"},
])
def test_project_input_validation(user_client, bad):
    assert user_client.post("/api/projects", json=project_payload(**bad)).status_code == 422


@pytest.mark.parametrize("url", [
    "http://169.254.169.254/latest/meta-data/", "http://10.0.0.5/", "http://localhost:9999/", "http://192.168.1.1/",
    "file:///etc/passwd", "ftp://example.com/", "http://user:pw@example.com/", "http://127.0.0.1:8000/", "http://[::1]/",
])
def test_project_rejects_unsafe_targets(user_client, url):
    r = user_client.post("/api/projects", json=project_payload(target_url=url))
    assert r.status_code == 422, (url, r.text)


def test_source_dir_must_be_inside_allowed_roots(user_client):
    r = user_client.post("/api/projects", json=project_payload(source_dir="/etc"))
    assert r.status_code == 422


def test_projects_are_private_per_user(client):
    client.post("/api/auth/register", json={"name": "Alice A", "email": "alice@example.com", "password": "alice-pass-123"})
    pid = client.post("/api/projects", json=project_payload()).json()["id"]
    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"name": "Mallory M", "email": "mallory@example.com", "password": "mallory-pass-123"})
    assert client.get(f"/api/projects/{pid}").status_code == 404
    assert client.delete(f"/api/projects/{pid}").status_code == 404
    assert client.post("/api/scans", json={"project_id": pid}).status_code == 404
    assert client.get("/api/projects").json() == []
