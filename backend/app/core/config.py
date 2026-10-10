"""Application settings, loaded from environment variables / .env (server-side only)."""
from __future__ import annotations

import logging
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), extra="ignore")

    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    database_url: str = f"sqlite:///{BACKEND_DIR / 'data' / 'omnisight.db'}"
    secret_key: str = ""
    data_dir: str = str(BACKEND_DIR / "data")

    allowed_scan_hosts: str = "127.0.0.1:5050,localhost:5050"
    allowed_source_roots: str = str(REPO_DIR / "demo-site")
    demo_site_dir: str = str(REPO_DIR / "demo-site")
    demo_site_port: int = 5050

    ai_provider: str = ""
    ai_model: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    github_token: str = ""
    github_repository: str = ""

    access_token_minutes: int = 60 * 12
    scan_timeout_seconds: int = 45
    max_dom_elements: int = 700

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def data_path(self) -> Path:
        p = Path(self.data_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def screenshots_path(self) -> Path:
        p = self.data_path / "screenshots"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def workspaces_path(self) -> Path:
        p = self.data_path / "workspaces"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def allowed_hosts_list(self) -> list[str]:
        hosts = [h.strip().lower() for h in self.allowed_scan_hosts.split(",") if h.strip()]
        # The bundled demo site is always an authorised target.
        for h in (f"127.0.0.1:{self.demo_site_port}", f"localhost:{self.demo_site_port}"):
            if h not in hosts:
                hosts.append(h)
        return hosts

    @property
    def allowed_source_roots_list(self) -> list[Path]:
        roots = []
        for r in self.allowed_source_roots.split(","):
            r = r.strip()
            if r:
                p = Path(r)
                roots.append((BACKEND_DIR / p).resolve() if not p.is_absolute() else p.resolve())
        return roots

    @property
    def ai_configured(self) -> bool:
        p = self.ai_provider.lower()
        if p == "anthropic":
            return bool(self.anthropic_api_key and self.ai_model)
        if p == "openai":
            return bool(self.openai_api_key and self.ai_model)
        return False

    @property
    def github_configured(self) -> bool:
        return bool(self.github_token and "/" in self.github_repository)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if not s.secret_key:
        if s.is_production:
            raise RuntimeError("SECRET_KEY must be set when ENVIRONMENT=production")
        # Development only: ephemeral key. Sessions are invalidated on restart.
        object.__setattr__(s, "secret_key", secrets.token_urlsafe(48))
        logging.getLogger("omnisight").warning(
            "SECRET_KEY not set: using a temporary development key (sessions reset on restart)."
        )
    return s
