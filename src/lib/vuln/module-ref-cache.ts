import { readJsonFile, writeJsonFile } from "./json-store";

type ModuleRefCacheFile = Record<string, string[]>;

/** Content at a specific commit SHA never changes, so this cache never expires — only the key (including the SHA) does. */
function cacheKey(owner: string, repo: string, number: number, headSha: string): string {
  return `${owner}/${repo}#${number}@${headSha}`;
}

export function readModuleRefCache(path: string, owner: string, repo: string, number: number, headSha: string): string[] | null {
  const file = readJsonFile<ModuleRefCacheFile>(path);
  return file?.[cacheKey(owner, repo, number, headSha)] ?? null;
}

export function writeModuleRefCache(path: string, owner: string, repo: string, number: number, headSha: string, refs: string[]): void {
  const file = readJsonFile<ModuleRefCacheFile>(path) ?? {};
  file[cacheKey(owner, repo, number, headSha)] = refs;
  writeJsonFile(path, file);
}
