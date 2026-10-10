"use client";
import * as React from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-card", className)} {...p} />;
}
export function CardHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-3.5", className)}>
      <div><h2 className="text-sm font-semibold">{title}</h2>{description && <p className="mt-0.5 text-xs text-muted">{description}</p>}</div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: { icon?: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-subtle text-steel"><Icon className="h-5 w-5" /></div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-crimson/10 text-crimson"><AlertCircle className="h-5 w-5" /></div>
      <h3 className="text-sm font-semibold">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}

export function Notice({ tone = "blue", icon: Icon, title, children, className }: { tone?: "blue" | "amber" | "crimson" | "neutral"; icon?: React.ComponentType<{ className?: string }>; title?: string; children: React.ReactNode; className?: string }) {
  const t = { blue: "border-primary/25 bg-primary/5", amber: "border-warn/30 bg-warn/5", crimson: "border-crimson/30 bg-crimson/5", neutral: "border-line bg-subtle/50" }[tone];
  const ic = { blue: "text-primary", amber: "text-warn", crimson: "text-crimson", neutral: "text-steel" }[tone];
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", t, className)}>
      {Icon && <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ic)} />}
      <div className="min-w-0">{title && <p className="font-medium">{title}</p>}<div className={cn(title && "mt-0.5", "text-muted")}>{children}</div></div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1, to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm text-muted">
      <span>{from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="tabular-nums">Page {page} of {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
