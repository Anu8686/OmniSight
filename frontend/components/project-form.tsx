"use client";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError, errMsg } from "@/lib/api";
import type { Project, ProjectInput } from "@/types";

const GH = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
export const projectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(160),
  description: z.string().max(2000),
  target_url: z.string().trim().min(1, "Target URL is required.").max(2048)
    .refine((v) => { try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } }, "Enter a full URL starting with http:// or https://"),
  environment: z.enum(["local", "development", "staging", "production"]),
  github_repo_url: z.string().trim().refine((v) => !v || GH.test(v), "Use the form https://github.com/owner/repo"),
  github_branch: z.string().trim().refine((v) => !v || (/^[\w./-]{1,120}$/.test(v) && !v.includes("..")), "Branch name contains unsupported characters."),
  auth_instructions: z.string().max(2000),
  viewports: z.array(z.enum(["desktop", "tablet", "mobile"])).min(1, "Select at least one viewport."),
  scan_notes: z.string().max(2000),
  expectations: z.string().max(2000),
  source_dir: z.string().max(1024),
  repo_path_prefix: z.string().max(255).refine((v) => !v.includes("..") && /^[\w./-]*$/.test(v), "Path prefix is invalid."),
});
export type ProjectValues = z.infer<typeof projectSchema>;

export const VIEWPORT_PRESETS = [
  { id: "desktop", label: "Desktop", hint: "1440 × 900" }, { id: "tablet", label: "Tablet", hint: "820 × 1180" }, { id: "mobile", label: "Mobile", hint: "390 × 844" },
] as const;
const ENVS = [{ value: "local", label: "Local" }, { value: "development", label: "Development" }, { value: "staging", label: "Staging" }, { value: "production", label: "Production" }];

export function toValues(p?: Project): ProjectValues {
  return {
    name: p?.name ?? "", description: p?.description ?? "", target_url: p?.target_url ?? "", environment: (p?.environment ?? "local") as ProjectValues["environment"],
    github_repo_url: p?.github_repo_url ?? "", github_branch: p?.github_branch ?? "", auth_instructions: p?.auth_instructions ?? "",
    viewports: p?.viewports ?? ["desktop", "tablet", "mobile"], scan_notes: p?.scan_notes ?? "", expectations: p?.expectations ?? "",
    source_dir: p?.source_dir ?? "", repo_path_prefix: p?.repo_path_prefix ?? "",
  };
}
export function toPayload(v: ProjectValues): ProjectInput {
  return { ...v, github_repo_url: v.github_repo_url || null, github_branch: v.github_branch || null, source_dir: v.source_dir || null };
}

export function ProjectForm({ project, submitLabel, onSubmit, onCancel }: { project?: Project; submitLabel: string; onSubmit: (v: ProjectValues) => Promise<void>; onCancel?: () => void }) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [adv, setAdv] = React.useState(!!(project?.source_dir || project?.expectations));
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues: toValues(project) });
  const submit = async (v: ProjectValues) => {
    setServerError(null);
    try { await onSubmit(v); }
    catch (e) {
      if (e instanceof ApiError && e.fields?.length) {
        let any = false;
        e.fields.forEach((f) => { if (f.field in v) { setError(f.field as keyof ProjectValues, { message: f.message }); any = true; } });
        if (any) { setServerError("Please fix the highlighted fields."); return; }
      }
      setServerError(errMsg(e));
    }
  };
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
      {serverError && <div role="alert" className="rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 text-sm text-crimson-dark">{serverError}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name" htmlFor="name" error={errors.name?.message}><Input id="name" aria-invalid={!!errors.name} {...register("name")} /></Field>
        <Field label="Environment" htmlFor="environment" error={errors.environment?.message}>
          <Controller control={control} name="environment" render={({ field }) => <Select id="environment" value={field.value} onValueChange={field.onChange} options={ENVS} />} />
        </Field>
      </div>
      <Field label="Target URL" htmlFor="target_url" error={errors.target_url?.message} hint="The page OmniSight will scan. Only allowed hosts can be scanned (see Settings).">
        <Input id="target_url" placeholder="http://127.0.0.1:5050/index.html" aria-invalid={!!errors.target_url} {...register("target_url")} />
      </Field>
      <Field label="Description" htmlFor="description" error={errors.description?.message}><Textarea id="description" {...register("description")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="GitHub repository URL (optional)" htmlFor="github_repo_url" error={errors.github_repo_url?.message}><Input id="github_repo_url" placeholder="https://github.com/owner/repo" aria-invalid={!!errors.github_repo_url} {...register("github_repo_url")} /></Field>
        <Field label="Branch (optional)" htmlFor="github_branch" error={errors.github_branch?.message}><Input id="github_branch" placeholder="main" aria-invalid={!!errors.github_branch} {...register("github_branch")} /></Field>
      </div>
      <Field label="Authentication instructions (optional)" htmlFor="auth_instructions" error={errors.auth_instructions?.message} hint="Notes for protected test sites. Do not paste real passwords here.">
        <Textarea id="auth_instructions" {...register("auth_instructions")} />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium">Viewport presets</legend>
        <Controller control={control} name="viewports" render={({ field }) => (
          <div className="flex flex-wrap gap-2">
            {VIEWPORT_PRESETS.map((v) => {
              const on = field.value.includes(v.id);
              return (
                <label key={v.id} htmlFor={`vp-${v.id}`} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${on ? "border-primary bg-primary/5" : "border-line bg-surface"}`}>
                  <Checkbox id={`vp-${v.id}`} checked={on} onCheckedChange={(c) => field.onChange(c ? [...field.value, v.id] : field.value.filter((x) => x !== v.id))} />
                  <span>{v.label} <span className="font-mono text-xs text-muted">{v.hint}</span></span>
                </label>
              );
            })}
          </div>
        )} />
        {errors.viewports && <p role="alert" className="mt-1 text-xs text-crimson">{errors.viewports.message}</p>}
      </fieldset>
      <Field label="Scan notes (optional)" htmlFor="scan_notes" error={errors.scan_notes?.message}><Textarea id="scan_notes" {...register("scan_notes")} /></Field>

      <div className="rounded-lg border border-line">
        <button type="button" onClick={() => setAdv(!adv)} aria-expanded={adv} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
          Advanced <ChevronDown className={`h-4 w-4 text-muted transition-transform ${adv ? "rotate-180" : ""}`} />
        </button>
        {adv && (
          <div className="space-y-4 border-t border-line p-4">
            <Field label="Expected behaviour" htmlFor="expectations" error={errors.expectations?.message} hint="Optional context for the analyser, for example 'the checkout button must be fully visible'."><Textarea id="expectations" {...register("expectations")} /></Field>
            <Field label="Local source directory" htmlFor="source_dir" error={errors.source_dir?.message} hint="Absolute path to the site's source. Enables applying fixes in an isolated copy. The original is never modified."><Input id="source_dir" className="font-mono" placeholder="/path/to/site" {...register("source_dir")} /></Field>
            <Field label="Repository path prefix" htmlFor="repo_path_prefix" error={errors.repo_path_prefix?.message} hint="Folder of the site inside the Git repository, used when opening pull requests."><Input id="repo_path_prefix" className="font-mono" placeholder="demo-site" {...register("repo_path_prefix")} /></Field>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
