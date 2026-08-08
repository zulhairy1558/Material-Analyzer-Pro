"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { useAppStore } from "@/lib/store";
import { EChart } from "./echart";
import type { StressData } from "@/lib/types";

interface SeriesPoint {
  x: number;
  y: number;
}

function toSeries(
  data: StressData,
  key: "stretchMedian" | "windMedian",
): SeriesPoint[] {
  return data.strain.map((s, i) => ({ x: s, y: data[key][i] ?? 0 }));
}

export function StressChart() {
  const datasets = useAppStore((s) => s.datasets.stress);
  const colors = useAppStore((s) => s.chartColors.stress);
  const seriesVisibility = useAppStore((s) => s.seriesVisibility.stress);
  const axisConfig = useAppStore((s) => s.chartAxisConfigs.stress);

  const option = useMemo<EChartsOption>(() => {
    type Serie = {
      key: string;
      label: string;
      color: string;
      dash: boolean;
      data: SeriesPoint[];
      hidden: boolean;
    };
    const all: Serie[] = [];

    const refName =
      datasets.customNames.reference ||
      datasets.reference?.name ||
      "Reference";

    if (datasets.reference) {
      all.push({
        key: "ref_stretch",
        label: `${refName} (Stretch)`,
        color: colors.reference,
        dash: false,
        data: toSeries(datasets.reference, "stretchMedian"),
        hidden: seriesVisibility[0] === false,
      });
    }
    datasets.comparisons.forEach((c, i) => {
      if (!c) return;
      const cname = datasets.customNames.comparisons[i] || c.name;
      all.push({
        key: `comp_${i}_stretch`,
        label: `${cname} (Stretch)`,
        color: colors.comparisons[i] ?? "#999",
        dash: false,
        data: toSeries(c as StressData, "stretchMedian"),
        hidden: seriesVisibility[1 + i] === false,
      });
    });

    if (datasets.reference) {
      all.push({
        key: "ref_wind",
        label: `${refName} (Wind)`,
        color: colors.reference,
        dash: true,
        data: toSeries(datasets.reference, "windMedian"),
        hidden:
          seriesVisibility[datasets.comparisons.length + 1] === false,
      });
    }
    datasets.comparisons.forEach((c, i) => {
      if (!c) return;
      const cname = datasets.customNames.comparisons[i] || c.name;
      all.push({
        key: `comp_${i}_wind`,
        label: `${cname} (Wind)`,
        color: colors.comparisons[i] ?? "#999",
        dash: true,
        data: toSeries(c as StressData, "windMedian"),
        hidden:
          seriesVisibility[datasets.comparisons.length + 2 + i] === false,
      });
    });

    // Visible series only — drive axis domains
    const visible = all.filter((s) => !s.hidden);

    let xMin = Infinity;
    let xMax = -Infinity;
    let yMax = 0;
    visible.forEach((s) => {
      s.data.forEach((pt) => {
        if (pt.x < xMin) xMin = pt.x;
        if (pt.x > xMax) xMax = pt.x;
        if (pt.y > yMax) yMax = pt.y;
      });
    });
    if (!Number.isFinite(xMin)) {
      xMin = 0;
      xMax = 100;
    }
    yMax = yMax * 1.1 || 100;

    return {
      legend: {
        show: true,
        top: 0,
        left: "center",
        type: "scroll",
        textStyle: {
          fontSize: 12,
        },
        itemWidth: 16,
        itemHeight: 8,
        icon: "roundRect",
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
        backgroundColor: "var(--card-highest, #1c1f26)",
        borderColor: "var(--border)",
        borderWidth: 1,
        textStyle: {
          color: "var(--foreground, #f2f3f5)",
          fontFamily:
            "var(--font-jetbrains-mono), JetBrains Mono, monospace",
          fontSize: 12,
        },
        formatter: (params: unknown) => {
          const arr = params as Array<{
            seriesName: string;
            value: [number, number];
            color: string;
            marker: string;
          }>;
          if (!arr.length) return "";
          const x = arr[0].value[0];
          let html = `<div style="margin-bottom:4px;font-weight:600">Strain: ${x.toFixed(2)}%</div>`;
          arr.forEach((p) => {
            html += `<div style="display:flex;align-items:center;gap:6px">${p.marker}<span>${p.seriesName}</span><span style="margin-left:auto;font-weight:600">${p.value[1].toFixed(2)} N</span></div>`;
          });
          return html;
        },
      },
      xAxis: {
        type: "value",
        min: axisConfig.xMin ?? xMin,
        max: axisConfig.xMax ?? xMax,
        interval: axisConfig.xStep ?? undefined,
        name: "Strain [%]",
        nameLocation: "middle",
        nameGap: 32,
        nameTextStyle: { fontSize: 12 },
        axisTick: { show: false },
        axisLabel: {
          formatter: (v: number) => v.toFixed(axisConfig.xDecimals),
        },
      },
      yAxis: {
        type: "value",
        min: axisConfig.yMin ?? 0,
        max: axisConfig.yMax ?? yMax,
        interval: axisConfig.yStep ?? undefined,
        name: "Force [N]",
        nameLocation: "middle",
        nameGap: 44,
        nameTextStyle: { fontSize: 12 },
        axisTick: { show: false },
        axisLabel: {
          formatter: (v: number) => v.toFixed(axisConfig.yDecimals),
        },
      },
      series: all.map((s) => ({
        name: s.label,
        type: "line",
        showSymbol: false,
        smooth: false,
        symbolSize: 6,
        lineStyle: {
          width: 2,
          color: s.color,
          type: s.dash ? "dashed" : "solid",
        },
        itemStyle: { color: s.color },
        emphasis: { focus: "series" },
        data: s.data.map((pt) => [pt.x, pt.y]),
        animation: false,
      })),
    };
  }, [datasets, colors, seriesVisibility, axisConfig]);

  const hasData = (option.series as unknown[]).some((s) => {
    const serie = s as { data: unknown[] };
    return serie.data && serie.data.length > 0;
  });

  if (!hasData) {
    return (
      <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground">
        No data to chart. Upload a reference or comparison file to begin.
      </div>
    );
  }

  return <EChart option={option} height={380} />;
}
