import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-card border-line bg-surface shadow-soft border p-5 sm:p-6 ${className}`}
      {...props}
    />
  );
}

export function CardTitle({ className = "", ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={`text-lg font-semibold tracking-tight ${className}`}
      {...props}
    />
  );
}
