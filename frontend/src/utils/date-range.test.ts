import { describe, expect, it } from "vitest";
import { toDateTimeRangeParams } from "@/utils/date-range";

describe("toDateTimeRangeParams", () => {
  it("formats date range as full-day datetime strings accepted by backend MyBatis filters", () => {
    expect(toDateTimeRangeParams(["2026-07-01", "2026-07-06"])).toEqual({
      createdFrom: "2026-07-01 00:00:00",
      createdTo: "2026-07-06 23:59:59",
    });
  });

  it("omits empty date range params", () => {
    expect(toDateTimeRangeParams([])).toEqual({
      createdFrom: undefined,
      createdTo: undefined,
    });
  });
});
