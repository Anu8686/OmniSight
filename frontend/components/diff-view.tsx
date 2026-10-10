import { cn } from "@/lib/utils";

/** Unified diff renderer (monospace, coloured +/- lines). */
export function UnifiedDiff({ diff, className }: { diff: string; className?: string }) {
  const lines = diff.split("\n");
  return (
    <pre className={cn("scroll-thin max-h-80 overflow-auto rounded-lg border border-line bg-graphite p-3 font-mono text-xs leading-5 text-mist", className)} tabIndex={0} aria-label="Unified diff">
      {lines.map((l, i) => (
        <div key={i} className={cn("whitespace-pre px-1", l.startsWith("+") && !l.startsWith("+++") && "bg-electric/20 text-[#bfdbfe]", l.startsWith("-") && !l.startsWith("---") && "bg-crimson/25 text-[#fecdd3]", (l.startsWith("@@") || l.startsWith("+++") || l.startsWith("---")) && "text-steel")}>{l || " "}</div>
      ))}
    </pre>
  );
}

/** Side-by-side original vs proposed. Original is empty when the fix appends a new override block. */
export function SideBySide({ original, proposed, file }: { original: string; proposed: string; file: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted"><span>Original</span><span className="font-mono">{file}</span></p>
        <pre className="scroll-thin min-h-[88px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-crimson/25 bg-crimson/5 p-3 font-mono text-xs leading-5" tabIndex={0}>
          {original.trim() ? original : <span className="text-muted">{"/* No existing rule is replaced. The change below is appended to the end of the file. */"}</span>}
        </pre>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Proposed</p>
        <pre className="scroll-thin min-h-[88px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-primary/25 bg-primary/5 p-3 font-mono text-xs leading-5" tabIndex={0}>{proposed}</pre>
      </div>
    </div>
  );
}
