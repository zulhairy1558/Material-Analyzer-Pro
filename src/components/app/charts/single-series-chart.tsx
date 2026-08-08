"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { ChartTooltip } from "./chart-tooltip";
import type { ChartAxisConfig, TestData } from "@/lib/types";
import { EChart } from "./echart";

interface SingleSeriesChartProps<T extends TestData> {
  datasets: {
    reference: T | null;
    comparisons: (T | null)[];
    customNames: { reference: string; comparisons: string[] };
  };
  colors: { reference: string; comparisons: string[] };
  seriesVisibility: boolean[];
  xLabel: string;
  yLabel: string;
  xKey: keyof T;
  yKey: keyof T;
  xTickFormat?: (v: number) => string;
  axisConfig: ChartAxisConfig;
}

export function SingleSeriesChart<T extends TestData>({
  datasets,
  colors,
  seriesVisibility,
  xLabel,
  yLabel,
  xKey,
  yKey,
  xTickFormat,
  axisConfig,
}: SingleSeriesChartProps<T>) {
  const option = useMemo<EChartsOption>(() => {
    type Serie = {
      key: string;
      label: string;
      color: string;
      data: { x: number; y: number }[];
      hidden: boolean;
    };
    const all: Serie[] = [];

    const refName =
      datasets.customNames.reference ||
      datasets.reference?.name ||
      "Reference";

    if (datasets.reference) {
      const ref = datasets.reference;
      const xs = ref[xKey] as unknown as number[];
      const ys = ref[yKey] as unknown as number[];
      all.push({
        key: "ref",
        label: refName,
        color: colors.reference,
        data: xs.map((x, i) => ({ x, y: ys[i] ?? 0 })),
        hidden: seriesVisibility[0] === false,
      });
    }
    datasets.comparisons.forEach((c, i) => {
      if (!c) return;
      const cname = datasets.customNames.comparisons[i] || c.name;
      const xs = c[xKey] as unknown as number[];
      const ys = c[yKey] as unknown as number[];
      all.push({
        key: `comp_${i}`,
        label: cname,
        color: colors.comparisons[i] ?? "#999",
        data: xs.map((x, j) => ({ x, y: ys[j] ?? 0 })),
        hidden: seriesVisibility[i + 1] === false,
      });
    });

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
        textStyle: { fontSize: 12 },
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
            marker: string;
          }>;
          if (!arr.length) return "";
          const x = arr[0].value[0];
          let html = `<div style="margin-bottom:4px;font-weight:600">${xLabel}: ${xTickFormat ? xTickFormat(x) : x.toFixed(2)}</div>`;
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
        name: xLabel,
        nameLocation: "middle",
        nameGap: 32,
        nameTextStyle: { fontSize: 12 },
        axisTick: { show: false },
        axisLabel: {
          formatter: (v: number) =>
            v.toFixed(axisConfig.xDecimals),
        },
      },
      yAxis: {
        type: "value",
        min: axisConfig.yMin ?? 0,
        max: axisConfig.yMax ?? yMax,
        interval: axisConfig.yStep ?? undefined,
        name: yLabel,
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
        symbolSize: 6,
        lineStyle: { width: 2, color: s.color },
        itemStyle: { color: s.color },
        emphasis: { focus: "series" },
        data: s.data.map((pt) => [pt.x, pt.y]),
        animation: false,
      })),
    };
  }, [datasets, colors, seriesVisibility, xLabel, yLabel, xKey, yKey, xTickFormat, axisConfig]);

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

  void ChartTooltip; // keep import for backward-compat (chart-tooltip file still exists)
  return <EChart option={option} height={380} />;
}
