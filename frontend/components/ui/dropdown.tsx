"use client";
import * as React from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownTrigger = M.Trigger;
export const DropdownContent = ({ className, ...p }: React.ComponentProps<typeof M.Content>) => (
  <M.Portal><M.Content sideOffset={6} align="end" className={cn("z-[60] min-w-[200px] rounded-lg border border-line bg-surface p-1 shadow-pop", className)} {...p} /></M.Portal>
);
export const DropdownItem = ({ className, destructive, ...p }: React.ComponentProps<typeof M.Item> & { destructive?: boolean }) => (
  <M.Item className={cn("flex cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-subtle", destructive && "text-crimson", className)} {...p} />
);
export const DropdownLabel = ({ className, ...p }: React.ComponentProps<typeof M.Label>) => <M.Label className={cn("px-2.5 py-1.5 text-xs text-muted", className)} {...p} />;
export const DropdownSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
