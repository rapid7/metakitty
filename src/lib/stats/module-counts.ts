import type { RawModuleMetadataEntry } from "./module-counts-client";

export interface ModuleTypeInfo {
  label: string;
  description: string;
}

/** The module types and their descriptions, ported from metasploit-framework's docs/docs/modules.md, keyed by the metadata's `type` field. */
export const MODULE_TYPES: Record<string, ModuleTypeInfo> = {
  auxiliary: {
    label: "Auxiliary",
    description: "Does not exploit a target, but performs useful tasks such as administration, scanning, fuzzing, or denial of service.",
  },
  encoder: {
    label: "Encoder",
    description: "Encodes a payload's raw bytes, e.g. with a bitwise XOR, to remove bad characters such as null bytes.",
  },
  evasion: {
    label: "Evasion",
    description: "Generates evasive payloads that aim to evade antivirus, such as Windows Defender, without external tools.",
  },
  exploit: {
    label: "Exploit",
    description: "Leverages a vulnerability in a target to execute arbitrary code — the payload.",
  },
  nop: {
    label: "Nop",
    description: "Generates a sequence of 'No Operation' instructions, often used alongside stack buffer overflows.",
  },
  payload: {
    label: "Payload",
    description: "The arbitrary code (shellcode) executed once an exploit succeeds, typically opening a Metasploit session. Assembled from a stager + stage (+ adapter), so there are many more payload modules than files.",
  },
  post: {
    label: "Post",
    description: "Runs after a session is opened, to gather, collect, or enumerate data from the compromised machine.",
  },
};

export interface ModuleTreeNode {
  name: string;
  total: number;
  /** The module's .rb file path within the repo (no leading slash), set only for leaf (module) nodes. */
  modulePath: string | null;
  /** The module's fullname (e.g. "exploit/windows/smb/ms17_010_eternalblue"), set only for leaf (module) nodes — links to /modules/<fullname>/. */
  fullname: string | null;
  children: ModuleTreeNode[];
}

export interface ModuleTypeCount {
  type: string;
  label: string;
  description: string;
  count: number;
}

export interface ModuleCveYear {
  year: number;
  count: number;
}

export interface ModuleCweCount {
  cwe: string;
  count: number;
}

export interface ModuleCveYearEntry {
  fullname: string;
  /** The module's .rb file path within the repo (no leading slash) — links out to its GitHub source. */
  path: string;
  cveIds: string[];
}

export interface ModuleCveYearDetail {
  year: number;
  modules: ModuleCveYearEntry[];
}

export interface ModuleCounts {
  totalCount: number;
  countsByType: ModuleTypeCount[];
  tree: ModuleTreeNode[];
  cveCountsByYear: ModuleCveYear[];
  /** The same modules cveCountsByYear counts, per year, but naming each module and its actual CVE ids rather than just a count. */
  cveDetailsByYear: ModuleCveYearDetail[];
  /** Modules with a self-reported `CWE-` reference in their own metadata — thin coverage (most modules don't tag one at all); see module-cwe-nvd-dataset.ts for a broader NVD-derived histogram instead. */
  cweCounts: ModuleCweCount[];
}

interface ModuleEntry {
  segments: string[];
  path: string;
  fullname: string;
}

/** One entry per distinct module file (deduped by path, same rationale as getCveCountsByYear), with its own CVE references — the input module-cwe-nvd-dataset.ts resolves CWEs from. */
export interface ModuleCveRefs {
  path: string;
  cveIds: string[];
}

export function getDistinctModuleCveRefs(metadata: RawModuleMetadataEntry[]): ModuleCveRefs[] {
  const seenPaths = new Set<string>();
  const results: ModuleCveRefs[] = [];
  for (const entry of metadata) {
    if (seenPaths.has(entry.path)) continue;
    seenPaths.add(entry.path);
    const cveIds = entry.references.filter((ref) => ref.startsWith("CVE-"));
    if (cveIds.length > 0) results.push({ path: entry.path, cveIds });
  }
  return results;
}

function sortByCountDesc(counts: Map<string, number>): ModuleCweCount[] {
  return [...counts.entries()].map(([cwe, count]) => ({ cwe, count })).sort((a, b) => b.count - a.count || a.cwe.localeCompare(b.cwe));
}

/** Counts modules with a self-reported `CWE-` reference, deduplicated by file path (a payload's stager+stage combinations share one underlying file and would otherwise double-count). */
function getCweCountsFromReferences(metadata: RawModuleMetadataEntry[]): ModuleCweCount[] {
  const seenPaths = new Set<string>();
  const counts = new Map<string, number>();
  for (const entry of metadata) {
    if (seenPaths.has(entry.path)) continue;
    seenPaths.add(entry.path);
    for (const cwe of new Set(entry.references.filter((ref) => ref.startsWith("CWE-")))) {
      counts.set(cwe, (counts.get(cwe) ?? 0) + 1);
    }
  }
  return sortByCountDesc(counts);
}

/** Tallies modules-by-CWE given each distinct module's resolved CWE set (e.g. from NVD lookups of its CVE references) — a module counts once per distinct CWE among any of its CVEs, not once per CVE. */
export function tallyModuleCweCounts(cwesByModule: string[][]): ModuleCweCount[] {
  const counts = new Map<string, number>();
  for (const cwes of cwesByModule) {
    for (const cwe of new Set(cwes)) counts.set(cwe, (counts.get(cwe) ?? 0) + 1);
  }
  return sortByCountDesc(counts);
}

export interface ModuleCweYearBreakdown {
  year: number;
  counts: ModuleCweCount[];
}

/** One row per year, every top-`topN` CWE (by total count across all years) as its own numeric key, plus an "Other" key for the remainder — the shape a stacked bar chart needs, since recharts needs a small, fixed set of series to stack legibly rather than one per distinct CWE. */
export interface CweYearChartRow {
  year: number;
  [cwe: string]: number;
}

export function pivotCweYearBreakdown(breakdowns: ModuleCweYearBreakdown[], topN: number): { rows: CweYearChartRow[]; cweKeys: string[] } {
  const totalByCwe = new Map<string, number>();
  for (const { counts } of breakdowns) {
    for (const { cwe, count } of counts) totalByCwe.set(cwe, (totalByCwe.get(cwe) ?? 0) + count);
  }
  const cweKeys = [...totalByCwe.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([cwe]) => cwe);
  const topSet = new Set(cweKeys);

  const rows = [...breakdowns]
    .sort((a, b) => a.year - b.year)
    .map(({ year, counts }) => {
      const row: CweYearChartRow = { year, Other: 0 };
      for (const cwe of cweKeys) row[cwe] = 0;
      for (const { cwe, count } of counts) {
        if (topSet.has(cwe)) row[cwe] += count;
        else row.Other += count;
      }
      return row;
    });

  return { rows, cweKeys };
}

function groupByDepth(entries: ModuleEntry[], depth: number): ModuleTreeNode[] {
  const buckets = new Map<string, ModuleEntry[]>();
  for (const entry of entries) {
    const key = entry.segments[depth];
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, group]) => {
      // Defensive: a module could in principle share its fullname with an ancestor directory of
      // further modules — no such case exists in modules_metadata_base.json today (verified), but
      // if it ever did, picking the module over recursing into its "children" (rather than
      // endlessly re-bucketing an entry whose segment count never grows) matches upstream's
      // docs/modules.html tree (metasploit_stats.rb picks `mod` over `children` whenever
      // `modules_by_fullname[current_path]` resolves) and avoids a call-stack overflow.
      const ownModule = group.find((entry) => entry.segments.length === depth + 1);
      return {
        name,
        total: group.length,
        modulePath: ownModule?.path ?? null,
        fullname: ownModule?.fullname ?? null,
        children: ownModule ? [] : groupByDepth(group, depth + 1),
      };
    });
}

/**
 * Counts modules with a CVE reference by disclosure year, deduplicated by file path (a payload's
 * stager+stage combinations share one underlying file and would otherwise double-count).
 */
function getCveCountsByYear(metadata: RawModuleMetadataEntry[]): ModuleCveYear[] {
  const seenPaths = new Set<string>();
  const counts = new Map<number, number>();
  for (const entry of metadata) {
    if (seenPaths.has(entry.path)) continue;
    seenPaths.add(entry.path);

    if (!entry.disclosure_date || !entry.references.some((ref) => ref.startsWith("CVE-"))) continue;
    const year = new Date(entry.disclosure_date).getUTCFullYear();
    if (!Number.isFinite(year)) continue;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year);
}

/**
 * The same modules {@link getCveCountsByYear} counts, grouped by disclosure year, but naming each
 * module and its actual CVE ids instead of just a count — sorted newest year first (a detail
 * drill-down reads naturally newest-first, unlike the chart's left-to-right time axis). Also the
 * input module-cwe-nvd-dataset.ts resolves its by-year CWE breakdown from.
 */
export function getCveDetailsByYear(metadata: RawModuleMetadataEntry[]): ModuleCveYearDetail[] {
  const seenPaths = new Set<string>();
  const entriesByYear = new Map<number, ModuleCveYearEntry[]>();
  for (const entry of metadata) {
    if (seenPaths.has(entry.path)) continue;
    seenPaths.add(entry.path);

    const cveIds = entry.references.filter((ref) => ref.startsWith("CVE-"));
    if (!entry.disclosure_date || cveIds.length === 0) continue;
    const year = new Date(entry.disclosure_date).getUTCFullYear();
    if (!Number.isFinite(year)) continue;

    const modules = entriesByYear.get(year);
    const moduleEntry = { fullname: entry.fullname, path: entry.path.replace(/^\//, ""), cveIds };
    if (modules) modules.push(moduleEntry);
    else entriesByYear.set(year, [moduleEntry]);
  }
  return [...entriesByYear.entries()]
    .map(([year, modules]) => ({ year, modules: modules.sort((a, b) => a.fullname.localeCompare(b.fullname)) }))
    .sort((a, b) => b.year - a.year);
}

/** Walks `tree` by name at each depth (e.g. ["auxiliary", "admin", "2wire"]), returning the matching node (leaf or folder) or null if any segment doesn't resolve. */
export function findTreeNode(tree: ModuleTreeNode[], segments: string[]): ModuleTreeNode | null {
  let nodes = tree;
  let found: ModuleTreeNode | null = null;
  for (const segment of segments) {
    found = nodes.find((node) => node.name === segment) ?? null;
    if (!found) return null;
    nodes = found.children;
  }
  return found;
}

/** Every folder (non-leaf) node's full path segments, e.g. ["auxiliary", "admin", "2wire"] — used to generate a static /modules/<path>/ browsing page for every intermediate directory, not just leaf modules. */
export function collectFolderPaths(tree: ModuleTreeNode[], prefix: string[] = []): string[][] {
  const paths: string[][] = [];
  for (const node of tree) {
    if (node.modulePath) continue; // leaf module — generateStaticParams covers this via moduleDetails' fullnames instead
    const path = [...prefix, node.name];
    paths.push(path, ...collectFolderPaths(node.children, path));
  }
  return paths;
}

/** Builds module type/category counts and a nested browsing tree from metasploit-framework's `db/modules_metadata_base.json` — the same source docs.metasploit.com's modules.html is generated from. */
export function getModuleCounts(metadata: RawModuleMetadataEntry[]): ModuleCounts {
  const moduleEntries: ModuleEntry[] = metadata.map((entry) => ({
    path: entry.path.replace(/^\//, ""),
    segments: entry.fullname.split("/"),
    fullname: entry.fullname,
  }));

  const tree = groupByDepth(moduleEntries, 0);
  const countsByType = tree.map((node) => {
    const info = MODULE_TYPES[node.name];
    return { type: node.name, label: info?.label ?? node.name, description: info?.description ?? "", count: node.total };
  });

  return {
    totalCount: moduleEntries.length,
    countsByType,
    tree,
    cveCountsByYear: getCveCountsByYear(metadata),
    cveDetailsByYear: getCveDetailsByYear(metadata),
    cweCounts: getCweCountsFromReferences(metadata),
  };
}
