/** MITRE's official CWE REST API — https://cwe-api.mitre.org. Unauthenticated, one id per call. */
const ENDPOINTS = [
  { path: "weakness", key: "Weaknesses" },
  { path: "category", key: "Categories" },
  { path: "view", key: "Views" },
] as const;

async function fetchEntryName(endpoint: (typeof ENDPOINTS)[number], id: string): Promise<string | null> {
  const response = await fetch(`https://cwe-api.mitre.org/api/v1/cwe/${endpoint.path}/${id}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return null;
  const data = (await response.json()) as Record<string, { Name?: string }[]>;
  return data[endpoint.key]?.[0]?.Name ?? null;
}

/**
 * Resolves a CWE id's human-readable name. A CWE id isn't always a plain "Weakness" — e.g.
 * CWE-661 ("Weaknesses in Software Written in PHP") is a View, and some ids are Categories — so
 * this tries each entry type in turn (plain Weakness first, since that's the overwhelmingly
 * common case) and returns the first one that resolves.
 */
export async function fetchCweName(cwe: string): Promise<string | null> {
  const id = cwe.replace(/^CWE-/, "");
  for (const endpoint of ENDPOINTS) {
    const name = await fetchEntryName(endpoint, id);
    if (name) return name;
  }
  return null;
}
