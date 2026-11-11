import { Dashboard } from "@/components/dashboard";
import { loadOpenPullRequestCounts, loadPullRequestsForRepo } from "@/lib/queue-data";
import { PRIMARY_REPO, STATS_OWNER, STATS_REPOS } from "@/lib/stats/repos";

export function generateStaticParams() {
  // Fixture builds only ever render the primary repo: the fixture has no per-repo content, so
  // generating all ~34 routes from it would just be ~34 copies of the same page.
  const repos = process.env.FIXTURE_DATA === "1" ? [PRIMARY_REPO] : STATS_REPOS;
  return repos.map((repo) => ({ repo }));
}

export default async function Page({ params }: { params: Promise<{ repo: string }> }) {
  const { repo } = await params;
  const [pullRequests, repoPrCounts] = await Promise.all([
    loadPullRequestsForRepo(STATS_OWNER, repo),
    loadOpenPullRequestCounts(STATS_OWNER, STATS_REPOS),
  ]);
  const generatedAt = new Date().toISOString();
  return (
    <Dashboard
      owner={STATS_OWNER}
      repo={repo}
      repos={STATS_REPOS}
      repoPrCounts={repoPrCounts}
      pullRequests={pullRequests}
      generatedAt={generatedAt}
    />
  );
}
