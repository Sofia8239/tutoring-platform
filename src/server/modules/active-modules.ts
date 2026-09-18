import "server-only";

import "@/server/modules/index";

import { activeModulesForDisciplines } from "@/lib/subject-modules";
import { listTeacherDisciplines } from "@/server/teacher/disciplines";
import { listRegisteredModules, type SubjectModule } from "@/server/modules/registry";

/**
 * Which subject modules are active for a teacher right now — scoped by their
 * own TeacherDiscipline rows (golden rule 7: tenant-scoped). Returns `[]`
 * today for every teacher, since no module is registered yet (see index.ts).
 */
export async function listActiveModulesForTeacher(
  teacherId: string,
): Promise<SubjectModule[]> {
  const disciplines = await listTeacherDisciplines(teacherId);
  const modules = listRegisteredModules();
  return activeModulesForDisciplines(
    modules,
    disciplines.map((d) => d.key),
  );
}
