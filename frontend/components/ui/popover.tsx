"use client";
import * as React from "react";
import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverContent = ({ className, ...p }: React.ComponentProps<typeof P.Content>) => (
  <P.Portal><P.Content sideOffset={8} align="end" className={cn("z-[60] w-[min(92vw,380px)] rounded-xl border border-line bg-surface shadow-pop", className)} {...p} /></P.Portal>
);
