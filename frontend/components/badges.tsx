import { AlertOctagon, AlertTriangle, Bot, CheckCircle2, CircleDashed, Info, Loader2, Ruler, ShieldCheck, XCircle, Ban, Undo2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

export const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;
export const SEVERITY_COLOR: Record<string, string> = { critical: "#DC143C", high: "#A30F2D", medium: "#B45309", low: "#687386" };

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { tone: "crimson" | "amber" | "neutral"; Icon: typeof Info; cls?: string }> = {
    critical: { tone: "crimson", Icon: AlertOctagon, cls: "bg-crimson text-white border-crimson" },
    high: { tone: "crimson", Icon: AlertTriangle },
    medium: { tone: "amber", Icon: AlertTriangle },
    low: { tone: "neutral", Icon: Info },
  };
  const m = map[severity] ?? map.low;
  return <Badge tone={m.tone} className={m.cls}><m.Icon className="h-3 w-3" aria-hidden />{titleCase(severity)}</Badge>;
}

export function ScanStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed": return <Badge tone="green"><CheckCircle2 className="h-3 w-3" aria-hidden />Completed</Badge>;
    case "failed": return <Badge tone="crimson"><XCircle className="h-3 w-3" aria-hidden />Failed</Badge>;
    case "cancelled": return <Badge><Ban className="h-3 w-3" aria-hidden />Cancelled</Badge>;
    case "running": return <Badge tone="blue"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />Running</Badge>;
    case "queued": return <Badge tone="blue"><Clock className="h-3 w-3" aria-hidden />Queued</Badge>;
    default: return <Badge>{titleCase(status)}</Badge>;
  }
}

/** Issue + fix statuses. Green is reserved for verified. */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>—</Badge>;
  const s = status;
  if (s === "verified") return <Badge tone="green"><ShieldCheck className="h-3 w-3" aria-hidden />Verified</Badge>;
  if (s === "verification_failed" || s === "rejected") return <Badge tone="crimson"><XCircle className="h-3 w-3" aria-hidden />{titleCase(s)}</Badge>;
  if (s === "open") return <Badge tone="amber"><CircleDashed className="h-3 w-3" aria-hidden />Open</Badge>;
  if (s === "fix_proposed" || s === "proposed" || s === "approved" || s === "fix_applied" || s === "applied")
    return <Badge tone="blue">{titleCase(s)}</Badge>;
  if (s === "rolled_back") return <Badge><Undo2 className="h-3 w-3" aria-hidden />Rolled back</Badge>;
  return <Badge>{titleCase(s)}</Badge>;
}

/** Origin of a finding. Deliberately distinct from verification status. */
export function SourceBadge({ source }: { source: string }) {
  const ai = source !== "rule-based";
  return ai
    ? <Badge tone="blue"><Bot className="h-3 w-3" aria-hidden />AI suggestion</Badge>
    : <Badge className="font-mono"><Ruler className="h-3 w-3" aria-hidden />Rule-based</Badge>;
}
