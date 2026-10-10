"use client";
import * as React from "react";
import { Play, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/states";
import { ScansTable } from "@/components/tables";
import { RunScanDialog } from "@/components/run-scan";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

export default function ScansPage() {
  const [status, setStatus] = React.useState("all");
  const [project, setProject] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const projects = useAsync(() => api.projects.list(), []);
  const { data, error, loading, reload } = useAsync(() => api.scans.list({ status, project_id: project }), [status, project]);
  const active = (data ?? []).some((s) => s.status === "running" || s.status === "queued");
  React.useEffect(() => { if (!active) return; const t = setInterval(reload, 3000); return () => clearInterval(t); }, [active, reload]);
  const filtered = status !== "all" || project !== "all";
  return (
    <div>
      <PageHeader title="Scans" description="Every visual scan across your projects." actions={<Button onClick={() => setOpen(true)}><Play className="h-4 w-4" />Run scan</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <Select aria-label="Filter by status" className="w-44" value={status} onValueChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...["completed", "running", "queued", "failed", "cancelled"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))]} />
          <Select aria-label="Filter by project" className="w-60" value={project} onValueChange={setProject} options={[{ value: "all", label: "All projects" }, ...(projects.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))]} />
        </div>
        {loading && !data ? <TableSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : (data ?? []).length === 0
          ? <EmptyState icon={ScanSearch} title={filtered ? "No scans match these filters" : "No scans yet"} description={filtered ? "Clear a filter to see more." : "Run a scan to capture screenshots and detect layout bugs."} action={!filtered ? <Button onClick={() => setOpen(true)}>Run scan</Button> : undefined} />
          : <ScansTable scans={data!} />}
      </Card>
      <RunScanDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reload(); }} />
    </div>
  );
}
