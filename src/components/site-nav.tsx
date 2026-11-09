"use client";

import { usePathname } from "next/navigation";

/** Mirrors metakitty's original navbar: a "Metasploit Stats" brand plus links out to the docs site and GitHub. */
const NAV_LINKS = [
  { href: "/queue/", label: "Open PR queue" },
  { href: "https://docs.metasploit.com", label: "Metasploit Docs", external: true },
  { href: "https://github.com/rapid7/metasploit-framework", label: "Metasploit on Github", external: true },
];

export function SiteNav() {
  const pathname = usePathname();
  // Everything outside /queue belongs to the dashboard (historical stats) section, which lives at the root.
  const onQueue = pathname.startsWith("/queue");

  return (
    <div className="border-b bg-muted/30">
      <nav aria-label="Site" className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2 text-sm">
        <a href="/" aria-current={onQueue ? undefined : "page"} className={`font-semibold ${onQueue ? "text-muted-foreground hover:text-foreground" : "text-foreground"}`}>
          Metasploit Stats
        </a>
        <ul className="flex items-center gap-4">
          {NAV_LINKS.map((link) => {
            const active = !link.external && pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  aria-current={active ? "page" : undefined}
                  className={active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
