import "server-only";

/**
 * Subject-module loader. This is the ONE file a new module's author edits in
 * core code — everything else in `server/modules/` stays untouched.
 *
 * A subject module is a package of subject-specific features (e.g. a future
 * language module: dictionary, flashcards) that lives entirely outside core
 * (its own directory — e.g. `src/server/modules/language/` — with its own
 * server logic, schemas, and UI components). To plug it in:
 *
 *   1. In the module's own file, call `registerSubjectModule({ key, label,
 *      disciplineKeys })` (from "@/server/modules/registry") at import time.
 *   2. Import that file here, once:
 *        import "./language/register";
 *   3. Nothing else in core changes. `listActiveModulesForTeacher()` picks it
 *      up automatically for any teacher whose configured discipline (Part 2's
 *      TeacherDiscipline) matches one of `disciplineKeys` — multi-tenant
 *      isolation is inherited for free, since disciplines are already scoped
 *      per teacher.
 *
 * Whatever the module actually DOES (its own routes, DB tables, AI prompts,
 * nav entries) is entirely up to it — the registry only decides whether it's
 * active for a given teacher. No module is registered yet, so this file has
 * no imports and every teacher today has zero active modules.
 */
