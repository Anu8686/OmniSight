"use client";
import * as React from "react";
import { screenshotUrl } from "@/lib/api";
import { ScreenshotView } from "@/components/screenshot";
import { cn } from "@/lib/utils";

/** Before/after comparison: side by side or draggable slider. */
export function BeforeAfter({ before, after }: { before: number | null; after: number | null }) {
  const [mode, setMode] = React.useState<"side" | "slider">("side");
  const [pos, setPos] = React.useState(50);
  if (!before && !after) return <p className="text-sm text-muted">No comparison screenshots were captured.</p>;
  return (
    <div>
      <div role="group" aria-label="Comparison mode" className="mb-3 inline-flex rounded-md border border-line p-0.5 text-xs">
        {(["side", "slider"] as const).map((m) => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("rounded-[8px] px-2.5 py-1", mode === m ? "bg-primary text-white" : "text-muted hover:text-ink")}>{m === "side" ? "Side by side" : "Slider"}</button>)}
      </div>
      {mode === "side" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <figure><figcaption className="mb-1.5 text-xs font-medium text-crimson-dark">Before</figcaption><ScreenshotView id={before} alt="Screenshot before the fix" maxHeight={460} /></figure>
          <figure><figcaption className="mb-1.5 text-xs font-medium text-primary">After</figcaption><ScreenshotView id={after} alt="Screenshot after the fix" maxHeight={460} /></figure>
        </div>
      ) : (
        <div>
          <div className="scroll-thin relative max-h-[520px] select-none overflow-auto rounded-lg border border-line bg-subtle">
            <div className="relative">
              <img src={screenshotUrl(after)} alt="After the fix" className="block w-full" />
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}><img src={screenshotUrl(before)} alt="Before the fix" className="block w-full max-w-none" /></div>
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${pos}%` }}><span className="absolute left-1/2 top-3 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-[10px] text-white">drag</span></div>
              <span className="absolute left-2 top-2 rounded bg-crimson-dark px-1.5 py-0.5 text-[10px] font-medium text-white">Before</span>
              <span className="absolute right-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-white">After</span>
            </div>
          </div>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Before and after position" className="mt-3 w-full accent-[#2563EB]" />
        </div>
      )}
    </div>
  );
}
