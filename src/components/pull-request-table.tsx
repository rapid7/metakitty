"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, GitPullRequest, Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssigneesList, ChangeScopeBadge, CiBadge, LabelsBadges, ModulesBadges, ReviewBadge, TestingEnvBadge } from "@/components/badges";
import { VulnerabilityEvidence } from "@/components/vulnerability-evidence";
import type { PullRequest } from "@/lib/types";
import type { SortDirection, SortField } from "@/components/dashboard";

const COLUMNS: Array<{ field: SortField; label: string; className?: string }> = [
  { field: "number", label: "#", className: "w-[60px]" },
  { field: "cvss", label: "CVE severity", className: "w-[110px]" },
  { field: "title", label: "Title" },
  { field: "author", label: "Author", className: "w-[200px]" },
  { field: "assignee", label: "Assignees", className: "w-[160px]" },
  { field: "createdAt", label: "Created", className: "w-[100px]" },
  { field: "filesChanged", label: "Files", className: "w-[64px] text-center" },
  { field: "ci", label: "CI", className: "w-[100px]" },
  { field: "review", label: "Review", className: "w-[150px]" },
  { field: "area", label: "Scope", className: "w-[140px]" },
  { field: "testingEnv", label: "Target environment", className: "w-[180px]" },
  { field: "commentCount", label: "\u{1F4AC}", className: "w-[48px] text-center" },
];

function formatRelativeTime(dateString: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateString).getTime()) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1d ago";
  return `${diffDays}d ago`;
}

function SortIcon({ field, current, direction }: { field: SortField; current: SortField; direction: SortDirection }) {
  if (field !== current) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function PullRequestTable({
  pullRequests,
  sortField,
  sortDirection,
  onSort,
}: {
  pullRequests: PullRequest[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead key={column.field} className={`cursor-pointer select-none ${column.className ?? ""}`} onClick={() => onSort(column.field)}>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  {column.field === "cvss" && <Shield className="h-3.5 w-3.5" />}
                  {column.label}
                  <SortIcon field={column.field} current={sortField} direction={sortDirection} />
                </span>
              </TableHead>
            ))}
            <TableHead>Labels</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pullRequests.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length + 1} className="py-16 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <GitPullRequest className="h-8 w-8 text-muted-foreground/50" />
                  <p>No pull requests match these filters.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
          {pullRequests.map((pr) => (
            <TableRow key={pr.number}>
              <TableCell className="tabular-nums text-muted-foreground">
                <a href={pr.githubUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                  {pr.number}
                </a>
              </TableCell>
              <TableCell>
                <VulnerabilityEvidence refs={pr.vulnRefs} />
              </TableCell>
              <TableCell>
                <a href={pr.githubUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">
                  {pr.title}
                </a>
                <ModulesBadges modules={pr.modules} />
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {pr.authorAvatarUrl && <img src={pr.authorAvatarUrl} alt="" className="h-5 w-5 rounded-full" />}
                  {pr.author}
                </span>
              </TableCell>
              <TableCell>
                <AssigneesList assignees={pr.assignees} />
              </TableCell>
              <TableCell className="text-muted-foreground">{formatRelativeTime(pr.createdAt)}</TableCell>
              <TableCell className="text-center tabular-nums text-muted-foreground">{pr.filesChanged}</TableCell>
              <TableCell>
                <CiBadge status={pr.ciStatus} />
              </TableCell>
              <TableCell>
                <ReviewBadge decision={pr.reviewDecision} />
              </TableCell>
              <TableCell>
                <ChangeScopeBadge moduleCount={pr.modules.length} />
              </TableCell>
              <TableCell>
                <TestingEnvBadge env={pr.testingEnv} reason={pr.testingEnvReason} />
              </TableCell>
              <TableCell className="text-center tabular-nums">{pr.commentCount}</TableCell>
              <TableCell>
                <LabelsBadges labels={pr.labels} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
