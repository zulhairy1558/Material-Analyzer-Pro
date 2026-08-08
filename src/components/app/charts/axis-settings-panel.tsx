"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TestType } from "@/lib/types";

interface AxisSettingsPanelProps {
  testType: TestType;
}

interface NumberInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}

function NullableNumberInput({ value, onChange, placeholder }: NumberInputProps) {
  return (
    <Input
      type="number"
      step="any"
      value={value ?? ""}
      placeholder={placeholder ?? "Auto"}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange(null);
          return;
        }
        const v = Number(raw);
        if (Number.isFinite(v)) {
          onChange(v);
        }
      }}
      className="h-8 font-mono text-xs"
    />
  );
}

export function AxisSettingsPanel({ testType }: AxisSettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const axisConfig = useAppStore((s) => s.chartAxisConfigs[testType]);
  const setChartAxisConfig = useAppStore((s) => s.setChartAxisConfig);
  const resetChartAxisConfig = useAppStore((s) => s.resetChartAxisConfig);

  const handleReset = () => {
    resetChartAxisConfig(testType);
    toast.info("Axis settings reset to auto");
  };

  return (
    <div className="rounded-lg border border-border bg-card-elevated overflow-hidden">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-card/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <Settings2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-medium text-foreground flex-1">
          Axis Settings
        </span>
        <span className="text-xs text-muted-foreground">
          {axisConfig.xMin !== null || axisConfig.xMax !== null || axisConfig.yMin !== null || axisConfig.yMax !== null
            ? "Custom"
            : "Auto"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Leave fields empty for auto-calculation. Decimals control the
                number of decimal places shown on axis labels.
              </p>

              {/* X Axis */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  X Axis
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Min</Label>
                    <NullableNumberInput
                      value={axisConfig.xMin}
                      onChange={(v) => setChartAxisConfig(testType, { xMin: v })}
                      placeholder="Auto"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Max</Label>
                    <NullableNumberInput
                      value={axisConfig.xMax}
                      onChange={(v) => setChartAxisConfig(testType, { xMax: v })}
                      placeholder="Auto"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Step</Label>
                    <NullableNumberInput
                      value={axisConfig.xStep}
                      onChange={(v) => setChartAxisConfig(testType, { xStep: v })}
                      placeholder="Auto"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Decimals</Label>
                    <Input
                      type="number"
                      min={0}
                      max={6}
                      step={1}
                      value={axisConfig.xDecimals}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v >= 0 && v <= 6) {
                          setChartAxisConfig(testType, { xDecimals: Math.round(v) });
                        }
                      }}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Y Axis */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Y Axis
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Min</Label>
                    <NullableNumberInput
                      value={axisConfig.yMin}
                      onChange={(v) => setChartAxisConfig(testType, { yMin: v })}
                      placeholder="Auto"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Max</Label>
                    <NullableNumberInput
                      value={axisConfig.yMax}
                      onChange={(v) => setChartAxisConfig(testType, { yMax: v })}
                      placeholder="Auto"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Step</Label>
                    <NullableNumberInput
                      value={axisConfig.yStep}
                      onChange={(v) => setChartAxisConfig(testType, { yStep: v })}
                      placeholder="Auto"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Decimals</Label>
                    <Input
                      type="number"
                      min={0}
                      max={6}
                      step={1}
                      value={axisConfig.yDecimals}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v >= 0 && v <= 6) {
                          setChartAxisConfig(testType, { yDecimals: Math.round(v) });
                        }
                      }}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleReset}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset to Auto
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
