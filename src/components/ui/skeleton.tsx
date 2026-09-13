import type { ComponentProps } from "react";

/** Soft pulsing placeholder block in the Indigo + Mint palette. */
export function Skeleton({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`bg-surface-2 rounded-chip animate-pulse ${className}`}
      {...props}
    />
  );
}

/** A card-shaped skeleton row, used in list loading states. */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-card border-line bg-surface shadow-soft flex flex-col gap-3 border p-5 sm:p-6 ${className}`}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
