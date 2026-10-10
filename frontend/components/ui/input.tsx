import * as React from "react";
import { cn } from "@/lib/utils";

const field = "w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric disabled:opacity-60 aria-[invalid=true]:border-crimson";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(field, "h-9", className)} {...p} />,
);
Input.displayName = "Input";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, "min-h-[84px] py-2", className)} {...p} />,
);
Textarea.displayName = "Textarea";
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink", className)} {...p} />;
}
export function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="mt-1 text-xs text-crimson">{message}</p> : null;
}
export function Field({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}
