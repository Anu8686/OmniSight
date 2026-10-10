import type {
  AppSettings, Dashboard, Fix, GithubStatus, Issue, IssueDetail, Page, PrPreview, PrResult, Project, ProjectInput,
  Report, Scan, User, Verification,
} from "@/types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  fields?: { field: string; message: string }[];
  constructor(message: string, status: number, fields?: { field: string; message: string }[]) {
    super(message); this.status = status; this.fields = fields;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

async function request<T>(path: string, init: RequestInit & { json?: unknown; raw?: boolean; noRedirect?: boolean } = {}): Promise<T> {
  const { json, raw, noRedirect, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include", ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Cannot reach the OmniSight API. Check that the backend is running.", 0);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`; let fields: ApiError["fields"];
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg?: string }) => d.msg).join("; ");
      fields = body.errors;
    } catch { /* non-JSON error */ }
    if (res.status === 401 && !noRedirect) onUnauthorized?.();
    throw new ApiError(msg, res.status, fields);
  }
  if (res.status === 204) return undefined as T;
  if (raw) return res as unknown as T;
  return (await res.json()) as T;
}

const qs = (p: Record<string, string | number | boolean | undefined | null>) => {
  const u = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== "all") u.set(k, String(v)); });
  const s = u.toString(); return s ? `?${s}` : "";
};

export const api = {
  auth: {
    me: () => request<User>("/api/auth/me", { noRedirect: true }),
    login: (email: string, password: string) => request<User>("/api/auth/login", { method: "POST", json: { email, password }, noRedirect: true }),
    register: (name: string, email: string, password: string) => request<User>("/api/auth/register", { method: "POST", json: { name, email, password }, noRedirect: true }),
    logout: () => request<void>("/api/auth/logout", { method: "POST", noRedirect: true }),
    update: (name: string) => request<User>("/api/auth/me", { method: "PATCH", json: { name } }),
  },
  dashboard: () => request<Dashboard>("/api/dashboard"),
  settings: () => request<AppSettings>("/api/settings"),
  projects: {
    list: (q?: string) => request<Project[]>(`/api/projects${qs({ q })}`),
    get: (id: number | string) => request<Project>(`/api/projects/${id}`),
    create: (b: ProjectInput) => request<Project>("/api/projects", { method: "POST", json: b }),
    demo: () => request<Project>("/api/projects/demo", { method: "POST" }),
    update: (id: number, b: ProjectInput) => request<Project>(`/api/projects/${id}`, { method: "PATCH", json: b }),
    remove: (id: number) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  },
  scans: {
    list: (p: { project_id?: number | string; status?: string } = {}) => request<Scan[]>(`/api/scans${qs(p)}`),
    get: (id: number | string) => request<Scan>(`/api/scans/${id}`),
    start: (project_id: number, viewports?: string[]) => request<Scan>("/api/scans", { method: "POST", json: { project_id, viewports } }),
    cancel: (id: number) => request<Scan>(`/api/scans/${id}/cancel`, { method: "POST" }),
    issues: (id: number | string) => request<Issue[]>(`/api/scans/${id}/issues`),
  },
  issues: {
    list: (p: Record<string, string | number | undefined>) => request<Page<Issue>>(`/api/issues${qs(p)}`),
    get: (id: number | string) => request<IssueDetail>(`/api/issues/${id}`),
    update: (id: number, b: { status?: "open" | "dismissed"; reviewer?: string; reviewer_comment?: string }) =>
      request<Issue>(`/api/issues/${id}`, { method: "PATCH", json: b }),
    proposeFix: (id: number) => request<Fix>(`/api/issues/${id}/propose-fix`, { method: "POST" }),
  },
  fixes: {
    list: (status?: string) => request<Fix[]>(`/api/fixes${qs({ status })}`),
    get: (id: number) => request<Fix>(`/api/fixes/${id}`),
    approve: (id: number, comment = "") => request<Fix>(`/api/fixes/${id}/approve`, { method: "POST", json: { comment } }),
    reject: (id: number, comment = "") => request<Fix>(`/api/fixes/${id}/reject`, { method: "POST", json: { comment } }),
    apply: (id: number) => request<Fix>(`/api/fixes/${id}/apply`, { method: "POST" }),
    verify: (id: number) => request<Verification>(`/api/fixes/${id}/verify`, { method: "POST" }),
    rollback: (id: number) => request<Fix>(`/api/fixes/${id}/rollback`, { method: "POST" }),
    verifications: (id: number) => request<Verification[]>(`/api/fixes/${id}/verifications`),
    patch: async (id: number) => (await request<Response>(`/api/fixes/${id}/patch`, { raw: true })).text(),
  },
  integrations: {
    githubStatus: () => request<GithubStatus>("/api/integrations/github/status"),
    prPreview: (fix_id: number) => request<PrPreview>("/api/integrations/github/pull-requests/preview", { method: "POST", json: { fix_id } }),
    createPr: (b: { fix_id: number; title?: string; commit_message?: string }) =>
      request<PrResult>("/api/integrations/github/pull-requests", { method: "POST", json: { ...b, approve: true } }),
  },
  reports: {
    get: (id: number | string) => request<Report>(`/api/reports/${id}`),
    file: async (id: number | string, format: "json" | "csv") => (await request<Response>(`/api/reports/${id}?format=${format}&download=true`, { raw: true })).blob(),
  },
};

export const screenshotUrl = (id: number | null | undefined) => (id ? `${API_URL}/api/screenshots/${id}/file` : "");

export function errMsg(e: unknown): string { return e instanceof Error ? e.message : "Something went wrong."; }
