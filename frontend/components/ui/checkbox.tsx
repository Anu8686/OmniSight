"use client";
import * as React from "react";
import * as C from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof C.Root>>(({ className, ...p }, ref) => (
  <C.Root ref={ref} className={cn("flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-steel bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric", className)} {...p}>
    <C.Indicator><Check className="h-3.5 w-3.5 text-white" /></C.Indicator>
  </C.Root>
));
Checkbox.displayName = "Checkbox";
