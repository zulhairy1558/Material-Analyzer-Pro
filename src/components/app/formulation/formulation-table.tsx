"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DragEvent, ClipboardEvent, KeyboardEvent } from "react";

interface HistoryEntry {
  headers: string[];
  rows: string[][];
}

export function FormulationTable() {
  const formulation = useAppStore((s) => s.formulation);
  const addRow = useAppStore((s) => s.addFormulationRow);
  const deleteRow = useAppStore((s) => s.deleteFormulationRow);
  const addCol = useAppStore((s) => s.addFormulationColumn);
  const deleteCol = useAppStore((s) => s.deleteFormulationColumn);
  const updateCell = useAppStore((s) => s.updateFormulationCell);
  const updateHeader = useAppStore((s) => s.updateFormulationHeader);
  const reorder = useAppStore((s) => s.reorderFormulationColumns);
  const clearAll = useAppStore((s) => s.clearFormulation);

  // Local UI state
  const [hiddenCols, setHiddenCols] = useState<Set<number>>(new Set());
  const [hiddenRows, setHiddenRows] = useState<Set<number>>(new Set());

  // Selection: single cell or rectangular range
  const [selectedStart, setSelectedStart] = useState<{ r: number; c: number } | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<{ r: number; c: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // History (undo/redo) — local copies of { headers, rows }
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Drag state for column reorder
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // ── Snapshot helpers — push current state to history before mutations ──
  const pushHistory = useCallback(() => {
    const snap: HistoryEntry = {
      headers: [...formulation.headers],
      rows: formulation.rows.map((r) => [...r]),
    };
    // Only push if changed
    const last = history[historyIdx];
    if (
      last &&
      JSON.stringify(last.headers) === JSON.stringify(snap.headers) &&
      JSON.stringify(last.rows) === JSON.stringify(snap.rows)
    ) {
      return;
    }
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(snap);
    // Cap history at 50 entries
    while (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
  }, [formulation, history, historyIdx]);

  const restoreFromHistory = useCallback(
    (entry: HistoryEntry) => {
      // Replace the formulation by direct store mutations
      // First clear all rows
      const cur = useAppStore.getState().formulation;
      // Delete all rows then re-add
      for (let i = cur.rows.length - 1; i >= 0; i--) {
        useAppStore.getState().deleteFormulationRow(i);
      }
      // Update headers
      const targetHeaders = entry.headers;
      // Simpler: clear formulation entirely, then re-add headers/rows via the store API.
      useAppStore.getState().clearFormulation();
      // clearFormulation resets to default headers; now rebuild:
      const state = useAppStore.getState();
      // Update headers — set them by direct store state mutation via set
      // The store doesn't expose a set-headers function, so we use updateFormulationHeader one-by-one
      // First, add columns until we have targetHeaders.length
      // (clearFormulation already sets default headers; we need to align length)
      const afterClear = useAppStore.getState().formulation;
      // Remove default headers we don't need
      // The cleanest path: apply each header via updateFormulationHeader, but lengths may differ.
      // Approach: ensure the headers length matches by adding/removing columns.
      let headers = [...afterClear.headers];
      // Strip "Action" if present, we'll add it back at the end
      headers = headers.filter((h) => h !== "Action");
      // Adjust length
      while (headers.length < targetHeaders.filter((h) => h !== "Action").length) {
        headers.push(`Header ${headers.length + 1}`);
        state.addFormulationColumn();
      }
      while (headers.length > targetHeaders.filter((h) => h !== "Action").length) {
        headers.pop();
        state.deleteFormulationColumn(headers.length);
      }
      // Now set header labels
      const finalHeaders = useAppStore.getState().formulation.headers;
      finalHeaders.forEach((h, i) => {
        if (h !== "Action") {
          state.updateFormulationHeader(i, targetHeaders[i] ?? h);
        }
      });
      // Add rows
      entry.rows.forEach(() => {
        state.addFormulationRow();
      });
      // Set cell values
      const freshRows = useAppStore.getState().formulation.rows;
      freshRows.forEach((_, ri) => {
        const rowData = entry.rows[ri];
        if (!rowData) return;
        const freshHeaders = useAppStore.getState().formulation.headers;
        freshHeaders.forEach((_, ci) => {
          if (freshHeaders[ci] !== "Action") {
            const val = rowData[ci] ?? "";
            state.updateFormulationCell(ri, ci, val);
          }
        });
      });
    },
    [],
  );

  const undo = useCallback(() => {
    if (historyIdx <= 0) {
      toast.info("Nothing to undo");
      return;
    }
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    restoreFromHistory(history[newIdx]);
    toast.info("Undo");
  }, [historyIdx, history, restoreFromHistory]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) {
      toast.info("Nothing to redo");
      return;
    }
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    restoreFromHistory(history[newIdx]);
    toast.info("Redo");
  }, [historyIdx, history, restoreFromHistory]);

  // ── Snapshot before user-initiated edits ──
  const snapshotBeforeEdit = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  // ── Selection helpers ──
  const selectedRange = useMemo(() => {
    if (!selectedStart || !selectedEnd) return null;
    const r1 = Math.min(selectedStart.r, selectedEnd.r);
    const r2 = Math.max(selectedStart.r, selectedEnd.r);
    const c1 = Math.min(selectedStart.c, selectedEnd.c);
    const c2 = Math.max(selectedStart.c, selectedEnd.c);
    return { r1, r2, c1, c2 };
  }, [selectedStart, selectedEnd]);

  const isCellSelected = useCallback(
    (r: number, c: number) => {
      if (!selectedRange) return false;
      return (
        r >= selectedRange.r1 &&
        r <= selectedRange.r2 &&
        c >= selectedRange.c1 &&
        c <= selectedRange.c2
      );
    },
    [selectedRange],
  );

  const isCellEditing = useCallback(
    (r: number, c: number) =>
      editingCell?.r === r && editingCell?.c === c,
    [editingCell],
  );

  // ── Cell click → select (or start editing if already selected) ──
  const handleCellMouseDown = useCallback(
    (r: number, c: number, e: React.MouseEvent) => {
      // Skip if it's the Action column
      const header = formulation.headers[c];
      if (header === "Action") return;

      if (e.shiftKey && selectedStart) {
        setSelectedEnd({ r, c });
        return;
      }
      setSelectedStart({ r, c });
      setSelectedEnd({ r, c });
      setEditingCell(null);
    },
    [formulation.headers, selectedStart],
  );

  const handleCellDoubleClick = useCallback((r: number, c: number) => {
    setEditingCell({ r, c });
  }, []);

  // ── Keyboard navigation ──
  const handleCellKeyDown = useCallback(
    (r: number, c: number, e: KeyboardEvent<HTMLInputElement>) => {
      const header = formulation.headers[c];
      if (header === "Action") return;

      const maxR = formulation.rows.length - 1;
      // Find last non-Action column index
      const dataCols = formulation.headers
        .map((h, i) => (h !== "Action" ? i : -1))
        .filter((i) => i >= 0);
      const maxC = dataCols.length > 0 ? Math.max(...dataCols) : 0;

      const moveSelection = (nr: number, nc: number) => {
        const clampedR = Math.max(0, Math.min(maxR, nr));
        const clampedC = Math.max(0, Math.min(maxC, nc));
        setSelectedStart({ r: clampedR, c: clampedC });
        setSelectedEnd({ r: clampedR, c: clampedC });
        setEditingCell(null);
        // Focus the input so further key nav works
        const key = `${clampedR}-${clampedC}`;
        const el = inputRefs.current.get(key);
        if (el) el.focus();
      };

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveSelection(r - 1, c);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveSelection(r + 1, c);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveSelection(r, c - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveSelection(r, c + 1);
          break;
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            moveSelection(r, c - 1);
          } else {
            // Wrap to next row
            if (c === maxC) {
              if (r < maxR) moveSelection(r + 1, 0);
            } else {
              moveSelection(r, c + 1);
            }
          }
          break;
        case "Enter":
          e.preventDefault();
          if (editingCell?.r === r && editingCell?.c === c) {
            // Commit + move down
            setEditingCell(null);
            moveSelection(r + 1, c);
          } else {
            setEditingCell({ r, c });
            // Focus the input after a tick
            setTimeout(() => {
              const key = `${r}-${c}`;
              const el = inputRefs.current.get(key);
              if (el) {
                el.focus();
                el.select();
              }
            }, 0);
          }
          break;
        case "F2":
          e.preventDefault();
          setEditingCell({ r, c });
          setTimeout(() => {
            const key = `${r}-${c}`;
            const el = inputRefs.current.get(key);
            if (el) {
              el.focus();
              // Place cursor at end
              const len = el.value.length;
              el.setSelectionRange(len, len);
            }
          }, 0);
          break;
        case "Escape":
          e.preventDefault();
          setEditingCell(null);
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          snapshotBeforeEdit();
          if (selectedRange) {
            // Clear selected range
            for (let rr = selectedRange.r1; rr <= selectedRange.r2; rr++) {
              for (let cc = selectedRange.c1; cc <= selectedRange.c2; cc++) {
                if (formulation.headers[cc] !== "Action") {
                  updateCell(rr, cc, "");
                }
              }
            }
          } else {
            updateCell(r, c, "");
          }
          break;
        default:
          // If a printable character and not editing, enter edit mode
          if (
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            e.key.length === 1 &&
            editingCell?.r !== r &&
            editingCell?.c !== c
          ) {
            setEditingCell({ r, c });
            setTimeout(() => {
              const key = `${r}-${c}`;
              const el = inputRefs.current.get(key);
              if (el) {
                el.focus();
                // Replace content with the typed char
                el.value = e.key;
                // Move cursor after the char
                el.setSelectionRange(1, 1);
              }
            }, 0);
          }
          break;
      }
    },
    [
      formulation.headers,
      formulation.rows.length,
      editingCell,
      selectedRange,
      updateCell,
      snapshotBeforeEdit,
    ],
  );

  // ── Cell input change ──
  const handleCellChange = useCallback(
    (r: number, c: number, value: string) => {
      updateCell(r, c, value);
    },
    [updateCell],
  );

  // ── Cell input blur ──
  const handleCellBlur = useCallback(() => {
    setEditingCell(null);
  }, []);

  // ── Copy (Ctrl/Cmd + C) ──
  const handleCopy = useCallback(
    (e: ClipboardEvent) => {
      if (!selectedRange) return;
      // Only intercept if focus is in the table
      const target = e.target as HTMLElement;
      if (!target.closest("[data-formulation-table]")) return;
      // If currently editing a cell, let the input handle its own copy
      if (editingCell && target.tagName === "INPUT") return;

      e.preventDefault();
      const { r1, r2, c1, c2 } = selectedRange;
      const lines: string[] = [];
      for (let r = r1; r <= r2; r++) {
        const cells: string[] = [];
        for (let c = c1; c <= c2; c++) {
          const val = formulation.rows[r]?.[c] ?? "";
          cells.push(val);
        }
        lines.push(cells.join("\t"));
      }
      const text = lines.join("\n");
      e.clipboardData?.setData("text/plain", text);
      toast.success(`Copied ${r2 - r1 + 1}×${c2 - c1 + 1} cells`);
    },
    [selectedRange, formulation.rows, editingCell],
  );

  // ── Paste (Ctrl/Cmd + V) ──
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-formulation-table]")) return;
      // If editing a single cell, allow paste into the input
      if (editingCell && target.tagName === "INPUT") {
        // Let the input handle paste normally — but check if it's multi-cell paste
        const text = e.clipboardData?.getData("text/plain") ?? "";
        const lines = text.split(/\r?\n/).filter((l) => l !== "");
        if (lines.length > 1 || (lines.length === 1 && lines[0].includes("\t"))) {
          // Multi-cell paste — intercept
          e.preventDefault();
          const startR = editingCell.r;
          const startC = editingCell.c;
          snapshotBeforeEdit();
          lines.forEach((line, di) => {
            const cells = line.split("\t");
            cells.forEach((val, dj) => {
              const r = startR + di;
              const c = startC + dj;
              // Auto-extend rows if needed
              while (useAppStore.getState().formulation.rows.length <= r) {
                useAppStore.getState().addFormulationRow();
              }
              if (formulation.headers[c] !== "Action") {
                updateCell(r, c, val);
              }
            });
          });
          toast.success(`Pasted ${lines.length} rows`);
        }
        return;
      }
      if (!selectedStart) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const lines = text.split(/\r?\n/).filter((l) => l !== "");
      if (lines.length === 0) return;
      snapshotBeforeEdit();
      const startR = selectedStart.r;
      const startC = selectedStart.c;
      lines.forEach((line, di) => {
        const cells = line.split("\t");
        cells.forEach((val, dj) => {
          const r = startR + di;
          const c = startC + dj;
          // Auto-extend rows
          while (useAppStore.getState().formulation.rows.length <= r) {
            useAppStore.getState().addFormulationRow();
          }
          if (formulation.headers[c] !== "Action") {
            updateCell(r, c, val);
          }
        });
      });
      // Update selection to pasted range
      const endR = startR + lines.length - 1;
      const endC = startC + lines[0].split("\t").length - 1;
      setSelectedStart({ r: startR, c: startC });
      setSelectedEnd({ r: endR, c: endC });
      toast.success(`Pasted ${lines.length} rows × ${lines[0].split("\t").length} cols`);
    },
    [selectedStart, formulation.headers, updateCell, snapshotBeforeEdit, editingCell],
  );

  // ── Attach copy/paste listeners to document ──
  useEffect(() => {
    document.addEventListener("copy", handleCopy as unknown as EventListener);
    document.addEventListener("paste", handlePaste as unknown as EventListener);
    return () => {
      document.removeEventListener("copy", handleCopy as unknown as EventListener);
      document.removeEventListener("paste", handlePaste as unknown as EventListener);
    };
  }, [handleCopy, handlePaste]);

  // ── Global keyboard shortcuts: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z ──
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-formulation-table]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // ── Column drag-reorder ──
  const onDragStart = useCallback((colIdx: number) => {
    dragFrom.current = colIdx;
  }, []);

  const onDragOverCol = useCallback(
    (e: DragEvent, colIdx: number) => {
      e.preventDefault();
      if (dragFrom.current !== null && dragFrom.current !== colIdx) {
        setDragOver(colIdx);
      }
    },
    [],
  );

  const onDropCol = useCallback(
    (colIdx: number) => {
      if (dragFrom.current !== null && dragFrom.current !== colIdx) {
        snapshotBeforeEdit();
        reorder(dragFrom.current, colIdx);
        toast.success("Column reordered");
      }
      dragFrom.current = null;
      setDragOver(null);
    },
    [reorder, snapshotBeforeEdit],
  );

  const toggleCol = useCallback((colIdx: number) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(colIdx)) next.delete(colIdx);
      else next.add(colIdx);
      return next;
    });
  }, []);

  const toggleRow = useCallback((rowIdx: number) => {
    setHiddenRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIdx)) next.delete(rowIdx);
      else next.add(rowIdx);
      return next;
    });
  }, []);

  return (
    <div className="space-y-4" data-formulation-table>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="subtle"
          size="sm"
          className="h-8"
          onClick={() => {
            snapshotBeforeEdit();
            addRow();
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Row
        </Button>
        <Button
          variant="subtle"
          size="sm"
          className="h-8"
          onClick={() => {
            snapshotBeforeEdit();
            addCol();
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Column
        </Button>
        <div className="h-4 w-px bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={undo}
          disabled={historyIdx <= 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="mr-1 h-3.5 w-3.5" /> Undo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={redo}
          disabled={historyIdx >= history.length - 1}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="mr-1 h-3.5 w-3.5" /> Redo
        </Button>
        <div className="h-4 w-px bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => {
            setHiddenCols(new Set());
            setHiddenRows(new Set());
          }}
        >
          <Eye className="mr-1 h-3.5 w-3.5" /> Unhide All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-error hover:bg-error-subtle"
          onClick={() => {
            if (confirm("Clear all formulation rows?")) {
              snapshotBeforeEdit();
              clearAll();
              toast.info("Formulation cleared");
            }
          }}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: "auto" }}>
          <thead>
            <tr className="bg-card-elevated">
              {/* Row number gutter */}
              <th
                className="border-b border-r border-border p-1 text-center text-[10px] font-semibold text-muted-foreground sticky left-0 z-10 bg-card-elevated"
                style={{ width: 36, minWidth: 36 }}
              >
                #
              </th>
              {formulation.headers.map((header, colIdx) => {
                const isAction = header === "Action";
                const hidden = hiddenCols.has(colIdx);
                if (hidden && !isAction) {
                  return (
                    <th
                      key={colIdx}
                      className="border-b border-border p-1 text-center"
                      style={{ width: 36, minWidth: 36 }}
                    >
                      <button
                        onClick={() => toggleCol(colIdx)}
                        className="text-muted-foreground hover:text-primary"
                        aria-label={`Show column ${colIdx + 1}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </th>
                  );
                }
                if (hidden && isAction) {
                  return (
                    <th
                      key={colIdx}
                      className="border-b border-border p-1"
                      style={{ width: 36, minWidth: 36 }}
                    />
                  );
                }
                return (
                  <th
                    key={colIdx}
                    className={cn(
                      "border-b border-r border-border p-1 text-left",
                      dragOver === colIdx && "bg-primary-subtle",
                    )}
                    onDragOver={(e) => onDragOverCol(e, colIdx)}
                    onDrop={() => onDropCol(colIdx)}
                    style={{ minWidth: 120 }}
                  >
                    {isAction ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                        Action
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          draggable
                          onDragStart={() => onDragStart(colIdx)}
                          onDragEnd={() => {
                            dragFrom.current = null;
                            setDragOver(null);
                          }}
                          className="cursor-grab text-muted-foreground hover:text-primary active:cursor-grabbing"
                          aria-label="Drag to reorder column"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="text"
                          value={header}
                          onChange={(e) => updateHeader(colIdx, e.target.value)}
                          className="w-full min-w-[80px] rounded border border-transparent bg-transparent px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground focus:border-border focus:bg-card focus:outline-none"
                        />
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => toggleCol(colIdx)}
                            className="text-muted-foreground hover:text-primary"
                            aria-label={`Hide column ${colIdx + 1}`}
                          >
                            <EyeOff className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete column "${header}"?`)) {
                                snapshotBeforeEdit();
                                deleteCol(colIdx);
                                toast.info("Column deleted");
                              }
                            }}
                            className="text-muted-foreground hover:text-error"
                            aria-label={`Delete column ${colIdx + 1}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {formulation.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={formulation.headers.length + 1}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  No rows yet. Click &ldquo;Add Row&rdquo; to begin, or paste
                  data from Excel with Ctrl+V.
                </td>
              </tr>
            ) : (
              formulation.rows.map((row, rowIdx) => {
                const rowHidden = hiddenRows.has(rowIdx);
                return (
                  <motion.tr
                    key={rowIdx}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "border-b border-border transition-colors",
                      rowHidden && "opacity-40",
                    )}
                  >
                    {/* Row number gutter */}
                    <td
                      className="border-r border-border p-1 text-center text-[10px] font-mono text-muted-foreground sticky left-0 z-10 bg-card"
                      style={{ width: 36, minWidth: 36 }}
                    >
                      {rowIdx + 1}
                    </td>
                    {formulation.headers.map((header, colIdx) => {
                      const isAction = header === "Action";
                      const colHidden = hiddenCols.has(colIdx);
                      if (colHidden && !isAction) {
                        return (
                          <td
                            key={colIdx}
                            className="p-1 text-center"
                            style={{ width: 36, minWidth: 36 }}
                          />
                        );
                      }
                      if (colHidden && isAction) {
                        return (
                          <td
                            key={colIdx}
                            className="p-1"
                            style={{ width: 36, minWidth: 36 }}
                          />
                        );
                      }
                      if (isAction) {
                        return (
                          <td
                            key={colIdx}
                            className="p-1 text-center"
                            style={{ width: 100, minWidth: 100 }}
                          >
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={() => toggleRow(rowIdx)}
                                className="rounded p-1 text-muted-foreground hover:bg-primary-subtle hover:text-primary"
                                aria-label={rowHidden ? "Show row" : "Hide row"}
                              >
                                {rowHidden ? (
                                  <Eye className="h-3.5 w-3.5" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  snapshotBeforeEdit();
                                  deleteRow(rowIdx);
                                  toast.info("Row deleted");
                                }}
                                className="rounded p-1 text-muted-foreground hover:bg-error-subtle hover:text-error"
                                aria-label="Delete row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        );
                      }
                      const isSelected = isCellSelected(rowIdx, colIdx);
                      const isEditing = isCellEditing(rowIdx, colIdx);
                      const cellKey = `${rowIdx}-${colIdx}`;
                      return (
                        <td
                          key={colIdx}
                          className={cn(
                            "border-r border-border p-0 relative",
                            isSelected && !isEditing && "ring-2 ring-inset ring-primary",
                          )}
                          onMouseDown={(e) => handleCellMouseDown(rowIdx, colIdx, e)}
                          onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                          style={{ minWidth: 120 }}
                        >
                          <input
                            ref={(el) => {
                              if (el) inputRefs.current.set(cellKey, el);
                              else inputRefs.current.delete(cellKey);
                            }}
                            type="text"
                            value={row[colIdx] ?? ""}
                            onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleCellKeyDown(rowIdx, colIdx, e)}
                            onFocus={() => {
                              if (!selectedStart || selectedStart.r !== rowIdx || selectedStart.c !== colIdx) {
                                setSelectedStart({ r: rowIdx, c: colIdx });
                                setSelectedEnd({ r: rowIdx, c: colIdx });
                              }
                            }}
                            readOnly={!isEditing}
                            className={cn(
                              "w-full px-2 py-1.5 text-sm bg-transparent",
                              "border-0 outline-none",
                              isEditing
                                ? "bg-card shadow-[inset_0_0_0_2px_var(--primary)]"
                                : "cursor-cell focus:bg-primary-subtle/30",
                              "font-sans",
                            )}
                            placeholder=""
                          />
                        </td>
                      );
                    })}
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border bg-card-elevated p-3">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Excel-like shortcuts:</strong>{" "}
          Click to select · Double-click or Enter to edit · Arrow keys / Tab /
          Enter to navigate · Ctrl+C / Ctrl+V to copy/paste (supports
          multi-cell rectangular paste from Excel) · Delete to clear · Ctrl+Z
          / Ctrl+Y for undo/redo.
        </p>
        {selectedRange ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Selection:{" "}
            <span className="font-mono text-foreground">
              {selectedRange.r2 - selectedRange.r1 + 1} row
              {selectedRange.r2 - selectedRange.r1 + 1 !== 1 ? "s" : ""} ×{" "}
              {selectedRange.c2 - selectedRange.c1 + 1} col
              {selectedRange.c2 - selectedRange.c1 + 1 !== 1 ? "s" : ""}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
