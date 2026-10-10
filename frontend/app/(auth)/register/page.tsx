"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { api, errMsg } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email: z.string().min(1, "Enter your email.").email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(128)
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number."),
});
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { user, checking, setUser } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  React.useEffect(() => { if (!checking && user) router.replace("/dashboard"); }, [checking, user, router]);
  const onSubmit = async (v: Values) => {
    setServerError(null);
    try { const u = await api.auth.register(v.name, v.email, v.password); setUser(u); toast.success("Account created."); router.replace("/dashboard"); }
    catch (e) { setServerError(errMsg(e)); }
  };
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Start auditing your UI in a few minutes.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {serverError && <div role="alert" className="rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 text-sm text-crimson-dark">{serverError}</div>}
        <Field label="Full name" htmlFor="name" error={errors.name?.message}><Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} /></Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}><Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} /></Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 10 characters, with a letter and a number.">
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="mt-6 text-sm text-muted">Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
    </>
  );
}
