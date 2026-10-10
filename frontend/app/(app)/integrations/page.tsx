"use client";
import * as React from "react";
import Link from "next/link";
import { Bot, ExternalLink, GitBranch, GitPullRequest, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, EmptyState, ErrorState, Notice, PageHeader } from "@/components/states";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UnifiedDiff } from "@/components/diff-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { api, ApiError, errMsg } from "@/lib/api";
import type { PrPreview, PrResult } from "@/types";

const READY = ["approved", "applied", "verified", "verification_failed"];

function Env({ children }: { children: React.ReactNode }) { return <code className="rounded bg-graphite px-2 py-1 font-mono text-xs text-mist">{children}</code>; }

export default function IntegrationsPage() {
  const gh = useAsync(() => api.integrations.githubStatus(), []);
  const settings = useAsync(() => api.settings(), []);
  const fixes = useAsync(() => api.fixes.list(), []);
  const [fixId, setFixId] = React.useState("");
  const [preview, setPreview] = React.useState<PrPreview | null>(null);
  const [loadingPrev, setLoadingPrev] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [commit, setCommit] = React.useState("");
  const [approved, setApproved] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [result, setResult] = React.useState<PrResult | null>(null);

  const eligible = (fixes.data ?? []).filter((f) => READY.includes(f.status));
  const loadPreview = async () => {
    if (!fixId) return;
    setLoadingPrev(true); setPreview(null); setResult(null); setApproved(false);
    try { const p = await api.integrations.prPreview(Number(fixId)); setPreview(p); setTitle(p.title); setCommit(p.commit_message); }
    catch (e) { toast.error(errMsg(e)); } finally { setLoadingPrev(false); }
  };
  const create = async () => {
    try {
      const r = await api.integrations.createPr({ fix_id: Number(fixId), title, commit_message: commit });
      setResult(r); setApproved(false); toast.success(r.simulated ? "Simulated pull request created." : "Pull request created."); fixes.reload();
    } catch (e) { toast.error(e instanceof ApiError && (e.status === 409 || e.status === 400) ? `Could not create the pull request: ${e.message}` : errMsg(e)); throw e; }
  };
  const g = gh.data;

  return (
    <div className="space-y-5">
      <PageHeader title="Integrations" description="Connect GitHub for pull requests and review the AI analysis provider." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><GitBranch className="h-4 w-4" />GitHub</span>} action={<Button variant="secondary" size="sm" loading={gh.loading} onClick={gh.reload}><RefreshCw className="h-3.5 w-3.5" />Re-check</Button>} />
          {gh.loading && !g ? <div className="space-y-2 p-5"><Skeleton className="h-6 w-40" /><Skeleton className="h-16" /></div> : gh.error || !g ? <ErrorState message={gh.error ?? "Unavailable"} onRetry={gh.reload} /> : (
            <div className="space-y-4 p-5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {g.mode === "live" ? <Badge tone="green">Live</Badge> : <Badge tone="amber">Simulated</Badge>}
                <Badge tone={g.connection === "ok" ? "green" : g.connection === "error" ? "crimson" : "neutral"}>{g.connection.replace("_", " ")}</Badge>
                {g.repository && <span className="font-mono text-xs">{g.repository}</span>}
              </div>
              <p className="text-muted">{g.message}</p>
              {g.mode === "live" && <dl className="grid grid-cols-2 gap-3"><div><dt className="text-xs text-muted">Default branch</dt><dd>{g.default_branch ?? "—"}</dd></div><div><dt className="text-xs text-muted">Can push</dt><dd>{g.can_push === null ? "—" : g.can_push ? "Yes" : "No"}</dd></div></dl>}
              {g.mode === "simulated" && <Notice tone="amber" title="Simulated mode">Pull requests are created locally for demonstration. Nothing is sent to GitHub, and the resulting URL is not a real pull request.</Notice>}
              <div>
                <p className="mb-2 font-medium">How to connect</p>
                <ol className="list-decimal space-y-2 pl-5 text-muted">{g.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
                <div className="mt-3 space-y-1.5"><div><Env>GITHUB_TOKEN=&lt;fine-grained token&gt;</Env></div><div><Env>GITHUB_REPOSITORY=owner/repo</Env></div></div>
                <p className="mt-2 text-xs text-muted">Credentials are set in the backend environment only. OmniSight never asks for tokens in the browser. Token configured: {g.token_present ? "yes" : "no"}.</p>
              </div>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Bot className="h-4 w-4" />AI provider</span>} />
          {settings.loading && !settings.data ? <div className="space-y-2 p-5"><Skeleton className="h-6 w-40" /><Skeleton className="h-16" /></div> : settings.error || !settings.data ? <ErrorState message={settings.error ?? "Unavailable"} onRetry={settings.reload} /> : (
            <div className="space-y-4 p-5 text-sm">
              <div className="flex flex-wrap items-center gap-2">{settings.data.ai.configured ? <Badge tone="blue">Vision model active</Badge> : <Badge>Rule-based demo mode</Badge>}{settings.data.ai.provider && <span className="font-mono text-xs">{settings.data.ai.provider} / {settings.data.ai.model}</span>}</div>
              <p className="text-muted">{settings.data.ai.message}</p>
              {!settings.data.ai.configured && <div className="space-y-1.5"><p className="font-medium">To enable a vision model</p><div><Env>AI_PROVIDER=&lt;provider&gt;</Env></div><div><Env>AI_MODEL=&lt;model name&gt;</Env></div><p className="text-xs text-muted">Add the provider API key in <code className="font-mono">backend/.env</code> and restart the backend. Keys are never entered here.</p></div>}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><GitPullRequest className="h-4 w-4" />Pull request</span>} description="Preview and open a pull request for an approved fix." />
        <div className="space-y-5 p-5">
          {fixes.loading && !fixes.data ? <Skeleton className="h-10" /> : fixes.error ? <ErrorState message={fixes.error} onRetry={fixes.reload} /> : eligible.length === 0 ? (
            <EmptyState icon={GitPullRequest} title="No approved fixes yet" description="A fix must be approved before a pull request can be opened." action={<Button variant="secondary" asChild><Link href="/self-healing">Go to Self-healing</Link></Button>} />
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1 sm:max-w-lg"><Label htmlFor="pr-fix">Fix</Label>
                <Select id="pr-fix" value={fixId} onValueChange={(v) => { setFixId(v); setPreview(null); setResult(null); }} placeholder="Select an approved fix" options={eligible.map((f) => ({ value: String(f.id), label: `#${f.id} · ${f.issue_title}` }))} /></div>
              <Button onClick={loadPreview} disabled={!fixId} loading={loadingPrev}>Preview pull request</Button>
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              <Notice tone={preview.mode === "live" ? "blue" : "amber"} title={preview.mode === "live" ? "Live pull request" : "Simulated pull request"}>
                {preview.mode === "live" ? `A real pull request will be opened on ${preview.repository}.` : "GitHub is not configured. Creating this pull request is simulated and nothing is sent to GitHub."}
              </Notice>
              <dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted">Repository</dt><dd className="font-mono text-xs">{preview.repository}</dd></div><div><dt className="text-xs text-muted">Base branch</dt><dd className="font-mono text-xs">{preview.base_branch}</dd></div><div><dt className="text-xs text-muted">Head branch</dt><dd className="font-mono text-xs">{preview.head_branch}</dd></div></dl>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label htmlFor="pr-title">Pull request title</Label><Input id="pr-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div><Label htmlFor="pr-commit">Commit message</Label><Input id="pr-commit" maxLength={300} value={commit} onChange={(e) => setCommit(e.target.value)} /></div>
              </div>
              {preview.files.map((f) => (
                <div key={f.path}><p className="mb-1.5 text-sm"><span className="font-mono text-xs">{f.path}</span> <span className="text-muted">· {f.change}</span></p>{f.diff ? <UnifiedDiff diff={f.diff} /> : <pre className="scroll-thin overflow-auto rounded-lg border border-primary/25 bg-primary/5 p-3 font-mono text-xs">{f.code}</pre>}</div>
              ))}
              {!preview.ready && <Notice tone="amber" title="Not ready">{preview.not_ready_reason}</Notice>}
              <label htmlFor="pr-approve" className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm">
                <Checkbox id="pr-approve" checked={approved} onCheckedChange={(c) => setApproved(c === true)} className="mt-0.5" disabled={!preview.ready} />
                <span>I have reviewed this change and explicitly approve writing it to {preview.mode === "live" ? <span className="font-mono text-xs">{preview.repository}</span> : "the repository (simulated)"}.</span>
              </label>
              <Button disabled={!approved || !preview.ready || !title.trim()} onClick={() => setConfirm(true)}><GitPullRequest className="h-4 w-4" />Approve and Create Pull Request</Button>
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-line bg-subtle/40 p-4 text-sm" role="status">
              <div className="mb-2 flex flex-wrap items-center gap-2 font-medium">Pull request {result.status}{result.simulated && <Badge tone="amber">Simulated</Badge>}{result.number ? <span className="text-muted">#{result.number}</span> : null}</div>
              <p>Branch <code className="font-mono text-xs">{result.branch}</code></p>
              {result.simulated ? <p className="mt-1 break-all font-mono text-xs">{result.url}</p> : <a href={result.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 break-all text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5 shrink-0" />{result.url}</a>}
              {result.simulated && <p className="mt-2 text-xs text-muted">This URL is simulated and will not resolve to a real pull request.</p>}
            </div>
          )}
        </div>
      </Card>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Create this pull request?" confirmLabel="Approve and Create Pull Request"
        description={preview?.mode === "live" ? `This writes branch ${preview.head_branch} to ${preview.repository} and opens a pull request.` : "GitHub is not configured, so this will be a simulated pull request. Nothing is written to GitHub."} onConfirm={create} />
    </div>
  );
}
