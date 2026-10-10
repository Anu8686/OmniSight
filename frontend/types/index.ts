// Mirrors backend/app/schemas/api.py
export type Environment = "local" | "development" | "staging" | "production";
export type ViewportName = "desktop" | "tablet" | "mobile";
export type Severity = "critical" | "high" | "medium" | "low";

export interface User { id: number; name: string; email: string; created_at: string }

export interface Project {
  id: number; name: string; description: string; target_url: string; environment: Environment;
  github_repo_url: string | null; github_branch: string | null; repo_path_prefix: string; source_dir: string | null;
  auth_instructions: string; viewports: ViewportName[]; scan_notes: string; expectations: string;
  status: "active" | "archived"; is_demo: boolean; created_at: string; updated_at: string;
  scan_count: number; open_issue_count: number; total_issue_count: number;
  last_scan_at: string | null; last_scan_status: string | null; last_scan_id: number | null;
}
export type ProjectInput = Partial<Omit<Project, "id" | "created_at" | "updated_at" | "is_demo" | "scan_count" | "open_issue_count" | "total_issue_count" | "last_scan_at" | "last_scan_status" | "last_scan_id">>;

export interface Screenshot { id: number; scan_id: number; viewport: string; kind: string; width: number; height: number; url: string }

export type ScanStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export interface Scan {
  id: number; project_id: number; project_name: string; kind: string; target_url: string; status: ScanStatus;
  stage: string; progress: number; analysis_mode: string; page_title: string | null; final_url: string | null;
  viewports: string[]; console_errors: string[]; failed_requests: Record<string, unknown>[];
  viewport_metrics: Record<string, { width: number; height: number; scroll_width: number; scroll_height: number; element_count: number; horizontal_overflow: boolean; issues: number }>;
  ai_notes: string[]; error_message: string | null; created_at: string; started_at: string | null; finished_at: string | null;
  issue_count: number; severity_counts: Record<string, number>; screenshots: Screenshot[];
}

export interface BBox { x: number; y: number; width: number; height: number }
export interface ViewportEvidence { screenshot_id: number; image_size: [number, number]; bounding_box: BBox }
export interface Evidence {
  screenshot?: string; screenshot_id?: number; image_size?: [number, number]; viewport?: string;
  element_selector?: string; bounding_box?: BBox; by_viewport?: Record<string, ViewportEvidence>;
}
export interface SuggestedFix { file: string; explanation: string; code: string }

export interface Verification {
  id: number; fix_id: number; verification_scan_id: number | null; resolved: boolean; status: string;
  regressions: string[]; before_screenshot_id: number | null; after_screenshot_id: number | null;
  summary: string; created_at: string;
}
export type FixStatus = "proposed" | "approved" | "rejected" | "applied" | "verified" | "verification_failed" | "rolled_back";
export interface Fix {
  id: number; issue_id: number; file: string; explanation: string; code: string; original_snippet: string;
  status: FixStatus; origin: string; patch: string | null; approved_at: string | null; pr_url: string | null;
  pr_status: string | null; pr_simulated: boolean; created_at: string; can_apply: boolean; source_note: string;
  issue_title: string; issue_severity: string; project_id: number; project_name: string;
  latest_verification: Verification | null;
}
export interface Issue {
  id: number; scan_id: number; project_id: number; project_name: string; title: string; category: string;
  severity: Severity; description: string; viewport: string; confidence: number; source: string; rule_id: string;
  evidence: Evidence; suggested_fix: SuggestedFix | null; reasoning: string; status: string;
  reviewer: string | null; reviewer_comment: string; created_at: string;
}
export interface IssueDetail extends Issue { fixes: Fix[]; verifications: Verification[] }
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }

export interface Dashboard {
  is_sample: boolean; sample_label: string;
  totals: { projects: number; scans: number; bugs_detected: number; fixes_verified: number };
  severity_distribution: Record<string, number>;
  scan_outcomes: Record<string, number>;
  activity: { date: string; completed: number; failed: number }[];
  viewport_coverage: Record<string, number>;
  recent_scans: Scan[]; recent_issues: Issue[]; recent_projects: Project[];
}

export interface AppSettings {
  environment: string;
  ai: { configured: boolean; provider: string | null; model: string | null; mode: string; message: string };
  github: { configured: boolean; repository: string | null };
  allowed_scan_hosts: string[]; auth_mode: string;
  limits: { scan_timeout_seconds: number; max_dom_elements: number };
}
export interface GithubStatus {
  configured: boolean; mode: "live" | "simulated"; repository: string | null; token_present: boolean;
  connection: string; can_push: boolean | null; default_branch: string | null; message: string; instructions: string[];
}
export interface PrPreview {
  mode: string; repository: string; base_branch: string; head_branch: string; title: string; commit_message: string; body: string;
  files: { path: string; change: string; diff: string | null; code: string }[]; ready: boolean; not_ready_reason: string | null;
}
export interface PrResult { url: string; number: number; branch: string; simulated: boolean; status: string }

export interface Report {
  generated_at: string; analysis_mode: string; analysis_label: string;
  scan: Record<string, unknown>; summary: { total_findings: number; by_severity: Record<string, number> };
  findings_by_severity: Record<string, { id: number; title: string; severity: string; viewport: string; category: string; confidence: number; source: string; status: string; description: string; element_selector: string | null }[]>;
  verifications: { fix_id: number; issue_id: number; issue_title: string; status: string; resolved: boolean; regressions: string[]; summary: string; before_screenshot_id: number | null; after_screenshot_id: number | null; verification_scan_id: number | null; created_at: string }[];
}
