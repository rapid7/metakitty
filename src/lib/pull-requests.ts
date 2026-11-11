import type { RawPullRequestNode } from "./github-client";
import { classifyTestingEnvironment } from "./testing-environment";
import type { CiStatus, PullRequest, ReviewDecision } from "./types";

const MODULE_PATH = /^modules\/(exploits|auxiliary|post|payloads|encoders|evasion|nops)\/(.+)\.rb$/;

/** e.g. "modules/exploits/windows/http/foo.rb" -> "exploits/windows/http/foo" */
function moduleId(path: string): string | null {
  const match = MODULE_PATH.exec(path);
  return match ? `${match[1]}/${match[2]}` : null;
}

function mapCiStatus(state: string | null | undefined): CiStatus {
  switch (state) {
    case "SUCCESS": return "passing";
    case "FAILURE":
    case "ERROR": return "failing";
    case "PENDING":
    case "EXPECTED": return "pending";
    default: return "unknown";
  }
}

function mapReviewDecision(decision: RawPullRequestNode["reviewDecision"]): ReviewDecision {
  switch (decision) {
    case "APPROVED": return "approved";
    case "CHANGES_REQUESTED": return "changes_requested";
    case "REVIEW_REQUIRED": return "review_required";
    default: return "none";
  }
}

export function mapPullRequest(raw: RawPullRequestNode): PullRequest {
  const filePaths = (raw.files?.nodes ?? []).map((file) => file.path);
  const { testingEnv, testingEnvReason } = classifyTestingEnvironment(filePaths, raw.body);
  const checkState = raw.commits.nodes[0]?.commit.statusCheckRollup?.state;

  return {
    number: raw.number,
    title: raw.title,
    author: raw.author?.login ?? "ghost",
    authorAvatarUrl: raw.author?.avatarUrl ?? null,
    status: "open",
    description: raw.body,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    commentCount: raw.comments.totalCount,
    totalChanges: raw.additions + raw.deletions,
    filesChanged: raw.changedFiles,
    modules: filePaths.map(moduleId).filter((id): id is string => id !== null),
    assignees: raw.assignees.nodes.map((assignee) => ({ login: assignee.login, avatarUrl: assignee.avatarUrl })),
    labels: (raw.labels?.nodes ?? []).map((label) => ({ name: label.name, color: label.color })),
    reviewDecision: mapReviewDecision(raw.reviewDecision),
    ciStatus: mapCiStatus(checkState),
    testingEnv,
    testingEnvReason,
    githubUrl: raw.url,
    vulnRefs: [],
  };
}
