"use client";

import { useMemo } from "react";
import { Eye, EyeOff, Table as TableIcon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  formatEnergy,
  formatForce,
  formatStrain,
  formatTime,
  getStressAtStrain,
} from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../ui/empty-state";
import { makeStableRowId } from "@/lib/store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SummaryRowData {
  id: string;
  role: "reference" | "comparison";
  index: number;
  sampleName: string;
  ultimateStrain: number | null;
  stretchForceAtStrain: number | null;
  windForceAtStrain: number | null;
  punctureForce: number | null;
  punctureEnergy: number | null;
  tearForce: number | null;
  tearTime: number | null;
  tearEnergy: number | null;
  clingForce: number | null;
}

export function SummaryTable() {
  const datasets = useAppStore((s) => s.datasets);
  const strainInput = useAppStore((s) => s.strainInput);
  const hiddenIds = useAppStore((s) => s.hiddenSummaryRowIds);
  const toggleRow = useAppStore((s) => s.toggleSummaryRow);
  const unhideAll = useAppStore((s) => s.unhideAllSummaryRows);
  const clearRows = useAppStore((s) => s.clearSummaryRows);

  const rows = useMemo<SummaryRowData[]>(() => {
    const out: SummaryRowData[] = [];

    // Determine if any reference exists
    const hasRef =
      datasets.stress.reference ||
      datasets.puncture.reference ||
      datasets.tear.reference ||
      datasets.cling.reference;

    if (hasRef) {
      const stressRef = datasets.stress.reference;
      const punctureRef = datasets.puncture.reference;
      const tearRef = datasets.tear.reference;
      const clingRef = datasets.cling.reference;

      const sampleName =
        datasets.stress.customNames.reference ||
        stressRef?.name ||
        datasets.puncture.customNames.reference ||
        punctureRef?.name ||
        datasets.tear.customNames.reference ||
        tearRef?.name ||
        datasets.cling.customNames.reference ||
        clingRef?.name ||
        "Reference";

      const stressAt = stressRef ? getStressAtStrain(stressRef, strainInput) : null;

      out.push({
        id: makeStableRowId("reference", 0),
        role: "reference",
        index: 0,
        sampleName,
        ultimateStrain: stressRef?.maxStrain ?? null,
        stretchForceAtStrain: stressAt?.stretch ?? null,
        windForceAtStrain: stressAt?.wind ?? null,
        punctureForce: punctureRef?.maxForce ?? null,
        punctureEnergy: punctureRef?.energy ?? null,
        tearForce: tearRef?.maxForce ?? null,
        tearTime: tearRef?.tearTime ?? null,
        tearEnergy: tearRef?.energy ?? null,
        clingForce: clingRef?.medianForce ?? null,
      });
    }

    // Comparison rows — union of all comparison indices across the 4 test types
    const maxCompIdx = Math.max(
      datasets.stress.comparisons.length,
      datasets.puncture.comparisons.length,
      datasets.tear.comparisons.length,
      datasets.cling.comparisons.length,
    );

    for (let i = 0; i < maxCompIdx; i++) {
      const sComp = datasets.stress.comparisons[i];
      const pComp = datasets.puncture.comparisons[i];
      const tComp = datasets.tear.comparisons[i];
      const cComp = datasets.cling.comparisons[i];

      if (!sComp && !pComp && !tComp && !cComp) continue;

      const sampleName =
        (sComp && (datasets.stress.customNames.comparisons[i] || sComp.name)) ||
        (pComp && (datasets.puncture.customNames.comparisons[i] || pComp.name)) ||
        (tComp && (datasets.tear.customNames.comparisons[i] || tComp.name)) ||
        (cComp && (datasets.cling.customNames.comparisons[i] || cComp.name)) ||
        `Comparison #${i + 1}`;

      const stressAt = sComp ? getStressAtStrain(sComp, strainInput) : null;

      out.push({
        id: makeStableRowId("comparison", i),
        role: "comparison",
        index: i,
        sampleName,
        ultimateStrain: sComp?.maxStrain ?? null,
        stretchForceAtStrain: stressAt?.stretch ?? null,
        windForceAtStrain: stressAt?.wind ?? null,
        punctureForce: pComp?.maxForce ?? null,
        punctureEnergy: pComp?.energy ?? null,
        tearForce: tComp?.maxForce ?? null,
        tearTime: tComp?.tearTime ?? null,
        tearEnergy: tComp?.energy ?? null,
        clingForce: cComp?.medianForce ?? null,
      });
    }

    return out;
  }, [datasets, strainInput]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={TableIcon}
        title="No data to summarize"
        description="Upload at least one reference or comparison file to see the consolidated summary."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={unhideAll} className="h-8 text-xs">
          <Eye className="mr-1 h-3.5 w-3.5" />
          Unhide All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearRows}
          className="h-8 text-xs text-error hover:bg-error-subtle"
        >
          Clear Hidden
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-card-elevated hover:bg-card-elevated">
              <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground sticky left-0 z-10 bg-card-elevated">
                Sample
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ultimate Strain [%]
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Stretch Force at {strainInput}% [N]
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Wind Force at {strainInput}% [N]
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Puncture Force [N]
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Puncture Energy [J]
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tear Force [N]
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tear Time [s]
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tear Energy [J]
              </TableHead>
              <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cling Force [N]
              </TableHead>
              <TableHead className="h-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const hidden = hiddenIds.includes(r.id);
              if (hidden) return null;
              return (
                <TableRow
                  key={r.id}
                  className={r.role === "reference" ? "bg-primary-subtle/30" : ""}
                >
                  <TableCell className="py-2.5 text-sm font-medium text-foreground sticky left-0 z-10 bg-card">
                    {r.sampleName}
                    {r.role === "reference" ? (
                      <span className="ml-2 rounded-full bg-primary-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Ref
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                    {formatStrain(r.ultimateStrain)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                    {formatForce(r.stretchForceAtStrain)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                    {formatForce(r.windForceAtStrain)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                    {formatForce(r.punctureForce)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                    {formatEnergy(r.punctureEnergy)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                    {formatForce(r.tearForce)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                    {formatTime(r.tearTime)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                    {formatEnergy(r.tearEnergy)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                    {formatForce(r.clingForce)}
                  </TableCell>
                  <TableCell className="py-2.5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleRow(r.id)}
                      aria-label={hidden ? "Show row" : "Hide row"}
                    >
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Hidden rows section */}
      {hiddenIds.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-card-elevated p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hidden rows ({hiddenIds.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {hiddenIds.map((id) => {
              const row = rows.find((r) => r.id === id);
              if (!row) return null;
              return (
                <button
                  key={id}
                  onClick={() => toggleRow(id)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-primary-subtle hover:text-primary"
                >
                  <Eye className="h-3 w-3" />
                  {row.sampleName}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
