import type { ComponentProps } from "react";

export type BadgeTone =
  "neutral" | "primary" | "success" | "attention" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success-strong",
  attention: "bg-attention-soft text-attention-strong",
  danger: "bg-danger-soft text-danger-strong",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={`rounded-chip inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
