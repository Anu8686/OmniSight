"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ExternalLink, Pencil, Play, Trash2, Bug, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, EmptyState, ErrorState, Pagination } from "@/components/states";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IssuesTable, ScansTable } from "@/components/tables";
import { ProjectForm, toPayload } from "@/components/project-form";
import { RunScanDialog } from "@/components/run-scan";
import { useAsync } from "@/hooks/use-async";
import { api, errMsg } from "@/lib/api";
import { fmtDateTime, titleCase } from "@/lib/utils";
import { TableSkeleton } from "@/components/states";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 break-words text-sm">{children || <span className="text-muted">—</span>}</dd></div>;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const project = useAsync(() => api.projects.get(id), [id]);
  const scans = useAsync(() => api.scans.list({ project_id: id }), [id]);
  const [ipage, setIpage] = React.useState(1);
  const issues = useAsync(() => api.issues.list({ project_id: id, page: ipage, page_size: 10 }), [id, ipage]);
  const [edit, setEdit] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);

  if (project.loading && !project.data) return <div><Skeleton className="mb-6 h-8 w-72" /><Skeleton className="h-40" /></div>;
  if (project.error || !project.data) return <Card><ErrorState message={project.error ?? "Project not found"} onRetry={project.reload} /></Card>;
  const p = project.data;
  const refreshAll = () => { project.reload(); scans.reload(); issues.reload(); };

  const toggleArchive = async () => {
    setArchiving(true);
    try { project.setData(await api.projects.update(p.id, { status: p.status === "active" ? "archived" : "active" })); toast.success(p.status === "active" ? "Project archived." : "Project restored."); }
    catch (e) { toast.error(errMsg(e)); } finally { setArchiving(false); }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight">{p.name}</h1>{p.is_demo && <Badge tone="blue">Demo</Badge>}{p.status === "archived" ? <Badge>Archived</Badge> : <Badge tone="blue">Active</Badge>}<Badge>{titleCase(p.environment)}</Badge></div>
          <a href={p.target_url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-primary"><ExternalLink className="h-3 w-3" />{p.target_url}</a>
          {p.description && <p className="mt-2 max-w-2xl text-sm text-muted">{p.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setScanOpen(true)} disabled={p.status === "archived"} title={p.status === "archived" ? "Restore the project to scan it" : undefined}><Play className="h-4 w-4" />Run scan</Button>
          <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Edit</Button>
          <Button variant="secondary" onClick={toggleArchive} loading={archiving}>{p.status === "active" ? <><Archive className="h-4 w-4" />Archive</> : <><ArchiveRestore className="h-4 w-4" />Restore</>}</Button>
          <Button variant="outlineDanger" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" />Delete</Button>
        </div>
      </div>

      <Tabs defaultValue="scans">
        <TabsList><TabsTrigger value="scans">Scan history ({scans.data?.length ?? p.scan_count})</TabsTrigger><TabsTrigger value="issues">Issues ({p.total_issue_count})</TabsTrigger><TabsTrigger value="details">Details</TabsTrigger></TabsList>
        <TabsContent value="scans">
          <Card>{scans.loading && !scans.data ? <TableSkeleton /> : scans.error ? <ErrorState message={scans.error} onRetry={scans.reload} /> : (scans.data ?? []).length === 0
            ? <EmptyState icon={ScanSearch} title="No scans yet" description="Run a scan to capture screenshots and detect layout bugs." action={<Button onClick={() => setScanOpen(true)} disabled={p.status === "archived"}>Run scan</Button>} />
            : <ScansTable scans={scans.data!} showProject={false} />}</Card>
        </TabsContent>
        <TabsContent value="issues">
          <Card>{issues.loading && !issues.data ? <TableSkeleton /> : issues.error ? <ErrorState message={issues.error} onRetry={issues.reload} /> : (issues.data?.items ?? []).length === 0
            ? <EmptyState icon={Bug} title="No issues" description="Findings from this project's scans will appear here." />
            : <><IssuesTable issues={issues.data!.items} showProject={false} /><Pagination page={issues.data!.page} pageSize={issues.data!.page_size} total={issues.data!.total} onPage={setIpage} /></>}</Card>
        </TabsContent>
        <TabsContent value="details">
          <Card><CardHeader title="Project configuration" /><dl className="grid gap-5 p-5 sm:grid-cols-2">
            <Detail label="Viewports">{p.viewports.map(titleCase).join(", ")}</Detail>
            <Detail label="GitHub repository">{p.github_repo_url && <a className="text-primary hover:underline" href={p.github_repo_url} target="_blank" rel="noreferrer noopener">{p.github_repo_url}</a>}</Detail>
            <Detail label="Branch">{p.github_branch}</Detail>
            <Detail label="Repository path prefix"><span className="font-mono text-xs">{p.repo_path_prefix}</span></Detail>
            <Detail label="Local source directory"><span className="font-mono text-xs">{p.source_dir}</span></Detail>
            <Detail label="Created">{fmtDateTime(p.created_at)}</Detail>
            <Detail label="Authentication instructions">{p.auth_instructions}</Detail>
            <Detail label="Scan notes">{p.scan_notes}</Detail>
            <Detail label="Expected behaviour">{p.expectations}</Detail>
          </dl></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Edit project</DialogTitle><DialogDescription>Changes apply to future scans.</DialogDescription>
          <div className="mt-4"><ProjectForm project={p} submitLabel="Save changes" onCancel={() => setEdit(false)} onSubmit={async (v) => {
            project.setData(await api.projects.update(p.id, toPayload(v))); toast.success("Project updated."); setEdit(false);
          }} /></div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={del} onOpenChange={setDel} destructive title="Delete this project?" confirmLabel="Delete project"
        description={`This permanently deletes "${p.name}" together with its scans, screenshots, issues and fixes. This cannot be undone.`}
        onConfirm={async () => { try { await api.projects.remove(p.id); toast.success("Project deleted."); router.push("/projects"); } catch (e) { toast.error(errMsg(e)); throw e; } }} />
      <RunScanDialog open={scanOpen} onOpenChange={(o) => { setScanOpen(o); if (!o) refreshAll(); }} defaultProjectId={p.id} />
    </div>
  );
}
