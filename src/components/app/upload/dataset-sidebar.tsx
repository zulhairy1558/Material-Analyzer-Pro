"use client";

import { useCallback, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { useAppStore } from "@/lib/store";
import { parseJSONFile } from "@/lib/parsers";
import { FileDropZone } from "./file-drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TestType } from "@/lib/types";

interface DatasetSidebarProps {
  testType: TestType;
}

export function DatasetSidebar({ testType }: DatasetSidebarProps) {
  const datasets = useAppStore((s) => s.datasets[testType]);
  const chartColors = useAppStore((s) => s.chartColors[testType]);
  const setReference = useAppStore((s) => s.setReference);
  const setComparison = useAppStore((s) => s.setComparison);
  const addComparison = useAppStore((s) => s.addComparison);
  const deleteComparison = useAppStore((s) => s.deleteComparison);
  const clearReference = useAppStore((s) => s.clearReference);
  const setCustomName = useAppStore((s) => s.setCustomName);
  const setReferenceColor = useAppStore((s) => s.setReferenceColor);
  const setComparisonColor = useAppStore((s) => s.setComparisonColor);

  const [collapsedComps, setCollapsedComps] = useState<Set<number>>(new Set());
  const [refCollapsed, setRefCollapsed] = useState(false);

  const handleReferenceFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      try {
        const data = await parseJSONFile(file, testType);
        setReference(testType, data, file.name);
        toast.success(`Loaded reference: ${data.name}`);
      } catch (err) {
        toast.error(
          `Failed to load reference: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
    [setReference, testType],
  );

  const handleComparisonFiles = useCallback(
    async (files: File[], index: number) => {
      const file = files[0];
      if (!file) return;
      try {
        const data = await parseJSONFile(file, testType);
        setComparison(testType, index, data, file.name);
        toast.success(`Loaded comparison: ${data.name}`);
      } catch (err) {
        toast.error(
          `Failed to load comparison: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
    [setComparison, testType],
  );

  const handleMultiComparisonFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          const data = await parseJSONFile(file, testType);
          const newIndex = addComparison(testType);
          setComparison(testType, newIndex, data, file.name);
        } catch (err) {
          toast.error(
            `Skipped ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
          );
        }
      }
    },
    [addComparison, setComparison, testType],
  );

  const handleAddComparison = useCallback(() => {
    addComparison(testType);
  }, [addComparison, testType]);

  const toggleCollapse = useCallback((index: number) => {
    setCollapsedComps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const refName = datasets.customNames.reference || datasets.reference?.name || "";

  return (
    <div className="space-y-4">
      {/* Reference */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reference
          </Label>
          {datasets.reference ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setRefCollapsed((c) => !c)}
                aria-label={refCollapsed ? "Expand reference" : "Collapse reference"}
              >
                {refCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-error hover:bg-error-subtle"
                onClick={() => {
                  clearReference(testType);
                  toast.info("Reference cleared");
                }}
              >
                <X className="mr-1 h-3 w-3" /> Clear
              </Button>
            </div>
          ) : null}
        </div>

        {datasets.reference ? (
          <div className="rounded-lg border border-border bg-card-elevated overflow-hidden">
            <button
              onClick={() => setRefCollapsed((c) => !c)}
              className="flex w-full items-center gap-2 p-3 text-left hover:bg-card/50 transition-colors"
            >
              {refCollapsed ? (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium text-foreground">
                {datasets.fileNames.reference || refName}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {!refCollapsed ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 p-3 pt-0">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Custom name
                      </Label>
                      <Input
                        type="text"
                        value={refName}
                        onChange={(e) =>
                          setCustomName(testType, "reference", 0, e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Color
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={chartColors.reference}
                          onChange={(e) => setReferenceColor(testType, e.target.value)}
                          className="h-8 w-12 cursor-pointer rounded border border-border bg-card"
                        />
                        <span className="font-mono text-xs text-muted-foreground">
                          {chartColors.reference.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : (
          <FileDropZone
            onFiles={handleReferenceFiles}
            label="Drop reference JSON"
            hint="Or click to browse"
            accept=".json,application/json"
            compact
          />
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Comparisons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Comparisons ({datasets.comparisons.length})
          </Label>
          <Button
            variant="subtle"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleAddComparison}
          >
            + Add
          </Button>
        </div>

        {datasets.comparisons.length === 0 ? (
          <FileDropZone
            onFiles={handleMultiComparisonFiles}
            allowMultiple
            label="Drop comparison JSON files"
            hint="Multi-select supported"
            accept=".json,application/json"
            compact
          />
        ) : (
          <div className="space-y-2">
            {datasets.comparisons.map((comp, i) => {
              const isCollapsed = collapsedComps.has(i);
              const customName = datasets.customNames.comparisons[i] || "";
              const displayName = customName || comp?.name || `Comparison #${i + 1}`;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border border-border bg-card-elevated overflow-hidden",
                    !comp && "border-dashed border-border-strong",
                  )}
                >
                  {/* Header — always visible, click to collapse */}
                  <div className="flex items-center gap-1 p-2">
                    <button
                      onClick={() => toggleCollapse(i)}
                      className="flex flex-1 items-center gap-2 text-left min-w-0"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      {comp ? (
                        <FileText
                          className="h-4 w-4 shrink-0"
                          style={{ color: chartColors.comparisons[i] ?? "#999" }}
                        />
                      ) : null}
                      <span className="truncate text-sm font-medium text-foreground">
                        {comp ? displayName : `Comparison #${i + 1} (empty)`}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-error hover:bg-error-subtle"
                      onClick={() => {
                        deleteComparison(testType, i);
                        toast.info(`Comparison #${i + 1} removed`);
                      }}
                      aria-label="Delete comparison"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* Body — collapsible */}
                  <AnimatePresence initial={false}>
                    {!isCollapsed ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 p-2 pt-0">
                          {comp ? (
                            <>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  Name
                                </Label>
                                <Input
                                  type="text"
                                  value={customName}
                                  onChange={(e) =>
                                    setCustomName(
                                      testType,
                                      "comparison",
                                      i,
                                      e.target.value,
                                    )
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  Color
                                </Label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={chartColors.comparisons[i] ?? "#999999"}
                                    onChange={(e) =>
                                      setComparisonColor(testType, i, e.target.value)
                                    }
                                    className="h-8 w-12 cursor-pointer rounded border border-border bg-card"
                                  />
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {(chartColors.comparisons[i] ?? "#999999").toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">
                                File: {datasets.fileNames.comparisons[i] || "—"}
                              </p>
                            </>
                          ) : (
                            <FileDropZone
                              onFiles={(files) => handleComparisonFiles(files, i)}
                              label={`Upload comparison #${i + 1}`}
                              compact
                              className="border-border-strong"
                            />
                          )}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}

            <FileDropZone
              onFiles={handleMultiComparisonFiles}
              allowMultiple
              label="Drop more files to add"
              compact
              className="border-border-strong"
            />
          </div>
        )}
      </div>
    </div>
  );
}
