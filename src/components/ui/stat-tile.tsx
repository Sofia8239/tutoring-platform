export type StatTint = "plain" | "rose" | "lavender" | "mint" | "peach";

const tints: Record<StatTint, string> = {
  plain: "bg-surface border-line",
  rose: "bg-tint-rose border-transparent",
  lavender: "bg-tint-lavender border-transparent",
  mint: "bg-tint-mint border-transparent",
  peach: "bg-tint-peach border-transparent",
};

export function StatTile({
  label,
  value,
  hint,
  tint = "plain",
}: {
  label: string;
  value: string;
  hint?: string;
  tint?: StatTint;
}) {
  return (
    <div
      className={`rounded-card shadow-soft flex flex-col gap-1 border p-4 sm:p-5 ${tints[tint]}`}
    >
      <span className="text-muted text-xs font-medium tracking-wide">
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {hint ? <span className="text-muted text-xs">{hint}</span> : null}
    </div>
  );
}
