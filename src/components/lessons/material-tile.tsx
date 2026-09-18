import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";

/**
 * One of the three big buttons (Дошка / Конспект / ДЗ) on a lesson page —
 * a single click to the one thing that matters, with a small counter when
 * there's more than one item behind it. Renders inert (no link) when empty.
 */
export function MaterialTile({
  icon,
  label,
  meta,
  href,
}: {
  icon: IconName;
  label: string;
  meta?: string | null;
  href?: string | null;
}) {
  const body = (
    <div className="flex flex-col items-center gap-1.5 px-2 py-4 text-center">
      <Icon name={icon} className="size-6" />
      <span className="text-sm font-medium">{label}</span>
      {meta ? <span className="text-muted text-xs">{meta}</span> : null}
    </div>
  );

  if (!href) {
    return (
      <div className="border-line rounded-btn border opacity-40">{body}</div>
    );
  }

  const tileClass =
    "border-line rounded-btn hover:bg-surface-2 hover:border-primary block border transition-colors";

  // A same-page anchor (e.g. "#assignments") needs the browser's own hash
  // scroll, not next/link's client-side router — Link doesn't reliably
  // trigger it, so plain <a> is the correct tool here, not a workaround.
  if (href.startsWith("#")) {
    return (
      <a href={href} className={tileClass}>
        {body}
      </a>
    );
  }

  return (
    <Link href={href} className={tileClass}>
      {body}
    </Link>
  );
}
