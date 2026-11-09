import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { getRepoSummaries } from "@/lib/stats/repo-summary";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { RepoSummaryTable } from "@/components/stats/repo-summary-table";

export default async function RepositoriesPage() {
  const dataset = await loadHistoricalDataset();
  const repos = getRepoSummaries(dataset.issues);
  return (
    <>
      <StatsPageHeader title="Metasploit Repositories" generatedAt={dataset.fetchedAt} />
      <RepoSummaryTable repos={repos} />
    </>
  );
}
