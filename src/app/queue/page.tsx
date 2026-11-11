import Link from "next/link";
import { PRIMARY_REPO, STATS_OWNER, STATS_REPOS } from "@/lib/stats/repos";

export default function QueueIndexPage() {
  const otherRepos = STATS_REPOS.filter((repo) => repo !== PRIMARY_REPO);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Open PR queues</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Every {STATS_OWNER} repo below gets the same triage queue: sortable/filterable PR table,
        CI and review status, assignee breakdown, and search. Module scope, inferred testing
        environment, and CVE/CVSS evidence are specific to {STATS_OWNER}/{PRIMARY_REPO}&apos;s
        exploit/auxiliary/post module layout, so those will read as empty or &quot;framework&quot;
        on other repos.
      </p>
      <ul className="space-y-2">
        <li>
          <Link href={`/queue/${PRIMARY_REPO}/`} className="text-lg font-semibold text-primary underline underline-offset-4">
            {STATS_OWNER}/{PRIMARY_REPO}
          </Link>
          <span className="ml-2 text-xs text-muted-foreground">flagship repo</span>
        </li>
        {otherRepos.map((repo) => (
          <li key={repo}>
            <Link href={`/queue/${repo}/`} className="text-primary underline underline-offset-4">
              {STATS_OWNER}/{repo}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
