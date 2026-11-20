"use client";

import { useMemo, useState } from "react";
import { ChevronRight, File, Folder, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { STATS_OWNER } from "@/lib/stats/repos";
import type { ModuleTreeNode } from "@/lib/stats/module-counts";

const MODULES_REPO = "metasploit-framework";
const MODULES_REF = "master";

function moduleUrl(path: string): string {
  return `https://github.com/${STATS_OWNER}/${MODULES_REPO}/blob/${MODULES_REF}/${path}`;
}

// Lines up under a folder row's icon (no chevron on a file row) — ChevronRight (14px) + the gap (6px) before it.
const FILE_ROW_INDENT = "pl-5";

/** Keeps only nodes whose fullname (leaves) matches `query`, pruning branches with no matches and re-summing folder totals to the filtered count. */
function filterTree(node: ModuleTreeNode, query: string): ModuleTreeNode | null {
  if (node.modulePath) {
    return node.fullname?.toLowerCase().includes(query) ? node : null;
  }
  const children = node.children.map((child) => filterTree(child, query)).filter((child): child is ModuleTreeNode => child !== null);
  if (children.length === 0) return null;
  return { ...node, children, total: children.reduce((sum, child) => sum + child.total, 0) };
}

function sumTotals(nodes: ModuleTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + node.total, 0);
}

function TreeNode({ node, forceOpen }: { node: ModuleTreeNode; forceOpen: boolean }) {
  // The full tree can be 8,000+ nodes — mounting every folder's children up front (even collapsed)
  // means that many DOM nodes in the initial render. Deferring a folder's children until it's
  // actually been opened at least once keeps the default render to just the visible rows. Sticky
  // once true so re-collapsing doesn't throw the subtree away and force a remount on reopen.
  const [hasOpened, setHasOpened] = useState(forceOpen);

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
      <details className="group" open={forceOpen || undefined} onToggle={(e) => e.currentTarget.open && setHasOpened(true)}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded py-0.5 select-none hover:bg-muted">
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <Folder className="size-3.5 shrink-0 fill-muted-foreground/25 text-muted-foreground" />
          <span className="font-mono text-foreground">{node.name}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{node.total}</span>
        </summary>
        <ul className="ml-[6.5px] border-l border-border pl-3">
          {(forceOpen || hasOpened) &&
            node.children.map((child) => <TreeNode key={child.name} node={child} forceOpen={forceOpen} />)}
        </ul>
      </details>
    </li>
  );
}

/** Native `<details>`/`<summary>` disclosure tree. A folder's own row (name, icon, total) always renders without client JS; its children only mount once it's actually opened (see TreeNode), so browsing below the top level needs JS — a deliberate trade-off given the tree's size. */
export function ModuleTree({ nodes }: { nodes: ModuleTreeNode[] }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const filteredNodes = useMemo(() => {
    if (!query) return nodes;
    return nodes.map((node) => filterTree(node, query)).filter((node): node is ModuleTreeNode => node !== null);
  }, [nodes, query]);

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">Browse modules</h2>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter modules by path..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {query && (
          <span className="text-sm tabular-nums text-muted-foreground">
            {sumTotals(filteredNodes)} of {sumTotals(nodes)} modules
          </span>
        )}
      </div>
      <div className="rounded-md border bg-muted/20 p-4 text-sm">
        {filteredNodes.length === 0 ? (
          <p className="text-muted-foreground">No modules match &quot;{search}&quot;.</p>
        ) : (
          <ul>
            {filteredNodes.map((node) => (
              <TreeNode key={node.name} node={node} forceOpen={query !== ""} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
