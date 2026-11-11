/** Shared parser for the `metrics` shape used by both the fkie-cad NVD mirror and the real NVD REST API. */

export interface CvssMetric {
  version: string;
  vectorString: string;
  baseScore: number;
}

interface CvssDataEntry {
  type?: string;
  cvssData?: { version: string; vectorString: string; baseScore: number };
}

export function extractBestCvssMetric(metrics: unknown): CvssMetric | null {
  if (!metrics || typeof metrics !== "object") return null;
  const record = metrics as Record<string, unknown>;
  for (const key of ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const entries = record[key];
    if (!Array.isArray(entries) || entries.length === 0) continue;
    const primary = (entries as CvssDataEntry[]).find((entry) => entry.type === "Primary") ?? entries[0];
    const data = primary?.cvssData;
    if (data?.vectorString && typeof data.baseScore === "number") {
      return { version: data.version, vectorString: data.vectorString, baseScore: data.baseScore };
    }
  }
  return null;
}
