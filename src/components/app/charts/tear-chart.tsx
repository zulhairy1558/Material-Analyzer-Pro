"use client";

import { useAppStore } from "@/lib/store";
import { SingleSeriesChart } from "./single-series-chart";
import type { TearData } from "@/lib/types";

export function TearChart() {
  const datasets = useAppStore((s) => s.datasets.tear);
  const colors = useAppStore((s) => s.chartColors.tear);
  const seriesVisibility = useAppStore((s) => s.seriesVisibility.tear);
  const axisConfig = useAppStore((s) => s.chartAxisConfigs.tear);

  return (
    <SingleSeriesChart<TearData>
      datasets={datasets}
      colors={colors}
      seriesVisibility={seriesVisibility}
      xLabel="Time [s]"
      yLabel="Force [N]"
      xKey="time"
      yKey="force"
      xTickFormat={(v: number) => v.toFixed(1)}
      axisConfig={axisConfig}
    />
  );
}
