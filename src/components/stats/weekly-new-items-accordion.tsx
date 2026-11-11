"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { WeeklyNewItem } from "@/lib/stats/weekly-new-items";

export interface WeeklyNewItemsGroup {
  key: string;
  label: string;
  items: WeeklyNewItem[];
}

export function WeeklyNewItemsAccordion({ groups }: { groups: WeeklyNewItemsGroup[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold text-foreground">Top items this last week</h2>
      <Accordion type="multiple" className="rounded-md border px-3">
        {groups.map((group) => (
          <AccordionItem key={group.key} value={group.key}>
            <AccordionTrigger>
              New {group.label} <span className="ml-2 text-muted-foreground">({group.items.length})</span>
            </AccordionTrigger>
            <AccordionContent>
              {group.items.length === 0 ? (
                <p className="text-muted-foreground">Nothing new this week.</p>
              ) : (
                <ul className="space-y-1.5">
                  {group.items.map((item) => (
                    <li key={`${item.project}#${item.number}`} className="flex flex-wrap items-baseline justify-between gap-2">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
                        {item.title}
                      </a>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {item.project} · {item.reporter} · {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
