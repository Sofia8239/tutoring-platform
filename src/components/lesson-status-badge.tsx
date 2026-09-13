import { Badge } from "@/components/ui/badge";
import { LESSON_STATUS_LABEL, LESSON_STATUS_TONE } from "@/lib/lesson-display";
import type { LessonStatus } from "@/generated/prisma/enums";

export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  return (
    <Badge tone={LESSON_STATUS_TONE[status]}>
      {LESSON_STATUS_LABEL[status]}
    </Badge>
  );
}
