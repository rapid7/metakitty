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
  children: ModuleTreeNode[];
}

export interface ModuleTypeCount {
  type: string;
  label: string;
  description: string;
  count: number;
}

export interface ModuleCounts {
  totalCount: number;
  countsByType: ModuleTypeCount[];
  tree: ModuleTreeNode[];
}

interface ModuleEntry {
  segments: string[];
  path: string;
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
        children: ownModule ? [] : groupByDepth(group, depth + 1),
      };
    });
}

/** Builds module type/category counts and a nested browsing tree from metasploit-framework's `db/modules_metadata_base.json` — the same source docs.metasploit.com's modules.html is generated from. */
export function getModuleCounts(metadata: RawModuleMetadataEntry[]): ModuleCounts {
  const moduleEntries: ModuleEntry[] = metadata.map((entry) => ({
    path: entry.path.replace(/^\//, ""),
    segments: entry.fullname.split("/"),
  }));

  const tree = groupByDepth(moduleEntries, 0);
  const countsByType = tree.map((node) => {
    const info = MODULE_TYPES[node.name];
    return { type: node.name, label: info?.label ?? node.name, description: info?.description ?? "", count: node.total };
  });

  return { totalCount: moduleEntries.length, countsByType, tree };
}
