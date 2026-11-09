"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Maximize2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RepoSummary } from "@/lib/stats/repo-summary";

export function RepoSummaryTable({ repos }: { repos: RepoSummary[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filteredRepos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? repos.filter((repo) => repo.repo.toLowerCase().includes(query)) : repos;
  }, [repos, search]);

  const totalOpen = repos.reduce((sum, repo) => sum + repo.openPrs.length, 0);
  const reposWithOpenPrs = repos.filter((repo) => repo.openPrs.length > 0).length;

  const openDetailedView = (repo: string) => router.push(`/queue/${repo}/`);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter repos by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {filteredRepos.length} of {repos.length} repos · {reposWithOpenPrs} with open PRs · {totalOpen} open PRs total
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Repo</TableHead>
              <TableHead className="w-[100px] text-right">Open</TableHead>
              <TableHead className="w-[100px] text-right">Closed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRepos.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-16 text-center text-muted-foreground">
                  No repos match &quot;{search}&quot;.
                </TableCell>
              </TableRow>
            )}
            {filteredRepos.map((repo) => {
              const hasOpenPrs = repo.openPrs.length > 0;
              return (
                <TableRow
                  key={repo.repo}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetailedView(repo.repo)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    openDetailedView(repo.repo);
                  }}
                  className="cursor-pointer select-none"
                >
                  <TableCell className="font-mono">
                    <span className="flex items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={`/queue/${repo.repo}/`}
                            aria-label={`Open the detailed PR queue for ${repo.repo}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Maximize2 className="size-4" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>Detailed view: open the full PR queue</TooltipContent>
                      </Tooltip>
                      {repo.repo}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Badge variant="outline" className={hasOpenPrs ? "border-primary/50 text-primary" : "border-transparent text-muted-foreground"}>
                      {repo.openPrs.length}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{repo.closedPrs.length}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
