import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#2563EB" />
      <path d="M5.5 16S10 9.5 16 9.5 26.5 16 26.5 16 22 22.5 16 22.5 5.5 16 5.5 16Z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="3.6" fill="#fff" />
      <circle cx="16" cy="16" r="1.5" fill="#DC143C" />
    </svg>
  );
}
export function Logo({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-[17px] font-semibold tracking-tight", dark ? "text-white" : "text-ink")}>OmniSight</span>
    </span>
  );
}
