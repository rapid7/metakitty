import { extractBestCvssMetric, type CvssMetric } from "./nvd-metrics";

/** https://services.nvd.nist.gov — works unauthenticated, but an API key raises the rate limit considerably. */
export async function fetchNvdCve(cveId: string, apiKey?: string): Promise<CvssMetric | null> {
  const headers: Record<string, string> = {};
  if (apiKey) headers.apiKey = apiKey;

  const response = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`NVD API error: ${response.status} ${response.statusText}`);

  const data = (await response.json()) as { vulnerabilities?: Array<{ cve?: { metrics?: unknown } }> };
  const metrics = data.vulnerabilities?.[0]?.cve?.metrics;
  return extractBestCvssMetric(metrics);
}
