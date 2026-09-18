import "server-only";

import type { SubjectModule } from "@/lib/subject-modules";

export { type SubjectModule } from "@/lib/subject-modules";

/**
 * The in-process registry a subject module joins by calling
 * `registerSubjectModule()` as a side effect of being imported — see
 * `server/modules/index.ts`, the single place that imports every module.
 */
const registry = new Map<string, SubjectModule>();

export class SubjectModuleError extends Error {}

export function registerSubjectModule(module: SubjectModule): void {
  if (registry.has(module.key)) {
    throw new SubjectModuleError(
      `Subject module "${module.key}" is already registered.`,
    );
  }
  registry.set(module.key, module);
}

export function listRegisteredModules(): SubjectModule[] {
  return [...registry.values()];
}
