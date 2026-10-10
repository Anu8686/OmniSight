"""GitHub integration (REST API). Live mode needs GITHUB_TOKEN + GITHUB_REPOSITORY; otherwise a
clearly-labelled SIMULATED mode is used. Tokens never leave the server and are never logged."""
from __future__ import annotations

import base64
import logging
import re
from dataclasses import dataclass

import httpx

from app.core.config import Settings

log = logging.getLogger("omnisight.github")
API = "https://api.github.com"


class GitHubError(Exception):
    """Safe-to-display error (never contains the token)."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message, self.status = message, status


@dataclass
class PullRequestResult:
    url: str
    number: int | None
    branch: str
    simulated: bool
    status: str = "open"


def parse_repo(url_or_slug: str | None) -> str | None:
    if not url_or_slug:
        return None
    m = re.match(r"^(?:https://github\.com/)?([\w.-]+/[\w.-]+?)(?:\.git)?/?$", url_or_slug.strip())
    return m.group(1) if m else None


class GitHubClient:
    def __init__(self, token: str, repo: str, client: httpx.Client | None = None):
        self._repo = repo
        self._client = client or httpx.Client(timeout=20)
        self._headers = {
            "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
        }

    def _req(self, method: str, path: str, **kw) -> dict:
        try:
            r = self._client.request(method, f"{API}{path}", headers=self._headers, **kw)
        except httpx.HTTPError as exc:
            raise GitHubError("GitHub could not be reached.") from exc
        if r.status_code == 401:
            raise GitHubError("GitHub rejected the configured token.", 502)
        if r.status_code == 403:
            raise GitHubError("The GitHub token does not have permission for this action (or a rate limit was hit).", 502)
        if r.status_code == 404:
            raise GitHubError("The repository, branch or file was not found (or the token cannot see it).", 404)
        if r.status_code == 422:
            raise GitHubError("GitHub could not process the request (for example the branch already exists).", 422)
        if r.status_code >= 400:
            raise GitHubError(f"GitHub returned HTTP {r.status_code}.")
        return r.json() if r.content else {}

    def check(self) -> dict:
        repo = self._req("GET", f"/repos/{self._repo}")
        perms = repo.get("permissions") or {}
        return {
            "full_name": repo.get("full_name"), "default_branch": repo.get("default_branch"),
            "can_push": bool(perms.get("push")), "private": bool(repo.get("private")),
        }

    def get_file(self, path: str, ref: str) -> tuple[str, str]:
        data = self._req("GET", f"/repos/{self._repo}/contents/{path}", params={"ref": ref})
        if data.get("encoding") != "base64":
            raise GitHubError("Unsupported file encoding returned by GitHub.")
        return base64.b64decode(data["content"]).decode("utf-8"), data["sha"]

    def branch_sha(self, branch: str) -> str:
        return self._req("GET", f"/repos/{self._repo}/git/ref/heads/{branch}")["object"]["sha"]

    def create_branch(self, name: str, sha: str) -> None:
        self._req("POST", f"/repos/{self._repo}/git/refs", json={"ref": f"refs/heads/{name}", "sha": sha})

    def put_file(self, path: str, content: str, message: str, branch: str, sha: str) -> None:
        self._req("PUT", f"/repos/{self._repo}/contents/{path}", json={
            "message": message, "content": base64.b64encode(content.encode()).decode(), "branch": branch, "sha": sha,
        })

    def create_pr(self, title: str, body: str, head: str, base: str) -> dict:
        return self._req("POST", f"/repos/{self._repo}/pulls", json={"title": title, "body": body, "head": head, "base": base})


def get_client(settings: Settings, http: httpx.Client | None = None) -> GitHubClient | None:
    if not settings.github_configured:
        return None
    return GitHubClient(settings.github_token, settings.github_repository, http)


def create_pull_request(
    settings: Settings, *, project_repo_url: str | None, base_branch: str | None, repo_file: str, fix_id: int,
    transform, title: str, commit_message: str, body: str, http: httpx.Client | None = None,
) -> PullRequestResult:
    """`transform(original_text) -> new_text` applies only the approved change."""
    branch = f"omnisight/fix-{fix_id}"
    client = get_client(settings, http)
    if client is None:
        # Mock mode: nothing is written anywhere.
        return PullRequestResult(url=f"simulated://github/{settings.github_repository or 'owner/repo'}/pull/{fix_id}",
                                 number=None, branch=branch, simulated=True)
    wanted = parse_repo(project_repo_url)
    if wanted and wanted.lower() != settings.github_repository.lower():
        raise GitHubError("The project's repository does not match the repository the server token is configured for.", 400)
    info = client.check()
    if not info["can_push"]:
        raise GitHubError("The configured token does not have write access to this repository.", 403)
    base = base_branch or info["default_branch"]
    original, sha = client.get_file(repo_file, base)
    new_text = transform(original)
    client.create_branch(branch, client.branch_sha(base))
    client.put_file(repo_file, new_text, commit_message, branch, sha)
    pr = client.create_pr(title, body, branch, base)
    return PullRequestResult(url=pr["html_url"], number=pr.get("number"), branch=branch, simulated=False)
