import type { ReactNode } from "react";
import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { STATS_CATEGORIES } from "@/lib/stats/categories";
import { getWeeklyNewItems } from "@/lib/stats/weekly-new-items";
import { getTopCommitters } from "@/lib/stats/top-committers";
import { StatsNav, type StatsNavItem } from "@/components/stats/stats-nav";
import { TopCommittersTable } from "@/components/stats/top-committers-table";
import { WeeklyNewItemsAccordion, type WeeklyNewItemsGroup } from "@/components/stats/weekly-new-items-accordion";

export default async function StatsLayout({ children }: { children: ReactNode }) {
  const dataset = await loadHistoricalDataset();

  const weeklyGroups: WeeklyNewItemsGroup[] = Object.entries(STATS_CATEGORIES).map(([key, category]) => ({
    key,
    label: category.label,
    items: getWeeklyNewItems(dataset.issues, category.matches),
  }));
  const weeklyCountByKey = Object.fromEntries(weeklyGroups.map((group) => [group.key, group.items.length]));

  const navItems: StatsNavItem[] = [
    { href: "/", label: STATS_CATEGORIES.pullRequests.label, badge: weeklyCountByKey.pullRequests },
    { href: "/bugs/", label: STATS_CATEGORIES.bugs.label, badge: weeklyCountByKey.bugs },
    { href: "/features-and-enhancements/", label: STATS_CATEGORIES.featuresAndEnhancements.label, badge: weeklyCountByKey.featuresAndEnhancements },
    { href: "/repositories/", label: "Metasploit Repositories" },
    { href: "/pull-request-rates/", label: "Pull Requests per Quarter" },
    { href: "/bug-rates/", label: "Bugs per Quarter" },
    { href: "/feature-and-enhancement-rates/", label: "Features and Enhancements per Quarter" },
  ];

  const topCommitters = getTopCommitters(dataset.recentCommitAuthors);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="md:flex md:gap-8">
        <div className="mb-6 md:mb-0 md:w-64 md:flex-shrink-0">
          <StatsNav items={navItems} />
        </div>
        <div className="min-w-0 flex-1">
          {children}
          <TopCommittersTable committers={topCommitters} />
          <WeeklyNewItemsAccordion groups={weeklyGroups} />
        </div>
      </div>
    </div>
  );
}
