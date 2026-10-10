"use client";
import * as React from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/states";
import { ScreenshotView } from "@/components/screenshot";
import { SeverityBadge } from "@/components/badges";
import { cn, titleCase } from "@/lib/utils";
import type { Issue, Scan } from "@/types";

/** Per-viewport screenshots with a highlight overlay for the selected finding. */
export function ViewportInspector({ scan, issues }: { scan: Scan; issues: Issue[] }) {
  const vps = scan.viewports.length ? scan.viewports : ["desktop"];
  const [vp, setVp] = React.useState(vps[0]);
  const [sel, setSel] = React.useState<number | null>(null);
  const [kind, setKind] = React.useState<"fullpage" | "viewport">("fullpage");
  const shots = (v: string, k: string) => scan.screenshots.find((s) => s.viewport === v && s.kind === k);
  const forVp = issues.filter((i) => !!i.evidence.by_viewport?.[vp]);
  const selIssue = issues.find((i) => i.id === sel);
  const ev = selIssue?.evidence.by_viewport?.[vp];
  const shot = shots(vp, kind) ?? shots(vp, "fullpage") ?? shots(vp, "viewport");
  const showBox = !!(ev && shot && ev.screenshot_id === shot.id);
  const m = scan.viewport_metrics[vp];

  return (
    <Card>
      <CardHeader title="Screenshots and comparison" description="Select a finding to highlight the affected element." />
      <div className="p-5">
        <Tabs value={vp} onValueChange={setVp}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList aria-label="Viewport">{vps.map((v) => <TabsTrigger key={v} value={v}>{titleCase(v)}</TabsTrigger>)}<TabsTrigger value="compare">Compare all</TabsTrigger></TabsList>
            {vp !== "compare" && (
              <div role="group" aria-label="Capture type" className="inline-flex rounded-md border border-line p-0.5 text-xs">
                {(["fullpage", "viewport"] as const).map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("rounded-[8px] px-2.5 py-1", kind === k ? "bg-primary text-white" : "text-muted hover:text-ink")}>{k === "fullpage" ? "Full page" : "Viewport"}</button>)}
              </div>
            )}
          </div>
          {vps.map((v) => (
            <TabsContent key={v} value={v}>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div>
                  <ScreenshotView id={shot?.id} alt={`${titleCase(v)} screenshot`} box={showBox ? ev!.bounding_box : null} imageSize={showBox ? ev!.image_size : null} maxHeight={640} />
                  {m && <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted"><span>{m.width} × {m.height}</span><span>page height {m.scroll_height}px</span><span>{m.element_count} elements</span>{m.horizontal_overflow && <Badge tone="crimson">Horizontal overflow</Badge>}</p>}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Findings at this size ({forVp.length})</h3>
                  {forVp.length === 0 ? <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">No findings at this viewport.</p> : (
                    <ul className="space-y-2">{forVp.map((i) => (
                      <li key={i.id}><button onClick={() => { setSel(i.id === sel ? null : i.id); setKind("fullpage"); }} aria-pressed={sel === i.id}
                        className={cn("w-full rounded-lg border p-3 text-left text-sm transition-colors", sel === i.id ? "border-crimson bg-crimson/5" : "border-line hover:bg-subtle/50")}>
                        <span className="flex items-start justify-between gap-2"><span className="font-medium">{i.title}</span><SeverityBadge severity={i.severity} /></span>
                        <span className="mt-1 block truncate font-mono text-xs text-muted">{i.evidence.element_selector}</span>
                        {sel === i.id && <Link href={`/issues/${i.id}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Open issue</Link>}
                      </button></li>))}</ul>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
          <TabsContent value="compare">
            <div className="grid gap-4 md:grid-cols-3">{vps.map((v) => { const s = shots(v, "fullpage") ?? shots(v, "viewport"); return (
              <figure key={v}><figcaption className="mb-1.5 text-sm font-medium">{titleCase(v)} <span className="text-xs font-normal text-muted">{scan.viewport_metrics[v]?.width} px</span></figcaption><ScreenshotView id={s?.id} alt={`${titleCase(v)} screenshot`} maxHeight={420} /></figure>); })}</div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
