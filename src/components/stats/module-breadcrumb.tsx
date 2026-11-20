import Link from "next/link";

/** Every prefix of `slugSegments` is its own static /modules/<path>/ page (a folder browsing page, or the final leaf's module page), so every segment but the last links there. */
export function ModuleBreadcrumb({ slugSegments }: { slugSegments: string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link href="/modules/" className="hover:text-foreground hover:underline">
        Modules
      </Link>
      {slugSegments.map((segment, index) => {
        const isLast = index === slugSegments.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            <span className="text-muted-foreground/50">/</span>
            {isLast ? (
              <span className="font-medium text-foreground">{segment}</span>
            ) : (
              <Link href={`/modules/${slugSegments.slice(0, index + 1).join("/")}/`} className="hover:text-foreground hover:underline">
                {segment}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
