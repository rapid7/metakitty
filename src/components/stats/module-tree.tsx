import { ChevronRight, File, Folder } from "lucide-react";
import { STATS_OWNER } from "@/lib/stats/repos";
import type { ModuleTreeNode } from "@/lib/stats/module-counts";

const MODULES_REPO = "metasploit-framework";
const MODULES_REF = "master";

function moduleUrl(path: string): string {
  return `https://github.com/${STATS_OWNER}/${MODULES_REPO}/blob/${MODULES_REF}/${path}`;
}

// Lines up under a folder row's icon (no chevron on a file row) — ChevronRight (14px) + the gap (6px) before it.
const FILE_ROW_INDENT = "pl-5";

function TreeNode({ node }: { node: ModuleTreeNode }) {
  if (node.modulePath) {
    return (
      <li className={`flex items-center gap-1.5 rounded py-0.5 ${FILE_ROW_INDENT} hover:bg-muted`}>
        <File className="size-3.5 shrink-0 text-muted-foreground" />
        <a href={moduleUrl(node.modulePath)} target="_blank" rel="noreferrer" className="truncate font-mono text-foreground hover:text-primary hover:underline">
          {node.name}.rb
        </a>
      </li>
    );
  }

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded py-0.5 select-none hover:bg-muted">
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <Folder className="size-3.5 shrink-0 fill-muted-foreground/25 text-muted-foreground" />
          <span className="font-mono text-foreground">{node.name}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{node.total}</span>
        </summary>
        <ul className="ml-[6.5px] border-l border-border pl-3">
          {node.children.map((child) => (
            <TreeNode key={child.name} node={child} />
          ))}
        </ul>
      </details>
    </li>
  );
}

/** Native `<details>`/`<summary>` disclosure tree — works without client JS, fitting this statically-exported site. */
export function ModuleTree({ nodes }: { nodes: ModuleTreeNode[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">Browse modules</h2>
      <div className="rounded-md border bg-muted/20 p-4 text-sm">
        <ul>
          {nodes.map((node) => (
            <TreeNode key={node.name} node={node} />
          ))}
        </ul>
      </div>
    </section>
  );
}
