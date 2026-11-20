import { describe, expect, it } from "vitest";
import { extractCwes } from "../src/lib/vuln/nvd-weaknesses";

describe("extractCwes", () => {
  it("returns [] for missing or non-array input", () => {
    expect(extractCwes(undefined)).toEqual([]);
    expect(extractCwes(null)).toEqual([]);
    expect(extractCwes("CWE-89")).toEqual([]);
  });

  it("extracts a real CWE id from a Primary entry", () => {
    const weaknesses = [{ source: "nvd@nist.gov", type: "Primary", description: [{ lang: "en", value: "CWE-89" }] }];
    expect(extractCwes(weaknesses)).toEqual(["CWE-89"]);
  });

  it("ignores placeholder NVD-CWE-* values that mean 'not classified'", () => {
    const weaknesses = [{ source: "nvd@nist.gov", type: "Primary", description: [{ lang: "en", value: "NVD-CWE-noinfo" }] }];
    expect(extractCwes(weaknesses)).toEqual([]);
  });

  it("prefers Primary entries over Secondary ones when both are present", () => {
    const weaknesses = [
      { source: "nvd@nist.gov", type: "Primary", description: [{ lang: "en", value: "CWE-94" }] },
      { source: "someorg", type: "Secondary", description: [{ lang: "en", value: "CWE-119" }] },
    ];
    expect(extractCwes(weaknesses)).toEqual(["CWE-94"]);
  });

  it("falls back to Secondary entries when there's no Primary one", () => {
    const weaknesses = [{ source: "someorg", type: "Secondary", description: [{ lang: "en", value: "CWE-119" }] }];
    expect(extractCwes(weaknesses)).toEqual(["CWE-119"]);
  });

  it("dedupes repeated CWE values across entries", () => {
    const weaknesses = [
      { type: "Primary", description: [{ lang: "en", value: "CWE-89" }] },
      { type: "Primary", description: [{ lang: "en", value: "CWE-89" }] },
    ];
    expect(extractCwes(weaknesses)).toEqual(["CWE-89"]);
  });
});
