"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Notice } from "@/components/states";
import { useAuth } from "@/hooks/use-auth";
import { api, errMsg } from "@/lib/api";

const schema = z.object({ email: z.string().min(1, "Enter your email.").email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });
type Values = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, checking, setUser } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  const next = params.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  React.useEffect(() => { if (!checking && user) router.replace(dest); }, [checking, user, router, dest]);

  const onSubmit = async (v: Values) => {
    setServerError(null);
    try { const u = await api.auth.login(v.email, v.password); setUser(u); toast.success(`Welcome back, ${u.name.split(" ")[0]}.`); router.replace(dest); }
    catch (e) { setServerError(errMsg(e)); }
  };
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Sign in to OmniSight</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Enter your details to continue.</p>
      {params.get("demo") && <Notice tone="blue" icon={Info} className="mt-5" title="Sign in to explore the demo">The demo project is created in your own workspace once you are signed in.</Notice>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {serverError && <div role="alert" className="rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 text-sm text-crimson-dark">{serverError}</div>}
        <Field label="Email" htmlFor="email" error={errors.email?.message}><Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} /></Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}><Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
      <p className="mt-6 text-sm text-muted">New to OmniSight? <Link href="/register" className="font-medium text-primary hover:underline">Create an account</Link></p>
    </>
  );
}
export default function LoginPage() { return <React.Suspense fallback={null}><LoginForm /></React.Suspense>; }
