"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/input";
import { ScanStatusBadge } from "@/components/badges";
import { useScanRunner } from "@/hooks/use-run-scan";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Scan } from "@/types";
import { ErrorState } from "@/components/states";

export function ScanProgress({ scan, onCancel }: { scan: Scan; onCancel?: () => void }) {
  const active = scan.status === "queued" || scan.status === "running";
  return (
    <div className="rounded-lg border border-line bg-subtle/40 p-4" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">Scan #{scan.id} <ScanStatusBadge status={scan.status} /></div>
        <span className="text-sm tabular-nums text-muted">{scan.progress}%</span>
      </div>
      <div role="progressbar" aria-valuenow={scan.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Scan progress" className="h-2 overflow-hidden rounded-full bg-subtle">
        <div className={scan.status === "failed" ? "h-full bg-crimson" : "h-full bg-primary transition-all duration-500"} style={{ width: `${scan.progress}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">{scan.stage}{scan.error_message ? ` — ${scan.error_message}` : ""}</p>
      {active && onCancel && <Button variant="outlineDanger" size="sm" className="mt-3" onClick={onCancel}>Cancel scan</Button>}
    </div>
  );
}

export function RunScanDialog({ open, onOpenChange, defaultProjectId }: { open: boolean; onOpenChange: (o: boolean) => void; defaultProjectId?: number }) {
  const router = useRouter();
  const projects = useAsync(() => api.projects.list(), [open]);
  const [pid, setPid] = React.useState<string>(defaultProjectId ? String(defaultProjectId) : "");
  const runner = useScanRunner();
  const list = (projects.data ?? []).filter((p) => p.status === "active");
  React.useEffect(() => { if (!pid && list.length) setPid(String(defaultProjectId ?? list[0].id)); }, [list, pid, defaultProjectId]);
  React.useEffect(() => { if (!open) runner.reset(); // eslint-disable-line react-hooks/exhaustive-deps
  }, [open]);
  const done = runner.scan && ["completed", "failed", "cancelled"].includes(runner.scan.status);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!runner.running) onOpenChange(o); }}>
      <DialogContent>
        <DialogTitle>Run a visual scan</DialogTitle>
        <DialogDescription>Captures desktop, tablet and mobile screenshots and analyses the page for layout bugs.</DialogDescription>
        <div className="mt-4 space-y-4">
          {projects.error ? <ErrorState message={projects.error} onRetry={projects.reload} /> : !runner.scan ? (
            list.length === 0 && !projects.loading ? (
              <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">You have no active projects yet. <Link className="text-primary underline" href="/projects/new" onClick={() => onOpenChange(false)}>Create one</Link> first.</p>
            ) : (
              <div>
                <Label htmlFor="scan-project">Project</Label>
                <Select id="scan-project" value={pid} onValueChange={setPid} placeholder={projects.loading ? "Loading projects…" : "Select a project"} options={list.map((p) => ({ value: String(p.id), label: p.name }))} />
              </div>
            )
          ) : (
            <>
              <ScanProgress scan={runner.scan} onCancel={runner.cancel} />
              {done && runner.scan.status === "completed" && (
                <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" />Scan finished with {runner.scan.issue_count} finding{runner.scan.issue_count === 1 ? "" : "s"}.</p>
              )}
              {done && runner.scan.status !== "completed" && <p className="flex items-center gap-2 text-sm"><XCircle className="h-4 w-4 text-crimson" />This scan did not complete.</p>}
            </>
          )}
        </div>
        <DialogFooter>
          {!runner.scan && <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
            <Button disabled={!pid} loading={runner.starting} onClick={() => runner.start(Number(pid))}><Play className="h-4 w-4" />Start scan</Button>
          </>}
          {runner.scan && !runner.running && <>
            <Button variant="secondary" onClick={() => { runner.reset(); }}>Run another</Button>
            <Button onClick={() => { onOpenChange(false); router.push(`/scans/${runner.scan!.id}`); }}>View report</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
