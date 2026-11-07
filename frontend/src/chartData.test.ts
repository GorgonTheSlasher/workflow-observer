import { describe, expect, it } from "vitest";
import { formatMinutes, topWithOther, truncateLabel } from "./chartData";

const rows = (counts: number[]) => counts.map((count, i) => ({ label: `branch-${i}`, count }));

describe("topWithOther", () => {
  it("returns rows unchanged when they fit", () => {
    const input = rows([5, 3, 1]);
    expect(topWithOther(input, 8, "branches")).toEqual(input);
  });

  it("keeps the largest rows and folds the rest into one Other row", () => {
    const result = topWithOther(rows([1, 9, 4, 7, 2, 8]), 4, "branches");

    expect(result.map((r) => r.label)).toEqual(["branch-1", "branch-5", "branch-3", "Other (3 branches)"]);
    expect(result[3]).toEqual({ label: "Other (3 branches)", count: 4 + 2 + 1, isOther: true });
  });

  it("never changes the total", () => {
    const input = rows([12, 7, 7, 3, 3, 2, 1, 1, 1]);
    const total = (r: { count: number }[]) => r.reduce((sum, row) => sum + row.count, 0);

    expect(total(topWithOther(input, 5, "branches"))).toBe(total(input));
  });

  it("does not mutate its input", () => {
    const input = rows([1, 3, 2]);
    topWithOther(input, 2, "branches");
    expect(input.map((r) => r.count)).toEqual([1, 3, 2]);
  });
});

describe("truncateLabel", () => {
  it("leaves short labels alone", () => {
    expect(truncateLabel("main", 10)).toBe("main");
  });

  it("cuts long labels to the limit, ellipsis included", () => {
    const result = truncateLabel("feature/a-very-long-branch-name", 12);
    expect(result).toBe("feature/a-v…");
    expect(result).toHaveLength(12);
  });
});

describe("formatMinutes", () => {
  it("shows short durations in seconds", () => {
    expect(formatMinutes(0)).toBe("0s");
    expect(formatMinutes(0.75)).toBe("45s");
  });

  it("takes minutes, not seconds", () => {
    expect(formatMinutes(4)).toBe("4m");
    expect(formatMinutes(2.5)).toBe("2.5m");
  });

  it("rounds long durations to whole minutes", () => {
    expect(formatMinutes(12.4)).toBe("12m");
  });
});
