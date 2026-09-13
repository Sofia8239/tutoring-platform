import type { ComponentProps } from "react";

export type ButtonVariant =
  "primary" | "secondary" | "success" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-btn font-medium transition-colors disabled:opacity-55 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-ink hover:bg-primary-hover",
  secondary:
    "border border-primary/30 bg-surface text-primary hover:bg-primary-soft",
  success: "bg-success text-white hover:brightness-95",
  ghost: "text-ink hover:bg-surface-2",
  danger: "border border-danger/40 text-danger hover:bg-danger-soft",
};

/** Class string for the shared button look — use on `<button>` and `<Link>`. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = "",
): string {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={buttonClass(variant, size, className)} {...props} />
  );
}
