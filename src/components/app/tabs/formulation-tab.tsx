"use client";

import { FormulationTable } from "../formulation/formulation-table";

export function FormulationTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Formulation
        </h2>
        <p className="text-sm text-muted-foreground">
          Free-form editable table for recording material composition. Add
          rows/columns, reorder via drag, hide/show with the eye icon.
        </p>
      </div>
      <FormulationTable />
    </div>
  );
}
