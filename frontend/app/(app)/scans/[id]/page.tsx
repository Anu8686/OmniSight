"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Bot, FileJson, FileSpreadsheet, Globe, Ruler, ShieldCheck, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, EmptyState, ErrorState, Notice } from "@/components/states";
import { ScanProgress } from "@/components/run-scan";
import { SEVERITY_ORDER, ScanStatusBadge, SeverityBadge, SourceBadge, StatusBadge } from "@/components/badges";
import { ViewportInspector } from "@/components/viewport-inspector";
import { BeforeAfter } from "@/components/before-after";
import { useScanRunnerForExisting } from "@/hooks/use-scan-poll";
import { api, errMsg } from "@/lib/api";
import { downloadBlob, duration, fmtDateTime, pct, titleCase } from "@/lib/utils";
import { useAsync } from "@/hooks/use-async";

export default function ScanReportPage() {
  const { id } = useParams<{ id: string }>();
  const { scan, error, reload, cancel, active } = useScanRunnerForExisting(id);
  const done = scan?.status === "completed";
  const issues = useAsync(() => (done ? api.scans.issues(id) : Promise.resolve([])), [id, done]);
  const report = useAsync(() => (scan && !active ? api.reports.get(id) : Promise.resolve(null)), [id, scan?.status]);
  const [exporting, setExporting] = React.useState<string | null>(null);

  const exportFile = async (f: "json" | "csv") => {
    setExporting(f);
    try { downloadBlob(await api.reports.file(id, f), `omnisight-scan-${id}.${f}`); toast.success(`Exported ${f.toUpperCase()}.`); }
    catch (e) { toast.error(errMsg(e)); } finally { setExporting(null); }
  };

  if (error && !scan) return <Card><ErrorState message={error} onRetry={reload} /></Card>;
  if (!scan) return <div><Skeleton className="mb-6 h-8 w-72" /><Skeleton className="h-64" /></div>;
  const rule = scan.analysis_mode === "rule-based-demo";
  const list = issues.data ?? [];
  const verifs = report.data?.verifications ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight">Scan #{scan.id}</h1><ScanStatusBadge status={scan.status} /></div>
          <p className="mt-1 text-sm text-muted"><Link className="text-primary hover:underline" href={`/projects/${scan.project_id}`}>{scan.project_name}</Link> · {fmtDateTime(scan.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={active || !!exporting} loading={exporting === "json"} onClick={() => exportFile("json")}><FileJson className="h-4 w-4" />Export JSON</Button>
          <Button variant="secondary" disabled={active || !!exporting} loading={exporting === "csv"} onClick={() => exportFile("csv")}><FileSpreadsheet className="h-4 w-4" />Export CSV</Button>
        </div>
      </div>

      {active && <ScanProgress scan={scan} onCancel={cancel} />}
      {scan.status === "failed" && <Notice tone="crimson" icon={AlertTriangle} title="This scan failed">{scan.error_message ?? "No further details were recorded."}</Notice>}
      {scan.status === "cancelled" && <Notice tone="neutral" icon={AlertTriangle} title="This scan was cancelled">{scan.error_message ?? "No findings were recorded."}</Notice>}

      {done && (
        <Notice tone={rule ? "neutral" : "blue"} icon={rule ? Ruler : Bot} title={rule ? "Rule-based demo analysis" : "AI-assisted analysis"}>
          {rule ? "No vision model is configured, so these findings come from deterministic geometry and contrast rules, not from an AI model."
            : "A vision model contributed findings alongside the rule-based checks. Model findings are suggestions and are labelled as such."}
          {scan.ai_notes.filter((n) => !n.startsWith("Demo mode")).map((n, i) => <span key={i} className="mt-1 block">{n}</span>)}
        </Notice>
      )}

      <Card>
        <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted">Target</dt><dd className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-xs"><Globe className="h-3.5 w-3.5 shrink-0 text-steel" />{scan.final_url ?? scan.target_url}</dd></div>
          <div><dt className="text-xs text-muted">Page title</dt><dd className="mt-0.5 truncate text-sm">{scan.page_title ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted">Duration</dt><dd className="mt-0.5 text-sm">{duration(scan.started_at, scan.finished_at)}</dd></div>
          <div><dt className="text-xs text-muted">Viewports</dt><dd className="mt-0.5 text-sm">{scan.viewports.map(titleCase).join(", ")}</dd></div>
        </dl>
        {done && <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-5">
          <div className="bg-surface p-4"><p className="text-xs text-muted">Total findings</p><p className="text-2xl font-semibold tabular-nums">{scan.issue_count}</p></div>
          {SEVERITY_ORDER.map((k) => <div key={k} className="bg-surface p-4"><p className="text-xs text-muted">{titleCase(k)}</p><p className={`text-2xl font-semibold tabular-nums ${k === "critical" && scan.severity_counts[k] ? "text-crimson" : ""}`}>{scan.severity_counts[k] ?? 0}</p></div>)}
        </div>}
      </Card>

      {done && <ViewportInspector scan={scan} issues={list} />}

      {done && (
        <Card>
          <CardHeader title="Findings by severity" description="Grouped from most to least severe." />
          {issues.error ? <ErrorState message={issues.error} onRetry={issues.reload} /> : list.length === 0 ? <EmptyState icon={ShieldCheck} title="No findings" description="This scan did not detect layout problems." /> : (
            <div className="divide-y divide-line">
              {SEVERITY_ORDER.map((sev) => { const g = list.filter((i) => i.severity === sev); if (!g.length) return null; return (
                <section key={sev} aria-label={`${titleCase(sev)} findings`} className="p-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><SeverityBadge severity={sev} /><span className="text-muted">{g.length}</span></h3>
                  <ul className="space-y-2">{g.map((i) => (
                    <li key={i.id}><Link href={`/issues/${i.id}`} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-line p-3 hover:bg-subtle/40">
                      <span className="min-w-0"><span className="block font-medium">{i.title}</span><span className="mt-0.5 block text-xs text-muted">{titleCase(i.category)} · {i.viewport} · confidence {pct(i.confidence)}</span></span>
                      <span className="flex items-center gap-1.5"><SourceBadge source={i.source} /><StatusBadge status={i.status} /></span>
                    </Link></li>))}</ul>
                </section>); })}
            </div>
          )}
        </Card>
      )}

      {verifs.length > 0 && (
        <Card>
          <CardHeader title="Fix verification" description="Before and after screenshots from isolated re-scans." />
          <div className="space-y-6 p-5">{verifs.map((v) => (
            <div key={`${v.fix_id}-${v.created_at}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{v.issue_title}</span><StatusBadge status={v.status === "passed" ? "verified" : "verification_failed"} /><Badge>Fix #{v.fix_id}</Badge></div>
              <p className="mb-3 text-sm text-muted">{v.summary}</p>
              <BeforeAfter before={v.before_screenshot_id} after={v.after_screenshot_id} />
            </div>))}
          </div>
        </Card>
      )}

      {scan.status !== "queued" && scan.status !== "running" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Console errors" description={`${scan.console_errors.length} captured`} />
            {scan.console_errors.length === 0 ? <p className="p-5 text-sm text-muted">No console errors were captured.</p> :
              <ul className="divide-y divide-line">{scan.console_errors.map((e, i) => <li key={i} className="px-5 py-2.5 font-mono text-xs text-crimson-dark break-words">{e}</li>)}</ul>}
          </Card>
          <Card>
            <CardHeader title="Failed network requests" description={`${scan.failed_requests.length} captured`} />
            {scan.failed_requests.length === 0 ? <p className="p-5 text-sm text-muted">No failed requests were captured.</p> :
              <ul className="divide-y divide-line">{scan.failed_requests.map((r, i) => <li key={i} className="flex items-start gap-2 px-5 py-2.5 font-mono text-xs break-all"><WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crimson" /><span>{Object.values(r).map(String).join(" · ")}</span></li>)}</ul>}
          </Card>
        </div>
      )}
    </div>
  );
}
