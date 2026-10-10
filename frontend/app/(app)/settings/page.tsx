"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, CardHeader, ErrorState, PageHeader } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { applyTheme, getTheme, type ThemePref } from "@/components/theme";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/hooks/use-auth";
import { api, errMsg } from "@/lib/api";
import { cn, fmtDate } from "@/lib/utils";

const schema = z.object({ name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80) });

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const settings = useAsync(() => api.settings(), []);
  const [theme, setTheme] = React.useState<ThemePref>("light");
  React.useEffect(() => setTheme(getTheme()), []);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<{ name: string }>({ resolver: zodResolver(schema), defaultValues: { name: user?.name ?? "" } });
  React.useEffect(() => { if (user) reset({ name: user.name }); }, [user, reset]);
  const s = settings.data;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" description="Your profile, appearance and the backend configuration in effect." />
      <Card>
        <CardHeader title="Profile" />
        <form className="space-y-4 p-5" noValidate onSubmit={handleSubmit(async (v) => { try { setUser(await api.auth.update(v.name)); toast.success("Profile updated."); } catch (e) { toast.error(errMsg(e)); } })}>
          <Field label="Name" htmlFor="profile-name" error={errors.name?.message}><Input id="profile-name" aria-invalid={!!errors.name} {...register("name")} /></Field>
          <Field label="Email" htmlFor="profile-email" hint="Email cannot be changed."><Input id="profile-email" value={user?.email ?? ""} readOnly disabled /></Field>
          <p className="text-xs text-muted">Member since {fmtDate(user?.created_at)}</p>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save profile</Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Appearance" description="Stored in this browser only." />
        <div className="p-5">
          <div role="radiogroup" aria-label="Theme" className="inline-flex flex-wrap gap-2">
            {([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as const).map(([v, l, Icon]) => (
              <button key={v} role="radio" aria-checked={theme === v} onClick={() => { setTheme(v); applyTheme(v); }}
                className={cn("flex items-center gap-2 rounded-lg border px-4 py-2 text-sm", theme === v ? "border-primary bg-primary/5 text-primary" : "border-line hover:bg-subtle/50")}><Icon className="h-4 w-4" />{l}</button>
            ))}
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Environment" description="Read-only. Change these in backend/.env." />
        {settings.loading && !s ? <div className="space-y-2 p-5"><Skeleton className="h-6" /><Skeleton className="h-6" /><Skeleton className="h-6" /></div> : settings.error || !s ? <ErrorState message={settings.error ?? "Unavailable"} onRetry={settings.reload} /> : (
          <dl className="divide-y divide-line text-sm">
            {[
              ["Environment", <Badge key="e">{s.environment}</Badge>],
              ["AI mode", s.ai.configured ? <span key="a" className="flex items-center gap-2"><Badge tone="blue">Vision model</Badge><span className="font-mono text-xs">{s.ai.provider} / {s.ai.model}</span></span> : <Badge key="a">Rule-based demo</Badge>],
              ["GitHub mode", s.github.configured ? <span key="g" className="flex items-center gap-2"><Badge tone="green">Live</Badge><span className="font-mono text-xs">{s.github.repository}</span></span> : <Badge key="g" tone="amber">Simulated</Badge>],
              ["Allowed scan hosts", <span key="h" className="flex flex-wrap gap-1.5">{s.allowed_scan_hosts.length ? s.allowed_scan_hosts.map((h) => <code key={h} className="rounded bg-subtle px-1.5 py-0.5 font-mono text-xs">{h}</code>) : "None"}</span>],
              ["Authentication", s.auth_mode],
              ["Scan limits", `${s.limits.scan_timeout_seconds}s timeout, up to ${s.limits.max_dom_elements} DOM elements analysed`],
            ].map(([k, v], i) => <div key={i} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[180px_1fr]"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
      </Card>
      <Card>
        <CardHeader title="Security notes" />
        <ul className="list-disc space-y-1.5 p-5 pl-9 text-sm text-muted">
          <li>Sessions use an HttpOnly cookie. The browser never sees the session token.</li>
          <li>Scans only run against allowed hosts, and internal network addresses are rejected.</li>
          <li>Fixes are applied in an isolated copy after explicit approval. Original source is never modified.</li>
          <li>API keys and GitHub tokens live in backend environment variables, never in the browser.</li>
        </ul>
      </Card>
    </div>
  );
}
