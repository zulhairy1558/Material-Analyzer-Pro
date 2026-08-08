"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { calculatePercentage, formatEnergy, formatForce } from "@/lib/calculations";
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

export function PunctureStatsTable() {
  const datasets = useAppStore((s) => s.datasets.puncture);

  const rows = useMemo(() => {
    const ref = datasets.reference;
    const refForce = ref?.maxForce ?? null;
    const refEnergy = ref?.energy ?? null;

    const out: Array<{
      name: string;
      isRef: boolean;
      maxForce: number | null;
      energy: number | null;
      forcePct: ReturnType<typeof calculatePercentage>;
      energyPct: ReturnType<typeof calculatePercentage>;
    }> = [];

    if (ref) {
      const refDisplayName =
        datasets.customNames.reference || ref.name;
      out.push({
        name: refDisplayName,
        isRef: true,
        maxForce: ref.maxForce,
        energy: ref.energy,
        forcePct: calculatePercentage(ref.maxForce, refForce),
        energyPct: calculatePercentage(ref.energy, refEnergy),
      });
    }

    datasets.comparisons.forEach((c, i) => {
      if (!c) return;
      const compName =
        datasets.customNames.comparisons[i] || c.name;
      out.push({
        name: compName,
        isRef: false,
        maxForce: c.maxForce,
        energy: c.energy,
        forcePct: calculatePercentage(c.maxForce, refForce),
        energyPct: calculatePercentage(c.energy, refEnergy),
      });
    });

    return out;
  }, [datasets]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="No puncture data yet"
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
              Max Force [N]
            </TableHead>
            <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              % vs Ref
            </TableHead>
            <TableHead className="h-10 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Puncture Energy [J]
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
                {formatForce(r.maxForce, 1)}
              </TableCell>
              <TableCell className="py-2.5 text-right">
                <PercentageBadge result={r.forcePct} />
              </TableCell>
              <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                {formatEnergy(r.energy, 2)}
              </TableCell>
              <TableCell className="py-2.5 text-right">
                <PercentageBadge result={r.energyPct} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
