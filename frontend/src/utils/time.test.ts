import { describe, expect, it } from "vitest";
import { parseUtcDate } from "./time";

describe("parseUtcDate", () => {
  it("reads timestamps without a timezone as UTC, not local time", () => {
    expect(parseUtcDate("2026-11-06T12:00:00").toISOString()).toBe("2026-11-06T12:00:00.000Z");
  });

  it("respects an explicit timezone", () => {
    expect(parseUtcDate("2026-11-06T12:00:00Z").toISOString()).toBe("2026-11-06T12:00:00.000Z");
    expect(parseUtcDate("2026-11-06T12:00:00+02:00").toISOString()).toBe("2026-11-06T10:00:00.000Z");
  });
});
