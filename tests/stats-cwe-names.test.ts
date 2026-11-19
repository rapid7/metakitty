import { describe, expect, it } from "vitest";
import { describeCwe } from "../src/lib/stats/cwe-names";

describe("describeCwe", () => {
  it("combines the id and name when a name is given", () => {
    expect(describeCwe("CWE-89", "Improper Neutralization of Special Elements used in an SQL Command")).toBe(
      "CWE-89 — Improper Neutralization of Special Elements used in an SQL Command"
    );
  });

  it("falls back to the bare id when the name is undefined (not yet resolved)", () => {
    expect(describeCwe("CWE-99999", undefined)).toBe("CWE-99999");
  });
});
