import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { loadContributorsDataset } from "@/lib/stats/contributors-dataset";
import { STATS_CATEGORIES } from "@/lib/stats/categories";
import { getSteadyStateSeries } from "@/lib/stats/steady-state";
import { DAY_MS, HALF_YEAR_LOOKBACK_DAYS, MONTH_LOOKBACK_DAYS, YEAR_LOOKBACK_DAYS } from "@/lib/stats/actor-counts";
import { getContributorWindows } from "@/lib/stats/contributor-by";
import { getContributorTimeSeries } from "@/lib/stats/contributor-trend";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { SteadyStateChart } from "@/components/stats/steady-state-chart";
import { MergedByLeaderboards } from "@/components/stats/merged-by-leaderboards";
import { CommitContributorsLeaderboards } from "@/components/stats/commit-contributors-leaderboards";

export default async function ContributorsPage() {
  // Sequential, not Promise.all: each of these is already an expensive, highly-concurrent live
  // fetch against the same GitHub token (35-repo GraphQL history vs. ~700 REST profile lookups) —
  // running them at the same time competes for the same rate limit and risks tipping a transient
  // failure past the retry budget (see next.config.ts's `cpus: 1` comment for the same concern
  // across pages).
  const dataset = await loadHistoricalDataset();
  const contributorsDataset = await loadContributorsDataset();
  const now = Date.now();
  const windows = getContributorWindows(dataset.issues, now);
  const since = (days: number) => new Date(now - days * DAY_MS).toISOString();
  const openPullRequestsSeries = getSteadyStateSeries(dataset.issues, STATS_CATEGORIES.pullRequests.matches);

  return (
    <>
      <StatsPageHeader title={STATS_CATEGORIES.pullRequests.label} generatedAt={dataset.fetchedAt} />
      <SteadyStateChart title={STATS_CATEGORIES.pullRequests.label} data={openPullRequestsSeries} />
      <StatsPageHeader
        title="Contributor Stats"
        description="Who authored the most merged pull requests across Metasploit's repos — the people who created the most pull requests."
        generatedAt={dataset.fetchedAt}
      />
      <MergedByLeaderboards
        barLabel="Opened PRs"
        itemLabel="contributors"
        sections={[
          { title: "All time", rows: windows.all, trendSeries: getContributorTimeSeries(dataset.issues, undefined, now) },
          { title: "Past 30 days", rows: windows.days30, trendSeries: getContributorTimeSeries(dataset.issues, since(MONTH_LOOKBACK_DAYS), now) },
          { title: "Past 180 days", rows: windows.days180, trendSeries: getContributorTimeSeries(dataset.issues, since(HALF_YEAR_LOOKBACK_DAYS), now) },
          { title: "Past 365 days", rows: windows.days365, trendSeries: getContributorTimeSeries(dataset.issues, since(YEAR_LOOKBACK_DAYS), now) },
        ]}
      />
      <StatsPageHeader
        title="Commit Contributors"
        description="Who has the most commits across Metasploit's repos, via GitHub's own per-repo contributor graph. This counts every commit, not just ones that went through a pull request someone else merged — so it can rank very differently from the leaderboards above for contributors whose history predates the PR workflow."
        generatedAt={contributorsDataset.fetchedAt}
      />
      <CommitContributorsLeaderboards
        sections={[
          { title: "All time", rows: contributorsDataset.all },
          { title: "Past 30 days", rows: contributorsDataset.month },
          { title: "Past 365 days", rows: contributorsDataset.year },
        ]}
      />
    </>
  );
}
