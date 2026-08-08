"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { useAppStore } from "@/lib/store";
import { RADAR_SERIES_COLORS, PREDEFINED_COLORS } from "@/lib/constants";
import { EChart } from "./echart";
import { getStressAtStrain } from "@/lib/calculations";
import type {
  ClingData,
  PunctureData,
  RadarAxisDef,
  RadarSeries,
  StressData,
  TearData,
} from "@/lib/types";

interface SummaryRow {
  id: string;
  role: "reference" | "comparison";
  index: number;
  sampleName: string;
  ultimateStrain: number | null;
  stretchForceAtStrain: number | null;
  windForceAtStrain: number | null;
  punctureForce: number | null;
  punctureEnergy: number | null;
  tearForce: number | null;
  tearTime: number | null;
  tearEnergy: number | null;
  clingForce: number | null;
}

type SummaryRowData = SummaryRow;

function buildSummaryRows(
  datasets: ReturnType<typeof useAppStore.getState>["datasets"],
  strainInput: number,
): SummaryRow[] {
  const out: SummaryRowData[] = [];
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
      role: "reference",
      index: 0,
      sampleName,
      ultimateStrain: s?.maxStrain ?? null,
      stretchForceAtStrain: at?.stretch ?? null,
      windForceAtStrain: at?.wind ?? null,
      punctureForce: p?.maxForce ?? null,
      punctureEnergy: p?.energy ?? null,
      tearForce: t?.maxForce ?? null,
      tearTime: t?.tearTime ?? null,
      tearEnergy: t?.energy ?? null,
      clingForce: c?.medianForce ?? null,
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
      role: "comparison",
      index: i,
      sampleName,
      ultimateStrain: s?.maxStrain ?? null,
      stretchForceAtStrain: at?.stretch ?? null,
      windForceAtStrain: at?.wind ?? null,
      punctureForce: p?.maxForce ?? null,
      punctureEnergy: p?.energy ?? null,
      tearForce: t?.maxForce ?? null,
      tearTime: t?.tearTime ?? null,
      tearEnergy: t?.energy ?? null,
      clingForce: c?.medianForce ?? null,
    });
  }
  return out;
}

interface RadarChartProps {
  // Override axes (for exports)
  axesOverride?: RadarAxisDef[];
  seriesOverride?: RadarSeries[];
  height?: number;
}

export function RadarChart({
  axesOverride,
  seriesOverride,
  height = 460,
}: RadarChartProps) {
  const datasets = useAppStore((s) => s.datasets);
  const strainInput = useAppStore((s) => s.strainInput);
  const radarAxes = useAppStore((s) => s.radarAxes);
  const radarOptions = useAppStore((s) => s.radarOptions);
  const radarSeriesOverrides = useAppStore(
    (s) => s.radarSeriesOverrides,
  );

  const axes = axesOverride ?? radarAxes;

  // Build series from summary rows
  const series = useMemo<RadarSeries[]>(() => {
    if (seriesOverride) return seriesOverride;
    const rows = buildSummaryRows(datasets, strainInput);
    return rows.map((row, i) => {
      const override = radarSeriesOverrides[row.id];
      const color =
        override?.color ||
        (row.role === "reference"
          ? PREDEFINED_COLORS[0]
          : RADAR_SERIES_COLORS[i % RADAR_SERIES_COLORS.length]);
      const visible = override?.visible ?? true;
      const values = {
        ultimateStrain: row.ultimateStrain,
        stretchForceAtStrain: row.stretchForceAtStrain,
        windForceAtStrain: row.windForceAtStrain,
        punctureForce: row.punctureForce,
        punctureEnergy: row.punctureEnergy,
        tearForce: row.tearForce,
        tearTime: row.tearTime,
        tearEnergy: row.tearEnergy,
        clingForce: row.clingForce,
      };
      return {
        id: row.id,
        name: row.sampleName,
        color,
        visible,
        values,
      };
    });
  }, [datasets, strainInput, radarSeriesOverrides, seriesOverride]);

  const option = useMemo<EChartsOption>(() => {
    const visibleAxes = axes.filter((a) => a.visible);

    // Compute max per axis (respecting scaleMode)
    const axisMax = visibleAxes.map((a) => {
      if (radarOptions.scaleMode === "fixed") return 100;
      if (radarOptions.scaleMode === "global") {
        let gmax = 1;
        series.forEach((s) => {
          if (!s.visible) return;
          const v = s.values[a.id];
          if (v !== null && Number.isFinite(v) && v > gmax) gmax = v;
        });
        return gmax;
      }
      // auto — use the configured max, but bump if data exceeds it
      let m = a.max;
      series.forEach((s) => {
        if (!s.visible) return;
        const v = s.values[a.id];
        if (v !== null && Number.isFinite(v) && v > m) m = v;
      });
      return m || 100;
    });

    const indicator = visibleAxes.map((a, i) => ({
      name: a.label,
      max: axisMax[i],
      min: a.min,
    }));

    const seriesData = series
      .filter((s) => s.visible)
      .map((s) => ({
        name: s.name,
        value: visibleAxes.map((a) => {
          const v = s.values[a.id];
          return v === null ? 0 : v;
        }),
        itemStyle: { color: s.color },
        lineStyle: {
          color: s.color,
          width: radarOptions.strokeWidth,
        },
        areaStyle: { color: s.color, opacity: radarOptions.fillOpacity },
        symbol: "circle",
        symbolSize: radarOptions.pointRadius * 2,
      }));

    return {
      legend: {
        show: true,
        top: 0,
        left: "center",
        type: "scroll",
        textStyle: { fontSize: 12 },
        itemWidth: 16,
        itemHeight: 8,
        icon: "roundRect",
      },
      tooltip: {
        trigger: "item",
        backgroundColor: "var(--card-highest, #1c1f26)",
        borderColor: "var(--border)",
        borderWidth: 1,
        textStyle: {
          color: "var(--foreground, #f2f3f5)",
          fontFamily:
            "var(--font-jetbrains-mono), JetBrains Mono, monospace",
          fontSize: 12,
        },
      },
      radar: {
        indicator,
        center: ["50%", "55%"],
        radius: "65%",
        shape: radarOptions.smoothCurves ? "circle" : "polygon",
        splitNumber: radarOptions.rings,
        axisName: {
          fontSize: radarOptions.labelFontSize,
          fontWeight: 600,
          color: "var(--chart-axis, oklch(72% 0.008 250))",
        },
        splitLine: {
          lineStyle: { color: "var(--chart-grid, oklch(26% 0.008 250))" },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: [
              "rgba(127,127,127,0.04)",
              "rgba(127,127,127,0.02)",
              "rgba(127,127,127,0.04)",
              "rgba(127,127,127,0.02)",
              "rgba(127,127,127,0.04)",
            ],
          },
        },
        axisLine: {
          lineStyle: { color: "var(--chart-grid, oklch(26% 0.008 250))" },
        },
      },
      series: [
        {
          type: "radar",
          data: seriesData,
          animation: radarOptions.animate,
        },
      ],
    };
  }, [axes, series, radarOptions]);

  const visibleAxes = axes.filter((a) => a.visible);
  if (visibleAxes.length < 3 || series.length === 0) {
    return (
      <div className="flex h-[460px] items-center justify-center text-sm text-muted-foreground text-center px-8">
        Radar chart needs at least 3 visible properties and at least one
        sample. Upload test data and check the axis selectors.
      </div>
    );
  }

  return <EChart option={option} height={height} />;
}
