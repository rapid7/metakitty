import { extractBestCvssMetric, type CvssMetric } from "./nvd-metrics";

/** https://github.com/fkie-cad/nvd-json-data-feeds — a static, unauthenticated GitHub-hosted mirror of NVD records. */
function buildFkieUrl(cveId: string): string | null {
  const match = /^CVE-(\d{4})-(\d+)$/i.exec(cveId);
  if (!match) return null;
  const [, year, num] = match;
  const bucket = num.length > 2 ? `${num.slice(0, -2)}xx` : "0xx";
  return `https://raw.githubusercontent.com/fkie-cad/nvd-json-data-feeds/main/CVE-${year}/CVE-${year}-${bucket}/CVE-${year}-${num}.json`;
}

export async function fetchFkieNvdCve(cveId: string): Promise<CvssMetric | null> {
  const url = buildFkieUrl(cveId);
  if (!url) return null;

  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`fkie-cad NVD mirror error: ${response.status} ${response.statusText}`);

  const data = (await response.json()) as { metrics?: unknown };
  return extractBestCvssMetric(data.metrics);
}
