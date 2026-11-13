import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { DAY_MS, HALF_YEAR_LOOKBACK_DAYS, MONTH_LOOKBACK_DAYS, YEAR_LOOKBACK_DAYS, getMergedByWindows } from "@/lib/stats/merged-by";
import { getMergedByTimeSeries } from "@/lib/stats/merged-by-trend";
import { getDaysToLandByYear } from "@/lib/stats/days-to-land-by-year";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { MergedByLeaderboards } from "@/components/stats/merged-by-leaderboards";
import { DaysToLandByYearChart } from "@/components/stats/days-to-land-by-year-chart";
import { DaysToLandByYearTable } from "@/components/stats/days-to-land-by-year-table";

export default async function MaintainersPage() {
  const dataset = await loadHistoricalDataset();
  const now = Date.now();
  const windows = getMergedByWindows(dataset.issues, now);
  const daysToLandByYear = getDaysToLandByYear(dataset.issues);
  const since = (days: number) => new Date(now - days * DAY_MS).toISOString();

  return (
    <>
      <StatsPageHeader
        title="Maintainer Stats"
        description="Who merged the most pull requests across Metasploit's repos — the maintainers keeping the review queue moving."
        generatedAt={dataset.fetchedAt}
      />
      <MergedByLeaderboards
        sections={[
          { title: "All time", rows: windows.all, trendSeries: getMergedByTimeSeries(dataset.issues, undefined, now) },
          { title: "Past 30 days", rows: windows.days30, trendSeries: getMergedByTimeSeries(dataset.issues, since(MONTH_LOOKBACK_DAYS), now) },
          { title: "Past 180 days", rows: windows.days180, trendSeries: getMergedByTimeSeries(dataset.issues, since(HALF_YEAR_LOOKBACK_DAYS), now) },
          { title: "Past 365 days", rows: windows.days365, trendSeries: getMergedByTimeSeries(dataset.issues, since(YEAR_LOOKBACK_DAYS), now) },
        ]}
      />
      <StatsPageHeader
        title="Average Days to Land a PR"
        description="How quickly a pull request typically goes from open to merged, averaged per calendar year — shows whether review turnaround is getting faster or slower over time."
      />
      <DaysToLandByYearChart data={daysToLandByYear} />
      <DaysToLandByYearTable data={daysToLandByYear} />
    </>
  );
}
