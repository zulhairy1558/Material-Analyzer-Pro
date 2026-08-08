"use client";

import ExcelJS from "exceljs";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
  InternalHyperlink,
} from "docx";

import { useAppStore } from "./store";
import {
  RADAR_CHART_ID,
  TEST_TYPE_MAP,
} from "./constants";
import {
  calculatePercentage,
  formatEnergy,
  formatForce,
  formatStrain,
  formatTime,
  getStressAtStrain,
} from "./calculations";
import {
  buildExecutiveSummary,
  buildEngineeringInterpretation,
  buildKpiScorecard,
  buildDeltaMatrix,
  buildSummaryRows,
  type SummaryRowData,
} from "./report-engine";
import type {
  ClingData,
  PunctureData,
  SaveFile,
  StressData,
  TearData,
  TestType,
  WordExportConfig,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Generic helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Wait for the Zustand store to be hydrated from IndexedDB.
 * Returns true if hydrated, false if timeout (3s).
 */
async function waitForHydration(): Promise<boolean> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    if (useAppStore.getState()._isHydrated) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Some browsers need a tick before removal
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

export function downloadText(text: string, filename: string, mime = "text/plain"): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

// ───────────────────────────────────────────────────────────────────────────
// Chart PNG export — beautiful, high-DPI, with title + padding + frame
// ───────────────────────────────────────────────────────────────────────────

/**
 * Wait for ECharts to finish rendering in the container.
 * ECharts renders asynchronously after mount, so we need a small delay
 * + a check for canvas/svg presence.
 */
async function waitForChartRender(containerId: string, maxWait = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const container = document.getElementById(containerId);
    if (container) {
      const canvas = container.querySelector("canvas");
      const svg = container.querySelector("svg");
      if (canvas || svg) {
        // Give ECharts one more frame to finish painting
        await new Promise((r) => setTimeout(r, 150));
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Export a chart container as a beautiful PNG with:
 * - 3x DPI for crisp output
 * - White background with subtle padding
 * - Title bar at top with the chart name
 * - Subtle border frame
 * - Footer with timestamp
 */
export async function exportChartAsPNG(
  containerId: string,
  filename: string,
  title?: string,
): Promise<void> {
  // Wait for the chart to render (handles offscreen container case)
  await waitForChartRender(containerId);

  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Chart container #${containerId} not found`);
  }

  const scale = 3; // 3x DPI for crisp, beautiful output
  const padding = 40;
  const titleBarHeight = 56;
  const footerHeight = 32;

  // Get the chart's native size
  const canvas = container.querySelector("canvas");
  const svg = container.querySelector("svg");
  if (!canvas && !svg) {
    throw new Error("No canvas or SVG found in chart container");
  }

  let chartWidth: number;
  let chartHeight: number;
  let chartCanvas: HTMLCanvasElement | null = null;

  if (canvas) {
    chartCanvas = canvas;
    chartWidth = canvas.width / (window.devicePixelRatio || 1);
    chartHeight = canvas.height / (window.devicePixelRatio || 1);
  } else {
    // SVG — need to render to canvas first
    const svgEl = svg as SVGElement;
    const bbox = svgEl.getBoundingClientRect();
    chartWidth = Math.max(bbox.width, 600);
    chartHeight = Math.max(bbox.height, 400);
  }

  // Ensure reasonable dimensions
  chartWidth = Math.max(chartWidth, 600);
  chartHeight = Math.max(chartHeight, 350);

  const totalWidth = (chartWidth + padding * 2) * scale;
  const totalHeight = (chartHeight + padding * 2 + titleBarHeight + footerHeight) * scale;

  // Create the output canvas
  const out = document.createElement("canvas");
  out.width = totalWidth;
  out.height = totalHeight;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Scale everything up
  ctx.scale(scale, scale);

  const w = chartWidth + padding * 2;
  const h = chartHeight + padding * 2 + titleBarHeight + footerHeight;

  // ── Background: white with subtle gradient ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, "#ffffff");
  bgGrad.addColorStop(1, "#fafbfc");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0,w, h);

  // ── Title bar ──
  const titleText = title || containerId.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
  ctx.fillStyle = "#0E8A8F";
  ctx.fillRect(0, 0, w, titleBarHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 18px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(titleText, padding, titleBarHeight / 2);

  // ── Chart area background (white) ──
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(padding, titleBarHeight + padding, chartWidth, chartHeight);

  // ── Draw the chart ──
  if (chartCanvas) {
    ctx.drawImage(
      chartCanvas,
      padding,
      titleBarHeight + padding,
      chartWidth,
      chartHeight,
    );
  } else if (svg) {
    // Render SVG to an image first
    const svgEl = svg as SVGElement;
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(chartWidth));
    clone.setAttribute("height", String(chartHeight));
    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, titleBarHeight + padding, chartWidth, chartHeight);
        URL.revokeObjectURL(svgUrl);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        resolve();
      };
      img.src = svgUrl;
    });
  }

  // ── Subtle border frame around chart ──
  ctx.strokeStyle = "#e4e6ec";
  ctx.lineWidth = 1;
  ctx.strokeRect(padding, titleBarHeight + padding, chartWidth, chartHeight);

  // ── Footer with timestamp ──
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  ctx.fillStyle = "#5a6172";
  ctx.font = "400 11px JetBrains Mono, monospace";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `Material Test Analyzer · ${timestamp}`,
    padding,
    titleBarHeight + padding + chartHeight + padding + footerHeight / 2,
  );

  // ── Right-side label ──
  ctx.textAlign = "right";
  ctx.fillText("MZN Labs", w - padding, titleBarHeight + padding + chartHeight + padding + footerHeight / 2);
  ctx.textAlign = "left";

  // ── Download ──
  await new Promise<void>((resolve, reject) => {
    out.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, filename);
        resolve();
      } else {
        reject(new Error("Failed to create PNG blob"));
      }
    }, "image/png");
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Capture chart as PNG ArrayBuffer (for Word/PDF embedding)
// ───────────────────────────────────────────────────────────────────────────

export async function captureChartAsArrayBuffer(
  containerId: string,
): Promise<ArrayBuffer | null> {
  // Wait for chart to render
  await waitForChartRender(containerId);

  const container = document.getElementById(containerId);
  if (!container) return null;

  // Try canvas
  const canvas = container.querySelector("canvas");
  if (canvas) {
    const scale = 2;
    const out = document.createElement("canvas");
    out.width = canvas.width * (scale / (window.devicePixelRatio || 1));
    out.height = canvas.height * (scale / (window.devicePixelRatio || 1));
    if (out.width < 600) out.width = 1200;
    if (out.height < 400) out.height = 800;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return new Promise<ArrayBuffer | null>((resolve) => {
      out.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(blob);
      }, "image/png");
    });
  }

  // SVG fallback
  const svg = container.querySelector("svg");
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const bbox = svg.getBoundingClientRect();
  const width = Math.max(bbox.width, 600);
  const height = Math.max(bbox.height, 400);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bgRect.setAttribute("x", "0");
  bgRect.setAttribute("y", "0");
  bgRect.setAttribute("width", String(width));
  bgRect.setAttribute("height", String(height));
  bgRect.setAttribute("fill", "#FFFFFF");
  clone.insertBefore(bgRect, clone.firstChild);

  const svgData = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgData], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<ArrayBuffer | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const out = document.createElement("canvas");
      out.width = width * scale;
      out.height = height * scale;
      const ctx = out.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(img, 0, 0, out.width, out.height);
      URL.revokeObjectURL(url);
      out.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(blob);
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// ───────────────────────────────────────────────────────────────────────────
// JSON Save / Load
// ───────────────────────────────────────────────────────────────────────────

export function saveSessionJSON(): void {
  const state = useAppStore.getState();
  const payload: SaveFile = {
    version: "2.0",
    datasets: state.datasets,
    chartColors: state.chartColors,
    strainInput: state.strainInput,
    formulation: state.formulation,
  };
  downloadText(
    JSON.stringify(payload, null, 2),
    "material_test_data.json",
    "application/json",
  );
}

export async function loadSessionJSON(file: File): Promise<void> {
  const text = await file.text();
  await useAppStore.getState().loadFromSerialized(text);
}

// ───────────────────────────────────────────────────────────────────────────
// Excel (.xlsx) export — multiple sheets with formatted tables + raw chart data
// ───────────────────────────────────────────────────────────────────────────

// SummaryRowData and buildSummaryRows are now imported from report-engine.ts

// ───────────────────────────────────────────────────────────────────────────

function styleHeaderCell(cell: ExcelJS.Cell): void {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0E8A8F" },
  };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  cell.border = {
    top: { style: "thin", color: { argb: "FFE4E6EC" } },
    bottom: { style: "thin", color: { argb: "FFE4E6EC" } },
    left: { style: "thin", color: { argb: "FFE4E6EC" } },
    right: { style: "thin", color: { argb: "FFE4E6EC" } },
  };
}

function styleDataCell(cell: ExcelJS.Cell, isRef: boolean): void {
  cell.font = { size: 11, color: { argb: "FF1A1D24" } };
  if (isRef) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD7F0F1" },
    };
  }
  cell.alignment = { vertical: "middle", horizontal: "right" };
  cell.border = {
    top: { style: "thin", color: { argb: "FFE4E6EC" } },
    bottom: { style: "thin", color: { argb: "FFE4E6EC" } },
    left: { style: "thin", color: { argb: "FFE4E6EC" } },
    right: { style: "thin", color: { argb: "FFE4E6EC" } },
  };
  cell.numFmt = "0.00";
}

async function addSummarySheet(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.addWorksheet("Summary", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const strainInput = useAppStore.getState().strainInput;
  const headers = [
    "Sample",
    "Ultimate Strain [%]",
    `Stretch Force at ${strainInput}% [N]`,
    `Wind Force at ${strainInput}% [N]`,
    "Puncture Force [N]",
    "Puncture Energy [J]",
    "Tear Force [N]",
    "Tear Time [s]",
    "Tear Energy [J]",
    "Cling Force [N]",
  ];
  ws.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: 22,
  }));
  // Style header row
  ws.getRow(1).eachCell((cell) => styleHeaderCell(cell));

  const rows = buildSummaryRows();
  rows.forEach((r) => {
    const row = ws.addRow({
      Sample: r.sampleName,
      "Ultimate Strain [%]": r.ultimateStrain ?? "N/A",
      [`Stretch Force at ${strainInput}% [N]`]: r.stretchForceAtStrain ?? "N/A",
      [`Wind Force at ${strainInput}% [N]`]: r.windForceAtStrain ?? "N/A",
      "Puncture Force [N]": r.punctureForce ?? "N/A",
      "Puncture Energy [J]": r.punctureEnergy ?? "N/A",
      "Tear Force [N]": r.tearForce ?? "N/A",
      "Tear Time [s]": r.tearTime ?? "N/A",
      "Tear Energy [J]": r.tearEnergy ?? "N/A",
      "Cling Force [N]": r.clingForce ?? "N/A",
    });
    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { size: 11, bold: r.isRef, color: { argb: "FF1A1D24" } };
        if (r.isRef) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD7F0F1" },
          };
        }
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE4E6EC" } },
          bottom: { style: "thin", color: { argb: "FFE4E6EC" } },
          left: { style: "thin", color: { argb: "FFE4E6EC" } },
          right: { style: "thin", color: { argb: "FFE4E6EC" } },
        };
      } else {
        styleDataCell(cell, r.isRef);
      }
    });
  });
}

async function addFormulationSheet(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.addWorksheet("Formulation", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const { formulation } = useAppStore.getState();
  const dataHeaders = formulation.headers.filter((h) => h !== "Action");
  const actionIdx = formulation.headers.indexOf("Action");

  ws.columns = dataHeaders.map((h) => ({ header: h, key: h, width: 20 }));
  ws.getRow(1).eachCell((cell) => styleHeaderCell(cell));

  formulation.rows.forEach((r) => {
    const rowData: Record<string, string> = {};
    dataHeaders.forEach((h, i) => {
      const idx = actionIdx >= 0 && i >= actionIdx ? i + 1 : i;
      rowData[h] = r[idx] ?? "";
    });
    const row = ws.addRow(rowData);
    row.eachCell((cell) => {
      cell.font = { size: 11, color: { argb: "FF1A1D24" } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE4E6EC" } },
        bottom: { style: "thin", color: { argb: "FFE4E6EC" } },
        left: { style: "thin", color: { argb: "FFE4E6EC" } },
        right: { style: "thin", color: { argb: "FFE4E6EC" } },
      };
    });
  });
}

async function addStressStatsSheet(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.addWorksheet("Stress Stats", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const state = useAppStore.getState();
  const strainInput = state.strainInput;
  const ds = state.datasets.stress;
  ws.columns = [
    { header: "Sample", key: "sample", width: 22 },
    { header: "Ultimate Strain [%]", key: "us", width: 22 },
    { header: `Stretch at ${strainInput}% [N]`, key: "stretch", width: 22 },
    { header: "% vs Ref", key: "stretchPct", width: 14 },
    { header: `Wind at ${strainInput}% [N]`, key: "wind", width: 22 },
    { header: "% vs Ref", key: "windPct", width: 14 },
  ];
  ws.getRow(1).eachCell((cell) => styleHeaderCell(cell));
  const sRef = ds.reference as StressData | null;
  const refAt = sRef ? getStressAtStrain(sRef, strainInput) : null;
  const refDisplayName = ds.customNames.reference || sRef?.name || "Reference";
  if (sRef) {
    const row = ws.addRow({
      sample: refDisplayName,
      us: sRef.maxStrain,
      stretch: refAt?.stretch ?? "N/A",
      stretchPct: "0.0%",
      wind: refAt?.wind ?? "N/A",
      windPct: "0.0%",
    });
    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { bold: true, size: 11, color: { argb: "FF1A1D24" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD7F0F1" } };
      } else {
        styleDataCell(cell, true);
      }
    });
  }
  ds.comparisons.forEach((c, i) => {
    const cc = c as StressData | null;
    if (!cc) return;
    const compName = ds.customNames.comparisons[i] || cc.name;
    const at = getStressAtStrain(cc, strainInput);
    const sp = calculatePercentage(at.stretch, refAt?.stretch ?? null);
    const wp = calculatePercentage(at.wind, refAt?.wind ?? null);
    const row = ws.addRow({
      sample: compName,
      us: cc.maxStrain,
      stretch: at.stretch ?? "N/A",
      stretchPct: sp.display,
      wind: at.wind ?? "N/A",
      windPct: wp.display,
    });
    row.eachCell((cell) => styleDataCell(cell, false));
  });
}

async function addPunctureStatsSheet(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.addWorksheet("Puncture Stats", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const ds = useAppStore.getState().datasets.puncture;
  ws.columns = [
    { header: "Sample", key: "sample", width: 22 },
    { header: "Max Force [N]", key: "maxForce", width: 18 },
    { header: "% vs Ref", key: "forcePct", width: 14 },
    { header: "Energy [J]", key: "energy", width: 18 },
    { header: "% vs Ref", key: "energyPct", width: 14 },
  ];
  ws.getRow(1).eachCell((cell) => styleHeaderCell(cell));
  const pRef = ds.reference as PunctureData | null;
  const refDisplayName = ds.customNames.reference || pRef?.name || "Reference";
  if (pRef) {
    const row = ws.addRow({
      sample: refDisplayName,
      maxForce: pRef.maxForce,
      forcePct: "0.0%",
      energy: pRef.energy,
      energyPct: "0.0%",
    });
    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { bold: true, size: 11, color: { argb: "FF1A1D24" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD7F0F1" } };
      } else {
        styleDataCell(cell, true);
      }
    });
  }
  ds.comparisons.forEach((c, i) => {
    const cc = c as PunctureData | null;
    if (!cc) return;
    const compName = ds.customNames.comparisons[i] || cc.name;
    const fp = calculatePercentage(cc.maxForce, pRef?.maxForce ?? null);
    const ep = calculatePercentage(cc.energy, pRef?.energy ?? null);
    const row = ws.addRow({
      sample: compName,
      maxForce: cc.maxForce,
      forcePct: fp.display,
      energy: cc.energy,
      energyPct: ep.display,
    });
    row.eachCell((cell) => styleDataCell(cell, false));
  });
}

async function addTearStatsSheet(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.addWorksheet("Tear Stats", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const ds = useAppStore.getState().datasets.tear;
  ws.columns = [
    { header: "Sample", key: "sample", width: 22 },
    { header: "Max Force [N]", key: "maxForce", width: 18 },
    { header: "% vs Ref", key: "forcePct", width: 14 },
    { header: "Tear Time [s]", key: "tearTime", width: 18 },
    { header: "% vs Ref", key: "timePct", width: 14 },
    { header: "Energy [J]", key: "energy", width: 18 },
    { header: "% vs Ref", key: "energyPct", width: 14 },
  ];
  ws.getRow(1).eachCell((cell) => styleHeaderCell(cell));
  const tRef = ds.reference as TearData | null;
  const refDisplayName = ds.customNames.reference || tRef?.name || "Reference";
  if (tRef) {
    const row = ws.addRow({
      sample: refDisplayName,
      maxForce: tRef.maxForce,
      forcePct: "0.0%",
      tearTime: tRef.tearTime,
      timePct: "0.0%",
      energy: tRef.energy,
      energyPct: "0.0%",
    });
    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { bold: true, size: 11, color: { argb: "FF1A1D24" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD7F0F1" } };
      } else {
        styleDataCell(cell, true);
      }
    });
  }
  ds.comparisons.forEach((c, i) => {
    const cc = c as TearData | null;
    if (!cc) return;
    const compName = ds.customNames.comparisons[i] || cc.name;
    const fp = calculatePercentage(cc.maxForce, tRef?.maxForce ?? null);
    const tp = calculatePercentage(cc.tearTime, tRef?.tearTime ?? null);
    const ep = calculatePercentage(cc.energy, tRef?.energy ?? null);
    const row = ws.addRow({
      sample: compName,
      maxForce: cc.maxForce,
      forcePct: fp.display,
      tearTime: cc.tearTime,
      timePct: tp.display,
      energy: cc.energy,
      energyPct: ep.display,
    });
    row.eachCell((cell) => styleDataCell(cell, false));
  });
}

async function addClingStatsSheet(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.addWorksheet("Cling Stats", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const ds = useAppStore.getState().datasets.cling;
  ws.columns = [
    { header: "Sample", key: "sample", width: 22 },
    { header: "Median Force [N]", key: "medianForce", width: 22 },
    { header: "% vs Ref", key: "pct", width: 14 },
  ];
  ws.getRow(1).eachCell((cell) => styleHeaderCell(cell));
  const cRef = ds.reference as ClingData | null;
  const refDisplayName = ds.customNames.reference || cRef?.name || "Reference";
  if (cRef) {
    const row = ws.addRow({
      sample: refDisplayName,
      medianForce: cRef.medianForce,
      pct: "0.0%",
    });
    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { bold: true, size: 11, color: { argb: "FF1A1D24" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD7F0F1" } };
      } else {
        styleDataCell(cell, true);
      }
    });
  }
  ds.comparisons.forEach((c, i) => {
    const cc = c as ClingData | null;
    if (!cc) return;
    const compName = ds.customNames.comparisons[i] || cc.name;
    const pct = calculatePercentage(cc.medianForce, cRef?.medianForce ?? null);
    const row = ws.addRow({
      sample: compName,
      medianForce: cc.medianForce,
      pct: pct.display,
    });
    row.eachCell((cell) => styleDataCell(cell, false));
  });
}

async function addRawDataSheet(
  wb: ExcelJS.Workbook,
  testType: TestType,
): Promise<void> {
  const state = useAppStore.getState();
  const ds = state.datasets[testType];
  const meta = TEST_TYPE_MAP[testType];

  const ws = wb.addWorksheet(`${meta.label} Raw`, {
    views: [{ state: "frozen", ySplit: 1, xSplit: 1 }],
  });

  // Build columns: x, then one column per dataset (ref + comparisons)
  const refName = ds.customNames.reference || ds.reference?.name || "Reference";
  const compNames = ds.comparisons.map(
    (c, i) => ds.customNames.comparisons[i] || c?.name || `Comp ${i + 1}`,
  );

  const columns: Array<Partial<ExcelJS.Column>> = [
    { header: meta.xLabel, key: "x", width: 18 },
  ];
  if (ds.reference) {
    columns.push({ header: `${refName}`, key: "ref", width: 22 });
  }
  ds.comparisons.forEach((_, i) => {
    columns.push({ header: compNames[i], key: `comp${i}`, width: 22 });
  });
  ws.columns = columns as ExcelJS.Column[];
  ws.getRow(1).eachCell((cell) => styleHeaderCell(cell));

  // Build rows: align all datasets on x values
  type Row = { x: number | null; ref: number | null; [k: string]: number | null };
  const xMap = new Map<number, Row>();

  if (ds.reference) {
    const ref = ds.reference as StressData | PunctureData | TearData | ClingData;
    const xs = getXArray(testType, ref);
    const ys = getYArray(ref);
    xs.forEach((x, i) => {
      if (!xMap.has(x)) xMap.set(x, { x, ref: null });
      const row = xMap.get(x);
      if (row) row.ref = ys[i] ?? null;
    });
  }
  ds.comparisons.forEach((c, i) => {
    if (!c) return;
    const xs = getXArray(testType, c);
    const ys = getYArray(c);
    xs.forEach((x, j) => {
      if (!xMap.has(x)) xMap.set(x, { x, ref: null });
      const row = xMap.get(x);
      if (row) row[`comp${i}`] = ys[j] ?? null;
    });
  });

  const sortedX = Array.from(xMap.keys()).sort((a, b) => a - b);
  sortedX.forEach((x) => {
    const row = xMap.get(x);
    if (!row) return;
    const excelRow: Record<string, number | string | null> = { x: row.x };
    if (ds.reference) {
      excelRow.ref = row.ref ?? "N/A";
    }
    ds.comparisons.forEach((_, i) => {
      excelRow[`comp${i}`] = row[`comp${i}`] ?? "N/A";
    });
    const added = ws.addRow(excelRow);
    added.eachCell((cell) => {
      cell.font = { size: 10, color: { argb: "FF1A1D24" } };
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE4E6EC" } },
        bottom: { style: "thin", color: { argb: "FFE4E6EC" } },
        left: { style: "thin", color: { argb: "FFE4E6EC" } },
        right: { style: "thin", color: { argb: "FFE4E6EC" } },
      };
      cell.numFmt = "0.00";
    });
  });
}

function getXArray(
  testType: TestType,
  data: StressData | PunctureData | TearData | ClingData,
): number[] {
  switch (testType) {
    case "stress":
      return (data as StressData).strain;
    case "puncture":
      return (data as PunctureData).position;
    case "tear":
      return (data as TearData).time;
    case "cling":
      return (data as ClingData).time;
  }
}

function getYArray(data: StressData | PunctureData | TearData | ClingData): number[] {
  // All test data types have a `force` field except StressData which has stretchMedian + windMedian
  if ("force" in data) return data.force;
  if ("stretchMedian" in data) return data.stretchMedian;
  return [];
}

async function addRadarDataSheet(wb: ExcelJS.Workbook): Promise<void> {
  const ws = wb.addWorksheet("Radar Data", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 1 }],
  });
  const state = useAppStore.getState();
  const axes = state.radarAxes.filter((a) => a.visible);
  const rows = buildSummaryRows();

  ws.columns = [
    { header: "Sample", key: "sample", width: 22 },
    ...axes.map((a) => ({ header: `${a.label} [${a.unit}]`, key: a.id, width: 20 })),
  ];
  ws.getRow(1).eachCell((cell) => styleHeaderCell(cell));

  rows.forEach((r) => {
    const rowData: Record<string, string | number> = { sample: r.sampleName };
    axes.forEach((a) => {
      const v = r[a.id as keyof SummaryRowData] as number | null;
      rowData[a.id] = v ?? "N/A";
    });
    const row = ws.addRow(rowData);
    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { bold: r.isRef, size: 11, color: { argb: "FF1A1D24" } };
        if (r.isRef) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD7F0F1" },
          };
        }
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE4E6EC" } },
          bottom: { style: "thin", color: { argb: "FFE4E6EC" } },
          left: { style: "thin", color: { argb: "FFE4E6EC" } },
          right: { style: "thin", color: { argb: "FFE4E6EC" } },
        };
      } else {
        styleDataCell(cell, r.isRef);
      }
    });
  });
}

export async function exportExcel(): Promise<void> {
  await waitForHydration();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Material Test Analyzer";
  wb.created = new Date();

  await addSummarySheet(wb);
  await addFormulationSheet(wb);
  await addStressStatsSheet(wb);
  await addPunctureStatsSheet(wb);
  await addTearStatsSheet(wb);
  await addClingStatsSheet(wb);
  await addRawDataSheet(wb, "stress");
  await addRawDataSheet(wb, "puncture");
  await addRawDataSheet(wb, "tear");
  await addRawDataSheet(wb, "cling");
  await addRadarDataSheet(wb);

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "material_test_data.xlsx",
  );
}

// ───────────────────────────────────────────────────────────────────────────


// ───────────────────────────────────────────────────────────────────────────
// Word (.docx) export — modern design, interactive TOC, embedded charts
// ───────────────────────────────────────────────────────────────────────────

function makeTableCell(
  text: string,
  opts: {
    header?: boolean;
    fill?: string;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts.header,
            color: opts.header ? "FFFFFF" : opts.color ?? "1A1D24",
            size: 20, // 10pt
            font: "Inter",
          }),
        ],
      }),
    ],
    shading: opts.header
      ? { type: ShadingType.SOLID, color: "0E8A8F", fill: "0E8A8F" }
      : opts.fill
        ? { type: ShadingType.SOLID, color: opts.fill, fill: opts.fill }
        : undefined,
    verticalAlign: "center",
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function makeTableRow(
  cells: string[],
  opts: { header?: boolean; fill?: string } = {},
): TableRow {
  return new TableRow({
    children: cells.map((c) =>
      makeTableCell(c, {
        header: opts.header,
        fill: opts.fill,
      }),
    ),
  });
}

function buildStatsTableRows(testType: TestType): TableRow[] {
  const state = useAppStore.getState();
  const ds = state.datasets[testType];
  const strainInput = state.strainInput;
  const rows: TableRow[] = [];
  const refDisplayName = ds.customNames.reference || ds.reference?.name || "Reference";

  if (testType === "stress") {
    rows.push(
      makeTableRow(
        [
          "Sample",
          "Ultimate Strain [%]",
          `Stretch at ${strainInput}% [N]`,
          "% vs Ref",
          `Wind at ${strainInput}% [N]`,
          "% vs Ref",
        ],
        { header: true },
      ),
    );
    const sRef = ds.reference as StressData | null;
    const refAt = sRef ? getStressAtStrain(sRef, strainInput) : null;
    if (sRef) {
      rows.push(
        makeTableRow(
          [
            refDisplayName,
            formatStrain(sRef.maxStrain),
            formatForce(refAt?.stretch ?? null),
            "0.0%",
            formatForce(refAt?.wind ?? null),
            "0.0%",
          ],
          { fill: "D7F0F1" },
        ),
      );
    }
    ds.comparisons.forEach((c, i) => {
      const cc = c as StressData | null;
      if (!cc) return;
      const compName = ds.customNames.comparisons[i] || cc.name;
      const at = getStressAtStrain(cc, strainInput);
      const sp = calculatePercentage(at.stretch, refAt?.stretch ?? null);
      const wp = calculatePercentage(at.wind, refAt?.wind ?? null);
      rows.push(
        makeTableRow([
          compName,
          formatStrain(cc.maxStrain),
          formatForce(at.stretch),
          sp.display,
          formatForce(at.wind),
          wp.display,
        ]),
      );
    });
    return rows;
  }
  if (testType === "puncture") {
    rows.push(
      makeTableRow(
        ["Sample", "Max Force [N]", "% vs Ref", "Energy [J]", "% vs Ref"],
        { header: true },
      ),
    );
    const pRef = ds.reference as PunctureData | null;
    if (pRef) {
      rows.push(
        makeTableRow(
          [refDisplayName, formatForce(pRef.maxForce, 1), "0.0%", formatEnergy(pRef.energy), "0.0%"],
          { fill: "D7F0F1" },
        ),
      );
    }
    ds.comparisons.forEach((c, i) => {
      const cc = c as PunctureData | null;
      if (!cc) return;
      const compName = ds.customNames.comparisons[i] || cc.name;
      const fp = calculatePercentage(cc.maxForce, pRef?.maxForce ?? null);
      const ep = calculatePercentage(cc.energy, pRef?.energy ?? null);
      rows.push(
        makeTableRow([
          compName,
          formatForce(cc.maxForce, 1),
          fp.display,
          formatEnergy(cc.energy),
          ep.display,
        ]),
      );
    });
    return rows;
  }
  if (testType === "tear") {
    rows.push(
      makeTableRow(
        [
          "Sample",
          "Max Force [N]",
          "% vs Ref",
          "Tear Time [s]",
          "% vs Ref",
          "Energy [J]",
          "% vs Ref",
        ],
        { header: true },
      ),
    );
    const tRef = ds.reference as TearData | null;
    if (tRef) {
      rows.push(
        makeTableRow(
          [
            refDisplayName,
            formatForce(tRef.maxForce, 1),
            "0.0%",
            formatTime(tRef.tearTime),
            "0.0%",
            formatEnergy(tRef.energy, 1),
            "0.0%",
          ],
          { fill: "D7F0F1" },
        ),
      );
    }
    ds.comparisons.forEach((c, i) => {
      const cc = c as TearData | null;
      if (!cc) return;
      const compName = ds.customNames.comparisons[i] || cc.name;
      const fp = calculatePercentage(cc.maxForce, tRef?.maxForce ?? null);
      const tp = calculatePercentage(cc.tearTime, tRef?.tearTime ?? null);
      const ep = calculatePercentage(cc.energy, tRef?.energy ?? null);
      rows.push(
        makeTableRow([
          compName,
          formatForce(cc.maxForce, 1),
          fp.display,
          formatTime(cc.tearTime),
          tp.display,
          formatEnergy(cc.energy, 1),
          ep.display,
        ]),
      );
    });
    return rows;
  }
  rows.push(
    makeTableRow(["Sample", "Median Force [N]", "% vs Ref"], { header: true }),
  );
  const cRef = ds.reference as ClingData | null;
  if (cRef) {
    rows.push(
      makeTableRow([refDisplayName, formatForce(cRef.medianForce), "0.0%"], {
        fill: "D7F0F1",
      }),
    );
  }
  ds.comparisons.forEach((c, i) => {
    const cc = c as ClingData | null;
    if (!cc) return;
    const compName = ds.customNames.comparisons[i] || cc.name;
    const pct = calculatePercentage(cc.medianForce, cRef?.medianForce ?? null);
    rows.push(makeTableRow([compName, formatForce(cc.medianForce), pct.display]));
  });
  return rows;
}

function buildFormulationTableRows(): TableRow[] {
  const state = useAppStore.getState();
  const { headers, rows } = state.formulation;
  const dataHeaders = headers.filter((h) => h !== "Action");
  const actionIdx = headers.indexOf("Action");
  const out: TableRow[] = [makeTableRow(dataHeaders, { header: true })];
  for (const r of rows) {
    out.push(
      makeTableRow(
        dataHeaders.map((_, i) => {
          const idx = actionIdx >= 0 && i >= actionIdx ? i + 1 : i;
          return r[idx] ?? "";
        }),
      ),
    );
  }
  return out;
}

function buildSummaryTableRows(): TableRow[] {
  const state = useAppStore.getState();
  const { strainInput } = state;
  const out: TableRow[] = [
    makeTableRow(
      [
        "Sample",
        "Ultimate Strain [%]",
        `Stretch at ${strainInput}% [N]`,
        `Wind at ${strainInput}% [N]`,
        "Puncture Force [N]",
        "Puncture Energy [J]",
        "Tear Force [N]",
        "Tear Time [s]",
        "Tear Energy [J]",
        "Cling Force [N]",
      ],
      { header: true },
    ),
  ];
  const rows = buildSummaryRows();
  rows.forEach((r) => {
    out.push(
      makeTableRow(
        [
          r.sampleName,
          r.ultimateStrain === null ? "N/A" : r.ultimateStrain.toFixed(2),
          r.stretchForceAtStrain === null ? "N/A" : r.stretchForceAtStrain.toFixed(2),
          r.windForceAtStrain === null ? "N/A" : r.windForceAtStrain.toFixed(2),
          r.punctureForce === null ? "N/A" : r.punctureForce.toFixed(2),
          r.punctureEnergy === null ? "N/A" : r.punctureEnergy.toFixed(2),
          r.tearForce === null ? "N/A" : r.tearForce.toFixed(2),
          r.tearTime === null ? "N/A" : r.tearTime.toFixed(2),
          r.tearEnergy === null ? "N/A" : r.tearEnergy.toFixed(2),
          r.clingForce === null ? "N/A" : r.clingForce.toFixed(2),
        ],
        { fill: r.isRef ? "D7F0F1" : undefined },
      ),
    );
  });
  return out;
}

// buildRadarTableRows is now unused — radar data is included in the delta matrix
// and performance scorecard instead.

export async function exportWord(config: WordExportConfig): Promise<void> {
  await waitForHydration();
  const sections: ISectionOptions[] = [];
  const execSummary = buildExecutiveSummary(0);
  const kpis = buildKpiScorecard(0);
  const deltaMatrix = buildDeltaMatrix(0);

  // ── PAGE 1: COVER — Controlled Technical Document ──
  const refName = execSummary?.refName || "Reference";
  const candName = execSummary?.candidateName || "Candidate";
  const reportId = `MTA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;
  const testDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  sections.push({
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { orientation: PageOrientation.PORTRAIT },
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
    },
    children: [
      // Confidentiality classification
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 1200 },
        children: [
          new TextRun({
            text: "CONFIDENTIAL — INTERNAL TECHNICAL DOCUMENT",
            bold: true,
            size: 16,
            color: "C4413B",
            font: "Inter",
          }),
        ],
      }),
      // Main title
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: config.mainTitle,
            bold: true,
            size: 72, // 36pt
            color: "0E8A8F",
            font: "Inter",
          }),
        ],
      }),
      // Subtitle
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: config.secondaryTitle,
            size: 28, // 14pt
            color: "5A6172",
            font: "Inter",
          }),
        ],
      }),
      // Metadata table (2-column key-value layout)
      new Table({
        rows: [
          new TableRow({ children: [
            makeTableCell("Project", { header: true, fill: "F4F5F7" }),
            makeTableCell("Film Formulation Optimisation"),
          ]}),
          new TableRow({ children: [
            makeTableCell("Reference", { header: true, fill: "F4F5F7" }),
            makeTableCell(refName),
          ]}),
          new TableRow({ children: [
            makeTableCell("Candidate", { header: true, fill: "F4F5F7" }),
            makeTableCell(candName),
          ]}),
          new TableRow({ children: [
            makeTableCell("Report ID", { header: true, fill: "F4F5F7" }),
            makeTableCell(reportId),
          ]}),
          new TableRow({ children: [
            makeTableCell("Test Date", { header: true, fill: "F4F5F7" }),
            makeTableCell(testDate),
          ]}),
          new TableRow({ children: [
            makeTableCell("Revision", { header: true, fill: "F4F5F7" }),
            makeTableCell("Rev. 01"),
          ]}),
          new TableRow({ children: [
            makeTableCell("Prepared By", { header: true, fill: "F4F5F7" }),
            makeTableCell("Materials Technology / Quality Engineering"),
          ]}),
          new TableRow({ children: [
            makeTableCell("Document Status", { header: true, fill: "F4F5F7" }),
            makeTableCell("Issued for Review"),
          ]}),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  // ── PAGE 2: TABLE OF CONTENTS ──
  const tocEntries: Array<{ title: string; bookmark: string }> = [];
  tocEntries.push({ title: "Executive Summary", bookmark: "exec-summary-section" });
  if (config.includeFormulation) {
    tocEntries.push({ title: "Material & Formulation", bookmark: "formulation-section" });
  }
  if (config.includeSummary) {
    tocEntries.push({ title: "Performance Dashboard", bookmark: "summary-section" });
  }
  (["stress", "puncture", "tear", "cling"] as TestType[]).forEach((tt) => {
    if (config.sections[tt]) {
      tocEntries.push({ title: TEST_TYPE_MAP[tt].label + " Performance", bookmark: `${tt}-section` });
    }
  });
  if (config.includeRadar) {
    tocEntries.push({ title: "Comparative Analysis", bookmark: "radar-section" });
  }
  tocEntries.push({ title: "Conclusions & Recommendations", bookmark: "conclusions-section" });

  sections.push({
    properties: {
      type: SectionType.NEXT_PAGE,
      page: { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
    },
    children: [
      new Paragraph({
        spacing: { after: 360 },
        children: [new TextRun({ text: "Table of Contents", bold: true, size: 48, color: "1A1D24", font: "Inter" })],
      }),
      ...tocEntries.map((entry, i) =>
        new Paragraph({
          spacing: { after: 200 },
          tabStops: [{ type: "right", position: 9000, leader: "dot" }],
          children: [
            new InternalHyperlink({
              anchor: entry.bookmark,
              children: [
                new TextRun({ text: `${String(i + 1).padStart(2, "0")}.  ${entry.title}`, size: 24, color: "0E8A8F", font: "Inter" }),
                new TextRun({ text: "\t", font: "Inter" }),
                new TextRun({ text: "—", size: 24, color: "5A6172", font: "Inter" }),
              ],
            }),
          ],
        }),
      ),
    ],
  });

  // ── PAGE 3: EXECUTIVE SUMMARY ──
  if (execSummary) {
    sections.push({
      properties: { type: SectionType.NEXT_PAGE, page: { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 240 },
          children: [new Bookmark({ id: "exec-summary-section", children: [new TextRun({ text: "Executive Summary", bold: true, size: 36, color: "1A1D24", font: "Inter" })] })],
        }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Overall Assessment", bold: true, size: 26, color: "0E8A8F", font: "Inter" })] }),
        new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: execSummary.conclusion, size: 22, color: "1A1D24", font: "Inter" })] }),
        // Performance Scorecard table
        new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: "Performance Scorecard", bold: true, size: 24, color: "0E8A8F", font: "Inter" })] }),
        new Table({
          rows: [
            makeTableRow(["Property", "Reference", "Candidate", "\u0394 vs Ref", "Assessment"], { header: true }),
            ...kpis.map((k) => {
              const refVal = k.reference !== null ? k.reference.toFixed(1) + " " + k.unit : "N/A";
              const candVal = k.candidate !== null ? k.candidate.toFixed(1) + " " + k.unit : "N/A";
              const delta = k.deltaPct !== null ? (k.deltaPct > 0 ? "+" : "") + k.deltaPct.toFixed(1) + "%" : "N/A";
              const arrow = k.direction === "up" ? "\u2191" : k.direction === "down" ? "\u2193" : k.direction === "neutral" ? "\u2248" : "\u2014";
              return makeTableRow([k.property, refVal, candVal, delta, arrow], { fill: k.assessment === "improved" ? "EBF5EF" : k.assessment === "reduced" ? "FBEAE9" : undefined });
            }),
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        // Decision box
        new Paragraph({ spacing: { before: 480, after: 80 }, children: [new TextRun({ text: "FORMULATION DECISION", bold: true, size: 24, color: "0E8A8F", font: "Inter" })] }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({
            text: `Status: ${execSummary.decision === "proceed" ? "PROCEED" : execSummary.decision === "conditional" ? "CONDITIONAL" : execSummary.decision === "reject" ? "REJECT" : "INSUFFICIENT DATA"}`,
            bold: true, size: 24,
            color: execSummary.decision === "proceed" ? "2E8B57" : execSummary.decision === "reject" ? "C4413B" : "D98E2B",
            font: "Inter",
          })],
        }),
        new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: execSummary.recommendation, size: 22, color: "1A1D24", font: "Inter" })] }),
      ],
    });
  }

  // ── PAGE: MATERIAL & FORMULATION ──
  if (config.includeFormulation) {
    sections.push({
      properties: { type: SectionType.NEXT_PAGE, page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 240 },
          children: [new Bookmark({ id: "formulation-section", children: [new TextRun({ text: "Material & Formulation", bold: true, size: 36, color: "1A1D24", font: "Inter" })] })],
        }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Formulation comparison and material identity details.", size: 22, color: "5A6172", font: "Inter" })] }),
        new Table({ rows: buildFormulationTableRows(), width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    });
  }

  // ── PAGE: PERFORMANCE DASHBOARD (Data Summary) ──
  if (config.includeSummary) {
    sections.push({
      properties: { type: SectionType.NEXT_PAGE, page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 240 },
          children: [new Bookmark({ id: "summary-section", children: [new TextRun({ text: "Performance Dashboard", bold: true, size: 36, color: "1A1D24", font: "Inter" })] })],
        }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Consolidated performance metrics across all test types.", size: 22, color: "5A6172", font: "Inter" })] }),
        new Table({ rows: buildSummaryTableRows(), width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    });
  }

  // ── PAGES: PER-TEST SECTIONS (chart + metrics + interpretation) ──
  for (const tt of (["stress", "puncture", "tear", "cling"] as TestType[])) {
    if (!config.sections[tt]) continue;
    const meta = TEST_TYPE_MAP[tt];
    const imgBuffer = await captureChartAsArrayBuffer(meta.chartId);

    type Child = Paragraph | Table;
    const children: Child[] = [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 120 },
        children: [new Bookmark({ id: `${tt}-section`, children: [new TextRun({ text: `${meta.label} Performance`, bold: true, size: 36, color: "1A1D24", font: "Inter" })] })],
      }),
    ];

    // Key finding
    const interpretation = buildEngineeringInterpretation(tt, 0);
    children.push(
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Key Finding", bold: true, size: 24, color: "0E8A8F", font: "Inter" })] }),
      new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: interpretation, size: 22, color: "5A6172", font: "Inter", italics: true })] }),
    );

    // Chart image
    if (imgBuffer) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new ImageRun({ data: imgBuffer, transformation: { width: 900, height: 400 }, type: "png" })],
        }),
      );
    }

    // Key metrics table
    children.push(
      new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Key Metrics", bold: true, size: 24, color: "0E8A8F", font: "Inter" })] }),
      new Table({ rows: buildStatsTableRows(tt), width: { size: 100, type: WidthType.PERCENTAGE } }),
    );

    sections.push({
      properties: { type: SectionType.NEXT_PAGE, page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children,
    });
  }

  // ── PAGE: COMPARATIVE ANALYSIS (Radar Chart + Delta Matrix) ──
  if (config.includeRadar) {
    const radarImg = await captureChartAsArrayBuffer(RADAR_CHART_ID);
    const radarChildren: Array<Paragraph | Table> = [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 120 },
        children: [new Bookmark({ id: "radar-section", children: [new TextRun({ text: "Comparative Analysis", bold: true, size: 36, color: "1A1D24", font: "Inter" })] })],
      }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Multi-Axis Performance Comparison", bold: true, size: 24, color: "0E8A8F", font: "Inter" })] }),
    ];

    if (radarImg) {
      radarChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new ImageRun({ data: radarImg, transformation: { width: 700, height: 420 }, type: "png" })],
        }),
      );
    }

    // Delta matrix table
    radarChildren.push(
      new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Performance Delta Matrix", bold: true, size: 24, color: "0E8A8F", font: "Inter" })] }),
      new Table({
        rows: [
          makeTableRow(["Property", "\u0394 vs Ref", "Direction", "Engineering Significance"], { header: true }),
          ...deltaMatrix.map((d) => {
            const delta = d.delta !== null ? (d.delta > 0 ? "+" : "") + d.delta.toFixed(1) + "%" : "N/A";
            const arrow = d.direction === "up" ? "\u2191" : d.direction === "down" ? "\u2193" : d.direction === "neutral" ? "\u2248" : "\u2014";
            const sig = d.direction === "up" ? "Higher" : d.direction === "down" ? "Lower" : "Comparable";
            return makeTableRow([d.property, delta, arrow, sig]);
          }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
      new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: "Engineering Interpretation", bold: true, size: 24, color: "0E8A8F", font: "Inter" })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: buildEngineeringInterpretation("radar", 0), size: 22, color: "5A6172", font: "Inter", italics: true })] }),
    );

    sections.push({
      properties: { type: SectionType.NEXT_PAGE, page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: radarChildren,
    });
  }

  // ── PAGE: CONCLUSIONS & RECOMMENDATIONS ──
  if (execSummary) {
    sections.push({
      properties: { type: SectionType.NEXT_PAGE, page: { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 240 },
          children: [new Bookmark({ id: "conclusions-section", children: [new TextRun({ text: "Conclusions & Recommendations", bold: true, size: 36, color: "1A1D24", font: "Inter" })] })],
        }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Engineering Conclusion", bold: true, size: 26, color: "0E8A8F", font: "Inter" })] }),
        new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: execSummary.conclusion, size: 22, color: "1A1D24", font: "Inter" })] }),
        new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Recommendation", bold: true, size: 26, color: "0E8A8F", font: "Inter" })] }),
        new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: execSummary.recommendation, size: 22, color: "1A1D24", font: "Inter" })] }),
        new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Validation Requirements", bold: true, size: 26, color: "0E8A8F", font: "Inter" })] }),
        new Paragraph({ spacing: { after: 60 }, indent: { left: 360 }, children: [new TextRun({ text: "\u2022  Application-level validation under representative wrapping conditions", size: 20, color: "1A1D24", font: "Inter" })] }),
        new Paragraph({ spacing: { after: 60 }, indent: { left: 360 }, children: [new TextRun({ text: "\u2022  Extended environmental testing (temperature, humidity cycling)", size: 20, color: "1A1D24", font: "Inter" })] }),
        new Paragraph({ spacing: { after: 60 }, indent: { left: 360 }, children: [new TextRun({ text: "\u2022  Production-scale trial run with quality verification", size: 20, color: "1A1D24", font: "Inter" })] }),
      ],
    });
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Inter", size: 22 },
        },
      },
    },
    sections: sections.map((s) => ({
      ...s,
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 18,
                  color: "5A6172",
                  font: "Inter",
                }),
              ],
            }),
          ],
        }),
      },
    })),
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, "material_test_report.docx");
}

// `Bookmark` is not directly exported by docx as a class — but `InternalHyperlink`
// already creates a bookmark target. We need to use `Bookmark` from docx for the
// TOC anchors. Let's check:
// Actually docx exports `Bookmark`. If not, we use a workaround.
// Workaround: use a Paragraph with a Bookmark-like wrapper.
// `Bookmark` IS exported by docx. Let's import it.
void ExternalHyperlink; // keep import for completeness

// ───────────────────────────────────────────────────────────────────────────
// CSV export — kept for backward compat, but Excel export is preferred
// ───────────────────────────────────────────────────────────────────────────

export function exportCSV(): void {
  const rows = buildSummaryRows();
  const strainInput = useAppStore.getState().strainInput;
  const headers = [
    "Item",
    "Ultimate Strain [%]",
    `Stretch Force at Strain ${strainInput}% [N]`,
    `Wind Force at Strain ${strainInput}% [N]`,
    "Puncture Force [N]",
    "Puncture Energy [J]",
    "Tear Force [N]",
    "Tear Time [s]",
    "Tear Energy [J]",
    "Cling Force [N]",
  ];
  const dataRows = rows.map((r) => [
    r.sampleName,
    r.ultimateStrain === null ? "N/A" : r.ultimateStrain.toFixed(2),
    r.stretchForceAtStrain === null ? "N/A" : r.stretchForceAtStrain.toFixed(2),
    r.windForceAtStrain === null ? "N/A" : r.windForceAtStrain.toFixed(2),
    r.punctureForce === null ? "N/A" : r.punctureForce.toFixed(2),
    r.punctureEnergy === null ? "N/A" : r.punctureEnergy.toFixed(2),
    r.tearForce === null ? "N/A" : r.tearForce.toFixed(2),
    r.tearTime === null ? "N/A" : r.tearTime.toFixed(2),
    r.tearEnergy === null ? "N/A" : r.tearEnergy.toFixed(2),
    r.clingForce === null ? "N/A" : r.clingForce.toFixed(2),
  ]);
  const csv = [headers, ...dataRows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadText(csv, "material_test_data.csv", "text/csv;charset=utf-8");
}

// Bookmark helper for docx — `Bookmark` is exported by docx
import { Bookmark } from "docx";
