import type { CiStatus, PullRequest, ReviewDecision, TestingEnvironment } from "./types";
import { isRapid7 } from "./queue-filter";
import { testingEnvironmentLabels } from "./testing-environment";

// Shared monthly bucketing for the creation-date histograms: bins span equal month ranges,
// capped at 24 bins total so a multi-year PR history doesn't render one bar per month.
function monthlyBinSkeleton(dates: number[]) {
  const monthIndex = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.getUTCFullYear() * 12 + date.getUTCMonth();
  };
  const first = monthIndex(Math.min(...dates));
  const last = monthIndex(Math.max(...dates));
  const monthsPerBin = Math.ceil((last - first + 1) / 24);
  const monthDate = (month: number) => new Date(Date.UTC(Math.floor(month / 12), month % 12, 1));
  const bins = Array.from({ length: Math.ceil((last - first + 1) / monthsPerBin) }, (_, index) => ({
    start: monthDate(first + index * monthsPerBin).toISOString(),
    end: monthDate(first + (index + 1) * monthsPerBin).toISOString(),
  }));
  const binIndexFor = (date: number) => Math.floor((monthIndex(date) - first) / monthsPerBin);
  return { bins, binIndexFor };
}

export function getCreationHistogram(pullRequests: PullRequest[]) {
  const entries = pullRequests
    .map((pr) => ({ date: Date.parse(pr.createdAt), rapid7: isRapid7(pr.author) }))
    .filter(({ date }) => Number.isFinite(date));
  if (!entries.length) return [];
  const { bins: skeleton, binIndexFor } = monthlyBinSkeleton(entries.map(({ date }) => date));
  const bins = skeleton.map((bin) => ({ ...bin, count: 0, community: 0, rapid7: 0 }));
  for (const { date, rapid7 } of entries) {
    const bin = bins[binIndexFor(date)];
    bin.count++;
    bin[rapid7 ? "rapid7" : "community"]++;
  }
  return bins;
}

// A shared PR counts toward every one of its assignees (same convention as getAssignmentStats),
// so a bin's byLogin values can sum higher than its count — that's expected, not a bug.
export function getAssignmentCreationHistogram(pullRequests: PullRequest[]) {
  const entries = pullRequests
    .map((pr) => ({ date: Date.parse(pr.createdAt), logins: new Set(pr.assignees.map((assignee) => assignee.login)) }))
    .filter(({ date }) => Number.isFinite(date));
  if (!entries.length) return { bins: [], logins: [] as string[] };
  const { bins: skeleton, binIndexFor } = monthlyBinSkeleton(entries.map(({ date }) => date));
  const bins = skeleton.map((bin) => ({ ...bin, count: 0, byLogin: {} as Record<string, number> }));
  const logins = [...new Set(entries.flatMap(({ logins }) => [...logins]))].sort();
  for (const { date, logins: prLogins } of entries) {
    const bin = bins[binIndexFor(date)];
    bin.count++;
    const keys = prLogins.size ? prLogins : new Set(["unassigned"]);
    for (const key of keys) bin.byLogin[key] = (bin.byLogin[key] ?? 0) + 1;
  }
  return { bins, logins };
}

// Fixed day-range buckets (not calendar-aligned, unlike getCreationHistogram): age shifts every
// day a PR stays open, so there's no stable "bin" to anchor to besides elapsed time from now.
const AGE_BUCKET_BOUNDARIES = [0, 7, 30, 90, 180, 365, Infinity];

function formatAgeBucketLabel(minDays: number, maxDays: number): string {
  return maxDays === Infinity ? `${minDays}+ days` : `${minDays}–${maxDays - 1} days`;
}

export function getAgeHistogram(pullRequests: PullRequest[], now = Date.now()) {
  const bins = AGE_BUCKET_BOUNDARIES.slice(0, -1).map((minDays, index) => {
    const maxDays = AGE_BUCKET_BOUNDARIES[index + 1];
    return {
      minDays,
      maxDays: Number.isFinite(maxDays) ? maxDays : null,
      label: formatAgeBucketLabel(minDays, maxDays),
      count: 0,
      community: 0,
      rapid7: 0,
    };
  });
  for (const pr of pullRequests) {
    const created = Date.parse(pr.createdAt);
    if (!Number.isFinite(created)) continue;
    const ageDays = Math.max(0, now - created) / 86_400_000;
    const bin = bins.find((b) => ageDays >= b.minDays && (b.maxDays === null || ageDays < b.maxDays)) ?? bins[bins.length - 1];
    bin.count++;
    bin[isRapid7(pr.author) ? "rapid7" : "community"]++;
  }
  return bins;
}

export function getQueueStats(pullRequests: PullRequest[], now = Date.now()) {
  const ages = pullRequests
    .map((pr) => Math.max(0, (now - new Date(pr.createdAt).getTime()) / 86_400_000))
    .filter(Number.isFinite);
  const research = pullRequests.filter((pr) => pr.modules.length > 0).length;

  const testing = Object.fromEntries(
    Object.keys(testingEnvironmentLabels).map((env) => [env, 0])
  ) as Record<TestingEnvironment, number>;
  const ci: Record<CiStatus, number> = { passing: 0, failing: 0, pending: 0, unknown: 0 };
  const review: Record<ReviewDecision, number> = { approved: 0, changes_requested: 0, review_required: 0, none: 0 };
  for (const pr of pullRequests) {
    testing[pr.testingEnv]++;
    ci[pr.ciStatus]++;
    review[pr.reviewDecision]++;
  }

  return {
    total: pullRequests.length,
    authors: new Set(pullRequests.map((pr) => pr.author)).size,
    rapid7: pullRequests.filter((pr) => isRapid7(pr.author)).length,
    community: pullRequests.filter((pr) => !isRapid7(pr.author)).length,
    unassigned: pullRequests.filter((pr) => pr.assignees.length === 0).length,
    averageAge: ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0,
    oldestAge: ages.length ? Math.max(...ages) : 0,
    olderThan30Days: ages.filter((age) => age >= 30).length,
    research,
    engineering: pullRequests.length - research,
    testing,
    ci,
    review,
  };
}

export function getAssignmentStats(pullRequests: PullRequest[]) {
  const counts = new Map<string, number>();
  let assigned = 0;
  let shared = 0;
  for (const pr of pullRequests) {
    const logins = new Set(pr.assignees.map((assignee) => assignee.login));
    if (logins.size) assigned++;
    if (logins.size > 1) shared++;
    for (const login of logins) counts.set(login, (counts.get(login) ?? 0) + 1);
  }
  return {
    assigned,
    unassigned: pullRequests.length - assigned,
    coverage: pullRequests.length ? Math.round((assigned / pullRequests.length) * 100) : 0,
    shared,
    people: [...counts]
      .map(([login, count]) => ({ login, count }))
      .sort((a, b) => b.count - a.count || a.login.localeCompare(b.login)),
  };
}

export function getLabelCounts(pullRequests: PullRequest[]) {
  const counts = new Map<string, { name: string; color: string; count: number }>();
  for (const pr of pullRequests) {
    for (const label of pr.labels) {
      const existing = counts.get(label.name);
      counts.set(label.name, { name: label.name, color: label.color, count: (existing?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
