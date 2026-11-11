import { cvssBaseFromVector } from "./cvss";
import { fetchFkieNvdCve } from "./fkie-nvd-client";
import { fetchNvdCve } from "./nvd-client";
import { fetchOsvVuln } from "./osv-client";
import { readAdvisoryCache, writeAdvisoryCache, type AdvisoryResult } from "./advisory-cache";

function warn(id: string, source: string, error: unknown): void {
  console.warn(`[vuln] ${source} lookup failed for ${id}: ${error instanceof Error ? error.message : String(error)}`);
}

/**
 * Resolves CVSS data for a CVE or GHSA id, trying OSV.dev first, then the fkie-cad NVD mirror,
 * then the NVD REST API, stopping as soon as one source yields a numeric score. Each source's
 * failure is independently swallowed (logged, not thrown) so one flaky API doesn't block the rest.
 */
export async function resolveAdvisory(id: string, cachePath: string, ttlMs: number, nvdApiKey?: string): Promise<AdvisoryResult> {
  const cached = readAdvisoryCache(cachePath, id, ttlMs);
  if (cached) return cached;

  let cvssScore: number | null = null;
  let cvssVector: string | null = null;
  let cvssVersion: string | null = null;
  let source: AdvisoryResult["source"] = null;
  let cveAliases: string[] = [];
  let anyRecordFound = false;
  let anyLookupErrored = false;

  try {
    const osv = await fetchOsvVuln(id);
    if (osv) {
      anyRecordFound = true;
      cveAliases = osv.aliases.filter((alias) => /^CVE-/i.test(alias));
      if (osv.cvssVector) {
        cvssVector = osv.cvssVector;
        cvssVersion = /^CVSS:(\d\.\d)/.exec(osv.cvssVector)?.[1] ?? null;
        cvssScore = cvssBaseFromVector(osv.cvssVector);
        source = "osv";
      }
    }
  } catch (error) {
    anyLookupErrored = true;
    warn(id, "OSV", error);
  }

  // CVE-only fallbacks: use the id itself if it's a CVE, else the first CVE alias OSV gave us for a GHSA.
  const cveId = /^CVE-/i.test(id) ? id : cveAliases[0];

  if (cvssScore === null && cveId) {
    try {
      const fkie = await fetchFkieNvdCve(cveId);
      if (fkie) {
        anyRecordFound = true;
        cvssScore = fkie.baseScore;
        cvssVector = fkie.vectorString;
        cvssVersion = fkie.version;
        source = "fkie-nvd-mirror";
      }
    } catch (error) {
      anyLookupErrored = true;
      warn(id, "fkie-cad NVD mirror", error);
    }
  }

  if (cvssScore === null && cveId) {
    try {
      const nvd = await fetchNvdCve(cveId, nvdApiKey);
      if (nvd) {
        anyRecordFound = true;
        cvssScore = nvd.baseScore;
        cvssVector = nvd.vectorString;
        cvssVersion = nvd.version;
        source = "nvd";
      }
    } catch (error) {
      anyLookupErrored = true;
      warn(id, "NVD", error);
    }
  }

  const status: AdvisoryResult["status"] =
    cvssScore !== null ? "scored" : anyRecordFound ? "no_score" : anyLookupErrored ? "lookup_failed" : "not_found";

  const result: AdvisoryResult = { cvssScore, cvssVector, cvssVersion, source, status, cveAliases };
  writeAdvisoryCache(cachePath, id, result);
  return result;
}
