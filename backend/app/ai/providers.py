"""Modular Vision-Language Model providers (Anthropic, OpenAI). Keys come from server env only."""
from __future__ import annotations

import base64
import logging
from abc import ABC, abstractmethod

import httpx

from app.core.config import Settings

log = logging.getLogger("omnisight.ai")


class ProviderError(Exception):
    """Provider-side failure with a user-safe message."""


class ProviderRateLimited(ProviderError):
    pass


class VisionProvider(ABC):
    name: str

    @abstractmethod
    def analyze(self, image_png: bytes, prompt: str) -> str:
        """Return the raw model text (expected to be JSON)."""


def _raise_for(resp: httpx.Response) -> None:
    if resp.status_code == 429:
        raise ProviderRateLimited("The AI provider rate limit was reached.")
    if resp.status_code in (401, 403):
        raise ProviderError("The AI provider rejected the configured credentials.")
    if resp.status_code == 400:
        raise ProviderError("The AI provider rejected the request (unsupported image or model).")
    if resp.status_code >= 400:
        raise ProviderError(f"The AI provider returned HTTP {resp.status_code}.")


class AnthropicProvider(VisionProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str, client: httpx.Client | None = None):
        self._key, self._model = api_key, model
        self._client = client or httpx.Client(timeout=90)

    def analyze(self, image_png: bytes, prompt: str) -> str:
        body = {
            "model": self._model,
            "max_tokens": 3000,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                                 "data": base64.b64encode(image_png).decode()}},
                    {"type": "text", "text": prompt},
                ],
            }],
        }
        try:
            r = self._client.post(
                "https://api.anthropic.com/v1/messages", json=body,
                headers={"x-api-key": self._key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            )
        except httpx.HTTPError as exc:
            raise ProviderError("The AI provider could not be reached.") from exc
        _raise_for(r)
        try:
            return "".join(b.get("text", "") for b in r.json()["content"] if b.get("type") == "text")
        except Exception as exc:
            raise ProviderError("The AI provider returned an unexpected response shape.") from exc


class OpenAIProvider(VisionProvider):
    name = "openai"

    def __init__(self, api_key: str, model: str, client: httpx.Client | None = None):
        self._key, self._model = api_key, model
        self._client = client or httpx.Client(timeout=90)

    def analyze(self, image_png: bytes, prompt: str) -> str:
        body = {
            "model": self._model,
            "response_format": {"type": "json_object"},
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(image_png).decode()}},
                ],
            }],
        }
        try:
            r = self._client.post(
                "https://api.openai.com/v1/chat/completions", json=body,
                headers={"Authorization": f"Bearer {self._key}", "content-type": "application/json"},
            )
        except httpx.HTTPError as exc:
            raise ProviderError("The AI provider could not be reached.") from exc
        _raise_for(r)
        try:
            return r.json()["choices"][0]["message"]["content"] or ""
        except Exception as exc:
            raise ProviderError("The AI provider returned an unexpected response shape.") from exc


def build_provider(settings: Settings) -> VisionProvider | None:
    if not settings.ai_configured:
        return None
    if settings.ai_provider.lower() == "anthropic":
        return AnthropicProvider(settings.anthropic_api_key, settings.ai_model)
    if settings.ai_provider.lower() == "openai":
        return OpenAIProvider(settings.openai_api_key, settings.ai_model)
    return None
