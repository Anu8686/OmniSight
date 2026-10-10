"use client";
import * as React from "react";
import Link from "next/link";
import { ExternalLink, FolderKanban, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Card, EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/states";
import { ScanStatusBadge } from "@/components/badges";
import { CreateDemoButton } from "@/components/demo-button";
import { useAsync, useDebounced } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { fmtDate, titleCase } from "@/lib/utils";

export default function ProjectsPage() {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useAsync(() => api.projects.list(dq || undefined), [dq]);
  const rows = (data ?? []).filter((p) => status === "all" || p.status === status);
  return (
    <div>
      <PageHeader title="Projects" description="Sites and apps you audit with OmniSight." actions={<Button asChild><Link href="/projects/new"><Plus className="h-4 w-4" />New project</Link></Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search projects" placeholder="Search projects" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select aria-label="Filter by status" className="w-40" value={status} onValueChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
        </div>
        {loading && !data ? <TableSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : rows.length === 0 ? (
          <EmptyState icon={FolderKanban} title={q || status !== "all" ? "No matching projects" : "No projects yet"} description={q || status !== "all" ? "Try a different search or filter." : "Create a project or start with the bundled demo site."}
            action={!q && status === "all" ? <div className="flex gap-2"><CreateDemoButton /><Button variant="secondary" asChild><Link href="/projects/new">New project</Link></Button></div> : undefined} />
        ) : (
          <Table>
            <THead><TR><TH>Project</TH><TH>Environment</TH><TH>Status</TH><TH>Last scan</TH><TH>Findings</TH><TH>Open</TH></TR></THead>
            <TBody>{rows.map((p) => (
              <TR key={p.id}>
                <TD className="max-w-[320px]"><Link href={`/projects/${p.id}`} className="font-medium hover:text-primary hover:underline">{p.name}</Link>{p.is_demo && <Badge tone="blue" className="ml-2">Demo</Badge>}<span className="mt-0.5 flex items-center gap-1 truncate font-mono text-xs text-muted"><ExternalLink className="h-3 w-3 shrink-0" />{p.target_url}</span></TD>
                <TD>{titleCase(p.environment)}</TD>
                <TD>{p.status === "archived" ? <Badge>Archived</Badge> : <Badge tone="blue">Active</Badge>}</TD>
                <TD>{p.last_scan_at ? <span className="flex flex-col gap-1"><ScanStatusBadge status={p.last_scan_status ?? ""} /><span className="text-xs text-muted">{fmtDate(p.last_scan_at)}</span></span> : <span className="text-muted">Never</span>}</TD>
                <TD className="tabular-nums">{p.total_issue_count}</TD>
                <TD className="tabular-nums">{p.open_issue_count}</TD>
              </TR>
            ))}</TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
