import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { MergedByCount } from "@/lib/stats/merged-by";

const COLUMNS = 5;

export function MergedByTable({ rows, onLoginHover }: { rows: MergedByCount[]; onLoginHover?: (login: string | null) => void }) {
  if (rows.length === 0) return null;
  const chunks: MergedByCount[][] = [];
  for (let i = 0; i < rows.length; i += COLUMNS) chunks.push(rows.slice(i, i + COLUMNS));

  return (
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
                    {avatarUrl && <img src={avatarUrl} alt="" className="h-5 w-5 rounded-full" />}
                    {login} <span className="tabular-nums">({count})</span>
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
