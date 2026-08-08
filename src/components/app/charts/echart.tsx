"use client";

import { useEffect, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import * as echarts from "echarts";
import { useAppStore } from "@/lib/store";

interface EChartProps {
  option: EChartsOption;
  height?: number;
  className?: string;
  onChartReady?: (instance: echarts.ECharts) => void;
}

/**
 * Thin wrapper around ECharts that:
 * - Re-renders when the option prop changes
 * - Auto-resizes with the container (ResizeObserver)
 * - Applies the current theme (light/dark) on each render
 * - Exposes the underlying instance via onChartReady callback
 */
export function EChart({
  option,
  height = 380,
  className,
  onChartReady,
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const theme = useAppStore((s) => s.theme);
  const [isDark, setIsDark] = useState(false);

  // Track effective theme (resolve "system" → matchMedia)
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const compute = () =>
      setIsDark(theme === "dark" || (theme === "system" && mql.matches));
    compute();
    if (theme === "system") {
      mql.addEventListener("change", compute);
      return () => mql.removeEventListener("change", compute);
    }
  }, [theme]);

  // Init ECharts instance once
  useEffect(() => {
    if (!containerRef.current) return;
    const inst = echarts.init(containerRef.current, undefined, {
      renderer: "svg",
    });
    instanceRef.current = inst;
    onChartReady?.(inst);

    const ro = new ResizeObserver(() => inst.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      inst.dispose();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply option + theme on changes
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;

    // Compute theme-aware colors
    const chartGrid = isDark
      ? "oklch(26% 0.008 250)"
      : "oklch(92% 0.004 250)";
    const chartAxis = isDark
      ? "oklch(72% 0.008 250)"
      : "oklch(48% 0.012 250)";
    const chartText = isDark
      ? "oklch(96% 0.002 240)"
      : "oklch(20% 0.012 250)";

    const merged: EChartsOption = {
      backgroundColor: "transparent",
      ...option,
      grid: {
        top: 16,
        right: 24,
        bottom: 48,
        left: 56,
        containLabel: true,
        ...(typeof option.grid === "object" ? option.grid : {}),
      },
      textStyle: {
        color: chartText,
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        ...(option.textStyle ?? {}),
      },
    };

    // Apply theme to axes if present
    if (merged.xAxis) {
      const axes = Array.isArray(merged.xAxis) ? merged.xAxis : [merged.xAxis];
      axes.forEach((a) => {
        if (typeof a === "object" && a) {
          a.axisLine = { lineStyle: { color: chartAxis } };
          a.axisLabel = {
            color: chartAxis,
            fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
            fontSize: 11,
            ...(a.axisLabel ?? {}),
          };
          a.splitLine = {
            show: true,
            lineStyle: { color: chartGrid, type: "dashed" },
            ...(a.splitLine ?? {}),
          };
        }
      });
    }
    if (merged.yAxis) {
      const axes = Array.isArray(merged.yAxis) ? merged.yAxis : [merged.yAxis];
      axes.forEach((a) => {
        if (typeof a === "object" && a) {
          a.axisLine = { lineStyle: { color: chartAxis } };
          a.axisLabel = {
            color: chartAxis,
            fontFamily: "var(--font-jetbrains-mono), JetBrains Mono, monospace",
            fontSize: 11,
            ...(a.axisLabel ?? {}),
          };
          a.splitLine = {
            show: true,
            lineStyle: { color: chartGrid, type: "dashed" },
            ...(a.splitLine ?? {}),
          };
        }
      });
    }

    inst.setOption(merged, { notMerge: false, lazyUpdate: true });
  }, [option, isDark]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height }}
      className={className}
    />
  );
}
