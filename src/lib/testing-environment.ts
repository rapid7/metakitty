import type { TestingEnvironment } from "./types";

export const testingEnvironmentLabels: Record<TestingEnvironment, string> = {
  docker: "Docker",
  windows: "Windows",
  linux: "Linux",
  appliance: "Appliance / vendor image",
  macos: "macOS",
  android: "Android",
  unix: "Unix",
  bsd: "BSD",
  framework: "Framework / tooling",
  multiple: "Multiple environments",
  unknown: "Unknown",
};

const platforms = {
  windows: "win|windows",
  linux: "linux",
  macos: "osx|macos",
  android: "android",
  unix: "unix",
  bsd: "bsd|freebsd",
} as const;

/**
 * Classifies the PR's target environment, never the machine running Metasploit.
 * Ported from gh-review's classifyTestingEnvironment, trimmed to evidence available
 * from GitHub's GraphQL API: file paths and PR description text. The REST-only diff
 * content (e.g. `Platform =>` metadata lines, modified markdown instructions) isn't
 * exposed over GraphQL, so that evidence is dropped rather than approximated.
 */
export function classifyTestingEnvironment(filePaths: string[] | null, description?: string | null) {
  const evidence = new Map<TestingEnvironment, string[]>();
  const add = (env: TestingEnvironment, reason: string) => {
    evidence.set(env, [...new Set([...(evidence.get(env) ?? []), reason])]);
  };

  const inspectInstructions = (text: string, source: string) => {
    for (const line of text.split("\n")) {
      // Require an affirmative target statement, rather than any mention of Docker/appliances.
      const match = line.match(/^\s*(?:[-*]\s*)?(?:testing target|test target|target environment|target setup)\s*:\s*(.+)$/i);
      if (!match) continue;
      const value = match[1];
      if (/\b(?:not|no|cannot|can't|unsupported|unknown|unconfirmed|unavailable)\b/i.test(value) || value.includes("?")) continue;
      if (/\b(?:appliance|vendor image)\b/i.test(value)) add("appliance", `${source}: ${line.trim()}`);
      else if (/\bdocker\b/i.test(value)) add("docker", `${source}: ${line.trim()}`);
      else {
        if (/\bwindows\b/i.test(value)) add("windows", `${source}: ${line.trim()}`);
        if (/\blinux\b/i.test(value)) add("linux", `${source}: ${line.trim()}`);
      }
    }
  };

  const inspectProse = (text: string, source: string) => {
    const clean = text.replace(/<!--[\s\S]*?-->/g, "");
    for (const line of clean.split("\n")) {
      if (/\b(?:not|cannot|unsupported|unconfirmed)\b/i.test(line)) continue;
      if (/(?:tested (?:on|against)|target(?: OS| operating system)?\s*[:|])/i.test(line)) {
        for (const [env, aliases] of Object.entries(platforms)) {
          if (new RegExp(`\\b(?:${aliases})\\b`, "i").test(line)) add(env as TestingEnvironment, `${source}: ${line.trim().slice(0, 220)}`);
        }
      }
      // Ignore template checklists and hypothetical specialized-hardware guidance.
      if (!/if your|specialized hardware|\[ \]|otherwise|optional/i.test(line) &&
          /\b(?:the appliance|GL\.iNet routers|Juniper devices|physical hardware testing)\b/i.test(line)) {
        add("appliance", `${source}: ${line.trim().slice(0, 220)}`);
      }
    }
  };

  inspectProse(description ?? "", "PR description");
  inspectInstructions(description ?? "", "PR test instructions");

  for (const rawPath of filePaths ?? []) {
    const normalized = rawPath.replaceAll("\\", "/").toLowerCase();
    // Target modules, payloads, and platform libraries provide OS evidence; runner Dockerfiles do not.
    const targetModule = /(?:^|\/)modules\/(?:exploits|auxiliary|post|payloads|evasion)\//.test(normalized);
    const moduleDoc = /^documentation\/modules\//.test(normalized);
    const platformLibrary = /^(?:spec\/)?lib\/(?:msf|rex)\/(?:.*\/)?(?:windows|linux|osx|android)(?:\/|\.rb)/.test(normalized);
    if (targetModule || moduleDoc || platformLibrary) {
      for (const [env, aliases] of Object.entries(platforms)) {
        if (new RegExp(`/(?:${aliases})/|/(?:${aliases})\\.rb$`).test(normalized)) add(env as TestingEnvironment, `Platform-specific target path: ${rawPath}`);
      }
    }
  }

  // An explicit container/appliance setup describes deployment more precisely than its OS.
  if (evidence.has("docker") || evidence.has("appliance")) {
    evidence.delete("linux");
    evidence.delete("windows");
    evidence.delete("unix");
    evidence.delete("bsd");
  }
  // Unix is a broad family; retain the more specific OS when available.
  if (["linux", "macos", "bsd"].some((env) => evidence.has(env as TestingEnvironment))) evidence.delete("unix");

  const currentPaths = filePaths ?? [];
  if (!evidence.size && currentPaths.length && currentPaths.every((path) => !/^(?:modules|documentation\/modules)\//.test(path))) {
    add("framework", "Changes are confined to framework, tooling, tests, or general documentation; no target module changes detected.");
  }

  const environments = [...evidence.keys()];
  const testingEnv: TestingEnvironment = environments.length > 1 ? "multiple" : environments[0] ?? "unknown";
  const reasons = [...evidence.values()].flat();
  return {
    testingEnv,
    testingEnvReason: reasons.length
      ? `${reasons.slice(0, 4).join("; ")}. Inferred from PR evidence; target availability is not verified.`
      : "Target environment has not been established from the available file paths or description. Running Metasploit in Docker does not establish target compatibility.",
  };
}
