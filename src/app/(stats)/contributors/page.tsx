import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { STATS_CATEGORIES } from "@/lib/stats/categories";
import { getSteadyStateSeries } from "@/lib/stats/steady-state";
import { getQuarterlySeries } from "@/lib/stats/quarterly";
import { DAY_MS, HALF_YEAR_LOOKBACK_DAYS, MONTH_LOOKBACK_DAYS, YEAR_LOOKBACK_DAYS } from "@/lib/stats/actor-counts";
import { getContributorWindows } from "@/lib/stats/contributor-by";
import { getContributorTimeSeries } from "@/lib/stats/contributor-trend";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { SteadyStateChart } from "@/components/stats/steady-state-chart";
import { QuarterlyRateChart } from "@/components/stats/quarterly-rate-chart";
import { MergedByLeaderboards } from "@/components/stats/merged-by-leaderboards";

const PULL_REQUEST_RATES_TITLE = "Pull Requests per Quarter";

export default async function ContributorsPage() {
  const dataset = await loadHistoricalDataset();
  const now = Date.now();
  const windows = getContributorWindows(dataset.issues, now);
  const since = (days: number) => new Date(now - days * DAY_MS).toISOString();
  const openPullRequestsSeries = getSteadyStateSeries(dataset.issues, STATS_CATEGORIES.pullRequests.matches);
  const pullRequestRatesSeries = getQuarterlySeries(dataset.issues, STATS_CATEGORIES.pullRequests.matches);

  return (
    <>
      <StatsPageHeader title={STATS_CATEGORIES.pullRequests.label} generatedAt={dataset.fetchedAt} />
      <SteadyStateChart title={STATS_CATEGORIES.pullRequests.label} data={openPullRequestsSeries} />
      <QuarterlyRateChart title={PULL_REQUEST_RATES_TITLE} data={pullRequestRatesSeries} />
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
    </>
  );
}
