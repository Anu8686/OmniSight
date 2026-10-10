"use client";
import * as React from "react";
import { ImageOff } from "lucide-react";
import { screenshotUrl } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { BBox } from "@/types";

/** Screenshot with an optional bounding-box highlight overlay (box coords are in image pixels). */
export function ScreenshotView({ id, alt, box, imageSize, className, maxHeight }: {
  id: number | null | undefined; alt: string; box?: BBox | null; imageSize?: [number, number] | null; className?: string; maxHeight?: number;
}) {
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");
  const [nat, setNat] = React.useState<[number, number] | null>(null);
  React.useEffect(() => { setState("loading"); }, [id]);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const boxKey = box ? `${box.x},${box.y}` : "";
  React.useEffect(() => {
    const el = boxRef.current, sc = el?.closest<HTMLElement>("[data-scroll]");
    if (el && sc && state === "ok") sc.scrollTo({ top: Math.max(0, el.offsetTop - sc.clientHeight / 3), behavior: "smooth" });
  }, [state, boxKey, id]);
  if (!id) return <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">No screenshot</div>;
  const size = imageSize ?? nat;
  return (
    <div className={className}>
      <div data-scroll className="scroll-thin relative overflow-auto rounded-lg border border-line bg-subtle" style={maxHeight ? { maxHeight } : undefined}>
        {state === "loading" && <Skeleton className="absolute inset-0 h-full min-h-[160px] w-full" />}
        {state === "error" ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 text-sm text-muted"><ImageOff className="h-5 w-5" />Screenshot unavailable</div>
        ) : (
          <div className="relative inline-block w-full">
            <img src={screenshotUrl(id)} alt={alt} className="block h-auto w-full"
              onLoad={(e) => { setState("ok"); setNat([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight]); }}
              onError={() => setState("error")} />
            {state === "ok" && box && size && (
              <div ref={boxRef} aria-label="Highlighted element" className="pointer-events-none absolute rounded-[3px] border-2 border-crimson bg-crimson/15 shadow-[0_0_0_2px_rgba(255,255,255,0.7)]"
                style={{ left: `${(box.x / size[0]) * 100}%`, top: `${(box.y / size[1]) * 100}%`, width: `${(box.width / size[0]) * 100}%`, height: `${(box.height / size[1]) * 100}%` }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
