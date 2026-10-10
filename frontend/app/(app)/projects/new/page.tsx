"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/states";
import { CreateDemoButton } from "@/components/demo-button";
import { ProjectForm, toPayload } from "@/components/project-form";
import { api } from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New project" description="Describe the site you want to audit." actions={<CreateDemoButton variant="secondary" label="Use the demo site instead" />} />
      <Card className="p-5 sm:p-6">
        <ProjectForm submitLabel="Create project" onCancel={() => router.push("/projects")} onSubmit={async (v) => {
          const p = await api.projects.create(toPayload(v));
          toast.success("Project created."); router.push(`/projects/${p.id}`);
        }} />
      </Card>
    </div>
  );
}
