"use client";
import * as React from "react";
import Link from "next/link";
import { Check, Download, FlaskConical, Play, ShieldCheck, Undo2, X, AlertTriangle, GitPullRequest } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notice } from "@/components/states";
import { SideBySide, UnifiedDiff } from "@/components/diff-view";
import { BeforeAfter } from "@/components/before-after";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SourceBadge, StatusBadge } from "@/components/badges";
import { api, ApiError, errMsg } from "@/lib/api";
import { downloadBlob, fmtDateTime } from "@/lib/utils";
import type { Fix, Verification } from "@/types";

function friendly(e: unknown, action: string): string {
  if (e instanceof ApiError && (e.status === 409 || e.status === 422)) return `Could not ${action}: ${e.message}`;
  return errMsg(e);
}

export function VerificationResult({ v }: { v: Verification }) {
  const ok = v.status === "passed";
  return (
    <div className={`rounded-lg border p-4 ${ok ? "border-success/30 bg-success/5" : "border-crimson/30 bg-crimson/5"}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {ok ? <ShieldCheck className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-crimson" />}
        Verification {ok ? "passed" : v.status === "error" ? "errored" : "failed"}
        <Badge tone={v.resolved ? "green" : "crimson"}>{v.resolved ? "Issue resolved" : "Issue still present"}</Badge>
        <span className="ml-auto text-xs font-normal text-muted">{fmtDateTime(v.created_at)}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{v.summary}</p>
      <div className="mt-2 text-sm"><span className="font-medium">Regressions: </span>
        {v.regressions.length === 0 ? <span className="text-muted">none detected</span> : <ul className="mt-1 list-disc space-y-0.5 pl-5 text-crimson-dark">{v.regressions.map((r, i) => <li key={i}>{r}</li>)}</ul>}</div>
      {v.verification_scan_id && <Link href={`/scans/${v.verification_scan_id}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Open verification scan #{v.verification_scan_id}</Link>}
      <div className="mt-4"><BeforeAfter before={v.before_screenshot_id} after={v.after_screenshot_id} /></div>
    </div>
  );
}

export function FixCard({ fix, onUpdated, showIssueLink = false }: { fix: Fix; onUpdated: (f: Fix) => void; showIssueLink?: boolean }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [decision, setDecision] = React.useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = React.useState("");
  const [rollback, setRollback] = React.useState(false);
  const [verif, setVerif] = React.useState<Verification | null>(fix.latest_verification);
  React.useEffect(() => setVerif(fix.latest_verification), [fix.latest_verification]);

  const refresh = async () => { const f = await api.fixes.get(fix.id); onUpdated(f); return f; };
  const run = async (key: string, action: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); await refresh(); toast.success(ok); return true; }
    catch (e) { toast.error(friendly(e, action)); return false; }
    finally { setBusy(null); }
  };
  const st = fix.status;
  const canApply = fix.can_apply;
  const diffText = fix.patch;

  const download = async () => {
    setBusy("patch");
    try { downloadBlob(new Blob([await api.fixes.patch(fix.id)], { type: "text/x-diff" }), `omnisight-fix-${fix.id}.patch`); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Fix #{fix.id}</h3><StatusBadge status={st} /><SourceBadge source={fix.origin} />
        <span className="font-mono text-xs text-muted">{fix.file}</span>
        {showIssueLink && <Link href={`/issues/${fix.issue_id}`} className="ml-auto text-xs font-medium text-primary hover:underline">Open issue</Link>}
      </div>
      <p className="text-sm text-muted">{fix.explanation}</p>
      {!canApply && <Notice tone="amber" icon={AlertTriangle}>{fix.source_note || "No local source directory is linked, so this fix cannot be applied automatically."}</Notice>}

      <Tabs defaultValue="compare">
        <TabsList><TabsTrigger value="compare">Original vs proposed</TabsTrigger><TabsTrigger value="diff">Unified diff</TabsTrigger></TabsList>
        <TabsContent value="compare"><SideBySide original={fix.original_snippet} proposed={fix.code} file={fix.file} /></TabsContent>
        <TabsContent value="diff">{diffText ? <UnifiedDiff diff={diffText} /> : <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">A unified diff is generated when the fix is applied in the isolated workspace. Until then, the proposed code is shown under “Original vs proposed”, and “Download patch” gives a copy of it.</p>}</TabsContent>
      </Tabs>

      {verif && <VerificationResult v={verif} />}
      {fix.pr_url && <p className="flex flex-wrap items-center gap-2 text-sm"><GitPullRequest className="h-4 w-4 text-steel" />Pull request: <a className="break-all text-primary hover:underline" href={fix.pr_url} target="_blank" rel="noreferrer noopener">{fix.pr_url}</a>{fix.pr_simulated && <Badge tone="amber">Simulated</Badge>}{fix.pr_status && <Badge>{fix.pr_status}</Badge>}</p>}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {st === "proposed" && <>
          <Button size="sm" onClick={() => { setComment(""); setDecision("approve"); }}><Check className="h-4 w-4" />Approve</Button>
          <Button size="sm" variant="outlineDanger" onClick={() => { setComment(""); setDecision("reject"); }}><X className="h-4 w-4" />Reject</Button>
        </>}
        {st === "approved" && <Button size="sm" disabled={!canApply} loading={busy === "apply"} title={canApply ? undefined : "No local source directory is linked"} onClick={() => run("apply", "apply the fix", () => api.fixes.apply(fix.id), "Fix applied in the isolated workspace.")}><Play className="h-4 w-4" />Apply in isolated workspace</Button>}
        {(st === "applied" || st === "verification_failed") && <Button size="sm" loading={busy === "verify"} onClick={() => run("verify", "verify the fix", () => api.fixes.verify(fix.id), "Verification scan finished.")}><FlaskConical className="h-4 w-4" />{st === "applied" ? "Run verification scan" : "Re-run verification"}</Button>}
        {st === "verified" && <Button size="sm" variant="secondary" loading={busy === "verify"} onClick={() => run("verify", "verify the fix", () => api.fixes.verify(fix.id), "Verification scan finished.")}><FlaskConical className="h-4 w-4" />Verify again</Button>}
        {(st === "applied" || st === "verified" || st === "verification_failed") && <Button size="sm" variant="secondary" onClick={() => setRollback(true)}><Undo2 className="h-4 w-4" />Roll back</Button>}
        <Button size="sm" variant="secondary" loading={busy === "patch"} onClick={download}><Download className="h-4 w-4" />Download patch</Button>
      </div>
      {busy === "verify" && <p className="text-xs text-muted" aria-live="polite">Running an isolated re-scan. This usually takes under a minute.</p>}

      <Dialog open={!!decision} onOpenChange={(o) => !o && !busy && setDecision(null)}>
        <DialogContent>
          <DialogTitle>{decision === "approve" ? "Approve this fix?" : "Reject this fix?"}</DialogTitle>
          <DialogDescription>{decision === "approve" ? "Approval only allows OmniSight to apply this change in an isolated copy of your source. Your original files stay untouched." : "The fix will be marked as rejected. You can propose a new one afterwards."}</DialogDescription>
          <div className="mt-4"><Label htmlFor="decision-comment">Comment (optional)</Label><Textarea id="decision-comment" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} placeholder="Reason or review notes" /></div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDecision(null)} disabled={!!busy}>Cancel</Button>
            <Button variant={decision === "reject" ? "destructive" : "default"} loading={busy === "decide"} onClick={async () => {
              const d = decision!;
              const ok = await run("decide", d === "approve" ? "approve the fix" : "reject the fix", () => (d === "approve" ? api.fixes.approve(fix.id, comment) : api.fixes.reject(fix.id, comment)), d === "approve" ? "Fix approved." : "Fix rejected.");
              if (ok) setDecision(null);
            }}>{decision === "approve" ? "Approve fix" : "Reject fix"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={rollback} onOpenChange={setRollback} destructive title="Roll back this fix?" confirmLabel="Roll back"
        description="The isolated workspace copy is discarded and the issue returns to the proposed state. Your original source was never changed."
        onConfirm={async () => { await run("rollback", "roll back the fix", () => api.fixes.rollback(fix.id), "Fix rolled back."); }} />
    </div>
  );
}
