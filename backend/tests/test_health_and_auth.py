from tests.conftest import project_payload


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["database"] == "ok"
    assert body["ai_mode"] == "rule-based-demo" and body["github_mode"] == "simulated"


def test_protected_routes_require_auth(client):
    for path in ("/api/projects", "/api/scans", "/api/issues", "/api/dashboard", "/api/fixes"):
        assert client.get(path).status_code == 401


def test_register_login_logout_flow(client):
    r = client.post("/api/auth/register", json={"name": "Ada Lovelace", "email": "ada@example.com", "password": "analytical-engine1"})
    assert r.status_code == 201 and "password" not in r.text
    assert "httponly" in r.headers["set-cookie"].lower()
    assert client.get("/api/auth/me").json()["email"] == "ada@example.com"
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": "ada@example.com", "password": "wrong-password-1"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "ada@example.com", "password": "analytical-engine1"}).status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_registration_validation_and_duplicates(client):
    assert client.post("/api/auth/register", json={"name": "A", "email": "bad", "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={"name": "Bob Ross", "email": "bob@example.com", "password": "alllettersnodigits"}).status_code == 422
    ok = {"name": "Bob Ross", "email": "bob@example.com", "password": "happy-trees-42"}
    assert client.post("/api/auth/register", json=ok).status_code == 201
    assert client.post("/api/auth/register", json=ok).status_code == 409


def test_password_is_hashed():
    from app.core.security import hash_password, verify_password

    h = hash_password("super-secret-pass1")
    assert "super-secret" not in h and h.startswith("scrypt$")
    assert verify_password("super-secret-pass1", h) and not verify_password("other", h)


def test_unknown_error_does_not_leak_internals(user_client):
    r = user_client.get("/api/projects/99999")
    assert r.status_code == 404 and "Traceback" not in r.text
