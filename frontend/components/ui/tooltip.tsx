"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tooltip";

export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <T.Provider delayDuration={200}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal><T.Content sideOffset={6} className="z-[70] max-w-xs rounded-md bg-graphite px-2.5 py-1.5 text-xs text-white shadow-pop">{label}</T.Content></T.Portal>
      </T.Root>
    </T.Provider>
  );
}
