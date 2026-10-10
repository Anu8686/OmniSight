"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { api, errMsg } from "@/lib/api";

export function HeroCtas() {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const demo = async () => {
    if (!user) { router.push("/login?demo=1"); return; }
    setBusy(true);
    try { const p = await api.projects.demo(); toast.success("Demo project ready."); router.push(`/projects/${p.id}`); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" asChild><Link href={user ? "/dashboard" : "/register"}>Start Visual Audit<ArrowRight className="h-4 w-4" /></Link></Button>
      <Button size="lg" variant="secondary" className="border-slate bg-slate/50 text-white hover:bg-slate" onClick={demo} loading={busy}><Play className="h-4 w-4" />Explore Demo</Button>
    </div>
  );
}

export function NavAuth() {
  const { user, checking } = useAuth();
  if (checking) return <span className="h-8 w-20" aria-hidden />;
  return user
    ? <Button size="sm" asChild><Link href="/dashboard">Dashboard</Link></Button>
    : <><Link href="/login" className="rounded-md px-3 py-1.5 text-sm font-medium text-mist/80 hover:text-white">Sign In</Link><Button size="sm" asChild className="hidden sm:inline-flex"><Link href="/register">Get started</Link></Button></>;
}
