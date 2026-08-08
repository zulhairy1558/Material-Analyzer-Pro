"use client";

import { SummaryTable } from "../tables/summary-table";

export function SummaryTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Data Summary
        </h2>
        <p className="text-sm text-muted-foreground">
          Consolidated view across all four test types. Hide/show rows with
          the eye icon.
        </p>
      </div>
      <SummaryTable />
    </div>
  );
}
