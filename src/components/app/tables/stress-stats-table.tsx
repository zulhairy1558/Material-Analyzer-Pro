"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import {
  calculatePercentage,
  formatStrain,
  formatForce,
  getStressAtStrain,
} from "@/lib/calculations";
import { PercentageBadge } from "../ui/percentage-badge";
import { EmptyState } from "../ui/empty-state";
import { Database } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function StressStatsTable() {
  const datasets = useAppStore((s) => s.datasets.stress);
  const strainInput = useAppStore((s) => s.strainInput);

  const rows = useMemo(() => {
    const ref = datasets.reference;
    const refAtStrain = ref ? getStressAtStrain(ref, strainInput) : null;
    const refStretch = refAtStrain?.stretch ?? null;
    const refWind = refAtStrain?.wind ?? null;

    const out: Array<{
      name: string;
      isRef: boolean;
      maxStrain: number | null;
      stretchAtStrain: number | null;
      windAtStrain: number | null;
      stretchPct: ReturnType<typeof calculatePercentage>;
      windPct: ReturnType<typeof calculatePercentage>;
    }> = [];

    if (ref) {
      const refDisplayName =
        datasets.customNames.reference || ref.name;
      out.push({
        name: refDisplayName,
        isRef: true,
        maxStrain: ref.maxStrain,
        stretchAtStrain: refStretch,
        windAtStrain: refWind,
        stretchPct: calculatePercentage(refStretch, refStretch),
        windPct: calculatePercentage(refWind, refWind),
      });
    }

    datasets.comparisons.forEach((c, i) => {
      if (!c) return;
      const compName =
        datasets.customNames.comparisons[i] || c.name;
      const atStrain = getStressAtStrain(c, strainInput);
      out.push({
        name: compName,
        isRef: false,
        maxStrain: c.maxStrain,
        stretchAtStrain: atStrain.stretch,
        windAtStrain: atStrain.wind,
        stretchPct: calculatePercentage(atStrain.stretch, refStretch),
        windPct: calculatePercentage(atStrain.wind, refWind),
      });
    });

    return out;
  }, [datasets, strainInput]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="No stress-strain data yet"
        description="Upload a reference JSON to populate this table."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-card-elevated hover:bg-card-elevated">
            <TableHead className="h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              File
            </TableHead>
            <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ultimate Strain [%]
            </TableHead>
            <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stretch Force at {strainInput}% [N]
            </TableHead>
            <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              % vs Ref
            </TableHead>
            <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Wind Force at {strainInput}% [N]
            </TableHead>
            <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              % vs Ref
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow
              key={`${r.name}-${i}`}
              className={r.isRef ? "bg-primary-subtle/30" : ""}
            >
              <TableCell className="py-2.5 text-sm font-medium text-foreground">
                {r.name}
                {r.isRef ? (
                  <span className="ml-2 rounded-full bg-primary-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Ref
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                {formatStrain(r.maxStrain)}
              </TableCell>
              <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                {formatForce(r.stretchAtStrain)}
              </TableCell>
              <TableCell className="py-2.5 text-right">
                <PercentageBadge result={r.stretchPct} />
              </TableCell>
              <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                {formatForce(r.windAtStrain)}
              </TableCell>
              <TableCell className="py-2.5 text-right">
                <PercentageBadge result={r.windPct} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
