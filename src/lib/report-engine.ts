"use client";

import { useAppStore } from "./store";
import {
  calculatePercentage,
  getStressAtStrain,
} from "./calculations";
import type {
  ClingData,
  PunctureData,
  StressData,
  TearData,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Report Intelligence Engine
// Generates the "interpretation layer" that transforms a data dump into
// an engineering decision document.
// ───────────────────────────────────────────────────────────────────────────

export interface KpiRow {
  property: string;
  unit: string;
  reference: number | null;
  candidate: number | null;
  deltaPct: number | null;
  direction: "up" | "down" | "neutral" | "na";
  assessment: "improved" | "reduced" | "comparable" | "unknown";
}

export interface SummaryRowData {
  id: string;
  role: "reference" | "comparison";
  sampleName: string;
  isRef: boolean;
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

export function buildSummaryRows(): SummaryRowData[] {
  const state = useAppStore.getState();
  const { datasets, strainInput } = state;
  const out: SummaryRowData[] = [];

  const hasRef =
    datasets.stress.reference ||
    datasets.puncture.reference ||
    datasets.tear.reference ||
    datasets.cling.reference;

  if (hasRef) {
    const s = datasets.stress.reference as StressData | null;
    const p = datasets.puncture.reference as PunctureData | null;
    const t = datasets.tear.reference as TearData | null;
    const c = datasets.cling.reference as ClingData | null;
    const sampleName = datasets.stress.customNames.reference || s?.name || "Reference";
    const at = s ? getStressAtStrain(s, strainInput) : null;
    out.push({
      id: "reference-0",
      role: "reference",
      sampleName,
      isRef: true,
      ultimateStrain: s?.maxStrain ?? null,
      stretchForceAtStrain: at?.stretch ?? null,
      windForceAtStrain: at?.wind ?? null,
      punctureForce: p?.maxForce ?? null,
      punctureEnergy: p?.energy ?? null,
      tearForce: t?.maxForce ?? null,
      tearTime: t?.tearTime ?? null,
      tearEnergy: t?.energy ?? null,
      clingForce: c?.medianForce ?? null,
    });
  }

  const maxComp = Math.max(
    datasets.stress.comparisons.length,
    datasets.puncture.comparisons.length,
    datasets.tear.comparisons.length,
    datasets.cling.comparisons.length,
  );

  for (let i = 0; i < maxComp; i++) {
    const s = datasets.stress.comparisons[i] as StressData | null;
    const p = datasets.puncture.comparisons[i] as PunctureData | null;
    const t = datasets.tear.comparisons[i] as TearData | null;
    const c = datasets.cling.comparisons[i] as ClingData | null;
    if (!s && !p && !t && !c) continue;
    const sampleName =
      (s && (datasets.stress.customNames.comparisons[i] || s.name)) ||
      (p && (datasets.puncture.customNames.comparisons[i] || p.name)) ||
      (t && (datasets.tear.customNames.comparisons[i] || t.name)) ||
      (c && (datasets.cling.customNames.comparisons[i] || c.name)) ||
      `Comparison #${i + 1}`;
    const at = s ? getStressAtStrain(s, strainInput) : null;
    out.push({
      id: `comparison-${i}`,
      role: "comparison",
      sampleName,
      isRef: false,
      ultimateStrain: s?.maxStrain ?? null,
      stretchForceAtStrain: at?.stretch ?? null,
      windForceAtStrain: at?.wind ?? null,
      punctureForce: p?.maxForce ?? null,
      punctureEnergy: p?.energy ?? null,
      tearForce: t?.maxForce ?? null,
      tearTime: t?.tearTime ?? null,
      tearEnergy: t?.energy ?? null,
      clingForce: c?.medianForce ?? null,
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// KPI Scorecard — builds a performance matrix from summary rows
// ───────────────────────────────────────────────────────────────────────────

export function buildKpiScorecard(candidateIdx: number = 1): KpiRow[] {
  const rows = buildSummaryRows();
  const ref = rows.find((r) => r.role === "reference");
  const candidates = rows.filter((r) => r.role === "comparison");
  const candidate = candidates[candidateIdx] ?? candidates[0];
  if (!ref || !candidate) return [];

  const kpiDefs: Array<{
    property: string;
    unit: string;
    refVal: number | null;
    candVal: number | null;
    higherIsBetter: boolean;
  }> = [
    { property: "Ultimate Strain", unit: "%", refVal: ref.ultimateStrain, candVal: candidate.ultimateStrain, higherIsBetter: true },
    { property: "Stretch Force", unit: "N", refVal: ref.stretchForceAtStrain, candVal: candidate.stretchForceAtStrain, higherIsBetter: true },
    { property: "Wind Force", unit: "N", refVal: ref.windForceAtStrain, candVal: candidate.windForceAtStrain, higherIsBetter: true },
    { property: "Puncture Force", unit: "N", refVal: ref.punctureForce, candVal: candidate.punctureForce, higherIsBetter: true },
    { property: "Puncture Energy", unit: "J", refVal: ref.punctureEnergy, candVal: candidate.punctureEnergy, higherIsBetter: true },
    { property: "Tear Force", unit: "N", refVal: ref.tearForce, candVal: candidate.tearForce, higherIsBetter: true },
    { property: "Tear Time", unit: "s", refVal: ref.tearTime, candVal: candidate.tearTime, higherIsBetter: true },
    { property: "Tear Energy", unit: "J", refVal: ref.tearEnergy, candVal: candidate.tearEnergy, higherIsBetter: true },
    { property: "Cling Force", unit: "N", refVal: ref.clingForce, candVal: candidate.clingForce, higherIsBetter: true },
  ];

  return kpiDefs.map((k) => {
    const pct = calculatePercentage(k.candVal, k.refVal);
    const deltaPct = pct.value;
    let direction: KpiRow["direction"] = "na";
    if (deltaPct !== null) {
      if (deltaPct > 0.5) direction = "up";
      else if (deltaPct < -0.5) direction = "down";
      else direction = "neutral";
    }
    let assessment: KpiRow["assessment"] = "unknown";
    if (deltaPct !== null) {
      const absDelta = Math.abs(deltaPct);
      if (absDelta < 3) {
        assessment = "comparable";
      } else if (k.higherIsBetter) {
        assessment = deltaPct > 0 ? "improved" : "reduced";
      } else {
        assessment = deltaPct < 0 ? "improved" : "reduced";
      }
    }
    return {
      property: k.property,
      unit: k.unit,
      reference: k.refVal,
      candidate: k.candVal,
      deltaPct,
      direction,
      assessment,
    };
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Engineering Interpretation — auto-generated text per test type
// ───────────────────────────────────────────────────────────────────────────

export function buildEngineeringInterpretation(
  testType: "stress" | "puncture" | "tear" | "cling" | "radar",
  candidateIdx: number = 1,
): string {
  const kpis = buildKpiScorecard(candidateIdx);
  if (kpis.length === 0) return "Insufficient data for engineering interpretation.";

  const findKpi = (prop: string) => kpis.find((k) => k.property === prop);
  const fmtDelta = (k: KpiRow | undefined) => {
    if (!k || k.deltaPct === null) return "N/A";
    const sign = k.deltaPct > 0 ? "+" : "";
    return `${sign}${k.deltaPct.toFixed(1)}%`;
  };

  const rows = buildSummaryRows();
  const ref = rows.find((r) => r.role === "reference");
  const candidates = rows.filter((r) => r.role === "comparison");
  const candidate = candidates[candidateIdx] ?? candidates[0];
  if (!ref || !candidate) return "Insufficient data for engineering interpretation.";

  const refName = ref.sampleName;
  const candName = candidate.sampleName;

  if (testType === "stress") {
    const strain = findKpi("Ultimate Strain");
    const stretch = findKpi("Stretch Force");
    const wind = findKpi("Wind Force");
    const parts: string[] = [];
    parts.push(
      `Candidate ${candName} demonstrates ${stretch?.direction === "up" ? "higher" : stretch?.direction === "down" ? "lower" : "comparable"} resistance to stretching at the comparison strain point (${fmtDelta(stretch)} vs ${refName}),`,
    );
    parts.push(
      `while reaching ${strain?.direction === "down" ? "lower" : strain?.direction === "up" ? "higher" : "comparable"} ultimate extensibility (${fmtDelta(strain)}).`,
    );
    parts.push(
      `Wind force is ${wind?.direction === "down" ? "reduced" : wind?.direction === "up" ? "increased" : "comparable"} (${fmtDelta(wind)}).`,
    );
    parts.push(
      `The formulation therefore shifts the force–elongation response rather than providing a uniformly improved mechanical profile.`,
    );
    return parts.join(" ");
  }

  if (testType === "puncture") {
    const force = findKpi("Puncture Force");
    const energy = findKpi("Puncture Energy");
    return `Candidate ${candName} exhibits ${force?.assessment === "comparable" ? "comparable" : force?.assessment === "improved" ? "improved" : "reduced"} puncture resistance (${fmtDelta(force)} in peak force) and ${energy?.assessment === "comparable" ? "comparable" : energy?.assessment === "improved" ? "higher" : "lower"} energy absorption (${fmtDelta(energy)}). The puncture performance profile is ${force?.assessment === "comparable" && energy?.assessment === "comparable" ? "essentially equivalent to the reference" : "materially different from the reference"}.`;
  }

  if (testType === "tear") {
    const force = findKpi("Tear Force");
    const time = findKpi("Tear Time");
    const energy = findKpi("Tear Energy");
    return `Candidate ${candName} shows ${force?.assessment === "comparable" ? "comparable" : force?.assessment === "improved" ? "higher" : "lower"} tear propagation force (${fmtDelta(force)}), ${time?.assessment === "comparable" ? "similar" : time?.assessment === "improved" ? "longer" : "shorter"} time to break (${fmtDelta(time)}), and ${energy?.assessment === "comparable" ? "comparable" : energy?.assessment === "improved" ? "higher" : "lower"} tear energy (${fmtDelta(energy)}). The tear resistance characteristics are ${force?.assessment === "comparable" && energy?.assessment === "comparable" ? "consistent with the reference material" : "distinct from the reference"}.`;
  }

  if (testType === "cling") {
    const cling = findKpi("Cling Force");
    return `Candidate ${candName} demonstrates ${cling?.assessment === "comparable" ? "comparable" : cling?.assessment === "improved" ? "higher" : "lower"} cling force (${fmtDelta(cling)}). The adhesion performance is ${cling?.assessment === "comparable" ? "equivalent to the reference" : cling?.assessment === "improved" ? "enhanced relative to the reference" : "reduced relative to the reference"}.`;
  }

  // radar
  const improved = kpis.filter((k) => k.assessment === "improved");
  const reduced = kpis.filter((k) => k.assessment === "reduced");
  const comparable = kpis.filter((k) => k.assessment === "comparable");
  return `The multi-axis radar comparison reveals ${improved.length} improved, ${reduced.length} reduced, and ${comparable.length} comparable performance dimensions. Candidate ${candName} presents a ${improved.length > reduced.length ? "broadly favourable" : reduced.length > improved.length ? "broadly unfavourable" : "mixed"} overall profile relative to ${refName}, with trade-offs across the mechanical and functional property space.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Executive Summary — overall assessment + key findings
// ───────────────────────────────────────────────────────────────────────────

export interface ExecutiveSummary {
  refName: string;
  candidateName: string;
  improved: Array<{ property: string; delta: string }>;
  reduced: Array<{ property: string; delta: string }>;
  comparable: Array<{ property: string; delta: string }>;
  conclusion: string;
  decision: "proceed" | "conditional" | "reject" | "insufficient";
  recommendation: string;
}

export function buildExecutiveSummary(candidateIdx: number = 1): ExecutiveSummary | null {
  const kpis = buildKpiScorecard(candidateIdx);
  if (kpis.length === 0) return null;

  const rows = buildSummaryRows();
  const ref = rows.find((r) => r.role === "reference");
  const candidates = rows.filter((r) => r.role === "comparison");
  const candidate = candidates[candidateIdx] ?? candidates[0];
  if (!ref || !candidate) return null;

  const fmtDelta = (k: KpiRow) => {
    if (k.deltaPct === null) return "N/A";
    const sign = k.deltaPct > 0 ? "+" : "";
    return `${sign}${k.deltaPct.toFixed(1)}%`;
  };

  const improved = kpis
    .filter((k) => k.assessment === "improved")
    .map((k) => ({ property: k.property, delta: fmtDelta(k) }));
  const reduced = kpis
    .filter((k) => k.assessment === "reduced")
    .map((k) => ({ property: k.property, delta: fmtDelta(k) }));
  const comparable = kpis
    .filter((k) => k.assessment === "comparable")
    .map((k) => ({ property: k.property, delta: fmtDelta(k) }));

  const improvedCount = improved.length;
  const reducedCount = reduced.length;

  let decision: ExecutiveSummary["decision"] = "conditional";
  if (improvedCount > 0 && reducedCount === 0) decision = "proceed";
  else if (reducedCount > improvedCount + 1) decision = "reject";
  else if (improvedCount === 0 && reducedCount === 0) decision = "insufficient";

  const conclusion = `Candidate ${candidate.sampleName} shows a ${improvedCount > reducedCount ? "predominantly improved" : reducedCount > improvedCount ? "predominantly reduced" : "mixed"} performance profile relative to the ${ref.sampleName} reference. ${improvedCount > 0 ? `Improvements were observed in ${improved.map((i) => i.property.toLowerCase()).join(", ")}. ` : ""}${reducedCount > 0 ? `Reductions were noted in ${reduced.map((r) => r.property.toLowerCase()).join(", ")}. ` : ""}${comparable.length > 0 ? `Comparable performance was maintained for ${comparable.map((c) => c.property.toLowerCase()).join(", ")}.` : ""}`;

  const recommendation =
    decision === "proceed"
      ? `Proceed to application-level validation. Candidate ${candidate.sampleName} demonstrates favourable characteristics across key performance dimensions.`
      : decision === "conditional"
        ? `Proceed to application-level validation under representative conditions before formulation release. Candidate ${candidate.sampleName} exhibits trade-offs that require end-use verification.`
        : decision === "reject"
          ? `Recommend formulation revision. Candidate ${candidate.sampleName} shows significant performance degradation in critical dimensions.`
          : `Insufficient comparative data. Upload additional test datasets to generate a complete performance assessment.`;

  return {
    refName: ref.sampleName,
    candidateName: candidate.sampleName,
    improved,
    reduced,
    comparable,
    conclusion,
    decision,
    recommendation,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Performance Delta Matrix — bar chart-style text representation
// ───────────────────────────────────────────────────────────────────────────

export function buildDeltaMatrix(candidateIdx: number = 1): Array<{
  property: string;
  delta: number | null;
  bar: string;
  direction: "up" | "down" | "neutral" | "na";
}> {
  const kpis = buildKpiScorecard(candidateIdx);
  return kpis.map((k) => {
    const delta = k.deltaPct;
    let bar = "";
    if (delta !== null) {
      const absBars = Math.min(Math.round(Math.abs(delta) / 2), 20);
      const char = delta > 0 ? "█" : delta < 0 ? "░" : "—";
      bar = char.repeat(absBars || 1);
    }
    return {
      property: k.property,
      delta,
      bar,
      direction: k.direction,
    };
  });
}
