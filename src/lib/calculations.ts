import type {
  PercentageResult,
  StressData,
  TrendDirection,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Linear interpolation at a target strain (the "winning" version from the
// original script.js — shadowed the findClosestIndex version).
// ───────────────────────────────────────────────────────────────────────────

export function getValueAtStrain(
  strainArray: number[],
  valueArray: number[],
  targetStrain: number,
): number | null {
  if (!strainArray.length || !valueArray.length) return null;
  if (strainArray.length !== valueArray.length) return null;

  // Out of range — fall back to first/last
  if (targetStrain <= strainArray[0]) return valueArray[0];
  if (targetStrain >= strainArray[strainArray.length - 1]) {
    return valueArray[valueArray.length - 1];
  }

  // Find bracketing points
  let i = 0;
  while (i < strainArray.length - 1 && strainArray[i + 1] < targetStrain) {
    i++;
  }

  const x0 = strainArray[i];
  const x1 = strainArray[i + 1];
  const y0 = valueArray[i];
  const y1 = valueArray[i + 1];

  if (x1 === x0) return y0;

  const t = (targetStrain - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

// ───────────────────────────────────────────────────────────────────────────
// Percentage vs reference — green/red/neutral with arrow direction.
// ───────────────────────────────────────────────────────────────────────────

export function calculatePercentage(
  value: number | null,
  reference: number | null,
): PercentageResult {
  if (value === null || reference === null || reference === 0) {
    return { value: null, direction: "na", display: "N/A" };
  }

  const diff = value - reference;
  const pct = (diff / Math.abs(reference)) * 100;
  const sign = pct > 0 ? "+" : "";
  const display = `${sign}${pct.toFixed(1)}%`;

  let direction: TrendDirection = "neutral";
  if (pct > 0.05) direction = "up";
  else if (pct < -0.05) direction = "down";

  return { value: pct, direction, display };
}

export function getPercentageClass(
  value: number | null,
  reference: number | null,
): "text-success" | "text-error" | "" {
  if (value === null || reference === null || reference === 0) return "";
  return value >= reference ? "text-success" : "text-error";
}

// ───────────────────────────────────────────────────────────────────────────
// Optimal x-axis step size for the stress-strain chart
// ───────────────────────────────────────────────────────────────────────────

export function calculateOptimalStepSize(maxValue: number): number {
  if (maxValue <= 100) return 10;
  if (maxValue <= 200) return 20;
  if (maxValue <= 500) return 50;
  if (maxValue <= 1000) return 100;
  return Math.ceil(maxValue / 10);
}

// ───────────────────────────────────────────────────────────────────────────
// Stretch & Wind at strain (convenience wrappers)
// ───────────────────────────────────────────────────────────────────────────

export function getStressAtStrain(
  data: StressData,
  strain: number,
): { stretch: number | null; wind: number | null } {
  return {
    stretch: getValueAtStrain(data.strain, data.stretchMedian, strain),
    wind: getValueAtStrain(data.strain, data.windMedian, strain),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Format helpers — these are pure, deterministic, and locale-stable.
// ───────────────────────────────────────────────────────────────────────────

export function formatForce(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return value.toFixed(digits);
}

export function formatEnergy(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return value.toFixed(digits);
}

export function formatStrain(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return value.toFixed(digits);
}

export function formatTime(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return value.toFixed(digits);
}

// ───────────────────────────────────────────────────────────────────────────
// Nice-number rounding — rounds UP to a "human-friendly" step.
//   niceMax(420)   → 450   (step 50)
//   niceMax(380)   → 400   (step 50)
//   niceMax(25.3)  → 30    (step 5)
//   niceMax(0.65)  → 0.7   (step 0.1)
//   niceMax(1234)  → 2000  (step 1000)
// ───────────────────────────────────────────────────────────────────────────

export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  let stepFraction: number;
  if (normalized <= 1) stepFraction = 0.1;
  else if (normalized <= 2) stepFraction = 0.2;
  else if (normalized <= 5) stepFraction = 0.5;
  else stepFraction = 1;
  const niceStep = stepFraction * magnitude;
  return Math.ceil(max / niceStep) * niceStep;
}
