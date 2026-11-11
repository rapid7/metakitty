export type TestingEnvironment =
  | "docker"
  | "windows"
  | "linux"
  | "appliance"
  | "macos"
  | "android"
  | "unix"
  | "bsd"
  | "framework"
  | "multiple"
  | "unknown";

export type CiStatus = "passing" | "failing" | "pending" | "unknown";
export type ReviewDecision = "approved" | "changes_requested" | "review_required" | "none";

export interface Assignee {
  login: string;
  avatarUrl: string | null;
}

export interface Label {
  name: string;
  color: string;
}

/** A CVE/GHSA reference found in a PR's touched exploit/auxiliary/post module metadata or description. */
export interface VulnerabilityRef {
  id: string;
  /** Other CVE ids this ref is known to alias (relevant when `id` itself is a GHSA id). */
  cveAliases: string[];
  cvssScore: number | null;
  cvssVector: string | null;
  cvssVersion: string | null;
  source: "osv" | "fkie-nvd-mirror" | "nvd" | null;
  status: "scored" | "no_score" | "not_found" | "lookup_failed";
  /** null when the CISA KEV feed couldn't be loaded at all, not just "not in it" */
  knownExploited: boolean | null;
}

/** A single open pull request, trimmed to the fields the static dashboard renders. */
export interface PullRequest {
  number: number;
  title: string;
  author: string;
  authorAvatarUrl: string | null;
  status: "open";
  description: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  totalChanges: number;
  filesChanged: number;
  /** Module files touched, e.g. "exploits/windows/http/foo" */
  modules: string[];
  assignees: Assignee[];
  labels: Label[];
  reviewDecision: ReviewDecision;
  ciStatus: CiStatus;
  testingEnv: TestingEnvironment;
  testingEnvReason: string;
  githubUrl: string;
  /** Populated by a separate enrichment pass (src/lib/vuln/enrich.ts); empty for fixture builds. */
  vulnRefs: VulnerabilityRef[];
}
