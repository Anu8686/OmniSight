import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FixStatus } from "@/types";

export const STEPS = ["Plan", "Analyze", "Propose Fix", "Request Approval", "Apply in Isolated Workspace", "Re-scan", "Evaluate", "Report"];
type S = "done" | "current" | "todo" | "failed";

/** Derives each step's state from the real fix status (null = no fix proposed yet). */
export function stepStates(status: FixStatus | null): S[] {
  switch (status) {
    case null: return ["done", "done", "current", "todo", "todo", "todo", "todo", "todo"];
    case "proposed": return ["done", "done", "done", "current", "todo", "todo", "todo", "todo"];
    case "rejected": return ["done", "done", "done", "failed", "todo", "todo", "todo", "todo"];
    case "approved": return ["done", "done", "done", "done", "current", "todo", "todo", "todo"];
    case "rolled_back": return ["done", "done", "done", "done", "failed", "todo", "todo", "todo"];
    case "applied": return ["done", "done", "done", "done", "done", "current", "todo", "todo"];
    case "verified": return ["done", "done", "done", "done", "done", "done", "done", "done"];
    case "verification_failed": return ["done", "done", "done", "done", "done", "done", "failed", "done"];
  }
}

export function FixStepper({ status }: { status: FixStatus | null }) {
  const st = stepStates(status);
  return (
    <ol className="scroll-thin flex gap-0 overflow-x-auto pb-1" aria-label="Self-healing workflow progress">
      {STEPS.map((label, i) => {
        const s = st[i];
        return (
          <li key={label} className="flex min-w-[96px] flex-1 flex-col items-center text-center" aria-current={s === "current" ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : st[i - 1] === "done" ? "bg-primary" : "bg-line")} />
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                s === "done" && "border-primary bg-primary text-white", s === "current" && "border-primary bg-surface text-primary ring-4 ring-primary/15",
                s === "failed" && "border-crimson bg-crimson text-white", s === "todo" && "border-line bg-surface text-muted")}>
                {s === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : s === "failed" ? <X className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn("h-0.5 flex-1", i === STEPS.length - 1 ? "bg-transparent" : s === "done" ? "bg-primary" : "bg-line")} />
            </div>
            <span className={cn("mt-2 px-1 text-[11px] leading-tight", s === "todo" ? "text-muted" : "font-medium text-ink")}>{label}<span className="sr-only"> ({s === "done" ? "complete" : s === "current" ? "current step" : s === "failed" ? "failed or stopped" : "not started"})</span></span>
          </li>
        );
      })}
    </ol>
  );
}
