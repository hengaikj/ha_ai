import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CommitteeProjectListPage creation time", () => {
  it("renders project creation time with seconds", () => {
    const source = readFileSync(
      "src/pages/committee/CommitteeProjectListPage.vue",
      "utf8",
    );

    expect(source).toMatch(
      /<CommitteeDate :value="row\.createTime" with-seconds\s*\/>/,
    );
  });
});
