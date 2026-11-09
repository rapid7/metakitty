import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { STATS_CATEGORIES } from "@/lib/stats/categories";
import { getQuarterlySeries } from "@/lib/stats/quarterly";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { QuarterlyRateChart } from "@/components/stats/quarterly-rate-chart";

const TITLE = "Bugs per Quarter";

export default async function BugRatesPage() {
  const dataset = await loadHistoricalDataset();
  const series = getQuarterlySeries(dataset.issues, STATS_CATEGORIES.bugs.matches);
  return (
    <>
      <StatsPageHeader title={TITLE} generatedAt={dataset.fetchedAt} />
      <QuarterlyRateChart title={TITLE} data={series} />
    </>
  );
}
