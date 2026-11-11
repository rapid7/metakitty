import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { TopCommitter } from "@/lib/stats/top-committers";

const COLUMNS = 5;

export function TopCommittersTable({ committers }: { committers: TopCommitter[] }) {
  if (committers.length === 0) return null;
  const rows: TopCommitter[][] = [];
  for (let i = 0; i < committers.length; i += COLUMNS) rows.push(committers.slice(i, i + COLUMNS));

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">Top committers this last month</h2>
      <div className="rounded-md border">
        <Table>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                {row.map(({ author, count }) => (
                  <TableCell key={author} className="text-muted-foreground">
                    {author} <span className="tabular-nums">({count})</span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
