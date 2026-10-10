"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";

export function CreateDemoButton({ label = "Create demo project", ...props }: ButtonProps & { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button loading={busy} {...props} onClick={async () => {
      setBusy(true);
      try { const p = await api.projects.demo(); toast.success("Demo project created."); router.push(`/projects/${p.id}`); }
      catch (e) { toast.error(errMsg(e)); setBusy(false); }
    }}><FlaskConical className="h-4 w-4" />{label}</Button>
  );
}
