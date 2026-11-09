import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Assignee, CiStatus, Label, ReviewDecision, TestingEnvironment } from "@/lib/types";
import { nonModuleDescription } from "@/lib/queue-filter";
import { testingEnvironmentLabels } from "@/lib/testing-environment";

const CI_LABELS: Record<CiStatus, string> = { passing: "Passing", failing: "Failing", pending: "Pending", unknown: "Unknown" };
const CI_CLASSES: Record<CiStatus, string> = {
  passing: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
  failing: "border-red-500/50 text-red-600 dark:text-red-400",
  pending: "border-amber-500/50 text-amber-600 dark:text-amber-400",
  unknown: "border-border text-muted-foreground",
};

export function CiBadge({ status }: { status: CiStatus }) {
  return (
    <Badge variant="outline" className={CI_CLASSES[status]}>
      {CI_LABELS[status]}
    </Badge>
  );
}

const REVIEW_LABELS: Record<ReviewDecision, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
  review_required: "Review required",
  none: "Review required",
};
const REVIEW_CLASSES: Record<ReviewDecision, string> = {
  approved: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
  changes_requested: "border-red-500/50 text-red-600 dark:text-red-400",
  review_required: "border-border text-muted-foreground",
  none: "border-border text-muted-foreground",
};

export function ReviewBadge({ decision }: { decision: ReviewDecision }) {
  return (
    <Badge variant="outline" className={REVIEW_CLASSES[decision]}>
      {REVIEW_LABELS[decision]}
    </Badge>
  );
}

export function TestingEnvBadge({ env, reason }: { env: TestingEnvironment; reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="cursor-help whitespace-normal">
          {testingEnvironmentLabels[env]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <p>{reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ChangeScopeBadge({ moduleCount }: { moduleCount: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {moduleCount > 0 ? (
          <Badge variant="outline" className="cursor-help border-teal-500/50 text-teal-600 dark:text-teal-400">
            Module changes
          </Badge>
        ) : (
          <Badge variant="outline" className="cursor-help border-violet-500/50 text-violet-600 dark:text-violet-400">
            Non-module changes
          </Badge>
        )}
      </TooltipTrigger>
      <TooltipContent>
        <p>{moduleCount > 0 ? "Changes module files, including payloads, encoders, and NOPs" : nonModuleDescription}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function moduleColor(module: string): string {
  switch (module.split("/")[0]) {
    case "exploits": return "border-red-500/50 text-red-600 dark:text-red-400";
    case "post": return "border-blue-500/50 text-blue-600 dark:text-blue-400";
    case "auxiliary": return "border-yellow-500/50 text-yellow-700 dark:text-yellow-400";
    case "payloads": return "border-orange-500/50 text-orange-600 dark:text-orange-400";
    case "encoders": return "border-purple-500/50 text-purple-600 dark:text-purple-400";
    case "evasion": return "border-pink-500/50 text-pink-600 dark:text-pink-400";
    case "nops": return "border-gray-400/50 text-gray-500 dark:text-gray-400";
    default: return "border-border text-muted-foreground";
  }
}

export function ModulesBadges({ modules }: { modules: string[] }) {
  if (modules.length === 0) return null;
  const displayed = modules.slice(0, 2);
  const overflow = modules.length - displayed.length;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="mt-1 flex flex-wrap items-center gap-1">
          {displayed.map((module) => (
            <Badge key={module} variant="outline" className={`font-mono ${moduleColor(module)}`}>
              {module}
            </Badge>
          ))}
          {overflow > 0 && <span className="text-xs text-muted-foreground">+{overflow}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="mb-1 font-medium">Modules ({modules.length})</p>
        {modules.map((module) => (
          <p key={module} className="font-mono text-xs">
            {module}
          </p>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

export function LabelsBadges({ labels }: { labels: Label[] }) {
  if (labels.length === 0) return null;
  const displayed = labels.slice(0, 3);
  const overflow = labels.length - displayed.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {displayed.map((label) => (
        <span
          key={label.name}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `#${label.color}26`, color: `#${label.color}`, border: `1px solid #${label.color}80` }}
        >
          {label.name}
        </span>
      ))}
      {overflow > 0 && <span className="text-xs text-muted-foreground">+{overflow}</span>}
    </span>
  );
}

export function AssigneesList({ assignees }: { assignees: Assignee[] }) {
  if (assignees.length === 0) return <span className="text-xs text-muted-foreground">Unassigned</span>;
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {assignees.map((assignee) => (
        <li key={assignee.login} className="flex items-center gap-1 text-xs">
          {assignee.avatarUrl && <img src={assignee.avatarUrl} alt="" className="h-5 w-5 rounded-full" />}
          <span className="font-medium">@{assignee.login}</span>
        </li>
      ))}
    </ul>
  );
}
