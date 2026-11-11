/**
 * CVSS v3.0/v3.1 base score, computed from a vector string. Used when an advisory source gives
 * us a vector but no precomputed numeric score (OSV's `severity` field is vector-only).
 * Spec: https://www.first.org/cvss/v3.1/specification-document#7-1-Base-Metrics-Equations
 */

const AV: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC: Record<string, number> = { L: 0.77, H: 0.44 };
const PR_UNCHANGED: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_CHANGED: Record<string, number> = { N: 0.85, L: 0.68, H: 0.5 };
const UI: Record<string, number> = { N: 0.85, R: 0.62 };
const CIA: Record<string, number> = { N: 0, L: 0.22, H: 0.56 };

function roundUp(value: number): number {
  const intInput = Math.round(value * 100_000);
  if (intInput % 10_000 === 0) return intInput / 100_000;
  return (Math.floor(intInput / 10_000) + 1) / 10;
}

/** Returns null if the vector isn't a recognized CVSS v3.x vector or is missing required metrics. */
export function cvssBaseFromVector(vector: string): number | null {
  if (!/^CVSS:3\.[01]\//.test(vector)) return null;

  const metrics: Record<string, string> = {};
  for (const part of vector.split("/").slice(1)) {
    const [key, value] = part.split(":");
    if (key && value) metrics[key] = value;
  }

  const av = AV[metrics.AV];
  const ac = AC[metrics.AC];
  const ui = UI[metrics.UI];
  const c = CIA[metrics.C];
  const i = CIA[metrics.I];
  const a = CIA[metrics.A];
  const scopeChanged = metrics.S === "C";
  const pr = (scopeChanged ? PR_CHANGED : PR_UNCHANGED)[metrics.PR];

  if ([av, ac, ui, c, i, a, pr].some((value) => value === undefined)) return null;

  const iscBase = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = scopeChanged ? 7.52 * (iscBase - 0.029) - 3.25 * (iscBase - 0.02) ** 15 : 6.42 * iscBase;
  if (impact <= 0) return 0;

  const exploitability = 8.22 * av * ac * pr * ui;
  const baseScore = scopeChanged ? Math.min(1.08 * (impact + exploitability), 10) : Math.min(impact + exploitability, 10);
  return roundUp(baseScore);
}
