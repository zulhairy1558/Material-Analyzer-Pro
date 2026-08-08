"use client";

interface ChartTooltipPayloadItem {
  name?: string;
  dataKey?: string | number;
  value?: number;
  color?: string;
  payload?: { x?: number; y?: number; [k: string]: unknown };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: number | string;
  xLabel?: string;
  yLabel?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  xLabel,
  yLabel,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card-highest p-3 shadow-lg">
      {xLabel && label !== undefined ? (
        <p className="mb-1 font-mono text-xs text-muted-foreground">
          {xLabel}: <span className="font-medium text-foreground">{label}</span>
        </p>
      ) : null}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-mono text-xs text-foreground">
              {entry.name ?? "—"}
            </span>
            <span className="font-mono text-xs font-medium tabular-nums text-foreground">
              {(entry.value ?? 0).toFixed(2)}
              {yLabel ? "" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
