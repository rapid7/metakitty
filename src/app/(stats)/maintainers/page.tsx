import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { DAY_MS, HALF_YEAR_LOOKBACK_DAYS, MONTH_LOOKBACK_DAYS, YEAR_LOOKBACK_DAYS, getMergedByWindows } from "@/lib/stats/merged-by";
import { getMergedByTimeSeries } from "@/lib/stats/merged-by-trend";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { MergedByLeaderboards } from "@/components/stats/merged-by-leaderboards";

export default async function MaintainersPage() {
  const dataset = await loadHistoricalDataset();
  const now = Date.now();
  const windows = getMergedByWindows(dataset.issues, now);
  const since = (days: number) => new Date(now - days * DAY_MS).toISOString();

  return (
    <>
      <StatsPageHeader title="Maintainer Stats" generatedAt={dataset.fetchedAt} />
      <MergedByLeaderboards
        sections={[
          { title: "All time", rows: windows.all, trendSeries: getMergedByTimeSeries(dataset.issues, undefined, now) },
          { title: "Past 30 days", rows: windows.days30, trendSeries: getMergedByTimeSeries(dataset.issues, since(MONTH_LOOKBACK_DAYS), now) },
          { title: "Past 180 days", rows: windows.days180, trendSeries: getMergedByTimeSeries(dataset.issues, since(HALF_YEAR_LOOKBACK_DAYS), now) },
          { title: "Past 365 days", rows: windows.days365, trendSeries: getMergedByTimeSeries(dataset.issues, since(YEAR_LOOKBACK_DAYS), now) },
        ]}
      />
    </>
  );
}
