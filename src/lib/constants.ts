import type { TestType } from "./types";

// 20-color palette cycled for comparison series (mirrors the original app)
export const PREDEFINED_COLORS = [
  "#e91e63",
  "#17a2b8",
  "#ffc107",
  "#28a745",
  "#6f42c1",
  "#fd7e14",
  "#20c997",
  "#6610f2",
  "#e83e8c",
  "#007bff",
  "#dc3545",
  "#343a40",
  "#6c757d",
  "#17a2b8",
  "#ff9800",
  "#9c27b0",
  "#00bcd4",
  "#8bc34a",
  "#ffeb3b",
  "#f44336",
];

// Default reference color (canonical — original app had #007bff/#0056b3 inconsistency)
export const DEFAULT_REFERENCE_COLOR = "#007bff";

// Default strain comparison point
export const DEFAULT_STRAIN_INPUT = 260;

// App version
export const APP_VERSION = "2.0.0";

// Storage keys
export const STORAGE_KEYS = {
  theme: "mta-theme",
  density: "mta-density",
  sidebarCollapsed: "mta-sidebar-collapsed",
  appState: "mta-app-state-v2",
} as const;

// IndexedDB config
export const IDB_CONFIG = {
  dbName: "mta-store",
  dbVersion: 1,
  storeName: "kv",
} as const;

// Test type metadata
export interface TestTypeMeta {
  id: TestType;
  label: string;
  icon: string; // Lucide icon name
  chartId: string;
  xLabel: string;
  yLabel: string;
  description: string;
}

export const TEST_TYPES: TestTypeMeta[] = [
  {
    id: "stress",
    label: "Stress-Strain",
    icon: "TrendingUp",
    chartId: "stressStrainChart",
    xLabel: "Strain [%]",
    yLabel: "Force [N]",
    description: "Stretch & wind forces vs. strain",
  },
  {
    id: "puncture",
    label: "Puncture",
    icon: "CircleDot",
    chartId: "punctureChart",
    xLabel: "Position [mm]",
    yLabel: "Force [N]",
    description: "Force vs. probe position",
  },
  {
    id: "tear",
    label: "Tear",
    icon: "Scissors",
    chartId: "tearChart",
    xLabel: "Time [s]",
    yLabel: "Force [N]",
    description: "Force vs. time during tear",
  },
  {
    id: "cling",
    label: "Cling",
    icon: "GripHorizontal",
    chartId: "clingChart",
    xLabel: "Time [s]",
    yLabel: "Force [N]",
    description: "Cling force vs. time",
  },
];

export const TEST_TYPE_MAP: Record<TestType, TestTypeMeta> = TEST_TYPES.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<TestType, TestTypeMeta>,
);

// Default formulation table headers
export const DEFAULT_FORMULATION_HEADERS = [
  "Header Title 1",
  "Header Title 2",
  "Header Title 3",
  "Header Title 4",
  "Header Title 5",
  "Header Title 6",
  "Action",
];

// Available themes (kept for reference; only light/dark/system are actively used)
export const AVAILABLE_THEMES = [
  "light",
  "dark",
  "system",
] as const;

// Radar chart color palette (from Radar-Chart-Pro source)
export const RADAR_SERIES_COLORS = [
  "#06d6a0",
  "#ef476f",
  "#ffd166",
  "#4cc9f0",
  "#c77dff",
  "#f78c6b",
  "#06d6f0",
  "#f72585",
  "#b7e778",
  "#a8dadc",
  "#ff9f1c",
  "#e9c46a",
  "#2a9d8f",
  "#e76f51",
  "#457b9d",
];

// Chart IDs used by exports
export const RADAR_CHART_ID = "radarChart";
