"""SSRF-aware validation of scan targets.

Rules
-----
* Only http/https, no credentials in the URL.
* A host (or host:port) listed in ALLOWED_SCAN_HOSTS is *explicitly authorised* and may
  be a private/loopback address (this is how the local demo site is scanned).
* Every other host must resolve ONLY to public addresses. Loopback, private, link-local,
  multicast, reserved and cloud-metadata addresses are blocked.
* The guard is re-applied to every navigation request/redirect inside the browser.
"""
from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlsplit

from app.core.config import get_settings

METADATA_HOSTS = {"169.254.169.254", "metadata.google.internal", "metadata", "100.100.100.200", "fd00:ec2::254"}


class UnsafeTargetError(ValueError):
    """Raised when a URL is not an authorised scan target."""


@dataclass(frozen=True)
class ValidatedTarget:
    url: str
    host: str
    port: int
    explicitly_allowed: bool


def _is_blocked_ip(ip: ipaddress._BaseAddress) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or (isinstance(ip, ipaddress.IPv6Address) and bool(ip.ipv4_mapped) and _is_blocked_ip(ip.ipv4_mapped))
        or str(ip) in METADATA_HOSTS
    )


def _allow_entries(extra: set[str] | None = None) -> set[str]:
    entries = set(get_settings().allowed_hosts_list)
    if extra:
        entries |= {e.lower() for e in extra}
    return entries


def _resolve(host: str) -> list[ipaddress._BaseAddress]:
    try:
        return [ipaddress.ip_address(host)]
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise UnsafeTargetError(f"Host '{host}' could not be resolved.") from exc
    return [ipaddress.ip_address(i[4][0]) for i in infos]


def validate_target_url(url: str, extra_allowed: set[str] | None = None, resolve: bool = True) -> ValidatedTarget:
    if not isinstance(url, str) or not url.strip():
        raise UnsafeTargetError("A target URL is required.")
    url = url.strip()
    if len(url) > 2048:
        raise UnsafeTargetError("URL is too long.")
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as exc:
        raise UnsafeTargetError("URL is malformed.") from exc
    if parts.scheme not in ("http", "https"):
        raise UnsafeTargetError("Only http:// and https:// URLs can be scanned.")
    if parts.username or parts.password:
        raise UnsafeTargetError("URLs containing credentials are not allowed.")
    host = (parts.hostname or "").lower().rstrip(".")
    if not host:
        raise UnsafeTargetError("URL has no host.")
    port = port or (443 if parts.scheme == "https" else 80)

    allow = _allow_entries(extra_allowed)
    if host in METADATA_HOSTS:
        raise UnsafeTargetError("Cloud metadata endpoints are blocked.")
    if f"{host}:{port}" in allow or host in allow:
        return ValidatedTarget(url, host, port, True)

    if host == "localhost" or host.endswith(".localhost") or host.endswith(".local") or host.endswith(".internal"):
        raise UnsafeTargetError(
            "Local/internal hosts are blocked. Add the host to ALLOWED_SCAN_HOSTS to authorise it."
        )
    if get_settings().is_production:
        raise UnsafeTargetError("In production only hosts listed in ALLOWED_SCAN_HOSTS can be scanned.")
    if resolve:
        for ip in _resolve(host):
            if _is_blocked_ip(ip):
                raise UnsafeTargetError(
                    "Target resolves to a private, loopback or link-local address and is not authorised."
                )
    elif _is_ip_literal(host) and _is_blocked_ip(ipaddress.ip_address(host)):
        raise UnsafeTargetError("Private or loopback IP addresses are not authorised scan targets.")
    return ValidatedTarget(url, host, port, False)


def _is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def is_url_allowed(url: str, extra_allowed: set[str] | None = None) -> bool:
    """Boolean wrapper used by the browser request interceptor."""
    if url.startswith(("data:", "blob:", "about:")):
        return True
    try:
        validate_target_url(url, extra_allowed)
        return True
    except UnsafeTargetError:
        return False
