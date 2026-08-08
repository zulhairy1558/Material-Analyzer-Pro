import type {
  ClingData,
  ClingJSON,
  PunctureData,
  PunctureJSON,
  StressData,
  StressJSON,
  TearData,
  TearJSON,
  TestData,
  TestType,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────
// File helpers
// ───────────────────────────────────────────────────────────────────────────

export function getFileName(file: File | string): string {
  const name = typeof file === "string" ? file : file.name;
  return name.replace(/\.[^/.]+$/, "");
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsText(file);
  });
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Per-test-type parsers
// ───────────────────────────────────────────────────────────────────────────

export function parseStressData(
  jsonData: StressJSON,
  fileName: string,
  customName?: string,
): StressData {
  if (
    !jsonData?.calculation?.ultimate_strain ||
    !jsonData?.entries?.count ||
    !jsonData?.entries?.table
  ) {
    throw new Error("Invalid stress-strain JSON: missing calculation or entries");
  }

  const ultimateStrain = Number(jsonData.calculation.ultimate_strain);
  const count = Number(jsonData.entries.count);
  const table = jsonData.entries.table;

  if (!Number.isFinite(ultimateStrain) || !Number.isFinite(count) || count < 2) {
    throw new Error("Invalid stress-strain JSON: ultimate_strain or count invalid");
  }

  const strainIncrement = ultimateStrain / (count - 1);

  const strain: number[] = [];
  const stretchMedian: number[] = [];
  const windMedian: number[] = [];

  let maxStrain = 0;

  for (const entry of table) {
    const targetId = Number(entry.target_id);
    const s = targetId * strainIncrement;
    strain.push(s);
    stretchMedian.push(Number(entry.stretch_force_median ?? 0));
    windMedian.push(Number(entry.wind_force_median ?? 0));
    if (s > maxStrain) maxStrain = s;
  }

  return {
    name: customName?.trim() || fileName,
    strain,
    stretchMedian,
    windMedian,
    maxStrain,
  };
}

export function parsePunctureData(
  jsonData: PunctureJSON,
  fileName: string,
  customName?: string,
): PunctureData {
  if (!jsonData?.entries?.table) {
    throw new Error("Invalid puncture JSON: missing entries.table");
  }

  const table = jsonData.entries.table;
  const position: number[] = [];
  const force: number[] = [];

  for (const entry of table) {
    position.push(Number(entry.position));
    force.push(Number(entry.force));
  }

  const maxForce =
    Number(jsonData.calculation?.maximum) || Math.max(...force, 0);
  const energy = Number(jsonData.calculation?.energy) || 0;

  return {
    name: customName?.trim() || fileName,
    position,
    force,
    maxForce,
    energy,
  };
}

export function parseTearData(
  jsonData: TearJSON,
  fileName: string,
  customName?: string,
): TearData {
  if (!jsonData?.entries?.table) {
    throw new Error("Invalid tear JSON: missing entries.table");
  }

  const table = jsonData.entries.table;
  const time: number[] = [];
  const force: number[] = [];

  for (const entry of table) {
    time.push(Number(entry.time_stamp));
    force.push(Number(entry.force));
  }

  const maxForce = Number(jsonData.calculation?.max_force) || Math.max(...force, 0);
  const tearTime = Number(jsonData.calculation?.time_to_break) || time[time.length - 1] || 0;
  const energy = Number(jsonData.calculation?.energy) || 0;

  return {
    name: customName?.trim() || fileName,
    time,
    force,
    maxForce,
    tearTime,
    energy,
  };
}

export function parseClingData(
  jsonData: ClingJSON,
  fileName: string,
  customName?: string,
): ClingData {
  if (!jsonData?.entries?.table) {
    throw new Error("Invalid cling JSON: missing entries.table");
  }

  const table = jsonData.entries.table;
  const time: number[] = [];
  const force: number[] = [];

  for (const entry of table) {
    time.push(Number(entry.time_stamp));
    force.push(Number(entry.force));
  }

  const medianForce =
    Number(jsonData.calculation?.median) || calculateMedian(force);

  return {
    name: customName?.trim() || fileName,
    time,
    force,
    medianForce,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Dispatcher
// ───────────────────────────────────────────────────────────────────────────

export async function parseJSONFile(
  file: File,
  testType: TestType,
  customName?: string,
): Promise<TestData> {
  const text = await readFileAsText(file);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const fileName = getFileName(file);

  switch (testType) {
    case "stress":
      return parseStressData(json as StressJSON, fileName, customName);
    case "puncture":
      return parsePunctureData(json as PunctureJSON, fileName, customName);
    case "tear":
      return parseTearData(json as TearJSON, fileName, customName);
    case "cling":
      return parseClingData(json as ClingJSON, fileName, customName);
    default: {
      const exhaustive: never = testType;
      throw new Error(`Unknown test type: ${String(exhaustive)}`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Math helpers
// ───────────────────────────────────────────────────────────────────────────

export function calculateMedian(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function findClosestIndex(arr: number[], target: number): number {
  if (!arr.length) return -1;
  let bestIdx = 0;
  let bestDiff = Math.abs(arr[0] - target);
  for (let i = 1; i < arr.length; i++) {
    const diff = Math.abs(arr[i] - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}
