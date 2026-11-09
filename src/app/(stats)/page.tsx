import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { STATS_CATEGORIES } from "@/lib/stats/categories";
import { getSteadyStateSeries } from "@/lib/stats/steady-state";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { SteadyStateChart } from "@/components/stats/steady-state-chart";

export default async function OpenPullRequestsPage() {
  const dataset = await loadHistoricalDataset();
  const series = getSteadyStateSeries(dataset.issues, STATS_CATEGORIES.pullRequests.matches);
  return (
    <>
      <StatsPageHeader title={STATS_CATEGORIES.pullRequests.label} generatedAt={dataset.fetchedAt} />
      <SteadyStateChart title={STATS_CATEGORIES.pullRequests.label} data={series} />
    </>
  );
}
