"use client";

import { useAppStore } from "@/lib/store";
import { SingleSeriesChart } from "./single-series-chart";
import type { PunctureData } from "@/lib/types";

export function PunctureChart() {
  const datasets = useAppStore((s) => s.datasets.puncture);
  const colors = useAppStore((s) => s.chartColors.puncture);
  const seriesVisibility = useAppStore((s) => s.seriesVisibility.puncture);
  const axisConfig = useAppStore((s) => s.chartAxisConfigs.puncture);

  return (
    <SingleSeriesChart<PunctureData>
      datasets={datasets}
      colors={colors}
      seriesVisibility={seriesVisibility}
      xLabel="Position [mm]"
      yLabel="Force [N]"
      xKey="position"
      yKey="force"
      xTickFormat={(v: number) => v.toFixed(2)}
      axisConfig={axisConfig}
    />
  );
}
