import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

/** Backend returns naive UTC ISO strings; force UTC interpretation. */
export function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(s);
  const d = new Date(hasZone ? s : s + "Z");
  return isNaN(d.getTime()) ? null : d;
}
export function fmtDate(s?: string | null): string {
  const d = parseDate(s); if (!d) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
export function fmtDateTime(s?: string | null): string {
  const d = parseDate(s); if (!d) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function timeAgo(s?: string | null): string {
  const d = parseDate(s); if (!d) return "—";
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  if (sec < 86400 * 14) return `${Math.round(sec / 86400)} d ago`;
  return fmtDate(s);
}
export function duration(a?: string | null, b?: string | null): string {
  const s = parseDate(a), e = parseDate(b); if (!s || !e) return "—";
  const sec = Math.max(0, Math.round((e.getTime() - s.getTime()) / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const titleCase = (s: string) => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
