"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { MergedByCount } from "@/lib/stats/merged-by";

const COLUMNS = 5;
// An "All time" window can have 1,000+ contributors — rendering every one up front means that
// many simultaneous avatar <img> requests on first load. Capped the same as MergedByChart's
// top-N + "view all" toggle, just with a larger default since rows here are far cheaper than bars.
const TOP_N = 30;

export function MergedByTable({ rows, onLoginHover }: { rows: MergedByCount[]; onLoginHover?: (login: string | null) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;

  const isTruncated = rows.length > TOP_N;
  const shownRows = expanded ? rows : rows.slice(0, TOP_N);
  const chunks: MergedByCount[][] = [];
  for (let i = 0; i < shownRows.length; i += COLUMNS) chunks.push(shownRows.slice(i, i + COLUMNS));

  return (
    <div className="mb-3">
      <div className="max-h-96 overflow-y-auto rounded-md border">
        <Table>
          <TableBody>
            {chunks.map((chunk, index) => (
              <TableRow key={index}>
                {chunk.map(({ login, count, avatarUrl }) => (
                  <TableCell key={login}>
                    <a
                      href={`https://github.com/${login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline"
                      onMouseEnter={() => onLoginHover?.(login)}
                      onMouseLeave={() => onLoginHover?.(null)}
                      onFocus={() => onLoginHover?.(login)}
                      onBlur={() => onLoginHover?.(null)}
                    >
                      {avatarUrl && <img src={avatarUrl} alt="" className="h-5 w-5 rounded-full" loading="lazy" />}
                      {login} <span className="tabular-nums">({count})</span>
                    </a>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {isTruncated && (
        <Button variant="link" size="sm" className="px-0" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      )}
    </div>
  );
}
