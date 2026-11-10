import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ModuleTypeCount } from "@/lib/stats/module-counts";

export function ModuleTypeTable({ data }: { data: ModuleTypeCount[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">Module types</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px] text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.type}>
                <TableCell className="font-medium whitespace-nowrap">{row.label}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{row.description}</TableCell>
                <TableCell className="text-right tabular-nums">{row.count.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
