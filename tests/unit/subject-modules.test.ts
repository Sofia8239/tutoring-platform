import { describe, expect, it } from "vitest";

import {
  activeModulesForDisciplines,
  type SubjectModule,
} from "@/lib/subject-modules";

const languageModule: SubjectModule = {
  key: "language-tools",
  label: "Мовний модуль",
  disciplineKeys: ["english", "german"],
};

const mathModule: SubjectModule = {
  key: "math-tools",
  label: "Математичний модуль",
  disciplineKeys: ["math"],
};

describe("activeModulesForDisciplines", () => {
  it("activates a module when one of the teacher's disciplines matches", () => {
    const active = activeModulesForDisciplines(
      [languageModule, mathModule],
      ["english"],
    );
    expect(active.map((m) => m.key)).toEqual(["language-tools"]);
  });

  it("activates several modules independently for a multi-subject teacher", () => {
    const active = activeModulesForDisciplines(
      [languageModule, mathModule],
      ["math", "german"],
    );
    expect(active.map((m) => m.key).sort()).toEqual([
      "language-tools",
      "math-tools",
    ]);
  });

  it("activates nothing when no module is registered — today's actual state", () => {
    expect(activeModulesForDisciplines([], ["math"])).toEqual([]);
  });

  it("activates nothing when the teacher has configured no disciplines", () => {
    expect(
      activeModulesForDisciplines([languageModule, mathModule], []),
    ).toEqual([]);
  });

  it("activates nothing when disciplines don't match any registered module", () => {
    const active = activeModulesForDisciplines(
      [languageModule],
      ["history"],
    );
    expect(active).toEqual([]);
  });
});
