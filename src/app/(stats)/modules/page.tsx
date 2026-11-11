import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { loadModuleCounts } from "@/lib/stats/module-counts-dataset";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { ModuleTypeChart } from "@/components/stats/module-type-chart";
import { ModuleTypeTable } from "@/components/stats/module-type-table";
import { ModuleTree } from "@/components/stats/module-tree";

export default async function ModulesPage() {
  const [dataset, moduleCounts] = await Promise.all([loadHistoricalDataset(), loadModuleCounts()]);

  return (
    <>
      <StatsPageHeader
        title="Module Stats"
        description={`There are currently ${moduleCounts.totalCount.toLocaleString()} Metasploit modules, broken down by type below.`}
        generatedAt={dataset.fetchedAt}
      />
      <ModuleTypeChart data={moduleCounts.countsByType} />
      <ModuleTypeTable data={moduleCounts.countsByType} />
      <ModuleTree nodes={moduleCounts.tree} />
    </>
  );
}
