import { Fragment } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const METRICS: Record<string, { name: string; values: Record<string, string> }> = {
  AV: {
    name: "Attack vector",
    values: {
      N: "Network — exploitable remotely over a network.",
      A: "Adjacent — requires access to a nearby or shared network.",
      L: "Local — requires local access or local execution.",
      P: "Physical — requires physical access.",
    },
  },
  AC: {
    name: "Attack complexity",
    values: {
      L: "Low — no special conditions beyond the attacker’s control.",
      H: "High — depends on special conditions beyond the attacker’s control.",
    },
  },
  PR: {
    name: "Privileges required",
    values: {
      N: "None — no prior privileges needed.",
      L: "Low — basic user privileges needed.",
      H: "High — significant privileges, such as administrator access, needed before the attack.",
    },
  },
  UI: {
    name: "User interaction",
    values: {
      N: "None — no other user needs to act.",
      R: "Required — another user must participate.",
    },
  },
  S: {
    name: "Scope",
    values: {
      U: "Unchanged — impact stays within the same security authority.",
      C: "Changed — impact crosses a security authority boundary.",
    },
  },
  C: {
    name: "Confidentiality",
    values: { N: "None — no confidentiality impact.", L: "Low — limited data exposure.", H: "High — severe or complete data exposure." },
  },
  I: {
    name: "Integrity",
    values: { N: "None — no integrity impact.", L: "Low — limited unauthorized changes.", H: "High — severe or complete loss of data integrity." },
  },
  A: {
    name: "Availability",
    values: { N: "None — no availability impact.", L: "Low — reduced service availability.", H: "High — severe or complete loss of service." },
  },
};

export function CvssVectorExplanation({ vector }: { vector: string }) {
  const version = /^CVSS:(3\.[01])\//.exec(vector)?.[1];
  const parts = vector.split("/").slice(1).map((part) => {
    const [key, value] = part.split(":");
    return { code: part, name: METRICS[key]?.name, meaning: METRICS[key]?.values[value] };
  });

  if (!version) return <p className="break-all font-mono text-muted-foreground">{vector}</p>;

  const withVersion = [
    { code: `CVSS:${version}`, name: "CVSS version", meaning: `Common Vulnerability Scoring System ${version}. Describes attack requirements and potential impact.` },
    ...parts,
  ];

  return (
    <div className="space-y-1">
      <p className="break-words font-mono text-muted-foreground" aria-label={vector}>
        {withVersion.map(({ code, name, meaning }, index) => (
          <Fragment key={`${code}-${index}`}>
            {index > 0 && <span>/</span>}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={`${code}: ${name ?? "Additional metric"}. ${meaning ?? "See the CVSS specification for its definition."}`}
                  className="cursor-help rounded-sm underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {code}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">
                  {name ?? "Additional metric"} {"·"} {code}
                </p>
                <p>{meaning ?? "See the CVSS specification for its definition."}</p>
              </TooltipContent>
            </Tooltip>
          </Fragment>
        ))}
      </p>
      <details>
        <summary className="cursor-pointer text-primary underline underline-offset-2">What does this CVSS vector mean?</summary>
        <div className="mt-2 space-y-2">
          <p>CVSS {version} (Common Vulnerability Scoring System) describes attack requirements and potential impact. These metrics help explain the severity score.</p>
          <dl className="space-y-2">
            {parts.map(({ code, name, meaning }, index) => (
              <div key={`${code}-${index}`}>
                <dt className="font-semibold">
                  <code>{code}</code>
                  {name && ` · ${name}`}
                </dt>
                <dd className="text-muted-foreground">{meaning ?? "Additional metric; see the CVSS specification for its definition."}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground">This describes potential severity, not the likelihood of an attack or evidence of active exploitation.</p>
          <a
            href={`https://www.first.org/cvss/v${version}/specification-document`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            CVSS {version} specification (new tab)
          </a>
        </div>
      </details>
    </div>
  );
}
