"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FlaskConical, ShieldCheck, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, EmptyState, ErrorState, Notice, PageHeader, TableSkeleton } from "@/components/states";
import { ScanProgress } from "@/components/run-scan";
import { FixCard } from "@/components/fix-card";
import { FixStepper } from "@/components/fix-stepper";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import { useAsync } from "@/hooks/use-async";
import { useScanRunner } from "@/hooks/use-run-scan";
import { api, errMsg } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import type { Fix } from "@/types";

export default function SelfHealingPage() {
  const [status, setStatus] = React.useState("all");
  const { data, error, loading, reload, setData } = useAsync(() => api.fixes.list(status === "all" ? undefined : status), [status]);
  const [selId, setSelId] = React.useState<number | null>(null);
  const [demoIssue, setDemoIssue] = React.useState<number | null>(null);
  const [demoBusy, setDemoBusy] = React.useState(false);
  const runner = useScanRunner(async (s) => {
    if (s.status !== "completed") { toast.error("The demo scan did not complete."); return; }
    try {
      const issues = await api.scans.issues(s.id);
      const first = issues.find((i) => i.severity === "critical") ?? issues[0];
      if (first) setDemoIssue(first.id); else toast.info("The scan found no issues.");
    } catch (e) { toast.error(errMsg(e)); }
  });

  const fixes = data ?? [];
  const sel = fixes.find((f) => f.id === selId) ?? fixes[0] ?? null;
  const replace = (f: Fix) => setData(fixes.map((x) => (x.id === f.id ? f : x)));

  const guided = async () => {
    setDemoBusy(true); setDemoIssue(null); runner.reset();
    try { const p = await api.projects.demo(); await runner.start(p.id); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setDemoBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Self-healing" description="Review proposed CSS fixes, apply them in an isolated workspace and verify them with a re-scan."
        actions={<Button onClick={guided} loading={demoBusy || runner.running} disabled={runner.running}><FlaskConical className="h-4 w-4" />Run the guided demo</Button>} />

      <Notice tone="blue" icon={ShieldCheck} className="mb-5" title="Human approval required. Your source is never modified.">
        Changes are applied only in an isolated workspace copy, and only after you explicitly approve them. The original source files are never modified, every change can be rolled back, and every fix can be downloaded as a patch.
      </Notice>

      {(runner.scan || demoIssue) && (
        <Card className="mb-5">
          <CardHeader title="Guided demo" description="Creates the demo project, scans it, then takes you to a real finding." />
          <div className="space-y-3 p-5">
            {runner.scan && <ScanProgress scan={runner.scan} onCancel={runner.cancel} />}
            {demoIssue && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
                <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" />Scan complete. Next: open the first issue, propose a fix, approve it, apply it and verify.</p>
                <Button asChild><Link href={`/issues/${demoIssue}`}>Open first issue<ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="mb-5 p-5"><FixStepper status={sel?.status ?? null} />
        <p className="mt-3 text-xs text-muted">{sel ? `Showing the workflow state of fix #${sel.id}.` : "No fix selected. The first two steps complete as soon as a scan finds an issue."}</p></Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="self-start">
          <CardHeader title="Proposed fixes" action={<Select aria-label="Filter fixes by status" className="h-8 w-40" value={status} onValueChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...["proposed", "approved", "applied", "verified", "verification_failed", "rejected", "rolled_back"].map((s) => ({ value: s, label: s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()) }))]} />} />
          {loading && !data ? <TableSkeleton rows={4} /> : error ? <ErrorState message={error} onRetry={reload} /> : fixes.length === 0 ? (
            <EmptyState icon={Wand2} title={status === "all" ? "No fixes yet" : "No fixes with this status"} description="Open an issue and click “Propose fix”, or run the guided demo." action={<Button variant="secondary" asChild><Link href="/issues">Browse issues</Link></Button>} />
          ) : (
            <ul className="divide-y divide-line" aria-label="Fixes">{fixes.map((f) => (
              <li key={f.id}><button onClick={() => setSelId(f.id)} aria-current={sel?.id === f.id} className={cn("w-full px-5 py-3.5 text-left hover:bg-subtle/40", sel?.id === f.id && "bg-primary/5 shadow-[inset_3px_0_0_#2563EB]")}>
                <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-sm font-medium">{f.issue_title}</span><StatusBadge status={f.status} /></span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted"><SeverityBadge severity={f.issue_severity} /><span>Fix #{f.id}</span><span>{f.project_name}</span><span>{timeAgo(f.created_at)}</span></span>
              </button></li>))}</ul>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title={sel ? `Fix #${sel.id}: ${sel.issue_title}` : "Fix details"} />
          <div className="p-5">{sel ? <FixCard key={sel.id} fix={sel} onUpdated={replace} showIssueLink /> : <EmptyState title="Select a fix" description="Its diff, approval actions and verification results appear here." />}</div>
        </Card>
      </div>
    </div>
  );
}
