"""Strict schemas for findings, used both for rule-based and VLM output validation."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Severity = Literal["critical", "high", "medium", "low"]
ViewportName = Literal["desktop", "tablet", "mobile"]
Category = Literal[
    "responsive-layout", "overlap", "alignment", "contrast", "spacing",
    "navigation", "obscured-element", "missing-element", "accessibility", "other",
]


class BoundingBox(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: float
    y: float
    width: float = Field(ge=0)
    height: float = Field(ge=0)


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    screenshot: str | None = None
    element_selector: str | None = Field(default=None, max_length=300)
    bounding_box: BoundingBox | None = None


class SuggestedFix(BaseModel):
    model_config = ConfigDict(extra="forbid")
    file: str = Field(max_length=300)
    explanation: str = Field(max_length=1000)
    code: str = Field(max_length=4000)


class Finding(BaseModel):
    """One visual defect. Matches the schema in the product specification."""

    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=200)
    category: Category
    severity: Severity
    description: str = Field(min_length=3, max_length=2000)
    viewport: ViewportName
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: Evidence = Field(default_factory=Evidence)
    suggested_fix: SuggestedFix | None = None
    reasoning: str = Field(default="", max_length=2000)

    @field_validator("title", "description", "reasoning")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    findings: list[Finding] = Field(default_factory=list, max_length=50)


class DetectedFinding(Finding):
    """Finding plus bookkeeping used internally by OmniSight."""

    model_config = ConfigDict(extra="forbid")
    rule_id: str = ""
    issue_key: str = ""
    source: Literal["rule-based", "vlm"] = "rule-based"
