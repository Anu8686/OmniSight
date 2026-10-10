"""Test configuration: isolated temp DB/data dir, rate limits reset, demo site available."""
import os
import tempfile

_TMP = tempfile.mkdtemp(prefix="omnisight-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ["DATA_DIR"] = _TMP
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production-use-0123456789"
os.environ["ENVIRONMENT"] = "development"
for k in ("AI_PROVIDER", "AI_MODEL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GITHUB_TOKEN", "GITHUB_REPOSITORY"):
    os.environ[k] = ""

import itertools  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.security.rate_limit import auth_limiter, scan_limiter  # noqa: E402
from app.services import demo_service  # noqa: E402

_counter = itertools.count(1)


@pytest.fixture(scope="session")
def demo_site():
    assert demo_service.ensure_demo_server(), "demo site could not be started"
    yield demo_service.demo_url()
    demo_service.stop_demo_server()


@pytest.fixture()
def client():
    auth_limiter.reset()
    scan_limiter.reset()
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def user_client(client):
    n = next(_counter)
    r = client.post("/api/auth/register", json={"name": f"Tester {n}", "email": f"tester{n}@example.com", "password": "correct-horse-9"})
    assert r.status_code == 201, r.text
    return client


def project_payload(**over):
    base = {"name": "Demo project", "target_url": "http://127.0.0.1:5050/index.html", "environment": "local"}
    base.update(over)
    return base
