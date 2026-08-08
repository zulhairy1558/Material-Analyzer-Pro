"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  FileImage,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { useAppStore } from "@/lib/store";
import { RADAR_SERIES_COLORS } from "@/lib/constants";
import { ChartCard } from "../charts/chart-card";
import { RadarChart } from "../charts/radar-chart";
import { exportChartAsPNG } from "@/lib/export-utils";
import { RADAR_CHART_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatEnergy,
  formatForce,
  formatStrain,
  formatTime,
  getStressAtStrain,
} from "@/lib/calculations";
import type {
  ClingData,
  PunctureData,
  RadarAxisId,
  StressData,
  TearData,
} from "@/lib/types";

interface SummaryRow {
  id: string;
  sampleName: string;
  role: "reference" | "comparison";
  values: Record<RadarAxisId, number | null>;
}

function buildRows(
  datasets: ReturnType<typeof useAppStore.getState>["datasets"],
  strainInput: number,
): SummaryRow[] {
  const out: SummaryRow[] = [];
  const hasRef =
    datasets.stress.reference ||
    datasets.puncture.reference ||
    datasets.tear.reference ||
    datasets.cling.reference;

  if (hasRef) {
    const s = datasets.stress.reference as StressData | null;
    const p = datasets.puncture.reference as PunctureData | null;
    const t = datasets.tear.reference as TearData | null;
    const c = datasets.cling.reference as ClingData | null;
    const sampleName =
      datasets.stress.customNames.reference || s?.name || "Reference";
    const at = s ? getStressAtStrain(s, strainInput) : null;
    out.push({
      id: "reference-0",
      sampleName,
      role: "reference",
      values: {
        ultimateStrain: s?.maxStrain ?? null,
        stretchForceAtStrain: at?.stretch ?? null,
        windForceAtStrain: at?.wind ?? null,
        punctureForce: p?.maxForce ?? null,
        punctureEnergy: p?.energy ?? null,
        tearForce: t?.maxForce ?? null,
        tearTime: t?.tearTime ?? null,
        tearEnergy: t?.energy ?? null,
        clingForce: c?.medianForce ?? null,
      },
    });
  }

  const maxComp = Math.max(
    datasets.stress.comparisons.length,
    datasets.puncture.comparisons.length,
    datasets.tear.comparisons.length,
    datasets.cling.comparisons.length,
  );

  for (let i = 0; i < maxComp; i++) {
    const s = datasets.stress.comparisons[i] as StressData | null;
    const p = datasets.puncture.comparisons[i] as PunctureData | null;
    const t = datasets.tear.comparisons[i] as TearData | null;
    const c = datasets.cling.comparisons[i] as ClingData | null;
    if (!s && !p && !t && !c) continue;
    const sampleName =
      (s && (datasets.stress.customNames.comparisons[i] || s.name)) ||
      (p && (datasets.puncture.customNames.comparisons[i] || p.name)) ||
      (t && (datasets.tear.customNames.comparisons[i] || t.name)) ||
      (c && (datasets.cling.customNames.comparisons[i] || c.name)) ||
      `Comparison #${i + 1}`;
    const at = s ? getStressAtStrain(s, strainInput) : null;
    out.push({
      id: `comparison-${i}`,
      sampleName,
      role: "comparison",
      values: {
        ultimateStrain: s?.maxStrain ?? null,
        stretchForceAtStrain: at?.stretch ?? null,
        windForceAtStrain: at?.wind ?? null,
        punctureForce: p?.maxForce ?? null,
        punctureEnergy: p?.energy ?? null,
        tearForce: t?.maxForce ?? null,
        tearTime: t?.tearTime ?? null,
        tearEnergy: t?.energy ?? null,
        clingForce: c?.medianForce ?? null,
      },
    });
  }
  return out;
}

function fmtValue(axisId: RadarAxisId, v: number | null): string {
  if (v === null) return "N/A";
  switch (axisId) {
    case "ultimateStrain":
      return formatStrain(v);
    case "stretchForceAtStrain":
    case "windForceAtStrain":
    case "punctureForce":
    case "tearForce":
    case "clingForce":
      return formatForce(v);
    case "punctureEnergy":
    case "tearEnergy":
      return formatEnergy(v);
    case "tearTime":
      return formatTime(v);
    default:
      return String(v);
  }
}

export function RadarTab() {
  const datasets = useAppStore((s) => s.datasets);
  const strainInput = useAppStore((s) => s.strainInput);
  const radarAxes = useAppStore((s) => s.radarAxes);
  const radarOptions = useAppStore((s) => s.radarOptions);
  const radarSeriesOverrides = useAppStore(
    (s) => s.radarSeriesOverrides,
  );

  const setRadarAxisVisible = useAppStore((s) => s.setRadarAxisVisible);
  const setRadarAxisRange = useAppStore((s) => s.setRadarAxisRange);
  const setRadarAxisLabel = useAppStore((s) => s.setRadarAxisLabel);
  const setRadarOptions = useAppStore((s) => s.setRadarOptions);
  const setRadarSeriesOverride = useAppStore(
    (s) => s.setRadarSeriesOverride,
  );
  const resetRadarAxes = useAppStore((s) => s.resetRadarAxes);
  const autoComputeRadarAxes = useAppStore((s) => s.autoComputeRadarAxes);

  // Track whether auto-compute has already run (to avoid overriding user edits)
  const hasAutoComputed = useRef(false);

  const rows = useMemo(
    () => buildRows(datasets, strainInput),
    [datasets, strainInput],
  );

  // Auto-compute nice axis maxes on first mount when there's data AND axes
  // are still at defaults (all max === 100). This runs once per session —
  // the ref guard prevents it from re-running after the user edits axes.
  useEffect(() => {
    if (hasAutoComputed.current) return;
    if (rows.length === 0) return;
    const allDefaults = radarAxes.every((a) => a.max === 100 && a.min === 0);
    if (!allDefaults) return;
    hasAutoComputed.current = true;
    autoComputeRadarAxes();
  }, [rows.length, radarAxes, autoComputeRadarAxes]);

  const visibleAxes = radarAxes.filter((a) => a.visible);

  const handleExportPNG = () => {
    try {
      exportChartAsPNG(RADAR_CHART_ID, "radar-chart.png", "Multi-Axis Radar Chart");
      toast.success("Exported radar-chart.png");
    } catch (err) {
      toast.error(
        `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const handleAutoCompute = () => {
    autoComputeRadarAxes();
    toast.success("Axis max values auto-computed from data");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* Main column */}
      <div className="space-y-4">
        <ChartCard
          title="Multi-Axis Radar Chart"
          subtitle={`${visibleAxes.length} properties · ${rows.length} samples`}
          actions={
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleExportPNG}
                aria-label="Export radar as PNG"
                title="Export as PNG"
              >
                <FileImage className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleAutoCompute}
                aria-label="Auto-compute axis max values"
                title="Auto-compute axis max values from data"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  resetRadarAxes();
                  hasAutoComputed.current = false;
                  toast.info("Radar settings reset");
                }}
                aria-label="Reset radar settings"
                title="Reset to defaults"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          }
        >
          <div id={RADAR_CHART_ID}>
            <RadarChart />
          </div>
        </ChartCard>

        {/* Sample data preview */}
        <ChartCard title="Radar Data Preview" subtitle="Values per axis per sample">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left font-semibold text-muted-foreground">
                    Sample
                  </th>
                  {visibleAxes.map((a) => (
                    <th
                      key={a.id}
                      className="p-2 text-right font-semibold text-muted-foreground"
                    >
                      {a.label} [{a.unit}]
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleAxes.length + 1}
                      className="p-4 text-center text-muted-foreground"
                    >
                      No samples yet. Upload reference or comparison data on
                      the test tabs.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => {
                    const override = radarSeriesOverrides[row.id];
                    const color =
                      override?.color ||
                      (row.role === "reference"
                        ? "#06d6a0"
                        : RADAR_SERIES_COLORS[i % RADAR_SERIES_COLORS.length]);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border/50 hover:bg-card-elevated/50"
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium">{row.sampleName}</span>
                            {row.role === "reference" ? (
                              <span className="rounded-full bg-primary-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                                Ref
                              </span>
                            ) : null}
                          </div>
                        </td>
                        {visibleAxes.map((a) => (
                          <td
                            key={a.id}
                            className="p-2 text-right font-mono tabular-nums"
                          >
                            {fmtValue(a.id, row.values[a.id])}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Sidebar — axis & series controls */}
      <aside className="lg:sticky lg:top-[88px] lg:self-start space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Properties
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Toggle visibility and set per-axis min/max for normalization.
            Selected count: <span className="font-mono">{visibleAxes.length}</span> (min 3)
          </p>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {radarAxes.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-border bg-card-elevated p-2 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`axis-${a.id}`}
                    checked={a.visible}
                    onCheckedChange={(v) =>
                      setRadarAxisVisible(a.id, v === true)
                    }
                  />
                  <Input
                    value={a.label}
                    onChange={(e) =>
                      setRadarAxisLabel(a.id, e.target.value)
                    }
                    className="h-7 flex-1 text-xs"
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {a.unit}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Min
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      value={a.min}
                      onChange={(e) => {
                        const min = Number(e.target.value);
                        const max = a.max;
                        if (Number.isFinite(min) && min < max) {
                          setRadarAxisRange(a.id, min, max);
                        }
                      }}
                      className="h-7 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Max
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      value={a.max}
                      onChange={(e) => {
                        const max = Number(e.target.value);
                        const min = a.min;
                        if (Number.isFinite(max) && max > min) {
                          setRadarAxisRange(a.id, min, max);
                        }
                      }}
                      className="h-7 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Series
          </h2>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No samples yet. Upload data first.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row, i) => {
                const override = radarSeriesOverrides[row.id];
                const color =
                  override?.color ||
                  (row.role === "reference"
                    ? "#06d6a0"
                    : RADAR_SERIES_COLORS[i % RADAR_SERIES_COLORS.length]);
                const visible = override?.visible ?? true;
                return (
                  <div
                    key={row.id}
                    className="rounded-lg border border-border bg-card-elevated p-2 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`series-${row.id}`}
                        checked={visible}
                        onCheckedChange={(v) =>
                          setRadarSeriesOverride(row.id, {
                            visible: v === true,
                          })
                        }
                      />
                      <span className="flex-1 truncate text-sm font-medium">
                        {row.sampleName}
                      </span>
                      <input
                        type="color"
                        value={color}
                        onChange={(e) =>
                          setRadarSeriesOverride(row.id, {
                            color: e.target.value,
                          })
                        }
                        className="h-6 w-8 cursor-pointer rounded border border-border bg-card"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Visual Options
          </h2>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Scale mode</Label>
              <Select
                value={radarOptions.scaleMode}
                onValueChange={(v) =>
                  setRadarOptions({
                    scaleMode: v as "auto" | "fixed" | "global",
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (per-axis max)</SelectItem>
                  <SelectItem value="global">Global max</SelectItem>
                  <SelectItem value="fixed">Fixed (100)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Rings</Label>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  value={radarOptions.rings}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 2 && v <= 10) {
                      setRadarOptions({ rings: v });
                    }
                  }}
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fill opacity</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={radarOptions.fillOpacity}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0 && v <= 1) {
                      setRadarOptions({ fillOpacity: v });
                    }
                  }}
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Stroke width</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={6}
                  step={0.5}
                  value={radarOptions.strokeWidth}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0.5 && v <= 6) {
                      setRadarOptions({ strokeWidth: v });
                    }
                  }}
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Point radius</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  value={radarOptions.pointRadius}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0 && v <= 10) {
                      setRadarOptions({ pointRadius: v });
                    }
                  }}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <Checkbox
                id="radar-smooth"
                checked={radarOptions.smoothCurves}
                onCheckedChange={(v) =>
                  setRadarOptions({ smoothCurves: v === true })
                }
              />
              <Label htmlFor="radar-smooth" className="text-xs">
                Smooth curves (circular shape)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="radar-anim"
                checked={radarOptions.animate}
                onCheckedChange={(v) =>
                  setRadarOptions({ animate: v === true })
                }
              />
              <Label htmlFor="radar-anim" className="text-xs">
                Animate entrance
              </Label>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
