import { useEffect, useRef, useState } from "react";

type DateRange = {
  startDate: string | null;
  endDate: string | null;
};

type Preset = {
  label: string;
  range: DateRange;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const PRESETS: Preset[] = [
  { label: "All time",    range: { startDate: null,       endDate: null } },
  { label: "Today",       range: { startDate: today(),    endDate: today() } },
  { label: "Last 7 days", range: { startDate: daysAgo(6), endDate: today() } },
  { label: "Last 30 days",range: { startDate: daysAgo(29),endDate: today() } },
  { label: "Last 90 days",range: { startDate: daysAgo(89),endDate: today() } },
];

function deriveLabel(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return "All time";
  // Check if it matches a preset
  for (const p of PRESETS) {
    if (p.range.startDate === startDate && p.range.endDate === endDate) {
      return p.label;
    }
  }
  if (startDate && endDate) return `${startDate} – ${endDate}`;
  if (startDate) return `From ${startDate}`;
  return `Until ${endDate}`;
}

type Props = {
  startDate: string | null;
  endDate: string | null;
  onChange: (range: DateRange) => void;
};

export default function DateRangePicker({ startDate, endDate, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate ?? "");
  const [customEnd, setCustomEnd] = useState(endDate ?? "");
  const ref = useRef<HTMLDivElement>(null);

  // Sync local custom fields when external value changes (e.g. preset click)
  useEffect(() => {
    setCustomStart(startDate ?? "");
    setCustomEnd(endDate ?? "");
  }, [startDate, endDate]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function applyCustom() {
    onChange({
      startDate: customStart || null,
      endDate: customEnd || null,
    });
    setOpen(false);
  }

  const label = deriveLabel(startDate, endDate);

  return (
    <div className="drp-root" ref={ref}>
      <button className="drp-trigger" onClick={() => setOpen((o) => !o)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M1 6h14" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <span>{label}</span>
        <svg className={`drp-caret${open ? " drp-caret--open" : ""}`} width="10" height="10" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="drp-panel">
          <ul className="drp-presets">
            {PRESETS.map((p) => {
              const active = p.range.startDate === startDate && p.range.endDate === endDate;
              return (
                <li key={p.label}>
                  <button
                    className={`drp-preset${active ? " drp-preset--active" : ""}`}
                    onClick={() => { onChange(p.range); setOpen(false); }}
                  >
                    {p.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="drp-divider" />

          <div className="drp-custom">
            <p className="drp-custom__label">Custom range</p>
            <div className="drp-custom__fields">
              <div className="drp-custom__field">
                <label>From</label>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="drp-custom__field">
                <label>To</label>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  max={today()}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
            <button className="drp-apply" onClick={applyCustom}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
