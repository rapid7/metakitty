export interface OsvResult {
  cvssVector: string | null;
  aliases: string[];
}

/** https://osv.dev — no auth required. */
export async function fetchOsvVuln(id: string): Promise<OsvResult | null> {
  const response = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`OSV API error: ${response.status} ${response.statusText}`);

  const data = (await response.json()) as { severity?: Array<{ type: string; score: string }>; aliases?: string[] };
  const cvss = (data.severity ?? []).find((entry) => entry.type.startsWith("CVSS_V3"));
  return { cvssVector: cvss?.score ?? null, aliases: data.aliases ?? [] };
}
