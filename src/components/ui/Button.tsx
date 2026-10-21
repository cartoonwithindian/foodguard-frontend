"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-dark disabled:pointer-events-none disabled:opacity-50",
  secondary:
    "bg-primary-light text-primary-dark hover:bg-primary/20 active:bg-primary/25 disabled:pointer-events-none disabled:opacity-50",
  outline:
    "border border-primary/35 bg-transparent text-primary hover:bg-primary-light disabled:pointer-events-none disabled:opacity-50",
  ghost:
    "text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
  danger:
    "border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
  icon: "size-11 rounded-xl",
};

/**
 * The single button implementation for FoodGuard.
 *
 * Every interactive control should use it (or one of the `<Link>`-styled
 * `buttonClasses` helpers) so height, radius, focus ring, disabled and loading
 * states stay identical across screens. `min-h-11` keeps the 44px touch target
 * at the desktop 14px root.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

/** Class string for Link-based buttons (keeps the same visual contract). */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}
