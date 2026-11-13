import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DaysToLandYear } from "@/lib/stats/days-to-land-by-year";

export function DaysToLandByYearTable({ data }: { data: DaysToLandYear[] }) {
  if (data.length === 0) return null;

  return (
    <div className="mt-3 max-h-96 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead className="text-right">PRs merged</TableHead>
            <TableHead className="text-right">Avg days to land</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(({ year, count, averageDays }) => (
            <TableRow key={year}>
              <TableCell className="tabular-nums">{year}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{count}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{averageDays.toFixed(1)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
