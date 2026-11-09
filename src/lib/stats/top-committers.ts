export interface TopCommitter {
  author: string;
  count: number;
}

const DEFAULT_EXCLUDED = ["msjenkins-r7"];

/** Aggregates commit counts per author (already windowed to the last 30 days by the fetch layer), excluding the CI bot, sorted desc. */
export function getTopCommitters(recentCommitAuthors: Array<{ author: string }>, excluded: string[] = DEFAULT_EXCLUDED): TopCommitter[] {
  const counts = new Map<string, number>();
  for (const { author } of recentCommitAuthors) {
    if (excluded.includes(author)) continue;
    counts.set(author, (counts.get(author) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
}
