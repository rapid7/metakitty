import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { ModuleCweCount } from "@/lib/stats/module-counts";
import { describeCwe } from "@/lib/stats/cwe-names";

// One column, not merged-by-table.tsx's 5 — "CWE-89 — Improper Neutralization of..." runs much
// longer than a GitHub login, so even 3 columns wrapped/clipped badly.
const COLUMNS = 1;

function mitreUrl(cwe: string): string {
  return `https://cwe.mitre.org/data/definitions/${cwe.replace(/^CWE-/, "")}.html`;
}

/** Mirrors merged-by-table.tsx's scrollable, hoverable grid — every CWE's total count instead of every merger's. */
export function ModuleCweTable({
  rows,
  cweNames,
  onCweHover,
}: {
  rows: ModuleCweCount[];
  cweNames: Record<string, string>;
  onCweHover?: (cwe: string | null) => void;
}) {
  if (rows.length === 0) return null;
  const chunks: ModuleCweCount[][] = [];
  for (let i = 0; i < rows.length; i += COLUMNS) chunks.push(rows.slice(i, i + COLUMNS));

  return (
    <div className="max-h-96 overflow-y-auto rounded-md border">
      <Table>
        <TableBody>
          {chunks.map((chunk, index) => (
            <TableRow key={index}>
              {chunk.map(({ cwe, count }) => (
                <TableCell key={cwe}>
                  <a
                    href={mitreUrl(cwe)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 text-muted-foreground hover:text-foreground hover:underline"
                    onMouseEnter={() => onCweHover?.(cwe)}
                    onMouseLeave={() => onCweHover?.(null)}
                    onFocus={() => onCweHover?.(cwe)}
                    onBlur={() => onCweHover?.(null)}
                  >
                    <span className="truncate">{describeCwe(cwe, cweNames[cwe])}</span>
                    <span className="shrink-0 tabular-nums">({count})</span>
                  </a>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
