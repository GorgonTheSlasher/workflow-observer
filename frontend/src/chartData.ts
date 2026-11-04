export type RankedRow = {
  label: string;
  count: number;
  isOther?: boolean;
};

// A ranked bar chart only has room for so many readable rows. Keep the largest and fold
// the rest into one "Other" row, so the chart stays legible and the total still adds up.
export function topWithOther(rows: RankedRow[], limit: number, noun: string): RankedRow[] {
  if (rows.length <= limit) return rows;

  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const rest = sorted.slice(limit - 1);
  return [
    ...sorted.slice(0, limit - 1),
    {
      label: `Other (${rest.length} ${noun})`,
      count: rest.reduce((sum, r) => sum + r.count, 0),
      isOther: true,
    },
  ];
}

export function truncateLabel(label: string, max = 24): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
