import { Badge } from "@/components/ui/badge";

/** "+15% до попереднього періоду" / "нове" (grew from zero) / "без змін". */
export function DeltaBadge({ percent }: { percent: number | null }) {
  if (percent === null) return <Badge tone="primary">нове</Badge>;
  if (percent === 0) return <Badge tone="neutral">без змін</Badge>;

  const up = percent > 0;
  const rounded = Math.round(Math.abs(percent));
  return (
    <Badge tone={up ? "success" : "danger"}>
      {up ? "▲" : "▼"} {rounded}% до попереднього періоду
    </Badge>
  );
}
