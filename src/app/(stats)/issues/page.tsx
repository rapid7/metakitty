import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { STATS_CATEGORIES } from "@/lib/stats/categories";
import { getSteadyStateSeries } from "@/lib/stats/steady-state";
import { getQuarterlySeries } from "@/lib/stats/quarterly";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { SteadyStateChart } from "@/components/stats/steady-state-chart";
import { QuarterlyRateChart } from "@/components/stats/quarterly-rate-chart";

const BUG_RATES_TITLE = "Bugs per Quarter";
const FEATURE_RATES_TITLE = "Features and Enhancements per Quarter";

export default async function IssueStatsPage() {
  const dataset = await loadHistoricalDataset();

  const bugsSteadyState = getSteadyStateSeries(dataset.issues, STATS_CATEGORIES.bugs.matches);
  const bugsQuarterly = getQuarterlySeries(dataset.issues, STATS_CATEGORIES.bugs.matches);
  const featuresSteadyState = getSteadyStateSeries(dataset.issues, STATS_CATEGORIES.featuresAndEnhancements.matches);
  const featuresQuarterly = getQuarterlySeries(dataset.issues, STATS_CATEGORIES.featuresAndEnhancements.matches);

  return (
    <>
      <StatsPageHeader
        title="Issue Stats"
        description="Bug and feature/enhancement backlogs and filing rates across Metasploit's repos."
        generatedAt={dataset.fetchedAt}
      />
      <QuarterlyRateChart title={BUG_RATES_TITLE} data={bugsQuarterly} />
      <SteadyStateChart title={STATS_CATEGORIES.bugs.label} data={bugsSteadyState} />
      <QuarterlyRateChart title={FEATURE_RATES_TITLE} data={featuresQuarterly} />
      <SteadyStateChart title={STATS_CATEGORIES.featuresAndEnhancements.label} data={featuresSteadyState} />
    </>
  );
}
