import { getRawFileContent } from "../github-client";
import { STATS_OWNER } from "./repos";

export interface RawModuleMetadataEntry {
  /** e.g. "auxiliary/admin/2wire/xslt_password_reset" — no leading slash, no .rb extension. */
  fullname: string;
  /** e.g. "auxiliary", "exploit", "payload" — singular, matching MODULE_TYPES' keys. */
  type: string;
  /** e.g. "/modules/auxiliary/admin/2wire/xslt_password_reset.rb" — leading slash. */
  path: string;
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
