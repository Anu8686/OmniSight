"use client";
import * as React from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bug, FileText, FolderKanban, Info, Play, Plus, ScanSearch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Card, CardHeader, EmptyState, ErrorState, Notice, PageHeader } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ScanStatusBadge, SeverityBadge, StatusBadge, SEVERITY_COLOR, SEVERITY_ORDER } from "@/components/badges";
import { RunScanDialog } from "@/components/run-scan";
import { CreateDemoButton } from "@/components/demo-button";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { fmtDate, timeAgo, titleCase } from "@/lib/utils";

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone?: "crimson" | "success" }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between"><p className="text-sm text-muted">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone === "crimson" ? "bg-crimson/10 text-crimson" : tone === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}><Icon className="h-4 w-4" /></span></div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
    </Card>
  );
}

const tick = { fontSize: 12, fill: "#687386" };
const tooltipStyle = { borderRadius: 10, border: "1px solid #E0E5ED", fontSize: 12, boxShadow: "0 8px 30px rgba(20,33,61,0.14)" };

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.dashboard(), []);
  const [scanOpen, setScanOpen] = React.useState(false);

  const actions = (
    <>
      <Button variant="secondary" asChild><Link href="/projects/new"><Plus className="h-4 w-4" />New Project</Link></Button>
      <Button variant="secondary" asChild><Link href="/scans"><FileText className="h-4 w-4" />View Reports</Link></Button>
      <Button onClick={() => setScanOpen(true)}><Play className="h-4 w-4" />Run Scan</Button>
    </>
  );
  const header = <PageHeader title={`Welcome back${user ? `, ${user.name.split(" ")[0]}` : ""}`} description="Visual QA overview across your projects." actions={actions} />;

  if (loading && !data) return <div>{header}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><div className="mt-4 grid gap-4 lg:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div></div>;
  if (error || !data) return <div>{header}<Card><ErrorState message={error ?? "No data"} onRetry={reload} /></Card></div>;

  const d = data;
  const sev = SEVERITY_ORDER.map((k) => ({ name: titleCase(k), key: k, value: d.severity_distribution[k] ?? 0 }));
  const sevTotal = sev.reduce((a, b) => a + b.value, 0);
  const activity = d.activity.map((a) => ({ ...a, label: new Date(a.date + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) }));
  const vp = ["desktop", "tablet", "mobile"].map((k) => ({ name: titleCase(k), value: d.viewport_coverage[k] ?? 0 }));
  const empty = !d.is_sample && d.totals.projects === 0;

  return (
    <div>
      {header}
      {d.is_sample && (
        <Notice tone="amber" icon={Info} className="mb-5" title="Demo data">
          <span>{d.sample_label}</span>
          <div className="mt-3"><CreateDemoButton size="sm" label="Create demo project" /></div>
        </Notice>
      )}
      {empty && <Card><EmptyState icon={FolderKanban} title="No projects yet" description="Create a project, or start with the bundled demo site that contains deliberate UI bugs." action={<div className="flex gap-2"><CreateDemoButton /><Button variant="secondary" asChild><Link href="/projects/new">New project</Link></Button></div>} /></Card>}

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total projects" value={d.totals.projects} icon={FolderKanban} />
        <Kpi label="Total scans" value={d.totals.scans} icon={ScanSearch} />
        <Kpi label="Bugs detected" value={d.totals.bugs_detected} icon={Bug} tone="crimson" />
        <Kpi label="Fixes verified" value={d.totals.fixes_verified} icon={ShieldCheck} tone="success" />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Scan activity" description="Last 14 days. Failed includes cancelled scans." />
          <div className="h-64 p-4" role="img" aria-label="Bar chart of completed and failed scans per day">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#E8ECF2" vertical={false} />
                <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={1} />
                <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F5F7FA" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" name="Failed" stackId="a" fill="#DC143C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Severity distribution" description={`${sevTotal} finding${sevTotal === 1 ? "" : "s"}`} />
          {sevTotal === 0 ? <EmptyState title="No findings yet" description="Run a scan to see severity breakdown." /> : (
            <div className="p-4">
              <div className="h-44" role="img" aria-label="Donut chart of findings by severity">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={sev} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">{sev.map((s) => <Cell key={s.key} fill={SEVERITY_COLOR[s.key]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">{sev.map((s) => <li key={s.key} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_COLOR[s.key] }} />{s.name}</span><span className="tabular-nums text-muted">{s.value}</span></li>)}</ul>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Viewport coverage" description="Scans that captured each viewport" />
          <div className="h-48 p-4" role="img" aria-label="Bar chart of scans per viewport">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vp} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={tick} tickLine={false} axisLine={false} width={64} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#F5F7FA" }} />
                <Bar dataKey="value" name="Scans" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recent scans" action={<Button variant="ghost" size="sm" asChild><Link href="/scans">View all</Link></Button>} />
          {d.recent_scans.length === 0 ? <EmptyState icon={ScanSearch} title="No scans yet" description="Run your first scan to see activity here." action={<Button size="sm" onClick={() => setScanOpen(true)}>Run scan</Button>} /> : (
            <Table>
              <THead><TR><TH>Scan</TH><TH>Project</TH><TH>Status</TH><TH>Findings</TH><TH>When</TH></TR></THead>
              <TBody>{d.recent_scans.map((s) => (
                <TR key={s.id}><TD><Link className="font-medium text-primary hover:underline" href={`/scans/${s.id}`}>#{s.id}</Link></TD><TD className="max-w-[200px] truncate">{s.project_name}</TD><TD><ScanStatusBadge status={s.status} /></TD><TD className="tabular-nums">{s.issue_count}</TD><TD className="text-muted">{timeAgo(s.created_at)}</TD></TR>
              ))}</TBody>
            </Table>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent issues" action={<Button variant="ghost" size="sm" asChild><Link href="/issues">View all</Link></Button>} />
          {d.recent_issues.length === 0 ? <EmptyState icon={Bug} title="No issues yet" description="Findings from your scans appear here." /> : (
            <Table>
              <THead><TR><TH>Issue</TH><TH>Severity</TH><TH>Viewport</TH><TH>Status</TH></TR></THead>
              <TBody>{d.recent_issues.map((i) => (
                <TR key={i.id}><TD className="max-w-[320px]"><Link className="line-clamp-1 font-medium hover:text-primary hover:underline" href={`/issues/${i.id}`}>{i.title}</Link><span className="text-xs text-muted">{i.project_name}</span></TD><TD><SeverityBadge severity={i.severity} /></TD><TD className="text-muted">{i.viewport}</TD><TD><StatusBadge status={i.status} /></TD></TR>
              ))}</TBody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent projects" action={<Button variant="ghost" size="sm" asChild><Link href="/projects">View all</Link></Button>} />
          {d.recent_projects.length === 0 ? <EmptyState icon={FolderKanban} title="No projects" description="Add a project to start scanning." /> : (
            <ul className="divide-y divide-line">{d.recent_projects.map((p) => (
              <li key={p.id}><Link href={`/projects/${p.id}`} className="block px-5 py-3 hover:bg-subtle/40"><span className="block truncate text-sm font-medium">{p.name}</span><span className="text-xs text-muted">{p.open_issue_count} open · last scan {p.last_scan_at ? fmtDate(p.last_scan_at) : "never"}</span></Link></li>
            ))}</ul>
          )}
        </Card>
      </div>
      <RunScanDialog open={scanOpen} onOpenChange={(o) => { setScanOpen(o); if (!o) reload(); }} />
    </div>
  );
}
