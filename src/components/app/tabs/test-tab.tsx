"use client";

import { useMemo } from "react";
import { FileImage, Maximize2 } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { ChartCard } from "../charts/chart-card";
import { AxisSettingsPanel } from "../charts/axis-settings-panel";
import { DatasetSidebar } from "../upload/dataset-sidebar";
import { TEST_TYPE_MAP } from "@/lib/constants";
import type { TestType } from "@/lib/types";
import { StressChart } from "../charts/stress-chart";
import { PunctureChart } from "../charts/puncture-chart";
import { TearChart } from "../charts/tear-chart";
import { ClingChart } from "../charts/cling-chart";
import { StressStatsTable } from "../tables/stress-stats-table";
import { PunctureStatsTable } from "../tables/puncture-stats-table";
import { TearStatsTable } from "../tables/tear-stats-table";
import { ClingStatsTable } from "../tables/cling-stats-table";
import { exportChartAsPNG } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface TestTabProps {
  testType: TestType;
}

export function TestTab({ testType }: TestTabProps) {
  const meta = TEST_TYPE_MAP[testType];
  const strainInput = useAppStore((s) => s.strainInput);
  const setStrainInput = useAppStore((s) => s.setStrainInput);

  const chartComponent = useMemo(() => {
    switch (testType) {
      case "stress":
        return <StressChart />;
      case "puncture":
        return <PunctureChart />;
      case "tear":
        return <TearChart />;
      case "cling":
        return <ClingChart />;
    }
  }, [testType]);

  const statsTable = useMemo(() => {
    switch (testType) {
      case "stress":
        return <StressStatsTable />;
      case "puncture":
        return <PunctureStatsTable />;
      case "tear":
        return <TearStatsTable />;
      case "cling":
        return <ClingStatsTable />;
    }
  }, [testType]);

  const handleExportPNG = async () => {
    try {
      await exportChartAsPNG(meta.chartId, `${meta.chartId}.png`, `${meta.label} Chart`);
      toast.success(`Exported ${meta.chartId}.png`);
    } catch (err) {
      toast.error(
        `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* Main column: chart + stats */}
      <div className="space-y-4">
        {testType === "stress" ? (
          <div className="flex items-end gap-3 rounded-lg border border-border bg-card-elevated p-3">
            <div className="space-y-1">
              <Label
                htmlFor="strain-input"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Comparison Strain [%]
              </Label>
              <Input
                id="strain-input"
                type="number"
                value={strainInput}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setStrainInput(Number.isFinite(v) && v > 0 ? v : 260);
                }}
                className="h-8 w-32 font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Forces are interpolated at this strain value across all reference
              and comparison datasets.
            </p>
          </div>
        ) : null}

        <AxisSettingsPanel testType={testType} />

        <ChartCard
          title={`${meta.label} Chart`}
          subtitle={`${meta.xLabel} vs. ${meta.yLabel}`}
          actions={
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleExportPNG}
                aria-label="Export chart as PNG"
                title="Export as PNG"
              >
                <FileImage className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toast.info("Hover over the chart to see tooltips")}
                aria-label="Chart info"
                title="Hover for tooltips"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </>
          }
        >
          <div id={meta.chartId} className="w-full">
            {chartComponent}
          </div>
        </ChartCard>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Statistics
          </h3>
          {statsTable}
        </div>
      </div>

      {/* Sidebar column: dataset upload */}
      <aside className="lg:sticky lg:top-[88px] lg:self-start">
        <div className="rounded-xl border border-border bg-card p-4">
          <header className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              {meta.label}
            </h2>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </header>
          <DatasetSidebar testType={testType} />
        </div>
      </aside>
    </div>
  );
}
