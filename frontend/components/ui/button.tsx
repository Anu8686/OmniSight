import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 ring-offset-bg",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-[#1d4fd0] shadow-card",
        secondary: "bg-surface text-ink border border-line hover:bg-subtle/60",
        ghost: "text-ink hover:bg-subtle/70",
        destructive: "bg-crimson text-white hover:bg-crimson-dark shadow-card",
        outlineDanger: "border border-crimson/40 text-crimson hover:bg-crimson/10",
        dark: "bg-graphite text-white hover:bg-slate",
        success: "bg-success text-white hover:bg-[#126a33]",
      },
      size: { default: "h-9 px-4", sm: "h-8 px-3 text-[13px]", lg: "h-11 px-6 text-[15px]", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean; loading?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>{children}</Comp>;
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";
export { buttonVariants };
