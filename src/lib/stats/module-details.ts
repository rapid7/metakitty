import type { ModuleNotes, RawModuleMetadataEntry } from "./module-counts-client";

/** Metasploit's numeric rank scale — ported from metasploit-framework's Msf::Module::Rank constants. */
const RANK_LABELS: Record<number, string> = {
  0: "Manual",
  100: "Low",
  200: "Average",
  300: "Normal",
  400: "Good",
  500: "Great",
  600: "Excellent",
};

export interface ModuleReference {
  label: string;
  href: string | null;
}

export interface ModuleDetail {
  fullname: string;
  name: string;
  type: string;
  rank: number;
  rankLabel: string;
  author: string[];
  description: string;
  platform: string;
  arch: string;
  disclosureDate: string | null;
  targets: string[] | null;
  references: ModuleReference[];
  notes: ModuleNotes;
  check: boolean;
  postAuth: boolean;
  defaultCredential: boolean;
  /** `fullname.split("/")` — the segments making up the module's /modules/<...> route. */
  slugSegments: string[];
}

/** Parses one raw `references` entry (e.g. "CVE-2017-0144", "URL-https://...") into a label/link. */
function parseReference(raw: string): ModuleReference {
  if (raw.startsWith("CVE-")) {
    return { label: raw, href: `https://nvd.nist.gov/vuln/detail/${raw}` };
  }
  if (raw.startsWith("URL-")) {
    const url = raw.slice("URL-".length);
    return { label: url, href: url };
  }
  return { label: raw, href: null };
}

/** Builds a per-module detail record, keyed by `fullname`, from metasploit-framework's `db/modules_metadata_base.json`. */
export function getModuleDetails(metadata: RawModuleMetadataEntry[]): Map<string, ModuleDetail> {
  const details = new Map<string, ModuleDetail>();
  for (const entry of metadata) {
    details.set(entry.fullname, {
      fullname: entry.fullname,
      name: entry.name,
      type: entry.type,
      rank: entry.rank,
      rankLabel: RANK_LABELS[entry.rank] ?? `Rank ${entry.rank}`,
      author: entry.author,
      description: entry.description,
      platform: entry.platform,
      arch: entry.arch,
      disclosureDate: entry.disclosure_date,
      targets: entry.targets,
      references: entry.references.map(parseReference),
      notes: entry.notes,
      check: entry.check,
      postAuth: entry.post_auth,
      defaultCredential: entry.default_credential,
      slugSegments: entry.fullname.split("/"),
    });
  }
  return details;
}
