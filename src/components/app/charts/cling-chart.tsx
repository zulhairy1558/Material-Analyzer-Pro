"use client";

import { useAppStore } from "@/lib/store";
import { SingleSeriesChart } from "./single-series-chart";
import type { ClingData } from "@/lib/types";

export function ClingChart() {
  const datasets = useAppStore((s) => s.datasets.cling);
  const colors = useAppStore((s) => s.chartColors.cling);
  const seriesVisibility = useAppStore((s) => s.seriesVisibility.cling);
  const axisConfig = useAppStore((s) => s.chartAxisConfigs.cling);

  return (
    <SingleSeriesChart<ClingData>
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
