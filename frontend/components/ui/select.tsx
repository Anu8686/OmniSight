"use client";
import * as React from "react";
import * as S from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Opt { value: string; label: string }
/** Simple controlled select. Radix forbids empty-string item values, so callers use e.g. "all". */
export function Select({ value, onValueChange, options, placeholder, className, id, "aria-label": ariaLabel }: {
  value: string; onValueChange: (v: string) => void; options: Opt[]; placeholder?: string; className?: string; id?: string; "aria-label"?: string;
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange}>
      <S.Trigger id={id} aria-label={ariaLabel} className={cn("flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric", className)}>
        <S.Value placeholder={placeholder} />
        <S.Icon><ChevronDown className="h-4 w-4 text-muted" /></S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={4} className="z-[60] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-surface shadow-pop">
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item key={o.value} value={o.value} className="relative flex cursor-pointer select-none items-center rounded-[8px] py-1.5 pl-7 pr-3 text-sm outline-none data-[highlighted]:bg-subtle">
                <S.ItemIndicator className="absolute left-2"><Check className="h-3.5 w-3.5 text-primary" /></S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
