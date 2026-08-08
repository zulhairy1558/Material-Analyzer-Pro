"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

import {
  DEFAULT_FORMULATION_HEADERS,
  DEFAULT_REFERENCE_COLOR,
  DEFAULT_STRAIN_INPUT,
  PREDEFINED_COLORS,
  STORAGE_KEYS,
} from "./constants";
import { idbGet, idbSet } from "./idb";
import { getStressAtStrain, niceMax } from "./calculations";
import type {
  ChartAxisConfig,
  ChartAxisConfigs,
  ChartColors,
  Datasets,
  Density,
  FormulationData,
  RadarAxisDef,
  RadarAxisId,
  RadarConfig,
  SeriesVisibility,
  TestData,
  TestType,
  ThemeMode,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function makeEmptyDatasetEntry() {
  return {
    reference: null,
    comparisons: [],
    customNames: { reference: "", comparisons: [] },
    fileNames: { reference: "", comparisons: [] },
  };
}

function makeEmptyDatasets(): Datasets {
  return {
    stress: makeEmptyDatasetEntry(),
    puncture: makeEmptyDatasetEntry(),
    tear: makeEmptyDatasetEntry(),
    cling: makeEmptyDatasetEntry(),
  };
}

function makeEmptyChartColors(): ChartColors {
  const entry = () => ({ reference: DEFAULT_REFERENCE_COLOR, comparisons: [] });
  return {
    stress: entry(),
    puncture: entry(),
    tear: entry(),
    cling: entry(),
  };
}

function makeEmptyFormulation(): FormulationData {
  return {
    headers: [...DEFAULT_FORMULATION_HEADERS],
    rows: [],
  };
}

function makeEmptySeriesVisibility(): SeriesVisibility {
  return {
    stress: [],
    puncture: [],
    tear: [],
    cling: [],
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Radar default axes
// ───────────────────────────────────────────────────────────────────────────

export const RADAR_DEFAULT_AXES: RadarAxisDef[] = [
  { id: "ultimateStrain", label: "Ultimate Strain", unit: "%", visible: true, min: 0, max: 100 },
  { id: "stretchForceAtStrain", label: "Stretch Force", unit: "N", visible: true, min: 0, max: 100 },
  { id: "windForceAtStrain", label: "Wind Force", unit: "N", visible: true, min: 0, max: 100 },
  { id: "punctureForce", label: "Puncture Force", unit: "N", visible: true, min: 0, max: 100 },
  { id: "punctureEnergy", label: "Puncture Energy", unit: "J", visible: true, min: 0, max: 100 },
  { id: "tearForce", label: "Tear Force", unit: "N", visible: true, min: 0, max: 100 },
  { id: "tearTime", label: "Tear Time", unit: "s", visible: true, min: 0, max: 100 },
  { id: "tearEnergy", label: "Tear Energy", unit: "J", visible: true, min: 0, max: 100 },
  { id: "clingForce", label: "Cling Force", unit: "N", visible: true, min: 0, max: 100 },
];

const DEFAULT_RADAR_OPTIONS: Omit<RadarConfig, "axes" | "series"> = {
  rings: 5,
  fillOpacity: 0.18,
  strokeWidth: 2,
  pointRadius: 4,
  labelFontSize: 13,
  smoothCurves: false,
  animate: true,
  glowEffect: true,
  scaleMode: "auto",
};

// ───────────────────────────────────────────────────────────────────────────
// Default chart axis config (all null = auto)
// ───────────────────────────────────────────────────────────────────────────

function makeDefaultAxisConfig(): ChartAxisConfig {
  return {
    xMin: null,
    xMax: null,
    xStep: null,
    xDecimals: 2,
    yMin: null,
    yMax: null,
    yStep: null,
    yDecimals: 2,
  };
}

function makeDefaultAxisConfigs(): ChartAxisConfigs {
  return {
    stress: makeDefaultAxisConfig(),
    puncture: makeDefaultAxisConfig(),
    tear: makeDefaultAxisConfig(),
    cling: makeDefaultAxisConfig(),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Store interface
// ───────────────────────────────────────────────────────────────────────────

interface AppState {
  // Data
  datasets: Datasets;
  chartColors: ChartColors;
  strainInput: number;
  formulation: FormulationData;
  seriesVisibility: SeriesVisibility;
  hiddenSummaryRowIds: string[];

  // Hydration flag — true after IndexedDB data has been loaded
  _isHydrated: boolean;

  // Chart axis config (per-test-type: min/max/step/decimals for X and Y)
  chartAxisConfigs: ChartAxisConfigs;

  // Radar config (axes visibility + per-axis min/max + visual options)
  radarAxes: RadarAxisDef[];
  radarOptions: Omit<
    RadarConfig,
    "axes" | "series"
  >;
  radarSeriesOverrides: Record<
    string,
    { color: string; visible: boolean }
  >;

  // UI prefs (persisted to localStorage via zustand/persist)
  theme: ThemeMode;
  density: Density;
  sidebarCollapsed: boolean;

  // ── Dataset mutations
  setReference: (type: TestType, data: TestData | null, fileName?: string) => void;
  setComparison: (
    type: TestType,
    index: number,
    data: TestData | null,
    fileName?: string,
  ) => void;
  addComparison: (type: TestType) => number;
  deleteComparison: (type: TestType, index: number) => void;
  clearReference: (type: TestType) => void;
  setCustomName: (
    type: TestType,
    role: "reference" | "comparison",
    index: number,
    name: string,
  ) => void;
  setReferenceColor: (type: TestType, color: string) => void;
  setComparisonColor: (type: TestType, index: number, color: string) => void;

  // ── Strain
  setStrainInput: (value: number) => void;

  // ── Series visibility (chart legend toggle)
  setSeriesVisibility: (type: TestType, vis: boolean[]) => void;
  toggleSeriesVisibility: (type: TestType, index: number) => void;

  // ── Formulation mutations
  addFormulationRow: () => void;
  deleteFormulationRow: (index: number) => void;
  clearFormulation: () => void;
  addFormulationColumn: () => void;
  deleteFormulationColumn: (index: number) => void;
  updateFormulationCell: (row: number, col: number, value: string) => void;
  updateFormulationHeader: (col: number, value: string) => void;
  reorderFormulationColumns: (from: number, to: number) => void;

  // ── Summary
  toggleSummaryRow: (id: string) => void;
  unhideAllSummaryRows: () => void;
  clearSummaryRows: () => void;

  // ── Chart axis config
  setChartAxisConfig: (
    type: TestType,
    patch: Partial<ChartAxisConfig>,
  ) => void;
  resetChartAxisConfig: (type: TestType) => void;

  // ── Radar
  setRadarAxisVisible: (axisId: RadarAxisId, visible: boolean) => void;
  setRadarAxisRange: (
    axisId: RadarAxisId,
    min: number,
    max: number,
  ) => void;
  setRadarAxisLabel: (axisId: RadarAxisId, label: string) => void;
  setRadarOptions: (
    patch: Partial<Omit<RadarConfig, "axes" | "series">>,
  ) => void;
  setRadarSeriesOverride: (
    seriesId: string,
    patch: { color?: string; visible?: boolean },
  ) => void;
  resetRadarAxes: () => void;
  autoComputeRadarAxes: () => void;

  // ── UI prefs
  setTheme: (t: ThemeMode) => void;
  setDensity: (d: Density) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // ── Reset
  resetApp: () => void;

  // ── Save / Load (file-based, original behavior)
  serializeState: () => string;
  loadFromSerialized: (json: string) => Promise<void>;

  // ── IndexedDB autosave (recovery on tab close)
  persistToIDB: () => Promise<void>;
  hydrateFromIDB: () => Promise<void>;
}

// ───────────────────────────────────────────────────────────────────────────
// Store implementation
// ───────────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Initial state
      datasets: makeEmptyDatasets(),
      chartColors: makeEmptyChartColors(),
      strainInput: DEFAULT_STRAIN_INPUT,
      formulation: makeEmptyFormulation(),
      seriesVisibility: makeEmptySeriesVisibility(),
      hiddenSummaryRowIds: [],

      _isHydrated: false,

      // Chart axis config
      chartAxisConfigs: makeDefaultAxisConfigs(),

      // Radar
      radarAxes: RADAR_DEFAULT_AXES.map((a) => ({ ...a })),
      radarOptions: { ...DEFAULT_RADAR_OPTIONS },
      radarSeriesOverrides: {},

      // UI prefs (persisted)
      theme: "system",
      density: "comfortable",
      sidebarCollapsed: false,

      // ── Dataset mutations
      setReference: (type, data, fileName = "") => {
        set((state) => {
          const entry = state.datasets[type];
          const customName =
            entry.customNames.reference ||
            (data ? data.name : "") ||
            "";
          return {
            datasets: {
              ...state.datasets,
              [type]: {
                ...entry,
                reference: data,
                customNames: {
                  ...entry.customNames,
                  reference: customName,
                },
                fileNames: {
                  ...entry.fileNames,
                  reference: fileName,
                },
              },
            },
          };
        });
        void get().persistToIDB();
      },

      setComparison: (type, index, data, fileName = "") => {
        set((state) => {
          const entry = state.datasets[type];
          const comparisons = [...entry.comparisons];
          const customNames = [...entry.customNames.comparisons];
          const fileNames = [...entry.fileNames.comparisons];

          comparisons[index] = data;
          if (!customNames[index] && data) {
            customNames[index] = data.name;
          }
          fileNames[index] = fileName;

          return {
            datasets: {
              ...state.datasets,
              [type]: {
                ...entry,
                comparisons,
                customNames: {
                  ...entry.customNames,
                  comparisons: customNames,
                },
                fileNames: {
                  ...entry.fileNames,
                  comparisons: fileNames,
                },
              },
            },
          };
        });
        void get().persistToIDB();
      },

      addComparison: (type) => {
        const state = get();
        const entry = state.datasets[type];
        const newIndex = entry.comparisons.length;

        const newColor =
          state.chartColors[type].comparisons[newIndex] ||
          PREDEFINED_COLORS[newIndex % PREDEFINED_COLORS.length];

        set({
          datasets: {
            ...state.datasets,
            [type]: {
              ...entry,
              comparisons: [...entry.comparisons, null],
              customNames: {
                ...entry.customNames,
                comparisons: [...entry.customNames.comparisons, ""],
              },
              fileNames: {
                ...entry.fileNames,
                comparisons: [...entry.fileNames.comparisons, ""],
              },
            },
          },
          chartColors: {
            ...state.chartColors,
            [type]: {
              ...state.chartColors[type],
              comparisons: [...state.chartColors[type].comparisons, newColor],
            },
          },
          seriesVisibility: {
            ...state.seriesVisibility,
            [type]: [...state.seriesVisibility[type], true],
          },
        });
        void get().persistToIDB();
        return newIndex;
      },

      deleteComparison: (type, index) => {
        set((state) => {
          const entry = state.datasets[type];
          return {
            datasets: {
              ...state.datasets,
              [type]: {
                ...entry,
                comparisons: entry.comparisons.filter((_, i) => i !== index),
                customNames: {
                  ...entry.customNames,
                  comparisons: entry.customNames.comparisons.filter(
                    (_, i) => i !== index,
                  ),
                },
                fileNames: {
                  ...entry.fileNames,
                  comparisons: entry.fileNames.comparisons.filter(
                    (_, i) => i !== index,
                  ),
                },
              },
            },
            chartColors: {
              ...state.chartColors,
              [type]: {
                ...state.chartColors[type],
                comparisons: state.chartColors[type].comparisons.filter(
                  (_, i) => i !== index,
                ),
              },
            },
            seriesVisibility: {
              ...state.seriesVisibility,
              [type]: state.seriesVisibility[type].filter(
                (_, i) => i !== index,
              ),
            },
          };
        });
        void get().persistToIDB();
      },

      clearReference: (type) => {
        set((state) => {
          const entry = state.datasets[type];
          return {
            datasets: {
              ...state.datasets,
              [type]: {
                ...entry,
                reference: null,
                customNames: {
                  ...entry.customNames,
                  reference: "",
                },
                fileNames: {
                  ...entry.fileNames,
                  reference: "",
                },
              },
            },
            chartColors: {
              ...state.chartColors,
              [type]: {
                ...state.chartColors[type],
                reference: DEFAULT_REFERENCE_COLOR,
              },
            },
          };
        });
        void get().persistToIDB();
      },

      setCustomName: (type, role, index, name) => {
        set((state) => {
          const entry = state.datasets[type];
          if (role === "reference") {
            return {
              datasets: {
                ...state.datasets,
                [type]: {
                  ...entry,
                  customNames: {
                    ...entry.customNames,
                    reference: name,
                  },
                },
              },
            };
          }
          const comparisons = [...entry.customNames.comparisons];
          comparisons[index] = name;
          // also update the data.name so charts/tables reflect it
          const dataComparisons = [...entry.comparisons];
          if (dataComparisons[index]) {
            dataComparisons[index] = {
              ...(dataComparisons[index] as TestData),
              name,
            };
          }
          return {
            datasets: {
              ...state.datasets,
              [type]: {
                ...entry,
                comparisons: dataComparisons,
                customNames: {
                  ...entry.customNames,
                  comparisons,
                },
              },
            },
          };
        });
        void get().persistToIDB();
      },

      setReferenceColor: (type, color) => {
        set((state) => ({
          chartColors: {
            ...state.chartColors,
            [type]: {
              ...state.chartColors[type],
              reference: color,
            },
          },
        }));
        void get().persistToIDB();
      },

      setComparisonColor: (type, index, color) => {
        set((state) => {
          const comparisons = [...state.chartColors[type].comparisons];
          comparisons[index] = color;
          return {
            chartColors: {
              ...state.chartColors,
              [type]: {
                ...state.chartColors[type],
                comparisons,
              },
            },
          };
        });
        void get().persistToIDB();
      },

      // ── Strain
      setStrainInput: (value) => {
        set({ strainInput: value });
        void get().persistToIDB();
      },

      // ── Series visibility
      setSeriesVisibility: (type, vis) => {
        set((state) => ({
          seriesVisibility: {
            ...state.seriesVisibility,
            [type]: vis,
          },
        }));
      },
      toggleSeriesVisibility: (type, index) => {
        set((state) => {
          const vis = [...state.seriesVisibility[type]];
          vis[index] = !vis[index];
          return {
            seriesVisibility: {
              ...state.seriesVisibility,
              [type]: vis,
            },
          };
        });
      },

      // ── Formulation mutations
      addFormulationRow: () => {
        set((state) => {
          const headers = state.formulation.headers;
          const newRow = headers.map(() => "");
          return {
            formulation: {
              ...state.formulation,
              rows: [...state.formulation.rows, newRow],
            },
          };
        });
        void get().persistToIDB();
      },

      deleteFormulationRow: (index) => {
        set((state) => ({
          formulation: {
            ...state.formulation,
            rows: state.formulation.rows.filter((_, i) => i !== index),
          },
        }));
        void get().persistToIDB();
      },

      clearFormulation: () => {
        set({ formulation: makeEmptyFormulation() });
        void get().persistToIDB();
      },

      addFormulationColumn: () => {
        set((state) => {
          const headers = [...state.formulation.headers];
          const actionIdx = headers.findIndex((h) => h === "Action");
          const newHeaderName = `Header ${headers.length}`;
          if (actionIdx >= 0) {
            headers.splice(actionIdx, 0, newHeaderName);
          } else {
            headers.push(newHeaderName);
          }
          const rows = state.formulation.rows.map((row) => {
            const newRow = [...row];
            if (actionIdx >= 0) {
              newRow.splice(actionIdx, 0, "");
            } else {
              newRow.push("");
            }
            return newRow;
          });
          return {
            formulation: { headers, rows },
          };
        });
        void get().persistToIDB();
      },

      deleteFormulationColumn: (index) => {
        set((state) => {
          const headers = state.formulation.headers.filter(
            (_, i) => i !== index,
          );
          const rows = state.formulation.rows.map((row) =>
            row.filter((_, i) => i !== index),
          );
          return {
            formulation: { headers, rows },
          };
        });
        void get().persistToIDB();
      },

      updateFormulationCell: (row, col, value) => {
        set((state) => {
          const rows = state.formulation.rows.map((r, i) => {
            if (i !== row) return r;
            const newRow = [...r];
            newRow[col] = value;
            return newRow;
          });
          return {
            formulation: { ...state.formulation, rows },
          };
        });
        void get().persistToIDB();
      },

      updateFormulationHeader: (col, value) => {
        set((state) => {
          const headers = [...state.formulation.headers];
          headers[col] = value;
          return {
            formulation: { ...state.formulation, headers },
          };
        });
        void get().persistToIDB();
      },

      reorderFormulationColumns: (from, to) => {
        if (from === to) return;
        set((state) => {
          const headers = [...state.formulation.headers];
          const [moved] = headers.splice(from, 1);
          headers.splice(to, 0, moved);
          const rows = state.formulation.rows.map((row) => {
            const newRow = [...row];
            const [movedCell] = newRow.splice(from, 1);
            newRow.splice(to, 0, movedCell);
            return newRow;
          });
          return {
            formulation: { headers, rows },
          };
        });
        void get().persistToIDB();
      },

      // ── Summary
      toggleSummaryRow: (id) => {
        set((state) => {
          if (state.hiddenSummaryRowIds.includes(id)) {
            return {
              hiddenSummaryRowIds: state.hiddenSummaryRowIds.filter(
                (r) => r !== id,
              ),
            };
          }
          return { hiddenSummaryRowIds: [...state.hiddenSummaryRowIds, id] };
        });
      },
      unhideAllSummaryRows: () => set({ hiddenSummaryRowIds: [] }),
      clearSummaryRows: () => set({ hiddenSummaryRowIds: [] }),

      // ── Chart axis config
      setChartAxisConfig: (type, patch) => {
        set((state) => ({
          chartAxisConfigs: {
            ...state.chartAxisConfigs,
            [type]: { ...state.chartAxisConfigs[type], ...patch },
          },
        }));
        void get().persistToIDB();
      },
      resetChartAxisConfig: (type) => {
        set((state) => ({
          chartAxisConfigs: {
            ...state.chartAxisConfigs,
            [type]: makeDefaultAxisConfig(),
          },
        }));
        void get().persistToIDB();
      },

      // ── Radar
      setRadarAxisVisible: (axisId, visible) => {
        set((state) => ({
          radarAxes: state.radarAxes.map((a) =>
            a.id === axisId ? { ...a, visible } : a,
          ),
        }));
        void get().persistToIDB();
      },
      setRadarAxisRange: (axisId, minVal, maxVal) => {
        set((state) => ({
          radarAxes: state.radarAxes.map((a) =>
            a.id === axisId
              ? { ...a, min: minVal, max: maxVal }
              : a,
          ),
        }));
        void get().persistToIDB();
      },
      setRadarAxisLabel: (axisId, label) => {
        set((state) => ({
          radarAxes: state.radarAxes.map((a) =>
            a.id === axisId ? { ...a, label } : a,
          ),
        }));
        void get().persistToIDB();
      },
      setRadarOptions: (patch) => {
        set((state) => ({
          radarOptions: { ...state.radarOptions, ...patch },
        }));
        void get().persistToIDB();
      },
      setRadarSeriesOverride: (seriesId, patch) => {
        set((state) => {
          const cur = state.radarSeriesOverrides[seriesId] ?? {
            color: "",
            visible: true,
          };
          return {
            radarSeriesOverrides: {
              ...state.radarSeriesOverrides,
              [seriesId]: { ...cur, ...patch },
            },
          };
        });
        void get().persistToIDB();
      },
      resetRadarAxes: () => {
        set({
          radarAxes: RADAR_DEFAULT_AXES.map((a) => ({ ...a })),
          radarOptions: { ...DEFAULT_RADAR_OPTIONS },
          radarSeriesOverrides: {},
        });
        void get().persistToIDB();
      },
      autoComputeRadarAxes: () => {
        const state = get();
        const { datasets, strainInput, radarAxes } = state;

        // Collect per-axis values from reference + comparisons
        const axisValues: Record<string, number[]> = {};
        radarAxes.forEach((a) => {
          axisValues[a.id] = [];
        });

        const pushVal = (axisId: string, v: number | null) => {
          if (v !== null && Number.isFinite(v) && v > 0) {
            axisValues[axisId]?.push(v);
          }
        };

        // Reference
        const sRef = datasets.stress.reference;
        const pRef = datasets.puncture.reference;
        const tRef = datasets.tear.reference;
        const cRef = datasets.cling.reference;
        if (sRef || pRef || tRef || cRef) {
          const at = sRef ? getStressAtStrain(sRef, strainInput) : null;
          pushVal("ultimateStrain", sRef?.maxStrain ?? null);
          pushVal("stretchForceAtStrain", at?.stretch ?? null);
          pushVal("windForceAtStrain", at?.wind ?? null);
          pushVal("punctureForce", pRef?.maxForce ?? null);
          pushVal("punctureEnergy", pRef?.energy ?? null);
          pushVal("tearForce", tRef?.maxForce ?? null);
          pushVal("tearTime", tRef?.tearTime ?? null);
          pushVal("tearEnergy", tRef?.energy ?? null);
          pushVal("clingForce", cRef?.medianForce ?? null);
        }

        // Comparisons
        const maxComp = Math.max(
          datasets.stress.comparisons.length,
          datasets.puncture.comparisons.length,
          datasets.tear.comparisons.length,
          datasets.cling.comparisons.length,
        );
        for (let i = 0; i < maxComp; i++) {
          const sC = datasets.stress.comparisons[i];
          const pC = datasets.puncture.comparisons[i];
          const tC = datasets.tear.comparisons[i];
          const cC = datasets.cling.comparisons[i];
          if (!sC && !pC && !tC && !cC) continue;
          const at = sC ? getStressAtStrain(sC, strainInput) : null;
          pushVal("ultimateStrain", sC?.maxStrain ?? null);
          pushVal("stretchForceAtStrain", at?.stretch ?? null);
          pushVal("windForceAtStrain", at?.wind ?? null);
          pushVal("punctureForce", pC?.maxForce ?? null);
          pushVal("punctureEnergy", pC?.energy ?? null);
          pushVal("tearForce", tC?.maxForce ?? null);
          pushVal("tearTime", tC?.tearTime ?? null);
          pushVal("tearEnergy", tC?.energy ?? null);
          pushVal("clingForce", cC?.medianForce ?? null);
        }

        // Compute nice max for each axis
        const newAxes = radarAxes.map((a) => {
          const vals = axisValues[a.id] ?? [];
          if (vals.length === 0) return a;
          const dataMax = Math.max(...vals);
          return { ...a, min: 0, max: niceMax(dataMax) };
        });

        set({ radarAxes: newAxes });
        void get().persistToIDB();
      },

      // ── UI prefs
      setTheme: (t) => set({ theme: t }),
      setDensity: (d) => set({ density: d }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // ── Reset
      resetApp: () => {
        set({
          datasets: makeEmptyDatasets(),
          chartColors: makeEmptyChartColors(),
          strainInput: DEFAULT_STRAIN_INPUT,
          formulation: makeEmptyFormulation(),
          seriesVisibility: makeEmptySeriesVisibility(),
          hiddenSummaryRowIds: [],
          chartAxisConfigs: makeDefaultAxisConfigs(),
          radarAxes: RADAR_DEFAULT_AXES.map((a) => ({ ...a })),
          radarOptions: { ...DEFAULT_RADAR_OPTIONS },
          radarSeriesOverrides: {},
        });
        void get().persistToIDB();
      },

      // ── Save (JSON file)
      serializeState: () => {
        const state = get();
        const payload = {
          version: "2.0" as const,
          datasets: state.datasets,
          chartColors: state.chartColors,
          strainInput: state.strainInput,
          formulation: state.formulation,
          chartAxisConfigs: state.chartAxisConfigs,
          radarAxes: state.radarAxes,
          radarOptions: state.radarOptions,
          radarSeriesOverrides: state.radarSeriesOverrides,
        };
        return JSON.stringify(payload, null, 2);
      },

      // ── Load (JSON file)
      loadFromSerialized: async (json) => {
        const parsed = JSON.parse(json) as {
          version: string;
          datasets: Datasets;
          chartColors: ChartColors;
          strainInput: number;
          formulation: FormulationData;
          chartAxisConfigs?: ChartAxisConfigs;
          radarAxes?: RadarAxisDef[];
          radarOptions?: Omit<RadarConfig, "axes" | "series">;
          radarSeriesOverrides?: Record<string, { color: string; visible: boolean }>;
        };
        if (!parsed.version) {
          throw new Error("Invalid save file: missing version");
        }
        // Migrate any missing fields
        const datasets: Datasets = {
          stress: {
            ...makeEmptyDatasetEntry(),
            ...parsed.datasets.stress,
          },
          puncture: {
            ...makeEmptyDatasetEntry(),
            ...parsed.datasets.puncture,
          },
          tear: { ...makeEmptyDatasetEntry(), ...parsed.datasets.tear },
          cling: { ...makeEmptyDatasetEntry(), ...parsed.datasets.cling },
        };
        const chartColors: ChartColors = {
          stress: {
            ...parsed.chartColors.stress,
            reference: parsed.chartColors.stress?.reference ?? DEFAULT_REFERENCE_COLOR,
            comparisons: parsed.chartColors.stress?.comparisons ?? [],
          },
          puncture: {
            ...parsed.chartColors.puncture,
            reference: parsed.chartColors.puncture?.reference ?? DEFAULT_REFERENCE_COLOR,
            comparisons: parsed.chartColors.puncture?.comparisons ?? [],
          },
          tear: {
            ...parsed.chartColors.tear,
            reference: parsed.chartColors.tear?.reference ?? DEFAULT_REFERENCE_COLOR,
            comparisons: parsed.chartColors.tear?.comparisons ?? [],
          },
          cling: {
            ...parsed.chartColors.cling,
            reference: parsed.chartColors.cling?.reference ?? DEFAULT_REFERENCE_COLOR,
            comparisons: parsed.chartColors.cling?.comparisons ?? [],
          },
        };

        // Ensure 'Action' header exists in formulation
        const formulation: FormulationData = {
          headers:
            parsed.formulation?.headers ?? [...DEFAULT_FORMULATION_HEADERS],
          rows: parsed.formulation?.rows ?? [],
        };
        if (!formulation.headers.includes("Action")) {
          formulation.headers.push("Action");
          formulation.rows = formulation.rows.map((r) => [...r, ""]);
        }

        const seriesVisibility: SeriesVisibility = {
          stress: datasets.stress.comparisons.map(() => true),
          puncture: datasets.puncture.comparisons.map(() => true),
          tear: datasets.tear.comparisons.map(() => true),
          cling: datasets.cling.comparisons.map(() => true),
        };

        set({
          datasets,
          chartColors,
          strainInput: parsed.strainInput ?? DEFAULT_STRAIN_INPUT,
          formulation,
          seriesVisibility,
          hiddenSummaryRowIds: [],
          chartAxisConfigs: parsed.chartAxisConfigs ?? makeDefaultAxisConfigs(),
          radarAxes:
            parsed.radarAxes && Array.isArray(parsed.radarAxes) && parsed.radarAxes.length > 0
              ? parsed.radarAxes.map((a, i) => ({
                  // Merge with defaults to ensure all fields exist
                  ...RADAR_DEFAULT_AXES[i],
                  ...a,
                }))
              : RADAR_DEFAULT_AXES.map((a) => ({ ...a })),
          radarOptions: { ...DEFAULT_RADAR_OPTIONS, ...(parsed.radarOptions ?? {}) },
          radarSeriesOverrides: parsed.radarSeriesOverrides ?? {},
        });
        await get().persistToIDB();
      },

      // ── IndexedDB autosave
      persistToIDB: async () => {
        const state = get();
        const payload = {
          version: "2.0",
          datasets: state.datasets,
          chartColors: state.chartColors,
          strainInput: state.strainInput,
          formulation: state.formulation,
          chartAxisConfigs: state.chartAxisConfigs,
          radarAxes: state.radarAxes,
          radarOptions: state.radarOptions,
          radarSeriesOverrides: state.radarSeriesOverrides,
        };
        await idbSet(STORAGE_KEYS.appState, payload);
      },

      hydrateFromIDB: async () => {
        const saved = await idbGet<{
          version: string;
          datasets: Datasets;
          chartColors: ChartColors;
          strainInput: number;
          formulation: FormulationData;
          chartAxisConfigs?: ChartAxisConfigs;
          radarAxes?: RadarAxisDef[];
          radarOptions?: Omit<RadarConfig, "axes" | "series">;
          radarSeriesOverrides?: Record<string, { color: string; visible: boolean }>;
        }>(STORAGE_KEYS.appState);
        if (!saved || saved.version !== "2.0") {
          set({ _isHydrated: true });
          return;
        }

        const seriesVisibility: SeriesVisibility = {
          stress: saved.datasets.stress.comparisons.map(() => true),
          puncture: saved.datasets.puncture.comparisons.map(() => true),
          tear: saved.datasets.tear.comparisons.map(() => true),
          cling: saved.datasets.cling.comparisons.map(() => true),
        };

        set({
          datasets: saved.datasets,
          chartColors: saved.chartColors,
          strainInput: saved.strainInput,
          formulation: saved.formulation,
          seriesVisibility,
          chartAxisConfigs: saved.chartAxisConfigs ?? makeDefaultAxisConfigs(),
          radarAxes:
            saved.radarAxes && Array.isArray(saved.radarAxes) && saved.radarAxes.length > 0
              ? saved.radarAxes.map((a, i) => ({
                  ...RADAR_DEFAULT_AXES[i],
                  ...a,
                }))
              : RADAR_DEFAULT_AXES.map((a) => ({ ...a })),
          radarOptions: { ...DEFAULT_RADAR_OPTIONS, ...(saved.radarOptions ?? {}) },
          radarSeriesOverrides: saved.radarSeriesOverrides ?? {},
          _isHydrated: true,
        });
      },
    }),
    {
      name: STORAGE_KEYS.theme, // persisted localStorage key — only the UI prefs
      storage: createJSONStorage(() => localStorage),
      // Only persist UI preferences; the heavy data goes to IndexedDB
      partialize: (state) => ({
        theme: state.theme,
        density: state.density,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);

// ───────────────────────────────────────────────────────────────────────────
// Utility ID generator (for summary rows)
// ───────────────────────────────────────────────────────────────────────────

export function makeRowId(role: "reference" | "comparison", index: number): string {
  return `${role}-${index}-${uuidv4().slice(0, 8)}`;
}

export function makeStableRowId(role: "reference" | "comparison", index: number): string {
  return `${role}-${index}`;
}
