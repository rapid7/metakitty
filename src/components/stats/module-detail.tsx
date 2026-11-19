import { Badge } from "@/components/ui/badge";
import { MODULE_TYPES } from "@/lib/stats/module-counts";
import type { ModuleDetail as ModuleDetailData } from "@/lib/stats/module-details";

function NotesList({ label, values }: { label: string; values: string[] | undefined }) {
  if (!values || values.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      <p className="text-sm text-muted-foreground">{values.join(", ")}</p>
    </div>
  );
}

export function ModuleDetail({ module }: { module: ModuleDetailData }) {
  const typeInfo = MODULE_TYPES[module.type];
  const flags = [
    module.check && "Has check",
    module.postAuth && "Post-auth",
    module.defaultCredential && "Default credential",
  ].filter((flag): flag is string => Boolean(flag));

  return (
    <>
      <section className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{typeInfo?.label ?? module.type}</Badge>
        <Badge variant="outline">{module.rankLabel} rank</Badge>
        {module.platform && <Badge variant="outline">{module.platform}</Badge>}
        {module.arch && <Badge variant="outline">{module.arch}</Badge>}
        {module.disclosureDate && (
          <span className="text-sm text-muted-foreground">
            Disclosed <time dateTime={module.disclosureDate}>{module.disclosureDate}</time>
          </span>
        )}
        {flags.map((flag) => (
          <Badge key={flag} variant="destructive">
            {flag}
          </Badge>
        ))}
      </section>

      {module.description && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-foreground">Description</h2>
          <div className="space-y-2 text-sm text-foreground">
            {module.description
              .split(/\n\s*\n/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
        </section>
      )}

      {module.author.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-foreground">Authors</h2>
          <ul className="list-inside list-disc text-sm text-foreground">
            {module.author.map((author) => (
              <li key={author}>{author}</li>
            ))}
          </ul>
        </section>
      )}

      {module.targets && module.targets.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-foreground">Targets</h2>
          <ul className="list-inside list-disc text-sm text-foreground">
            {module.targets.map((target) => (
              <li key={target}>{target}</li>
            ))}
          </ul>
        </section>
      )}

      {module.references.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-foreground">References</h2>
          <ul className="flex flex-wrap gap-2">
            {module.references.map((reference) => (
              <li key={reference.label}>
                {reference.href ? (
                  <a href={reference.href} target="_blank" rel="noreferrer">
                    <Badge variant="outline">{reference.label}</Badge>
                  </a>
                ) : (
                  <Badge variant="secondary">{reference.label}</Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(module.notes.AKA?.length || module.notes.SideEffects?.length || module.notes.Reliability?.length || module.notes.Stability?.length) && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-foreground">Notes</h2>
          <div className="space-y-2">
            <NotesList label="AKA" values={module.notes.AKA} />
            <NotesList label="Side effects" values={module.notes.SideEffects} />
            <NotesList label="Reliability" values={module.notes.Reliability} />
            <NotesList label="Stability" values={module.notes.Stability} />
          </div>
        </section>
      )}
    </>
  );
}
