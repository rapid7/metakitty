import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { loadModuleCounts } from "@/lib/stats/module-counts-dataset";
import { loadModuleCweDataFromNvd } from "@/lib/stats/module-cwe-nvd-dataset";
import { loadCweNames } from "@/lib/stats/cwe-names-dataset";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { ModuleTypeChart } from "@/components/stats/module-type-chart";
import { ModuleTypeTable } from "@/components/stats/module-type-table";
import { ModuleCveDatesChart } from "@/components/stats/module-cve-dates-chart";
import { ModuleCveYearAccordion } from "@/components/stats/module-cve-year-accordion";
import { ModuleCweYearSection } from "@/components/stats/module-cwe-year-section";
import { ModuleTree } from "@/components/stats/module-tree";

export default async function ModulesPage() {
  const [dataset, moduleCounts, cweFromNvd] = await Promise.all([loadHistoricalDataset(), loadModuleCounts(), loadModuleCweDataFromNvd()]);
  const cweNames = await loadCweNames(cweFromNvd.cweCounts.map((c) => c.cwe));

  return (
    <>
      <StatsPageHeader
        title="Module Stats"
        description={`There are currently ${moduleCounts.totalCount.toLocaleString()} Metasploit modules, broken down by type below.`}
        generatedAt={dataset.fetchedAt}
      />
      <ModuleTypeChart data={moduleCounts.countsByType} />
      <ModuleTypeTable data={moduleCounts.countsByType} />
      <ModuleCweYearSection
        title="CWE trend by year (via NVD)"
        description={`The top 8 CWEs overall, stacked per disclosure year, with everything else collapsed into "Other" — shows whether the mix of weakness types has shifted over time. Hover a CWE below to highlight it above.`}
        data={cweFromNvd.cweCountsByYear}
        allCounts={cweFromNvd.cweCounts}
        cweNames={cweNames}
      />
      <ModuleCveDatesChart data={moduleCounts.cveCountsByYear} />
      <ModuleCveYearAccordion groups={moduleCounts.cveDetailsByYear} />
      <ModuleTree nodes={moduleCounts.tree} />
    </>
  );
}
