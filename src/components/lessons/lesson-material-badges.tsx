import { Icon, type IconName } from "@/components/ui/icon";
import type { LessonMaterialFlags } from "@/lib/lesson-materials";

const ITEMS: { key: keyof LessonMaterialFlags; icon: IconName; title: string }[] = [
  { key: "hasNotes", icon: "file", title: "Є конспект" },
  { key: "hasAssignment", icon: "inbox", title: "Є домашнє завдання" },
  { key: "hasBoard", icon: "board", title: "Є дошка" },
];

/** Small icon row showing which materials exist for a lesson — dim = none yet. */
export function LessonMaterialBadges({
  flags,
}: {
  flags: LessonMaterialFlags | undefined;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {ITEMS.map(({ key, icon, title }) => {
        const present = flags?.[key] ?? false;
        return (
          <span
            key={key}
            title={title}
            className={present ? "text-primary" : "text-muted opacity-30"}
          >
            <Icon name={icon} className="size-4" />
          </span>
        );
      })}
    </span>
  );
}
