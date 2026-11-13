"use client";

import { useState } from "react";
import { MergedByChart } from "@/components/stats/merged-by-chart";
import { MergedByTable } from "@/components/stats/merged-by-table";
import { toMergedByCount, type ContributorInfo } from "@/lib/stats/contributors";

export interface CommitContributorsSection {
  title: string;
  rows: ContributorInfo[];
}

function CommitContributorsWindowSection({ title, rows }: CommitContributorsSection) {
  const [highlightedLogin, setHighlightedLogin] = useState<string | null>(null);
  if (rows.length === 0) return null;
  const mapped = rows.map(toMergedByCount);

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
      <MergedByChart rows={mapped} highlightedLogin={highlightedLogin} barLabel="Commits" itemLabel="contributors" />
      <MergedByTable rows={mapped} onLoginHover={setHighlightedLogin} />
    </section>
  );
}

/** Commit-count leaderboards (GitHub's native per-repo contributor graph), as a counterpart to the merged-PR-authored leaderboards above — the two can diverge sharply for contributors whose history predates the PR workflow. */
export function CommitContributorsLeaderboards({ sections }: { sections: CommitContributorsSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <CommitContributorsWindowSection key={section.title} title={section.title} rows={section.rows} />
      ))}
    </>
  );
}
