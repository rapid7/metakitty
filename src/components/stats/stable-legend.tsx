export interface StableLegendEntry {
  key: string;
  color: string;
  label: string;
}

/**
 * A chart legend rendered as plain JSX, not recharts' own `<Legend>` — for a chart whose series
 * can temporarily split (e.g. splitting a highlighted item out of an "Other" bucket), the legend's
 * own entries must stay fixed regardless, since recharts' `<Legend>` auto-detects its entries from
 * whatever's currently rendered (and doesn't accept a payload override in this recharts version).
 * Letting it drive the legend made it visibly resize/reflow on every hover. `entries` should be
 * computed from the chart's stable "always shown" series only, never from the current highlight.
 */
export function StableLegend({ entries, onHover }: { entries: StableLegendEntry[]; onHover?: (key: string | null) => void }) {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs">
      {entries.map((entry) => (
        <button
          key={entry.key}
          type="button"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline"
          onMouseEnter={() => onHover?.(entry.key)}
          onMouseLeave={() => onHover?.(null)}
          onFocus={() => onHover?.(entry.key)}
          onBlur={() => onHover?.(null)}
        >
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: entry.color }} />
          {entry.label}
        </button>
      ))}
    </div>
  );
}
