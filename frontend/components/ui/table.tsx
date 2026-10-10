import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="scroll-thin w-full overflow-x-auto"><table className={cn("w-full text-left text-sm", className)} {...p} /></div>
);
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="border-b border-line bg-subtle/40" {...p} />;
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className="divide-y divide-line" {...p} />;
export const TR = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("hover:bg-subtle/30", className)} {...p} />;
export const TH = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th scope="col" className={cn("whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted", className)} {...p} />;
export const TD = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-4 py-3 align-middle", className)} {...p} />;
