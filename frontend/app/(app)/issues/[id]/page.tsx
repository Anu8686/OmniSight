"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Ban, Bot, Lightbulb, RotateCcw, Ruler, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, ErrorState, Notice } from "@/components/states";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FixCard } from "@/components/fix-card";
import { FixStepper } from "@/components/fix-stepper";
import { SideBySide } from "@/components/diff-view";
import { ScreenshotView } from "@/components/screenshot";
import { SeverityBadge, SourceBadge, StatusBadge } from "@/components/badges";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError, errMsg } from "@/lib/api";
import { fmtDateTime, pct, titleCase } from "@/lib/utils";
import type { Fix } from "@/types";

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: issue, error, loading, reload } = useAsync(() => api.issues.get(id), [id]);
  const [reviewer, setReviewer] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [proposing, setProposing] = React.useState(false);
  const [dismiss, setDismiss] = React.useState(false);
  React.useEffect(() => { if (issue) { setReviewer(issue.reviewer ?? user?.name ?? ""); setComment(issue.reviewer_comment); } }, [issue?.id, issue?.reviewer, issue?.reviewer_comment]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !issue) return <div><Skeleton className="mb-6 h-8 w-80" /><Skeleton className="h-96" /></div>;
  if (error || !issue) return <Card><ErrorState message={error ?? "Issue not found"} onRetry={reload} /></Card>;

  const vps = Object.keys(issue.evidence.by_viewport ?? {});
  const fix: Fix | undefined = issue.fixes[0] && [...issue.fixes].sort((a, b) => b.id - a.id)[0];
  const olderFixes = issue.fixes.filter((f) => f.id !== fix?.id);
  const ai = issue.source !== "rule-based";
  const dismissed = issue.status === "dismissed";

  const patch = async (b: Parameters<typeof api.issues.update>[1], ok: string) => {
    try { await api.issues.update(issue.id, b); await reload(); toast.success(ok); return true; }
    catch (e) { toast.error(e instanceof ApiError && e.status === 409 ? `Could not update: ${e.message}` : errMsg(e)); return false; }
  };
  const propose = async () => {
    setProposing(true);
    try { await api.issues.proposeFix(issue.id); await reload(); toast.success("Fix proposed. Review it below."); }
    catch (e) { toast.error(e instanceof ApiError && (e.status === 409 || e.status === 422) ? `Could not propose a fix: ${e.message}` : errMsg(e)); }
    finally { setProposing(false); }
  };
  const canPropose = !dismissed && (!fix || fix.status === "rejected" || fix.status === "rolled_back");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">ISS-{String(issue.id).padStart(4, "0")} · <Link className="text-primary hover:underline" href={`/projects/${issue.project_id}`}>{issue.project_name}</Link> · <Link className="text-primary hover:underline" href={`/scans/${issue.scan_id}`}>Scan #{issue.scan_id}</Link></p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{issue.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2"><SeverityBadge severity={issue.severity} /><StatusBadge status={issue.status} /><SourceBadge source={issue.source} /><Badge>{titleCase(issue.category)}</Badge><Badge>{issue.viewport}</Badge></div>
        </div>
        <div className="flex gap-2">
          {canPropose && <Button loading={proposing} onClick={propose} disabled={!issue.suggested_fix && !ai}><Wand2 className="h-4 w-4" />Propose fix</Button>}
          {dismissed ? <Button variant="secondary" onClick={() => patch({ status: "open" }, "Issue reopened.")}><RotateCcw className="h-4 w-4" />Reopen</Button>
            : <Button variant="secondary" onClick={() => setDismiss(true)}><Ban className="h-4 w-4" />Dismiss</Button>}
        </div>
      </div>

      <Card className="p-5"><FixStepper status={fix?.status ?? null} /></Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="Screenshot evidence" description="The affected element is outlined in crimson." />
          <div className="p-5">
            {vps.length === 0 ? <ScreenshotView id={issue.evidence.screenshot_id} alt="Evidence screenshot" box={issue.evidence.bounding_box} imageSize={issue.evidence.image_size} maxHeight={620} /> : (
              <Tabs defaultValue={vps[0]}>
                <TabsList aria-label="Viewport evidence">{vps.map((v) => <TabsTrigger key={v} value={v}>{titleCase(v)}</TabsTrigger>)}</TabsList>
                {vps.map((v) => { const e = issue.evidence.by_viewport![v]; return (
                  <TabsContent key={v} value={v}>
                    <ScreenshotView id={e.screenshot_id} alt={`${titleCase(v)} evidence screenshot`} box={e.bounding_box} imageSize={e.image_size} maxHeight={620} />
                    <p className="mt-2 font-mono text-xs text-muted">box x={Math.round(e.bounding_box.x)} y={Math.round(e.bounding_box.y)} · {Math.round(e.bounding_box.width)} × {Math.round(e.bounding_box.height)} px</p>
                  </TabsContent>); })}
              </Tabs>
            )}
            {issue.evidence.element_selector && <p className="mt-3 text-sm"><span className="text-muted">Element: </span><code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-xs">{issue.evidence.element_selector}</code></p>}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <div className="space-y-4 p-5 text-sm">
              <p>{issue.description}</p>
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-muted">Confidence</dt><dd className="tabular-nums">{pct(issue.confidence)}</dd></div>
                <div><dt className="text-xs text-muted">Detected</dt><dd>{fmtDateTime(issue.created_at)}</dd></div>
                <div><dt className="text-xs text-muted">Rule</dt><dd className="font-mono text-xs">{issue.rule_id}</dd></div>
                <div><dt className="text-xs text-muted">Detection source</dt><dd>{ai ? "AI model suggestion" : "Rule-based check"}</dd></div>
              </dl>
              <Notice tone={ai ? "blue" : "neutral"} icon={ai ? Bot : Ruler}>{ai ? "Found by a vision model. Treat as a suggestion until you verify it." : "Found by a deterministic rule on measured element geometry."} Source is how this was found. Only a passed verification scan marks a fix as verified.</Notice>
            </div>
          </Card>
          <Card>
            <CardHeader title="Reasoning" />
            <div className="p-5"><p className="flex gap-2 text-sm"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-electric" />{issue.reasoning || "No reasoning was recorded."}</p></div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Fix" description="Changes are applied only in an isolated copy, after your approval." />
        <div className="p-5">
          {fix ? <FixCard fix={fix} onUpdated={() => reload()} />
            : issue.suggested_fix ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">{issue.suggested_fix.explanation}</p>
                <SideBySide original="" proposed={issue.suggested_fix.code} file={issue.suggested_fix.file} />
                <p className="text-xs text-muted">This is only a suggestion. Click “Propose fix” to create a reviewable fix.</p>
              </div>
            ) : <p className="text-sm text-muted">This finding has no automatic fix suggestion. Review it manually.</p>}
          {olderFixes.length > 0 && <p className="mt-4 border-t border-line pt-3 text-xs text-muted">Earlier attempts: {olderFixes.map((f) => `#${f.id} (${f.status.replace("_", " ")})`).join(", ")}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Review" description="Record who reviewed this finding and why." />
        <form className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" onSubmit={async (e) => { e.preventDefault(); setSaving(true); await patch({ reviewer, reviewer_comment: comment }, "Review saved."); setSaving(false); }}>
          <div><Label htmlFor="reviewer">Reviewer</Label><Input id="reviewer" maxLength={120} value={reviewer} onChange={(e) => setReviewer(e.target.value)} /></div>
          <div><Label htmlFor="reviewer-comment">Comment</Label><Textarea id="reviewer-comment" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          <div className="sm:col-span-2"><Button type="submit" loading={saving}><Save className="h-4 w-4" />Save review</Button></div>
        </form>
      </Card>

      <ConfirmDialog open={dismiss} onOpenChange={setDismiss} destructive title="Dismiss this issue?" confirmLabel="Dismiss issue"
        description="Dismissed issues are hidden from the open list. You can reopen it later."
        onConfirm={async () => { const ok = await patch({ status: "dismissed", reviewer: reviewer || undefined, reviewer_comment: comment }, "Issue dismissed."); if (!ok) throw new Error("dismiss failed"); }} />
    </div>
  );
}
