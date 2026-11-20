/** Shared parser for the `weaknesses` shape used by the fkie-cad NVD mirror (and the real NVD REST API, which uses the same CVE record shape). */

interface WeaknessEntry {
  type?: string;
  description?: { lang?: string; value?: string }[];
}

const REAL_CWE_PATTERN = /^CWE-\d+$/;

/**
 * Extracts real CWE ids (e.g. "CWE-89"), preferring NVD's own "Primary" classification over any
 * third-party "Secondary" one, and ignoring placeholder values like "NVD-CWE-Other"/"NVD-CWE-noinfo"
 * that mean "not classified" rather than naming a weakness.
 */
export function extractCwes(weaknesses: unknown): string[] {
  if (!Array.isArray(weaknesses)) return [];
  const entries = weaknesses as WeaknessEntry[];
  const primary = entries.filter((entry) => entry.type === "Primary");
  const candidates = primary.length > 0 ? primary : entries;

  const cwes = new Set<string>();
  for (const entry of candidates) {
    for (const description of entry.description ?? []) {
      if (description.value && REAL_CWE_PATTERN.test(description.value)) cwes.add(description.value);
    }
  }
  return [...cwes];
}
