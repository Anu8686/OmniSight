"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bug, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton } from "@/components/states";
import { IssuesTable } from "@/components/tables";
import { useAsync, useDebounced } from "@/hooks/use-async";
import { api } from "@/lib/api";

const ALL = { value: "all", label: "All" };
const opts = (xs: string[]) => [ALL, ...xs.map((x) => ({ value: x, label: x.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase()) }))];

function IssuesInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(sp.get("q") ?? "");
  const [f, setF] = React.useState({ severity: "all", status: "all", project: "all", viewport: "all", category: "all", from: "", to: "" });
  const [page, setPage] = React.useState(1);
  React.useEffect(() => { setQ(sp.get("q") ?? ""); }, [sp]);
  const dq = useDebounced(q);
  const projects = useAsync(() => api.projects.list(), []);
  const set = (k: keyof typeof f) => (v: string) => { setF((s) => ({ ...s, [k]: v })); setPage(1); };
  const { data, error, loading, reload } = useAsync(() => api.issues.list({
    q: dq || undefined, severity: f.severity === "all" ? undefined : f.severity, status: f.status === "all" ? undefined : f.status,
    project_id: f.project === "all" ? undefined : f.project, viewport: f.viewport === "all" ? undefined : f.viewport,
    category: f.category === "all" ? undefined : f.category, date_from: f.from || undefined, date_to: f.to || undefined, page, page_size: 15,
  }), [dq, f, page]);
  const filtered = dq || Object.entries(f).some(([, v]) => v !== "all" && v !== "");
  const clear = () => { setQ(""); setF({ severity: "all", status: "all", project: "all", viewport: "all", category: "all", from: "", to: "" }); setPage(1); if (sp.get("q")) router.replace("/issues"); };

  return (
    <div>
      <PageHeader title="Issues" description="UI bugs detected across all scans. Open an issue to review evidence and propose a fix." />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search issues by title" placeholder="Search issues by title" className="pl-9" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div></div>
          <div><Label htmlFor="f-sev">Severity</Label><Select id="f-sev" value={f.severity} onValueChange={set("severity")} options={opts(["critical", "high", "medium", "low"])} /></div>
          <div><Label htmlFor="f-status">Status</Label><Select id="f-status" value={f.status} onValueChange={set("status")} options={opts(["open", "fix_proposed", "fix_applied", "verified", "verification_failed", "dismissed"])} /></div>
          <div><Label htmlFor="f-proj">Project</Label><Select id="f-proj" value={f.project} onValueChange={set("project")} options={[ALL, ...(projects.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))]} /></div>
          <div><Label htmlFor="f-vp">Viewport</Label><Select id="f-vp" value={f.viewport} onValueChange={set("viewport")} options={opts(["desktop", "tablet", "mobile"])} /></div>
          <div><Label htmlFor="f-cat">Category</Label><Select id="f-cat" value={f.category} onValueChange={set("category")} options={opts(["alignment", "contrast", "navigation", "obscured-element", "overlap", "responsive-layout"])} /></div>
          <div><Label htmlFor="f-from">Detected from</Label><Input id="f-from" type="date" value={f.from} onChange={(e) => set("from")(e.target.value)} /></div>
          <div><Label htmlFor="f-to">Detected to</Label><Input id="f-to" type="date" value={f.to} onChange={(e) => set("to")(e.target.value)} /></div>
          <div className="flex items-end">{filtered && <Button variant="ghost" onClick={clear}><X className="h-4 w-4" />Clear filters</Button>}</div>
        </div>
        {loading && !data ? <TableSkeleton rows={8} /> : error ? <ErrorState message={error} onRetry={reload} /> : (data?.items ?? []).length === 0
          ? <EmptyState icon={Bug} title={filtered ? "No issues match these filters" : "No issues yet"} description={filtered ? "Try removing a filter." : "Run a scan on a project to detect UI bugs."} action={filtered ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />
          : <><IssuesTable issues={data!.items} full /><Pagination page={data!.page} pageSize={data!.page_size} total={data!.total} onPage={setPage} /></>}
      </Card>
    </div>
  );
}
export default function IssuesPage() { return <React.Suspense fallback={null}><IssuesInner /></React.Suspense>; }
