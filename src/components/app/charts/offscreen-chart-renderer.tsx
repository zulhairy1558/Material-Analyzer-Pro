"use client";

import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";

import { StressChart } from "./stress-chart";
import { PunctureChart } from "./puncture-chart";
import { TearChart } from "./tear-chart";
import { ClingChart } from "./cling-chart";
import { RadarChart } from "./radar-chart";
import { RADAR_CHART_ID, TEST_TYPE_MAP } from "@/lib/constants";
import type { TestType } from "@/lib/types";

interface OffscreenChartRendererProps {
  active: boolean;
}

// useSyncExternalStore to detect client-side mounting without
// triggering the "setState in effect" lint error.
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Renders all 5 charts in a fixed-position, visually-hidden container
 * (off-screen but not display:none, so ECharts can measure dimensions).
 *
 * This component is always mounted (when `active` is true) so that
 * export functions can find any chart in the DOM at any time.
 */
export function OffscreenChartRenderer({ active }: OffscreenChartRendererProps) {
  const isClient = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);

  if (!isClient || !active) return null;

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: "-9999px",
        top: "0",
        width: "900px",
        height: "auto",
        opacity: 0,
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      {(["stress", "puncture", "tear", "cling"] as TestType[]).map((tt) => {
        const meta = TEST_TYPE_MAP[tt];
        return (
          <div key={tt} id={meta.chartId} style={{ width: "900px", height: "400px" }}>
            {tt === "stress" && <StressChart />}
            {tt === "puncture" && <PunctureChart />}
            {tt === "tear" && <TearChart />}
            {tt === "cling" && <ClingChart />}
          </div>
        );
      })}
      <div id={RADAR_CHART_ID} style={{ width: "900px", height: "500px" }}>
        <RadarChart height={500} />
      </div>
    </div>,
    document.body,
  );
}
