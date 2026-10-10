import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "border-line bg-subtle/60 text-ink/80",
      blue: "border-primary/20 bg-primary/10 text-primary",
      crimson: "border-crimson/25 bg-crimson/10 text-crimson-dark",
      green: "border-success/25 bg-success/10 text-success",
      amber: "border-warn/30 bg-warn/10 text-warn",
      navy: "border-navy/20 bg-navy text-white",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, tone, ...p }: BadgeProps) { return <span className={cn(badgeVariants({ tone }), className)} {...p} />; }
