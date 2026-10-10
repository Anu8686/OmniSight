"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export const TabsList = ({ className, ...p }: React.ComponentProps<typeof T.List>) => (
  <T.List className={cn("inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-line bg-subtle/60 p-1", className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: React.ComponentProps<typeof T.Trigger>) => (
  <T.Trigger className={cn("whitespace-nowrap rounded-[8px] px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:shadow-card", className)} {...p} />
);
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof T.Content>) => <T.Content className={cn("mt-4 focus:outline-none", className)} {...p} />;
