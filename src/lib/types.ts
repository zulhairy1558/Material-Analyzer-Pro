// ───────────────────────────────────────────────────────────────────────────
// Core domain types for the Material Test Analyzer
// ───────────────────────────────────────────────────────────────────────────

export type TestType = "stress" | "puncture" | "tear" | "cling";

export type DatasetRole = "reference" | "comparison";

export type ThemeMode = "light" | "dark" | "system";

export type Density = "comfortable" | "cozy" | "compact";

// ───────────────────────────────────────────────────────────────────────────
// Parsed dataset shapes (one per test type)
// ───────────────────────────────────────────────────────────────────────────

export interface StressData {
  name: string;
  strain: number[];
  stretchMedian: number[];
  windMedian: number[];
  maxStrain: number;
}

export interface PunctureData {
  name: string;
  position: number[];
  force: number[];
  maxForce: number;
  energy: number;
}

export interface TearData {
  name: string;
  time: number[];
  force: number[];
  maxForce: number;
  tearTime: number;
  energy: number;
}

export interface ClingData {
  name: string;
  time: number[];
  force: number[];
  medianForce: number;
}

export type TestData = StressData | PunctureData | TearData | ClingData;

// ───────────────────────────────────────────────────────────────────────────
// IndexedDB / file upload JSON shapes
// ───────────────────────────────────────────────────────────────────────────

export interface StressJSON {
  calculation: { ultimate_strain: number };
  entries: {
    count: number;
    table: Array<{
      target_id: number;
      stretch_force_median?: number;
      wind_force_median?: number;
    }>;
  };
}

export interface PunctureJSON {
  calculation?: { maximum?: number; energy?: number };
  entries: {
    table: Array<{ position: number; force: number }>;
  };
}

export interface TearJSON {
  calculation?: {
    max_force?: number;
    time_to_break?: number;
    energy?: number;
  };
  entries: {
    table: Array<{ time_stamp: number; force: number }>;
  };
}

export interface ClingJSON {
  calculation?: { median?: number };
  entries: {
    table: Array<{ time_stamp: number; force: number }>;
  };
}

// ───────────────────────────────────────────────────────────────────────────
// DatasetEntry — wraps reference + comparisons for one test type
// ───────────────────────────────────────────────────────────────────────────

export interface CustomNames {
  reference: string;
  comparisons: string[];
}

export interface FileNames {
  reference: string;
  comparisons: string[];
}

export interface DatasetEntry<T extends TestData = TestData> {
  reference: T | null;
  comparisons: (T | null)[];
  customNames: CustomNames;
  fileNames: FileNames;
}

export type Datasets = {
  stress: DatasetEntry<StressData>;
  puncture: DatasetEntry<PunctureData>;
  tear: DatasetEntry<TearData>;
  cling: DatasetEntry<ClingData>;
};

// ───────────────────────────────────────────────────────────────────────────
// Chart colors — parallel structure
// ───────────────────────────────────────────────────────────────────────────

export interface ChartColorEntry {
  reference: string;
  comparisons: string[];
}

export type ChartColors = Record<TestType, ChartColorEntry>;

// ───────────────────────────────────────────────────────────────────────────
// Formulation table
// ───────────────────────────────────────────────────────────────────────────

export interface FormulationData {
  headers: string[];
  rows: string[][];
}

// ───────────────────────────────────────────────────────────────────────────
// Save file (JSON export/import)
// ───────────────────────────────────────────────────────────────────────────

export interface SaveFile {
  version: "2.0";
  datasets: Datasets;
  chartColors: ChartColors;
  strainInput: number;
  formulation: FormulationData;
}

// ───────────────────────────────────────────────────────────────────────────
// Chart series visibility (replaces Chart.js meta.hidden)
// ───────────────────────────────────────────────────────────────────────────

// For stress: [refStretch, ...compStretch, refWind, ...compWind]
// For other tests: [ref, comp1, comp2, ...]
export type SeriesVisibility = Record<TestType, boolean[]>;

// ───────────────────────────────────────────────────────────────────────────
// Summary table row
// ───────────────────────────────────────────────────────────────────────────

export type SummaryRowRole = "reference" | "comparison";

export interface SummaryRow {
  id: string;
  role: SummaryRowRole;
  index: number; // 0 for reference, otherwise comparison index
  hidden: boolean;
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

// ───────────────────────────────────────────────────────────────────────────
// Export configs
// ───────────────────────────────────────────────────────────────────────────

// HTML export removed — MultipleChartsExportConfig, FrontPageConfig, and
// ChartTableInclusionFlags are no longer needed.

export interface WordExportConfig {
  mainTitle: string;
  secondaryTitle: string;
  includeSummary: boolean;
  includeFormulation: boolean;
  includeRadar: boolean;
  sections: {
    stress: boolean;
    puncture: boolean;
    tear: boolean;
    cling: boolean;
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Radar chart types
// ───────────────────────────────────────────────────────────────────────────

// Each axis corresponds to one summary-table metric
export type RadarAxisId =
  | "ultimateStrain"
  | "stretchForceAtStrain"
  | "windForceAtStrain"
  | "punctureForce"
  | "punctureEnergy"
  | "tearForce"
  | "tearTime"
  | "tearEnergy"
  | "clingForce";

export interface RadarAxisDef {
  id: RadarAxisId;
  label: string;
  unit: string;
  visible: boolean;
  min: number;
  max: number;
}

export interface RadarSeries {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  values: Record<RadarAxisId, number | null>;
}

export interface RadarConfig {
  axes: RadarAxisDef[];
  series: RadarSeries[];
  rings: number;
  fillOpacity: number;
  strokeWidth: number;
  pointRadius: number;
  labelFontSize: number;
  smoothCurves: boolean;
  animate: boolean;
  glowEffect: boolean;
  scaleMode: "auto" | "fixed" | "global";
}

// ───────────────────────────────────────────────────────────────────────────
// Percentage / trend result
// ───────────────────────────────────────────────────────────────────────────

export type TrendDirection = "up" | "down" | "neutral" | "na";

export interface PercentageResult {
  value: number | null;
  direction: TrendDirection;
  display: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Chart axis config — per-test-type granular axis control
// ───────────────────────────────────────────────────────────────────────────

export interface ChartAxisConfig {
  xMin: number | null; // null = auto
  xMax: number | null;
  xStep: number | null; // null = auto (ECharts decides)
  xDecimals: number; // 0–6
  yMin: number | null;
  yMax: number | null;
  yStep: number | null;
  yDecimals: number;
}

export type ChartAxisConfigs = Record<TestType, ChartAxisConfig>;

