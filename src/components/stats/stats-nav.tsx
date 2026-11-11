"use client";

import { usePathname } from "next/navigation";

export interface StatsNavItem {
  href: string;
  label: string;
  /** "N since last week" badge count, shown on the 3 steady-state pages only. */
  badge?: number;
}

/** Ignores a trailing slash so this doesn't depend on exactly how usePathname() formats the current route. */
function withoutTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

// Plain <a> tags don't get next.config.ts's basePath applied automatically (unlike next/link).
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function StatsNav({ items }: { items: StatsNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Stats pages" className="mb-6 flex flex-col gap-1 text-sm">
      {items.map((item) => {
        const active = withoutTrailingSlash(pathname) === withoutTrailingSlash(item.href);
        return (
          <a
            key={item.href}
            href={`${BASE_PATH}${item.href}`}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-2 rounded-md px-3 py-1.5 ${active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary">{item.badge} since last week</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
