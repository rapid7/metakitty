/** "CWE-89 — Improper Neutralization of..." for chart labels/tooltips — falls back to the bare id when `name` isn't resolved (see cwe-names-dataset.ts, which resolves names live rather than from a static snapshot). */
export function describeCwe(cwe: string, name: string | undefined): string {
  return name ? `${cwe} — ${name}` : cwe;
}
