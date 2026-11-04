import { describe, expect, it } from "vitest";
import { firstError } from "./filters";

describe("firstError", () => {
  it("returns the first error that is set", () => {
    expect(firstError(null, "DORA failed", "Issues failed")).toBe("DORA failed");
  });

  it("returns null when nothing failed", () => {
    expect(firstError(null, null)).toBeNull();
  });

  it("treats an empty message as an error", () => {
    expect(firstError(null, "")).toBe("");
  });
});
