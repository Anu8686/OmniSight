import Link from "next/link";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ScanStatusBadge, SeverityBadge, SourceBadge, StatusBadge } from "@/components/badges";
import { duration, fmtDateTime, pct, titleCase } from "@/lib/utils";
import { SEVERITY_ORDER } from "@/components/badges";
import type { Issue, Scan } from "@/types";

export function ScansTable({ scans, showProject = true }: { scans: Scan[]; showProject?: boolean }) {
  return (
    <Table>
      <THead><TR><TH>Scan</TH>{showProject && <TH>Project</TH>}<TH>Status</TH><TH>Mode</TH><TH>Findings</TH><TH>Duration</TH><TH>Started</TH></TR></THead>
      <TBody>{scans.map((s) => (
        <TR key={s.id}>
          <TD><Link href={`/scans/${s.id}`} className="font-medium text-primary hover:underline">#{s.id}</Link></TD>
          {showProject && <TD className="max-w-[240px] truncate">{s.project_name}</TD>}
          <TD><ScanStatusBadge status={s.status} /></TD>
          <TD className="text-muted">{s.analysis_mode === "rule-based-demo" ? "Rule-based" : "AI + rules"}</TD>
          <TD><span className="tabular-nums">{s.issue_count}</span>
            {s.issue_count > 0 && <span className="ml-2 text-xs text-muted">{SEVERITY_ORDER.filter((k) => s.severity_counts[k]).map((k) => `${s.severity_counts[k]} ${k}`).join(", ")}</span>}</TD>
          <TD className="tabular-nums text-muted">{duration(s.started_at, s.finished_at)}</TD>
          <TD className="whitespace-nowrap text-muted">{fmtDateTime(s.created_at)}</TD>
        </TR>
      ))}</TBody>
    </Table>
  );
}

export function IssuesTable({ issues, showProject = true, full = false }: { issues: Issue[]; showProject?: boolean; full?: boolean }) {
  return (
    <Table>
      <THead><TR><TH>ID</TH><TH>Title</TH>{showProject && <TH>Project</TH>}<TH>Severity</TH><TH>Category</TH><TH>Viewport</TH>{full && <TH>Confidence</TH>}<TH>Status</TH>{full && <TH>Source</TH>}<TH>Detected</TH>{full && <TH>Reviewer</TH>}</TR></THead>
      <TBody>{issues.map((i) => (
        <TR key={i.id}>
          <TD><Link href={`/issues/${i.id}`} className="font-mono text-xs text-primary hover:underline">ISS-{String(i.id).padStart(4, "0")}</Link></TD>
          <TD className="max-w-[320px]"><Link href={`/issues/${i.id}`} className="line-clamp-2 font-medium hover:text-primary hover:underline">{i.title}</Link></TD>
          {showProject && <TD className="max-w-[180px] truncate text-muted">{i.project_name}</TD>}
          <TD><SeverityBadge severity={i.severity} /></TD>
          <TD className="text-muted">{titleCase(i.category)}</TD>
          <TD className="whitespace-nowrap text-muted">{i.viewport}</TD>
          {full && <TD className="tabular-nums">{pct(i.confidence)}</TD>}
          <TD><StatusBadge status={i.status} /></TD>
          {full && <TD><SourceBadge source={i.source} /></TD>}
          <TD className="whitespace-nowrap text-muted">{fmtDateTime(i.created_at)}</TD>
          {full && <TD className="text-muted">{i.reviewer ?? "—"}</TD>}
        </TR>
      ))}</TBody>
    </Table>
  );
}
