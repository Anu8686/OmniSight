"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, FolderKanban, LayoutDashboard, LogOut, Menu, Plug, ScanSearch, Search, Settings, ShieldCheck, Bug, Wand2, User as UserIcon, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useAsync, useDebounced } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { ScanStatusBadge, SeverityBadge, StatusBadge } from "@/components/badges";
import type { Issue, Project } from "@/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/scans", label: "Scans", icon: ScanSearch },
  { href: "/issues", label: "Issues", icon: Bug },
  { href: "/self-healing", label: "Self-Healing", icon: Wand2 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <div className="flex h-full flex-col bg-graphite text-mist">
      <div className="flex h-14 items-center px-5"><Link href="/dashboard" onClick={onNavigate} aria-label="OmniSight dashboard"><Logo dark /></Link></div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3 py-3">
        {NAV.map((n) => {
          const active = path === n.href || path.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "bg-primary text-white" : "text-mist/75 hover:bg-slate hover:text-white")}>
              <n.icon className="h-4 w-4" aria-hidden />{n.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-lg border border-slate bg-slate/40 p-3 text-xs text-mist/70">
        <p className="mb-1 flex items-center gap-1.5 font-medium text-white"><ShieldCheck className="h-3.5 w-3.5 text-electric" />Human approval</p>
        Fixes run only in an isolated copy, after you approve them.
      </div>
    </div>
  );
}

function labelFor(seg: string, prev: string | undefined): string {
  if (/^\d+$/.test(seg)) return prev === "scans" ? `Scan #${seg}` : prev === "issues" ? `Issue #${seg}` : `Project #${seg}`;
  return seg === "self-healing" ? "Self-Healing" : seg.replace(/\b\w/g, (c) => c.toUpperCase());
}
function Breadcrumbs() {
  const path = usePathname();
  const segs = path.split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm sm:flex">
      {segs.map((s, i) => {
        const href = "/" + segs.slice(0, i + 1).join("/");
        const last = i === segs.length - 1;
        return (
          <React.Fragment key={href}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden />}
            {last ? <span aria-current="page" className="truncate font-medium">{labelFor(s, segs[i - 1])}</span>
              : <Link href={href} className="text-muted hover:text-ink">{labelFor(s, segs[i - 1])}</Link>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const dq = useDebounced(q.trim(), 250);
  const [res, setRes] = React.useState<{ issues: Issue[]; projects: Project[] } | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!dq) { setRes(null); return; }
    let live = true; setBusy(true);
    Promise.all([api.issues.list({ q: dq, page_size: 5 }), api.projects.list(dq)])
      .then(([i, p]) => { if (live) setRes({ issues: i.items, projects: p.slice(0, 5) }); })
      .catch(() => { if (live) setRes({ issues: [], projects: [] }); })
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [dq]);
  const go = (href: string) => { setOpen(false); setQ(""); router.push(href); };
  return (
    <Popover open={open && q.trim().length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <form role="search" className="relative w-full max-w-md" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(`/issues?q=${encodeURIComponent(q.trim())}`); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input aria-label="Search issues and projects" placeholder="Search issues and projects" value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            className="h-9 w-full rounded-md border border-line bg-subtle/50 pl-9 pr-3 text-sm placeholder:text-muted focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric" />
        </form>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[min(92vw,460px)] p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
        {busy && !res ? <p className="flex items-center gap-2 p-3 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />Searching…</p> : res && (
          <div role="listbox" aria-label="Search results">
            {res.projects.length === 0 && res.issues.length === 0 && <p className="p-3 text-sm text-muted">No matches for “{q}”.</p>}
            {res.projects.length > 0 && <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted">Projects</p>}
            {res.projects.map((p) => (
              <button key={p.id} role="option" aria-selected={false} onClick={() => go(`/projects/${p.id}`)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-subtle">
                <span className="flex min-w-0 items-center gap-2"><FolderKanban className="h-4 w-4 shrink-0 text-steel" /><span className="truncate">{p.name}</span></span>
              </button>
            ))}
            {res.issues.length > 0 && <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted">Issues</p>}
            {res.issues.map((i) => (
              <button key={i.id} role="option" aria-selected={false} onClick={() => go(`/issues/${i.id}`)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-subtle">
                <span className="flex min-w-0 items-center gap-2"><Bug className="h-4 w-4 shrink-0 text-steel" /><span className="truncate">{i.title}</span></span><SeverityBadge severity={i.severity} />
              </button>
            ))}
            <button onClick={() => go(`/issues?q=${encodeURIComponent(q.trim())}`)} className="mt-1 w-full rounded-md border-t border-line px-2 py-2 text-left text-sm text-primary hover:bg-subtle">See all issues matching “{q}”</button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Notifications() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const data = useAsync(async () => {
    const [scans, fixes] = await Promise.all([api.scans.list(), api.fixes.list()]);
    return { scans: scans.slice(0, 4), fixes: fixes.slice(0, 4) };
  }, [open]);
  const items = data.data ? [
    ...data.data.scans.map((s) => ({ key: `s${s.id}`, when: s.finished_at ?? s.created_at, href: `/scans/${s.id}`, title: `Scan #${s.id} ${s.status}`, sub: `${s.project_name} · ${s.issue_count} finding${s.issue_count === 1 ? "" : "s"}`, badge: <ScanStatusBadge status={s.status} /> })),
    ...data.data.fixes.map((f) => ({ key: `f${f.id}`, when: f.latest_verification?.created_at ?? f.approved_at ?? f.created_at, href: `/self-healing`, title: `Fix #${f.id} ${f.status.replace("_", " ")}`, sub: f.issue_title, badge: <StatusBadge status={f.status} /> })),
  ].sort((a, b) => (b.when > a.when ? 1 : -1)).slice(0, 6) : [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label="Notifications"><Bell className="h-[18px] w-[18px]" /></Button></PopoverTrigger>
      <PopoverContent>
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">Recent activity</div>
        {data.loading && !data.data ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          : data.error ? <p className="p-4 text-sm text-crimson">{data.error}</p>
          : items.length === 0 ? <p className="p-4 text-sm text-muted">No scans or fixes yet. Run a scan to see activity here.</p>
          : <ul className="max-h-80 overflow-y-auto p-1">{items.map((n) => (
            <li key={n.key}><button onClick={() => { setOpen(false); router.push(n.href); }} className="flex w-full items-start justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-subtle">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{n.title}</span><span className="block truncate text-xs text-muted">{n.sub}</span><span className="text-xs text-muted">{timeAgo(n.when)}</span></span>
              {n.badge}
            </button></li>))}</ul>}
      </PopoverContent>
    </Popover>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const initials = (user?.name ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button aria-label="Open profile menu" className="flex h-9 items-center gap-2 rounded-md pl-1 pr-2 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{initials}</span>
          <span className="hidden max-w-[120px] truncate text-sm font-medium md:inline">{user?.name}</span>
        </button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownLabel>{user?.email}</DropdownLabel>
        <DropdownItem onSelect={() => router.push("/settings")}><UserIcon className="h-4 w-4" />Profile &amp; settings</DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={() => logout()}><LogOut className="h-4 w-4" />Log out</DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, checking } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [drawer, setDrawer] = React.useState(false);
  React.useEffect(() => { if (!checking && !user) router.replace("/login"); }, [checking, user, router]);
  React.useEffect(() => { setDrawer(false); }, [path]);

  if (checking || !user) {
    return (
      <div className="flex min-h-screen" aria-busy="true" aria-label="Checking your session">
        <div className="hidden w-60 bg-graphite lg:block" />
        <div className="flex-1 p-8"><Skeleton className="mb-6 h-8 w-56" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div></div>
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block"><SidebarContent /></aside>
      <Dialog open={drawer} onOpenChange={setDrawer}>
        <DialogContent className="left-0 top-0 h-full max-h-none w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-0 bg-graphite p-0">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <SidebarContent onNavigate={() => setDrawer(false)} />
        </DialogContent>
      </Dialog>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}><Menu className="h-5 w-5" /></Button>
          <Breadcrumbs />
          <div className="ml-auto flex w-full max-w-md items-center justify-end gap-1 sm:gap-2"><GlobalSearch /><Notifications /><ProfileMenu /></div>
        </header>
        <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
