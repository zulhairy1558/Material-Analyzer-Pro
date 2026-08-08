"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { exportWord } from "@/lib/export-utils";
import type { WordExportConfig } from "@/lib/types";

interface WordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_CONFIG: WordExportConfig = {
  mainTitle: "MATERIAL TEST REPORT",
  secondaryTitle: "Comprehensive Analysis of Material Properties",
  includeSummary: true,
  includeFormulation: true,
  includeRadar: true,
  sections: { stress: true, puncture: true, tear: true, cling: true },
};

const SECTIONS: Array<{ id: keyof WordExportConfig["sections"]; label: string }> = [
  { id: "stress", label: "Stress-Strain" },
  { id: "puncture", label: "Puncture" },
  { id: "tear", label: "Tear" },
  { id: "cling", label: "Cling" },
];

export function WordDialog({ open, onOpenChange }: WordDialogProps) {
  const [config, setConfig] = useState<WordExportConfig>(DEFAULT_CONFIG);
  const [isExporting, setIsExporting] = useState(false);

  const handleGenerate = async () => {
    setIsExporting(true);
    try {
      await exportWord(config);
      toast.success("Word document generated");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Word Report (.docx)</DialogTitle>
          <DialogDescription>
            Generate a formatted Word document with charts and tables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="word-main-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Main Title
            </Label>
            <Input
              id="word-main-title"
              value={config.mainTitle}
              onChange={(e) => setConfig((c) => ({ ...c, mainTitle: e.target.value }))}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="word-secondary-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subtitle
            </Label>
            <Input
              id="word-secondary-title"
              value={config.secondaryTitle}
              onChange={(e) => setConfig((c) => ({ ...c, secondaryTitle: e.target.value }))}
              className="h-9"
            />
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="word-summary"
                checked={config.includeSummary}
                onCheckedChange={(v) =>
                  setConfig((c) => ({ ...c, includeSummary: v === true }))
                }
              />
              <Label htmlFor="word-summary" className="text-sm">Include Summary Table</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="word-formulation"
                checked={config.includeFormulation}
                onCheckedChange={(v) =>
                  setConfig((c) => ({ ...c, includeFormulation: v === true }))
                }
              />
              <Label htmlFor="word-formulation" className="text-sm">Include Formulation Table</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="word-radar"
                checked={config.includeRadar}
                onCheckedChange={(v) =>
                  setConfig((c) => ({ ...c, includeRadar: v === true }))
                }
              />
              <Label htmlFor="word-radar" className="text-sm">Include Radar Chart</Label>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Chart Sections
            </Label>
            {SECTIONS.map((s) => (
              <div key={s.id} className="flex items-center gap-2 pl-2">
                <Checkbox
                  id={`word-${s.id}`}
                  checked={config.sections[s.id]}
                  onCheckedChange={(v) =>
                    setConfig((c) => ({
                      ...c,
                      sections: { ...c.sections, [s.id]: v === true },
                    }))
                  }
                />
                <Label htmlFor={`word-${s.id}`} className="text-sm">{s.label}</Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Generate .docx
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
