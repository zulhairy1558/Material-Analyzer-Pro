"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ThemeToggle } from "./theme-toggle";
import { WordDialog } from "./export/word-dialog";
import { useAppStore } from "@/lib/store";
import {
  exportExcel,
  loadSessionJSON,
  saveSessionJSON,
} from "@/lib/export-utils";

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wordOpen, setWordOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const resetApp = useAppStore((s) => s.resetApp);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const handleSave = () => {
    saveSessionJSON();
    toast.success("Session saved to material_test_data.json");
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadSessionJSON(file);
      toast.success("Session loaded");
    } catch (err) {
      toast.error(
        `Failed to load: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportExcel();
      toast.success("Exported material_test_data.xlsx");
    } catch (err) {
      toast.error(
        `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const handleReset = () => {
    resetApp();
    setResetOpen(false);
    toast.info("Application reset");
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex h-full items-center gap-2 px-3 sm:px-4">
          {/* Sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hidden lg:flex"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

          {/* Brand */}
          <div className="flex items-center gap-2 mr-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Download className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-tight text-foreground">
                Material Test Analyzer
              </p>
              <p className="text-[10px] leading-tight text-muted-foreground font-mono">
                v2.2.0 · MZN Labs
              </p>
            </div>
          </div>

          {/* Save / Load */}
          <Button variant="ghost" size="sm" className="h-9" onClick={handleSave}>
            <Save className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Save</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-9" onClick={handleLoadClick}>
            <Upload className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Load</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleLoadFile}
          />

          {/* Export menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="h-9">
                <Download className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Reports</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setWordOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Word Document (.docx)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Data</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel Workbook (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-error hover:bg-error-subtle"
            onClick={() => setResetOpen(true)}
            aria-label="Reset application"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          {/* Theme */}
          <ThemeToggle />
        </div>
      </header>

      {/* Dialogs */}
      <WordDialog open={wordOpen} onOpenChange={setWordOpen} />

      {/* Reset confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all uploaded datasets, charts, formulation table,
              and radar settings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-error text-white hover:bg-error/90"
            >
              <Loader2 className="mr-2 h-4 w-4 hidden" />
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
