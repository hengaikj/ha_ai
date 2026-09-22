import { describe, expect, it } from "vitest";
import { normalizeRdCategoryIds } from "@/api/rd-category";

describe("研发专业三级分类关联请求", () => {
  it("应去重并过滤无效分类ID", () => {
    expect(normalizeRdCategoryIds([104, 104, Number.NaN, 0, -1])).toEqual([
      104,
    ]);
  });
});
