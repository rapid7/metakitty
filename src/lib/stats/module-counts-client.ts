import { getRawFileContent } from "../github-client";
import { STATS_OWNER } from "./repos";

export interface ModuleNotes {
  AKA?: string[];
  SideEffects?: string[];
  Reliability?: string[];
  Stability?: string[];
}

export interface RawModuleMetadataEntry {
  /** e.g. "auxiliary/admin/2wire/xslt_password_reset" — no leading slash, no .rb extension. */
  fullname: string;
  /** e.g. "auxiliary", "exploit", "payload" — singular, matching MODULE_TYPES' keys. */
  type: string;
  /** e.g. "/modules/auxiliary/admin/2wire/xslt_password_reset.rb" — leading slash. */
  path: string;
  /** e.g. "2007-08-15", or null when unset. */
  disclosure_date: string | null;
  /** e.g. ["CVE-2007-4387", "OSVDB-37667", "URL-https://..."]. */
  references: string[];
  /** The module's human-readable title, e.g. "MS17-010 EternalBlue SMB Remote Windows Kernel Pool Corruption". */
  name: string;
  aliases: string[];
  /** Numeric rank, e.g. 300 — see RANK_LABELS in module-details.ts for the Manual..Excellent scale. */
  rank: number;
  author: string[];
  description: string;
  platform: string;
  arch: string;
  /** Target names, e.g. ["Windows 7", ...], or null when the module has none (most non-exploits). */
  targets: string[] | null;
  mod_time: string;
  ref_name: string;
  check: boolean;
  post_auth: boolean;
  default_credential: boolean;
  notes: ModuleNotes;
}

const MODULES_REPO = "metasploit-framework";
const MODULES_REF = "master";
const MODULE_METADATA_PATH = "db/modules_metadata_base.json";

/**
 * metasploit-framework's own module cache dump, keyed by ref_name — the same source
 * docs.metasploit.com's modules.html is generated from. Unlike walking the repo's file tree,
 * this already accounts for payload modules that are assembled at runtime from a stager + stage
 * (+ adapter) combination rather than existing as one file each, and needs no path-collision
 * handling of its own.
 */
export async function fetchModuleMetadata(token: string): Promise<RawModuleMetadataEntry[]> {
  const raw = await getRawFileContent({ token, owner: STATS_OWNER, repo: MODULES_REPO }, MODULE_METADATA_PATH, MODULES_REF);
  if (!raw) {
    throw new Error(`Unable to fetch ${MODULE_METADATA_PATH} from ${STATS_OWNER}/${MODULES_REPO}@${MODULES_REF}`);
  }
  const parsed = JSON.parse(raw) as Record<string, RawModuleMetadataEntry>;
  return Object.values(parsed);
}
